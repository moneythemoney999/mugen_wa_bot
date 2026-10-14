/* */

//imports a faire
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { traduire } from "../outils/langue.js";

//logique
export default {
	nom: "promouve",
	description: "Promeut un membre au statut d'administrateur.",
	categorie: "Groupes",
	infos: `Utilisation : \`.promouve @MEMBRE\` ou \`.promouve <numéro>\` pour nommer quelqu'un admin.
> Mais il faut être admin pour réussir.`,

	execute: async ({ connexion, nom_session, message, args }) => {
		const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'promouve', { [cle]: vars }))[cle];
		const jid = message.key.remoteJid;
		const estGroupe = jid.endsWith('@g.us');

		if (!estGroupe) {
			const si_prive = await trad('msg.si_prive') || "C'est pas utilisable en privé.";
			await connexion.sendMessage(jid,
			//si c'est utilisé en privé on préviens
				{ text: si_prive },
				{ quoted: message });
			return;
		}
		try {
			//appelle metadata et resolution des IDs
			const metadonnees_groupe = await connexion.groupMetadata(jid);
			const participants = metadonnees_groupe.participants;
			const jid_auteur_brut = message.key.participant || message.key.remoteJid.endsWith("@newsletter");
			const jid_bot_brut = connexion.user.id;
			const lid_bot_brut = connexion.user.lid || jid_bot_brut;
			const auteur_dans_participants = participants.find(p => p.id === jid_auteur_brut);
			const auteur_est_admin = auteur_dans_participants?.admin;
			const lid_bot_normaliser = jidNormalizedUser(lid_bot_brut);
			const bot_dans_participants = participants.find(p => jidNormalizedUser(p.id) === lid_bot_normaliser);
			const bot_est_admin = bot_dans_participants?.admin;
			const jid_auteur_normaliser = jidNormalizedUser(jid_auteur_brut);
			const est_moi = (jid_auteur_normaliser === lid_bot_normaliser);

			//logique de vérification des permissions
			if (!auteur_est_admin) {
				if (est_moi) {
					const moi_non_admin = await trad('msg.moi_non_admin') || "> T'es pas admin😂🤣.";
					await connexion.sendMessage(jid,
						//si c'est moi et que je suis pas admin on envoie un ça
						{ text: moi_non_admin },
						{ quoted: message });
				} else {
					const autre_non_admin = await trad('msg.autre_non_admin') || "Faut que tu sois admin";
					await connexion.sendMessage(jid,
						//pour quelqu'un d'autre qui n'est pas admin
						{ text: autre_non_admin },
						{ quoted: message });
				}
				return;
			}
			if (!bot_est_admin) {
				const bot_non_admin = await trad('msg.bot_non_admin') || "Faut me donner les droits d'administration";
				await connexion.sendMessage(jid,
					//ça vient d'un admin mais que le bot lui n'est pas admin
					{ text: bot_non_admin },
					{ quoted: message });
				return;
			}
			//logique d'identification des cibles
			let cibles_initiales = [];
			const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
			const num_cible = args.find(arg => /^\d+$/.test(arg));
			const autre_repondu_brut = message.message?.extendedTextMessage?.contextInfo?.participant;
			if (mentions.length > 0) {
				cibles_initiales.push(...mentions);
			} else if (autre_repondu_brut) {
				cibles_initiales.push(autre_repondu_brut);
			} else if (num_cible) {
				cibles_initiales.push(`${num_cible}@s.whatsapp.net`);
			} else {
				const pas_de_cible = await trad('msg.pas_de_cible') || `Qui dois-je promouvoir.
*Répond à un de ses messages ou mets son num ou tag la personne derrière la commande*.
> ex: \`.promouve 56931437983\` \`.promouve @la_personne\`.`;

				await connexion.sendMessage(jid,
					//detection d'aucun argument
					{ text: pas_de_cible },
					{ quoted: message });
				return;
			}
			//logique de promotion
			const cible_a_promouvoir = [];
			let cible_non_trouver = false;
			for (const cible_brute of cibles_initiales) {
				const cible_normaliser = jidNormalizedUser(cible_brute);
				const participant = participants.find( p => jidNormalizedUser(p.id) === cible_normaliser);
				if (participant) {
					if (participant.admin) {
						const cible_deja_admin =
							await trad('msg.cible_deja_admin', {
								cible: participant.id.split('@')[0]
							}) ||
							`@${participant.id.split('@')[0]} était déjà administrateur`;
						await connexion.sendMessage(jid, {
							//si la cible est deja admin
							text: cible_deja_admin,
							mentions: [participant.id]
						}, { quoted: message });
						continue;
					}
					cible_a_promouvoir.push(participant.id);
				} else {
					cible_non_trouver = true;
				}
			}
			//envoi de requete au serveur de whatsapp
			if (cible_a_promouvoir.length > 0) {
				try {
					await connexion.groupParticipantsUpdate(
						jid,
						cible_a_promouvoir,
						"promote"
					);
				} catch (e) {
					const jid_parent = metadonnees_groupe.linkedParent;
					if (jid_parent) {
						try {
							await connexion.groupParticipantsUpdate(
								jid_parent,
								cible_a_promouvoir,
								"promote"
							);
						} catch (e2) {
							throw e2; //relance pour le catch global
						}
					} else {
						throw e; //relance pour le catch global
					}
				}
				for (const promus of cible_a_promouvoir) {
					const succes =
						await trad('msg.succes', {
							cible: promus.split('@')[0]
						}) ||
						`✓ @${promus.split('@')[0]} a été promu admin.`;
					await connexion.sendMessage(jid, {
						//apres les requete si on reussi
						text: succes,
						mentions: [promus]
					}, { quoted: message });
				}
			} else if (cible_non_trouver) {
				const cible_non_membre =
					await trad('msg.cible_non_membre') || "~Cette personne n'est pas un membre du groupe~";
				await connexion.sendMessage(jid,
					//par contre si on pas trouve la personne dans metadata
					{ text: cible_non_membre },
					{ quoted: message });
			}
		} catch (e) {
			//si une erreur non identifie on le log et envoi un message d'erreur
			console.error(`[(promouve), "${nom_session}"] Erreur dans la commande promouve :`, erreur);
			const erreur =
				await trad('msg.erreur') || "Une erreur est survenue lors de la promotion.";
			await connexion.sendMessage(jid,
				{ text: erreur },  { quoted: message });
		}
	}
};
