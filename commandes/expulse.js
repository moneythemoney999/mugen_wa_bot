/* */
//imports necessaire
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { traduire} from "../outils/langue.js";

//export et logique de la commandes
export default {
	nom: "expulse",
	description: "Expulse un membre d'un groupe.",
	categorie: "Groupes",
	infos: `Utilisation : \`.expulse @membre\` ou \`.expulse <numéro>\` ou encore en répondant à un message de la personne avec ma commande.

Pour retirer quelqu'un du groupe il fait que tu sois admin du groupe.`,

	execute: async ({ connexion, message, args, nom_session }) => {
		const jid = message.key.remoteJid;
		const est_groupe = jid.endsWith('@g.us');
		const trad = (cle, variables = {}) => traduire (nom_session, 'commandes', 'expulse', { [cle] : variables}) [cle];

		if (!est_groupe) {
			//si c'est utiliser en privé
			const si_prive = trad('msg.si_prive') || "C'est pas utilisable en privé";
			await connexion.sendMessage(jid, { text: si_prive }, { quoted: message });
			return;
		}
		try {
			const metadonnees_groupe = await connexion.groupMetadata(jid);
			const participants = metadonnees_groupe.participants;
			const id_brut_auteur = message.key.participant;
			const id_brut_bot = connexion.user.id;
			const lid_brut_bot = connexion.user.lid || id_brut_bot;
			//on cherche le rôle de l'auteur avec son ID brut (qui est un LID propre)
			const auteur = participants.find(p => p.id === id_brut_auteur);
			const auteur_est_admin = auteur?.admin;
			//on cherche le rôle du bot en utilisant une version NORMALISÉE de son LID
			const lid_bot_normaliser = jidNormalizedUser(lid_brut_bot);
			const bot = participants.find(p => jidNormalizedUser(p.id) === lid_bot_normaliser);
			const bot_est_admin = bot?.admin;
			//on compare les JIDs normalisés pour savoir si l'auteur est le bot
			const lid_auteur_normaliser = jidNormalizedUser(id_brut_auteur);
			const est_moi = (lid_auteur_normaliser === lid_bot_normaliser);

			//vérification des permissions
			if (!auteur_est_admin) {
				if (est_moi) {
					//si c'est moi mais que chuis pas admin
					const moi_non_admin = trad("msg.moi_non_admin") || "> T'es pas admin😂🤣";
					await connexion.sendMessage(jid,
						{ text: moi_non_admin },
						{ quoted: message });
				} else {
					//si quelqu'un d'autre et qu'il n'est pas admin
					const autre_non_admin = trad('msg.autre_non_admin') || "Faut que tu sois admin";
					await connexion.sendMessage(jid,
						{ text: autre_non_admin },
						{ quoted: message });
				}
				return;
			}

			if (!bot_est_admin) {
				const bot_non_admin = trad('msg.bot_non_admin') || "Faut me donner les droits d'administration";
				await connexion.sendMessage(jid,
					//si un admin mais que le bot n'a pas les droits
					{ text: bot_non_admin },
					{ quoted: message });
				return;
			}
			//identification des cibles
			let cibles_initiales = [];
			const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
			const num_cible = args.find(arg => /^\+?\d+$/.test(arg))?.replace('+', '');
			const auteur_repondu_brut = message.message?.extendedTextMessage?.contextInfo?.participant;

			if (mentions.length > 0) {
				cibles_initiales.push(...mentions);
			} else if (auteur_repondu_brut) {
				cibles_initiales.push(auteur_repondu_brut);
			} else if (num_cible) {
				cibles_initiales.push(`${num_cible}@s.whatsapp.net`);
			} else {
				const pas_de_cible = trad('msg.pas_de_cible') || `Qui dois-je expulser.
*Mets son num ou tag la personne derrière la commande* ex: \`.expulse 56931437983\` \`.expulse @la_personne\`.`;
				//si on ne detecte pas de cible
				await connexion.sendMessage(jid, { text: pas_de_cible}, { quoted: message });
				return;
			}
			//expulsion
			const cibles_a_retrograder = [];
			let cible_non_trouver = false;

			for (const cible_brut of cibles_initiales) {
				let participant;
				if (cible_brut.endsWith('@s.whatsapp.net')) {
					//cible est un JID (venant d'un numéro@s.whatsapp.net) on cherche dans 'phoneNumber'
					participant = participants.find(p => p.phoneNumber === cible_brut);
				} else {
					//cible est un LID (venant d'une mention/réponse) on cherche dans 'id'
					participant = participants.find(p => p.id === cible_brut);
				}

				if (participant) {
					// On compare avec l'ID normalisé du bot pour être sûr
					if (jidNormalizedUser(participant.id) === lid_bot_normaliser) {
						const cible_moi = trad('msg.cible_moi') || "```🫩🫩```";
						await connexion.sendMessage(jid, { text: cible_moi}, { quoted: message });
						continue;
					}
					if (participant.admin === 'admin' || participant.admin === 'superadmin') {
						const cible_est_admin = trad('msg.cible_est_admin') || "~Fait le toi même, flemme🥱😪~";
						await connexion.sendMessage(jid,
							//si la cible est un administrateur on refuse
							{ text: cible_est_admin },
							{ quoted: message });
						continue;
					}
					cibles_a_retrograder.push(participant.id);
				} else {
					cible_non_trouver = true;
				}
			}

			//envoi de la requête a whatsapp
			if (cibles_a_retrograder.length > 0) {
				await connexion.groupParticipantsUpdate(jid, cibles_a_retrograder, "remove");
				for (const expulse of cibles_a_retrograder) {
					//si on reussi on envoi ce message de confirmation
					const succes = trad('msg.succes', {expulse: expulse.split('@')[0]}) || `~@${expulse.split('@')[0]}~ a été viré d'ici`
						await connexion.sendMessage(jid, { text: succes, mentions: [expulse] }, { quoted: message });
				}
			} else if (cible_non_trouver) {
				//si on trouve pas la personne dans la liste des participant
				const cible_non_membre = trad('msg.cible_non_membre') || "> Membre introuvable.";
				await connexion.sendMessage(jid, { text: cible_non_membre}, { quoted: message });
			}
		} catch (erreur) {
			//s'il y'a une autre erreur on l'affiche au terminal et envoi un message d'erreur sur whatsapp
			console.error(`[(expulse), "${nom_session}"]: Erreur dans la commande expulse :`, erreur);
			const msg_erreur = trad('msg.erreur') ||  "Une erreur est survenue lors de l'expulsion.";
			await connexion.sendMessage(jid, { text: msg_erreur}, { quoted: message });
		}
	}
};
