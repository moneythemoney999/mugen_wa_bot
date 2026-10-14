/* */

//les imports
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import { traduire } from '../outils/langue.js';

//congiguration des LIMITES
const limite_utilisation = {
	bot: 50,
	admins: 5,
	membres: 3,
};

//logique d'export
export default {
	nom: "xanti_unique",
	description: "Débloque les messages en vue unique.",
	categorie: "Groupes && Privé",
	infos: `*Pour l'utiliser peut importe l'endroit il faut répondre au média souhaité et il faut que se soit vraiment un message en vue unique*.
\`La commande à aussi un argument *prive* lui qui envera le message debloqué a soit meme au lieu du chat actuel.\`

> _Il ya aussi une limited'utilisation par jour dans les groupes \`${limite_utilisation.admins}\` pour les admin, \`${limite_utilisation.membres}\` pour ceux qui ne sont pas admin et \`${limite_utilisation.bot}\` pour le bot lui même_.

> *Et en privé seul le bot peut l'utiliser si l'interlocuteur essaie ~il sera bloqué~*.`,

	execute: async ({ connexion, message, args, nom_session }) => {
		const jid = message.key.remoteJid;
		const est_groupe = jid.endsWith('@g.us');
		const est_prive_demande = args[0]?.toLowerCase() === 'prive';
		//"Raccourci" de traduction importer depui le fichier outils/langue.js
		const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'xanti_unique', { [cle]: vars }))[cle];
		const est_moi = message.key.fromMe || jid.endsWith("@newsletter");

		//sous-commande 'prive' réservée au propriétaire
		if (est_prive_demande && !est_moi) {
			return; //silence si ce n'est pas le propriétaire
		}

		let limite;
		let donnees_utilisateur;

		//gestion des restrictions et limites
		if (est_groupe) {
			const jid_expediteur = message.key.participant;
			if (!jid_expediteur) return;

			const non_fichier = fileURLToPath(import.meta.url);
			const non_dossier = path.dirname(non_fichier);
			let metadonnees_groupe;
			try {
				metadonnees_groupe = await connexion.groupMetadata(jid);
			} catch (e) {
				console.error(`[(xanti_unique), "${nom_session}"]: Erreur métadonnées:`, e);
			}

			const nom_groupe_nettoyer = (metadonnees_groupe?.subject || "groupe").replace(/[\/\\?%*:|"<>]/g, '-');
			const chemin_memoire_groupe = path.join(non_dossier, '..', 'memoires', 'memoires_commandes', 'xanti_unique', nom_session, 'groupes', `${nom_groupe_nettoyer}_${jid.split('@')[0]}`);
			await fs.mkdir(chemin_memoire_groupe, { recursive: true });
			const chemin_memoire_utilisateur = path.join(chemin_memoire_groupe, `${jid_expediteur.split('@')[0]}.json`);
			donnees_utilisateur = { nom: message.pushName, numero: jid_expediteur, limite: 0, date: '' };
			try {
				if (await fs.access(chemin_memoire_utilisateur).then(() => true).catch(() => false)) {
					donnees_utilisateur = JSON.parse(await fs.readFile(chemin_memoire_utilisateur, 'utf-8'));
				}
			} catch (e) { console.error(`[(xanti_unique), "${nom_session}"]; Erreur lecture:`, e); }

			const heure_actuelle = new Date().toISOString().split('T')[0];
			if (donnees_utilisateur.date !== heure_actuelle) {
				donnees_utilisateur.limite = 0;
				donnees_utilisateur.date = heure_actuelle;
			}
			donnees_utilisateur.nom = message.pushName;
			limite= limite_utilisation.membres;

			if (est_moi) {
				limite= limite_utilisation.bot;
			} else {
				const membres = metadonnees_groupe?.participants.find(p => p.id === jid_expediteur);
				if (membres?.admin) {
					limite= limite_utilisation.admins;
				}
			}

			if (donnees_utilisateur.limite >= limite) {
				//quand quelqu'un atteint la limite
				const limite_atteint = await trad('msg.limite_atteint', {limite: limite}) || `Tu as atteint ta limited'utilisation (${limite}).`;
				return connexion.sendMessage(jid, { text: limite_atteint}, { quoted: message });
			}
			donnees_utilisateur.limite++;
			await fs.writeFile(chemin_memoire_utilisateur, JSON.stringify(donnees_utilisateur, null, 2));
		} else if (!est_moi) {
			//en prive si c'est pas moi ou si le message vient de moi dans un groupe
			const message_refus = await trad('msg.message_refus') || "Tu ne peux pas utiliser cette commande.";
			return connexion.sendMessage(jid, { text: message_refus }, { quoted: message });
		}

		//detections du media
		const contexte_info = message.message?.extendedTextMessage?.contexte_info;
		let message_repondu = contexte_info?.quotedMessage;

		if (!message_repondu) {
			//si le message n'est pas vraiment une vue unique
			const pas_de_cible = await trad('msg.pas_de_cible') || "Tu dois répondre à un média en vue unique.";
			return connexion.sendMessage(jid, { text: pas_de_cible }, { quoted: message });
		}

		//support V2
		if (message_repondu.viewOnceMessageV2) message_repondu = message_repondu.viewOnceMessageV2.message;
		if (message_repondu.viewOnceMessage) message_repondu = message_repondu.viewOnceMessage.message;

		//liste des types de message considere comme vue unique
		const type_de_media = message_repondu.imageMessage ? "image" : message_repondu.videoMessage ? "video" : message_repondu.audioMessage ? "audio" : null;
		const media = message_repondu.imageMessage || message_repondu.videoMessage || message_repondu.audioMessage;

		if (!type_de_media || !media) {
			//si le contenue du message ne conrespond pas l'un des types
			const media_non_reconnu = await trad('msg.media_non_reconnu') || "Ce message n'est pas un média en vue unique reconnu.";
			return connexion.sendMessage(jid, { text: media_non_reconnu }, { quoted: message });
		}

		//preparation du transfer
		const destination = est_prive_demande ? jidNormalizedUser(connexion.user.id) : jid;
		const jid_auteur_brut = contexte_info.participant;
		let jid_auteur_normaliser = jidNormalizedUser(jid_auteur_brut);

		//résolution du LID en numéro (JID) si nécessaire
		if (jid_auteur_brut && jid_auteur_brut.endsWith('@lid')) {
			try {
				const pn = await connexion.signalRepository.lidMapping.getPNForLID(jid_auteur_brut);
				if (pn) {
					jid_auteur_normaliser = jidNormalizedUser(pn);
				}
			} catch (e) {
				console.error(`[(xanti_unique), "${nom_session}"]; Impossible de résoudre le LID ${jid_auteur_brut}:`, e);
			}
		}

		const numero_auteur = jid_auteur_normaliser.split('@')[0];
		const nom_auteur = message.pushName || numero_auteur;
		const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

		//récupération du nom du groupe si c'est un groupe
		let nom_groupe = "";
		if (est_groupe) {
			try {
				const metadonnees = await connexion.groupMetadata(jid);
				nom_groupe = metadonnees.subject || "le groupe";
			} catch (e) {
				nom_groupe = "le groupe";
			}
		}

		//legende_reussite qu'on mets en legende_reussite s'il y en avait pas
			const legende_reussite = est_groupe
				? await trad('msg.legende_reussite_groupe', {
					nom_auteur: nom_auteur,
					num_auteur: numero_auteur,
					nom_groupe: nom_groupe,
					heure: heure
				}
					  )
				|| `Message débloqué de ${nom_auteur}(+${numero_auteur}) dans ${nom_groupe} à ${heure}.`
				: await trad('msg.legende_reussite_priver', {
					nom_auteur: nom_auteur,
					num_auteur: numero_auteur,
					heure: heure
				}
					  )
				|| `Message débloqué de ${nom_auteur}(+${numero_auteur}) à ${heure}.`;

		//mais s'il y en avait on lutillise de preference
		const message_original = {
			key: { remoteJid: jid, id: contexte_info.stanzaId, fromMe: false, participant: jid_auteur_normaliser },
			message: message_repondu
		};

		try {
			const tampon = await downloadMediaMessage(message_original, "buffer", {});

			if (type_de_media === "image") {
				const legende = est_prive_demande ? legende_reussite : (media.caption || "");
				await connexion.sendMessage(destination, { image: tampon, caption: legende }, { quoted: est_prive_demande ? null : message });
			} else if (type_de_media === "video") {
				const legende = est_prive_demande ? legende_reussite : (media.caption || "");
				await connexion.sendMessage(destination, { video: tampon, caption: legende }, { quoted: est_prive_demande ? null : message });
			} else if (type_de_media === "audio") {
				const message_audio = await connexion.sendMessage(destination, { audio: tampon, mimetype: 'audio/mp4', ptt: true }, { quoted: est_prive_demande ? null : message });
				if (est_prive_demande) {
					await connexion.sendMessage(destination, { text: legende_reussite }, { quoted: message_audio });
				}
			}
		}
		/*une erreur s'est produite alors en log et on envoi ça*/
		catch (e) {
			console.error(`[(xanti_unique), "${nom_session}"]; Erreur:`, e);
			const message_erreur = await trad('msg.message_erreur') || "Erreur lors du déblocage du média.";
			return connexion.sendMessage(jid, { text: message_erreur }, { quoted: message });
		}
	}
};