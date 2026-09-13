/* */
// Imports nécessaires au fichier
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import {traduire} from '../outils/langue.js';

// Export et logique que le fichier principal va venir importer
export default {
	nom: "degrade",
	description: "Rétrograde un administrateur d'un groupe.",
	categorie: "Groupes",
	infos: `Utilisation : \`.degrade @membre\` ou \`.degrade <numéro>\` pour rétrograder un admin.
Mais il faut que tu sois admin aussi et tu ne peux pas rétrograder la personne qui a créé le groupe.`,
	// Logique de la commande
	execute: async ({ connexion, nom_session, message, args }) => {
		const trad = (cle, vars = {}) => traduire (nom_session, 'commandes', 'degrade', { [cle] : vars}) [cle];
		const jid = message.key.remoteJid;
		const est_groupe = jid.endsWith('@g.us');

		// Si c'est utilisé en privé, on envoie ça pour ne pas provoquer d'erreurs
		if (!est_groupe) {
			const si_prive = trad('msg.si_prive') || "C'est pas utilisable en privé.";
			await connexion.sendMessage(jid, {text: si_prive}, {quoted: message});
			return;
		}

		try {
			const metadonnees_groupe = await connexion.groupMetadata(jid);
			const participants = metadonnees_groupe.participants;
			const id_brut_auteur = message.key.participant;
			const id_brut_bot = connexion.user.id;
			const lid_brut_bot = connexion.user.lid || id_brut_bot;
			const auteur = participants.find(p => p.id === id_brut_auteur);
			const auteur_est_admin = auteur?.admin === 'admin' || auteur?.admin === 'superadmin';
			const lid_bot_normaliser = jidNormalizedUser(lid_brut_bot);
			const bot = participants.find(p => jidNormalizedUser(p.id) === lid_bot_normaliser);
			const bot_est_admin = bot?.admin;
			const id_auteur_normaliser = jidNormalizedUser(id_brut_auteur);
			const est_moi = (id_auteur_normaliser === lid_bot_normaliser);

			// Vérification des permissions
			if (!auteur_est_admin) {
				if (est_moi) {
					const moi_non_admin = trad('msg.moi_non_admin') ||  "> T'es pas admin😂😂";
					await connexion.sendMessage(jid, { text: moi_non_admin }, //si c'est moi mais que je suis pas admin
						{ quoted: message });
				}
				else {
					const autre_non_admin = trad('msg.autre_non_admin') || "Faut que tu sois admin";
					await connexion.sendMessage(jid, { text: autre_non_admin}, //si c'est quelqu'un d'autre et qu'il n'est pas admin
						{ quoted: message });
				}
				return;
			}

			if (!bot_est_admin) {
				const bot_non_admin = trad('msg.bot_non_admin') || "Faut me donner les droits d'administration";
				await connexion.sendMessage(jid, { text: bot_non_admin }, //si c'est un admin mais que le bot lui n'est pas admin
					{ quoted: message });
				return;
			}

			// Identification des cibles
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
				// S'il n'y a pas de cible précisée
				const pas_de_cible = trad('msg.pas_de_cible') ||  `> Qui dois-je rétrograder.
*Répond à un de ses messages ou mets son num ou tag la personne derrière la commande* ex: \`.degrade 56931437983\` ou \`.degrade @la_personne\`.`;
				await connexion.sendMessage(jid, { text: pas_de_cible }, { quoted: message });
				return;
			}

			// Rétrogradation
			const cibles_a_retrograder = [];
			let cible_non_trouve = false;

			for (const cible_brut of cibles_initiales) {
				let participant;
				if (cible_brut.endsWith('@s.whatsapp.net')) {
					participant = participants.find(p => p.phoneNumber === cible_brut);
				} else {
					participant = participants.find(p => p.id === cible_brut);
				}

				if (participant) {
					if (jidNormalizedUser(participant.id) === lid_bot_normaliser) {
						// Si quelqu'un essaie de rétrograder le bot lui-même
						const cible_moi = trad('msg.cible_moi') ||  "```Je peux pas me rétrograder```";
						await connexion.sendMessage(jid, { text: cible_moi },
							{ quoted: message });
						continue;
					}
					if (participant.admin === 'superadmin') {
						// On n'essaie pas de rétrograder le créateur du groupe pour ne pas provoquer une erreur
						const cible_proprio = trad('msg.cible_proprio') ||  "~Impossible de rétrograder le proprio.~";
						await connexion.sendMessage(jid, { text: cible_proprio },
							{ quoted: message });
						continue;
					}
					if (!participant.admin) {
						// Si la cible n'était pas admin
						const cible_pas_admin = trad('msg.cible_pas_admin', {cible: participant.id.split('@')[0]}) || `_@${participant.id.split('@')[0]} n'était pas administrateur_`;
						await connexion.sendMessage(jid, { text: cible_pas_admin,
							mentions: [participant.id] },
							{ quoted: message });
						continue;
					}
					cibles_a_retrograder.push(participant.id);
				} else {
					cible_non_trouve = true;
				}
			}
			// Envoi des requêtes de rétrogradation à WhatsApp
			if (cibles_a_retrograder.length > 0) {
				try {
					await connexion.groupParticipantsUpdate(jid, cibles_a_retrograder, "demote");
				} catch (e) {
					const jidParent = metadonnees_groupe.linkedParent;
					if (jidParent) {
						try {
							await connexion.groupParticipantsUpdate(jidParent, cibles_a_retrograder, "demote");
						} catch (e2) {
							throw e2; // Relance pour le catch global
						}
					} else {
						throw e; // Relance pour le catch global
					}
				}
				// Après l'envoi des requêtes, si la rétrogradation a réussi
				for (const retrogrades of cibles_a_retrograder) {
					const succes = trad('msg.succes', {cible: retrogrades.split('@')[0]}) || `✓@${retrogrades.split('@')[0]} a bien été rétrogradé.`;
					await connexion.sendMessage(jid, { text: succes, mentions: [retrogrades] },
						{ quoted: message });
				}
			} else if (cible_non_trouve) {
				// Si les requêtes n'ont pas abouti du fait qu'on n'a pas trouvé la personne dans la liste des participants
				const cible_non_membre = trad('msg.cible_non_membre') || "~Cette personne n'est pas un membre du groupe~";
				await connexion.sendMessage(jid, { text: cible_non_membre },
					{ quoted: message });
			}
		} catch (erreur) {
			// S'il y a eu une erreur quelconque, on l'affiche dans le terminal et on envoie un message sur WhatsApp pour le faire savoir.
			console.error(`[(degrade), "${nom_session}"]: Erreur dans la commande degrade :`, erreur);
			const msg_erreur = trad('msg.erreur') || "Une erreur est survenue lors de la rétrogradation.";
			await connexion.sendMessage(jid, { text: msg_erreur },
				{ quoted: message });
		}
	}
};
