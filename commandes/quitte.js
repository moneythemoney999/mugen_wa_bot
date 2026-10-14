/* */

//imports
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { traduire } from '../outils/langue.js';

//export et logique
export default {
	nom: "quitte",
	description: "Pour quitter des groupes/communautés ou se désabonner à des chaînes.",
	categorie: "Groupes && Privé",
	infos: "Utilisation : `.quitte` dans un groupe, ou `.quitte <lien>` pour quitter une discussion spécifique.",

	execute: async ({ connexion, message, args, nom_session }) => {
		const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'quitte', { [cle]: vars }))[cle];
		const est_moi = message.key.fromMe || message.key.remoteJid.endsWith("@newsletter");
		if (!est_moi) {
			const message_permis = await trad('msg.message_permis') || "```T'es pas autorisé à exécuter cette commande```";
			await connexion.sendMessage(message.key.remoteJid,
				//si pas moi on refuse
				{ text: message_permis },
				{ quoted: message });
			return;
		}

		const lien = args[0];
		const jid = message.key.remoteJid;
		if (!lien) {
			if (jid.endsWith('@g.us')) {
				try {
					const groupes_actuel = await connexion.groupFetchAllParticipating();
					const info_groupe = groupes_actuel[jid];
					if (!info_groupe) {
						const plus_membre = await trad('msg.plus_membre') || "```Je ne suis déjà plus dans ce groupe.```";
						await connexion.sendMessage(connexion.user.id,
							//si on n'etait pas membre du groupe
							{ text: plus_membre },
							{ quoted: message });
						return 'NO_REACTION';
					}
					const nom_groupe = info_groupe.subject;
					const jid_bot_normaliser = jidNormalizedUser(connexion.user.id);
					const message_succes = await trad('msg.message_succes', {groupe: nom_groupe}) || `_Groupe : ${nom_groupe} quitté avec succès._`;
					await connexion.sendMessage(jid_bot_normaliser,
						//message de succes
			{ text: message_succes },
			{ quoted: message});
					await connexion.groupLeave(jid);
					return 'NO_REACTION';
				} catch (e) {
					//une erreur non identifié on le log
					console.error(`[(quitte), "${nom_session}": Erreur dans .quitte (groupe actuel) :`, e);
				}
			} else {
				const si_prive = await trad('msg.si_prive') || `> Inutilisable en privé.
*Où si c'est une autre discussion que tu veux quitter mets le lien de derrière la commande.*`;
				await connexion.sendMessage(jid,
					{ text: si_prive },
					{ quoted: message });
			}
			return;
		}
		//nettoyage et verfication du lien si
		const regex = /(?:https?:\/\/)?(chat\.whatsapp\.com|whatsapp\.com\/channel)\/([A-Za-z0-9_-]+)/;
		const correspondance = lien.match(regex);

		if (!correspondance) {
			const lien_invalide = await trad('msg.lien_invalide') || "```Lien invalide```";
			await connexion.sendMessage(jid,
				//si le lien est invalide
				{ text: lien_invalide },
				{ quoted: message });
			return;
		}
		//comme c'est valide on continu
		const type_lien = correspondance[1];
		const code_invitation = correspondance[2];

		try {
			//si c'est le lien d'un groupe on recupere les infos du groupe
			if (type_lien.startsWith('chat.whatsapp.com')) {
				const info = await connexion.groupGetInviteInfo(code_invitation);
				const groupes_actuel = await connexion.groupFetchAllParticipating();
				if (!groupes_actuel[info.id]) {
					const etait_pas_membre = await trad('msg.etait_pas_membre') || "> Tu n'étais pas membre de la discussion";
					await connexion.sendMessage(jid,
						//si apres verificaton on etait pas membre du groupe on s'arrete sans envoiye de requetes
						{ text: etait_pas_membre },
						{ quoted: message });
					return;
				}
				//mais si le contraire on est bien dans le groupe on envoit la requete a whatsapp
				await connexion.groupLeave(info.id);
				const message_succes = await trad('msg.message_succes', {nom : info.subject}) || `*Discussion quittée avec succès* : ~${info.subject}~`;
				await connexion.sendMessage(jid,
					//puis si on reussi on le confirme
					{ text: message_succes },
					{ quoted: message });
			} else if (type_lien.startsWith('whatsapp.com/channel')) { // dans le cas d'une chaine c'est un peu le meme delire mais en envoiyant "unfollow" au lieu de "leave"
				const metadata = await connexion.newsletterMetadata("invite", code_invitation);
				if (!metadata?.id) {
					//si la recheche avec le lien a echoue
					throw new Error(`[(quitte), "${nom_session}"]: Métadonnées de la chaîne introuvables via le code.`);
				}
				await connexion.newsletterUnfollow(metadata.id);
				//ce code n'est probablement jamais atteint le succès est géré dans le catch
			}
		} catch (e) {
			const message_erreur = e.message || '';
			if (message_erreur.includes('Failed to newsletter unfollow, unexpected response structure')) {
				//gestion de l'erreur de succès on envoie un message neutre
				const metadata = await connexion.newsletterMetadata("invite", code_invitation).catch(() => null);
				const nom_chaine = metadata?.thread_metadata?.name?.text || '';
				const succes_chaine = await trad('msg.succes_chaine', {nom_chaine: nom_chaine}) || `✓Opération terminée pour la chaîne : ~${nom_chaine}~`;
				await connexion.sendMessage(jid,
					//comme on est ne gere pas bien la detection que si si on etait deja pas dans la chaine on envoi un message assez neutre
					{ text: succes_chaine },
					{ quoted: message });
			} else if (e.message?.includes('not a subscriber')) { //hypothèse pour le cas "non abonné"
				const pas_abonne = await trad('msg.pas_abonne') || "> Tu n'étais pas abonné à cette chaîne";
				await connexion.sendMessage(jid,
					//si on arrive a faire la detection on porra envoiyé ce message
					{ text: pas_abonne },
					{ quoted: message });
			} else {
				//si pendans les requete quelque chose d'inatendu c'est produit on le log et envoi une notif
				console.error(`[(quitte), "${nom_session}"]: Erreur dans .quitte (avec lien) :`, e);
				const message_erreur = await trad('msg.message_erreur') || "*Une erreur s'est produite*";
				await connexion.sendMessage(jid,
					{ text: message_erreur },
					{ quoted: message });
			}
		}
	}
};
