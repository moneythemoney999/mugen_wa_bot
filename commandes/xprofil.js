/* */

//les imports dont on a besoin
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { traduire } from '../outils/langue.js';

//exporte et logique
export default {
	nom: "xprofil",
	description: "Piquer la tof profil des gens",
	categorie: "Groupes && Privé",
	infos: `Récupérer la photo profil de plusieurs personnes.
Utilisation : \`.xprofil @tag1 569... @tag2 509...\` ou juste \`.xprofil\` pour la profil du chat actuel.`,

	execute: async ({ connexion, message, args, nom_session }) => {
		const jid = message.key.remoteJid;
		//"Raccourci" de traduction importer depui le fichier outils/langue.js
		const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'xprofil', { [cle]: vars }))[cle];
		let liste_cibles = new Set();
		const contexte_info = message.message?.extendedTextMessage?.contextInfo;

		//1. recuperation de cibles (temporaire)
		if (contexte_info?.mentionedJid) {
			contexte_info.mentionedJid.forEach(j => liste_cibles.add(jidNormalizedUser(j)));
		}
		if (contexte_info?.participant) {
			liste_cibles.add(jidNormalizedUser(contexte_info.participant));
		}
		args?.forEach(arg => {
			const num = arg.replace(/\D/g, '');
			if (num.length >= 8) {
				liste_cibles.add(jidNormalizedUser(num + '@s.whatsapp.net'));
			}
		});

		if (liste_cibles.size === 0) {
			liste_cibles.add(jid);
		}

		let reussis = []; //stockage temporaire des images
		let echoues = [];

		//2. traitement et recuperation
		for (const cible of liste_cibles) {
			const cible_est_groupe = cible.endsWith('@g.us');
			const nom = cible_est_groupe
				? await trad('msg.cible_groupe') || "du groupe"
				: await trad('msg.cible_utilisateur', {utilisateur: cible.split('@')[0]}) || `de @${cible.split('@')[0]}`;

			try {
				const lien_image_profil = await connexion.profilePictureUrl(cible, 'image');
				reussis.push({ lien_image_profil, nom, jid: cible });
			} catch (e) {
				echoues.push({ nom });
			}
		}

		//3. construction de la legende final
		let legende_finale = "";
		if (reussis.length > 0) {
			const nom_reussis = reussis.map(r => r.nom).join(', ');
			legende_finale += await trad('msg.legende_reussis', {reussis: nom_reussis}) || `Voici la photo de profil ${nom_reussis}.`; //legende pour les photos qu'on a reussi a recuperer
		}

		if (echoues.length > 0) {
			const nom_echoues = echoues.map(e => e.nom).join(', ');
			if (legende_finale) legende_finale += "\n\n";
			//puis ceux qui ont echoue
			legende_finale += await trad('msg.legende_non_reussis', {echoues: nom_echoues}) || `> Impossible de récupérer la photo de profil de ${nom_echoues}. Il peut ne pas en avoir ou l'a cachée.`;
		}

		const mentions_cibles = [...liste_cibles];
		//4. envoi en forme d'album (bloc de fin)
		if (reussis.length > 0) {
			for (let i = 0; i < reussis.length; i++) {
				const est_dernier = (i === reussis.length - 1);
				await connexion.sendMessage(
					jid,
					{
						image: { url: reussis[i].lien_image_profil },
						caption: est_dernier ? legende_finale : "",
						mentions: est_dernier ? mentions_cibles : []
					},
					{ quoted: message }
				);

				//ajout d'un délai entre chaque envoi
				if (!est_dernier) {
					await new Promise(resolve => setTimeout(resolve, 2000));
				}
			}
		} else if (echoues.length > 0) {
			//uniquement des échecs : un seul message textuel
			await connexion.sendMessage(jid, { text: legende_finale, mentions: mentions_cibles }, { quoted: message });
		}
	}
};

