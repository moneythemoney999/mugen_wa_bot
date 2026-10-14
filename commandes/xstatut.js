/* Cette commandes telechage directos tous les statut et les sauvegarde pour que quand tu aime un statut il puisse te l'envoiyé.
Pourquoi utilliser le disque c'est parceque whasapp pour economiser la bande passante n'envoi les vrai statut que lorqu'il sont mis pour la premiere fois.
Ce qui fait que quand tu aime le statut whatsapp n'envoi que que l'identifiant du j'aime le j'aime et l'identifiant du statut auquel il est associé.
Si non sans ce stockage il falllait utiliser la Ram ce qui ne garde les infos qu'un instant ou faire la commandes manuellement ce qui oblige whatsapp à envoiyé le statut.
Pour ne pas staturer le disque on suprime tout les 24h et si le statut est suprimmer par son auteur. */

//imports nécessaires
import { promises as fs } from 'fs';
import path from 'path';
import { downloadMediaMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import { traduire } from '../outils/langue.js';

//variables de la base de données et le temps de nettoyage
const memoire_commande_xstatut = path.join(process.cwd(), 'memoires', 'memoires_commandes', 'xstatut');
const duree_valide = 24 * 60 * 60 * 1000;

//fonction utilitaire pour préparer le dossier de session
async function preparer_dossier_session(nom_session) {
	const dossier = path.join(memoire_commande_xstatut, nom_session);
	await fs.mkdir(dossier, { recursive: true });
	return dossier;
}

//gestion de la base de données JSON unique (infos_statuts.json) par session
async function gerer_dossier_memoire(nom_session, nouvelle_entree = null) {
	const dossier = await preparer_dossier_session(nom_session);
	const fichier_infos_statuts = path.join(dossier, 'infos_statuts.json');
	let informations_statuts = [];

	if (await fs.access(fichier_infos_statuts).then(() => true).catch(() => false)) {
		try {
			informations_statuts = JSON.parse(await fs.readFile(fichier_infos_statuts, 'utf-8'));
		} catch (erreur) {
			informations_statuts = [];
		}
	}

	const maintenant = Date.now();

	//nettoyage automatique : on ne garde que les statuts de moins de 24h
	const filtrer_informations_statuts = [];
	for (const element of informations_statuts) {
		const est_valide = (maintenant - element.date) < duree_valide;
		if (!est_valide && element.type !== 'texte') {
			const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
			const chemin_media = path.join(dossier, `${element.identifiant}${extension}`);
			try {
				await fs.unlink(chemin_media);
			} catch (e) {}
		} else {
			filtrer_informations_statuts.push(element);
		}
	}

	if (nouvelle_entree) {
		filtrer_informations_statuts.push(nouvelle_entree);
	}

	await fs.writeFile(fichier_infos_statuts, JSON.stringify(filtrer_informations_statuts, null, 2));
	return filtrer_informations_statuts;
}

//export et vraie logique de la commande
export default {
	nom: "xstatut",
	description: `Récupérer les statuts des gens.`,
	categorie: "Statuts",
	infos: `Pour récupérer les statuts :
Soit en _répondant au statut de la personne ou en aimant le statut_ *attention si c'est en aimant le statut il sera envoyé à toi pas dans le chat de la personne qui a mis le statut*.`,

	execute: async ({ connexion, message, args, nom_session }) => {

		const trad = async (cle, variables = {}) => (await traduire(nom_session, 'commandes', 'xstatut', { [cle]: variables }))[cle];
		const est_moi = message.key.fromMe || jid.endsWith("@newsletter");
		//PARTIE AVEC MANUELLE
		if (!est_moi) return;

		const infos_contexte = message.message?.extendedTextMessage?.contextInfo;
		const message_repondu = infos_contexte?.quotedMessage;

		//partie manuelle: si pas de reponse à aucun message
		if (!message_repondu) {
			const pas_de_cible = await trad('message.pas_de_cible') || "Il est où le statut à recuper  ";
			return connexion.sendMessage(message.key.remoteJid,
				{ text: pas_de_cible },
				{ quoted: message });
		}

		const est_un_statut = infos_contexte?.remoteJid === 'status@broadcast' || (infos_contexte?.participant && infos_contexte.participant.endsWith('status@broadcast'));
		//partie manuelle: s'il y'a reponse mais que c'est pas à un statut
		if (!est_un_statut) {
			const cible_pas_statut = await trad('message.cible_pas_statut') || "_C'est pas un statut c'truc_";
			return connexion.sendMessage(message.key.remoteJid,
				{ text: cible_pas_statut },
				{ quoted: message });
		}
		const destination = message.key.remoteJid;
		try {
			const texte = message_repondu.conversation || message_repondu.extendedTextMessage?.text;
			//partie manuelle: si reponse à un statut (texte)
			if (texte) {
				const manuel_statut_texte = await trad('message.manuel_statut_texte', {texte: texte}) || `> ${texte}`;
				await connexion.sendMessage(destination,
					{ text: manuel_statut_texte }, { quoted: message });
			} /*si c'est plutot une image/video*/ else if (message_repondu.imageMessage || message_repondu.videoMessage) {
				const tampon = await downloadMediaMessage({ key: { id: infos_contexte.stanzaId }, message: message_repondu }, 'buffer', {});
				const type = message_repondu.imageMessage ? 'image' : 'video';
				const manuel_statut_media = await trad('message.manuel_statut_media', {legende: message_repondu[type + 'Message'].caption || ""}) || (message_repondu[type + 'Message'].caption || "");
				await connexion.sendMessage(destination, { [type]: tampon,
					caption: manuel_statut_media },
					{ quoted: message });
			} /*pour les audio*/ else if (message_repondu.audioMessage) {
				const tampon = await downloadMediaMessage({ key: { id: infos_contexte.stanzaId }, message: message_repondu }, 'buffer', {});
				await connexion.sendMessage(destination, { audio: tampon, mimetype: 'audio/mp4' }, { quoted: message });
			}
		} /*s'il est arrivé une erreur*/ catch (erreur) {
			const erreur_recuperation = await trad('message.erreur_recuperation') || "Impossible de récupérer ce média.";
			await connexion.sendMessage(destination, { text: erreur_recuperation }, { quoted: message });
		}
	},

	//partie sans commande
	evenements_sans_prefixe: async ({ connexion, message, nom_session }) => {
	const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'xstatut', { [cle]: vars }))[cle];
	//definition des evenments de statuts
		const est_un_statut = message.key.remoteJid === 'status@broadcast';
		if (!est_un_statut) return; //si l'evenment ne correspond pas à notre definition des statuts on ignore
		//recuperation de l'objet message.message que whatsapp va envoiyé
		const contenu_message = message.message;

		if (!contenu_message) return;
		const jid_bot = jidNormalizedUser(connexion.user.id);
		const lid_bot_brut = connexion.user.lid || await trad('message.lid_bot_brut_inconnu') || 'inconnu';
		const lid_bot_nettoyer = lid_bot_brut.split(':')[0] + '@lid';

		//1. gestion des reaction: definition des variable de reaction de, la personne a mis et si cette personne est moi
		if (contenu_message.reactionMessage) {
			const reaction = contenu_message.reactionMessage;
			const auteur_reaction = message.key.participant || await trad('message.auteur_reaction_inconnu') || 'inconnu';
			const est_ma_reaction = message.key.fromMe || (auteur_reaction === jid_bot) || (auteur_reaction === lid_bot_nettoyer);
			//si c'est pas de moi on ignore
			if (!est_ma_reaction) return;

			const identifiant = reaction.key.id;
			const informations_statuts = await gerer_dossier_memoire(nom_session);
			const element = informations_statuts.find(el => el.identifiant === identifiant);
			if (!element) return;

			const jid_cible = jid_bot;
			const heure = new Date(element.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
			//resolution des identifiants
			let jid_auteur_brut = element.jid_auteur;
			if (jid_auteur_brut.endsWith('@lid')) {

				try {
					const pn = await connexion.signalRepository.lidMapping.getPNForLID(jid_auteur_brut);
					if (pn) jid_auteur_brut = pn;
				} catch (e) {}
			}
			const jid_auteur_nettoyer = jidNormalizedUser(jid_auteur_brut);
			const numero = jid_auteur_nettoyer.split('@')[0];
			//message qu'on mets lors de l'envoi de statut
			const format_legende = await trad('message.format_legende', {
				jid_auteur: element.nom_auteur || numero,
				numero: numero,
				heure: heure
			}) || `\n> *De ${element.nom_auteur || numero} (+${numero}) à ${heure}*`;

			try {
				//pour les textes on mets mets le messsage et le message (format_legende) en sautant de ligne
				if (element.type === "texte") {
					const auto_statut_texte = await trad('message.auto_statut_texte', {
						texte: element.texte,
						format_legende: format_legende
					}) || `${element.texte}${format_legende}`;
					await connexion.sendMessage(jid_cible, { text: auto_statut_texte });
				} else {
					const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
					const chemin_media = path.join(await preparer_dossier_session(nom_session), `${identifiant}${extension}`);
					if (!(await fs.access(chemin_media).then(() => true).catch(() => false))) return;

					const tampon = await fs.readFile(chemin_media);
					const legende = element.texte ? await trad('message.legende', {
						texte: element.texte,
						format_legende: `\n${format_legende.trim()}`
					}) || `${element.texte}${format_legende}` : format_legende.trim();

					//si image on mets en legende
					if (element.type === "image") {
						const legende_auto_image = await trad('message.legende_auto_image', {legende: legende}) || `${legende}`;
						await connexion.sendMessage(jid_cible, { image: tampon, caption: legende_auto_image });
					}
					//de meme pour les videos
					else if (element.type === "video") {
						const legende_auto_video = await trad('message.legende_auto_video', {legende: legende}) || `${legende}`;
						await connexion.sendMessage(jid_cible, { video: tampon, caption: legende_auto_video });
					}
					//mais pou les audio comme on peut mettre ni legende ni apres saut à la ligne on envoi le message en reponse après l'audio
					else if (element.type === "audio") {
						const m = await connexion.sendMessage(jid_cible, { audio: tampon, mimetype: 'audio/mp4', ptt: true });
						const legende_auto_audio = await trad('message.legende_auto_audio', {message: format_legende.trim()}) || `${format_legende.trim()}`;
						await connexion.sendMessage(jid_cible, { text: legende_auto_audio }, { quoted: m });
					}
				}
			} catch (erreur) {}
			return;
		}

		//2. capture et sauvegarde des statuts dans la memoires
		//ça se fera que si c'est pas de moi
		if (!message.key.fromMe) {
			//nettoyage immédiat si suppression
			if (contenu_message.protocolMessage && contenu_message.protocolMessage.type === 0) {
				const id_origine = contenu_message.protocolMessage.key.id;
				const dossier = await preparer_dossier_session(nom_session);
				const fichier_infos_statuts = path.join(dossier, 'infos_statuts.json');

				if (await fs.access(fichier_infos_statuts).then(() => true).catch(() => false)) {
					let informations_statuts = JSON.parse(await fs.readFile(fichier_infos_statuts, 'utf-8'));
					const indice_statut = informations_statuts.findIndex(element => element.identifiant === id_origine);
					if (indice_statut !== -1) {
						const element = informations_statuts[indice_statut];
						if (element.type !== 'texte') {
							const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
							const chemin_media = path.join(dossier, `${id_origine}${extension}`);
							try {
								await fs.unlink(chemin_media);
							} catch (erreur) {}
						}
						informations_statuts.splice(indice_statut, 1);
						await fs.writeFile(fichier_infos_statuts, JSON.stringify(informations_statuts, null, 2));
					}
				}
				return;
			}

			//capture de statut classique
			let type = "texte";
			if (contenu_message.imageMessage) type = "image";
			else if (contenu_message.videoMessage) type = "video";
			else if (contenu_message.audioMessage) type = "audio";
			//resolution LID -> PN dès la capture
			let jid_auteur_brut = message.key.participant || '';
			if (jid_auteur_brut.endsWith('@lid')) {
				try {
					const pn = await connexion.signalRepository.lidMapping.getPNForLID(jid_auteur_brut);
					if (pn) jid_auteur_brut = pn;
				} catch (e) {}
			}
			const jid_auteur_nettoyer = jidNormalizedUser(jid_auteur_brut);
			//construction du fichier infos_statuts.json
			const entree = {
				identifiant: message.key.id,
				jid_auteur: jid_auteur_nettoyer,
				nom_auteur: message.pushName,
				texte: contenu_message.imageMessage?.caption || contenu_message.videoMessage?.caption || contenu_message.conversation || contenu_message.extendedTextMessage?.text || "",
				date: Date.now(),
				type: type
			};

			if (type !== "texte") {
				try {
					const tampon = await downloadMediaMessage(message, 'buffer', {});
					const extension = type === 'image' ? '.jpg' : (type === 'video' ? '.mp4' : '.mp3');
					await fs.writeFile(path.join(await preparer_dossier_session(nom_session), `${entree.identifiant}${extension}`), tampon);
				} catch (erreur) {}
			}
			await gerer_dossier_memoire(nom_session, entree);
		}
	}
};