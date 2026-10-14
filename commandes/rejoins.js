/* */

//imports
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import {traduire} from '../outils/langue.js';

//logique
export default {
	nom: "rejoins",
	description: "Pour rejoindre des groupes, communautés ou s'abonner à des chaînes depuis un lien d'invitation.",
	categorie: "Bot",
	infos: "Utilisation : `.rejoins <lien>` pour rejoindre une discussion.",

	execute: async ({ connexion, message, args, nom_session }) => {
		const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'rejoins', { [cle]: vars }))[cle];
		const est_bot = message.key.fromMe || message.key.remoteJid.endsWith("@newsletter");
		if (!est_bot) {
			//si c'est pas moi
			const pas_le_bot = await trad('msg.pas_le_bot') || "```T'y est pas autorisé```";
			await connexion.sendMessage(message.key.remoteJid,
			{ text: pas_le_bot },
			{ quoted: message });
			return;
		}
		const lien = args[0];
		if (!lien) {
			//s'il ya pas de lien derriere la commandes
			const pas_de_lien = await trad('msg.pas_de_lien') || "> Tu veux rejoindre quoi fait genre `.rejoins <le lien en question>`";
			await connexion.sendMessage(message.key.remoteJid,
				{ text: pas_de_lien },
				{ quoted: message });
			return;
		}
		//nettoyage et verification du lien
		const regex = /(?:https?:\/\/)?(chat\.whatsapp\.com|whatsapp\.com\/channel)\/([A-Za-z0-9_-]+)/;
		const correspondance = lien.match(regex);

		if (!correspondance) {
			const lien_invalide = await trad('msg.lien_invalide') || "```Lien invalide```";
			await connexion.sendMessage(message.key.remoteJid,
				//si le lien ne correspondance pas
				{ text: lien_invalide },
				{ quoted: message });
			return;
		}

		const type_lien = correspondance[1];
		const code_invitation = correspondance[2];
		try {
			//gestion des liens de groupes si le lien correspondance
			if (type_lien.startsWith('chat.whatsapp.com')) {
				const info = await connexion.groupGetInviteInfo(code_invitation);
				const groupes_actuel = await connexion.groupFetchAllParticipating();

				if (groupes_actuel[info.id]) {
					const deja_membre = await trad('msg.deja_membre', {nom_groupe: info.subject}) || `> *Déjà membre de* : _${info.subject}._`;
					await connexion.sendMessage(message.key.remoteJid,
						//si t'es deja membre
						{ text: deja_membre },
						{ quoted: message });
					return;
				}
				await connexion.groupAcceptInvite(code_invitation);
				if (info.joinApprovalMode === true) {
					const attente_aprobation = await trad('msg.attente_aprobation') || "> Demande laissé, en attente de l'approbation des admins";
					await connexion.sendMessage(message.key.remoteJid,
			//si l'abrobation d'un admin est necessaire pour rejoindre
			{ text: attente_aprobation },
			{ quoted: message });
				} else {
					const succes = await trad('msg.succes', {nom_groupe: info.subject}) || `✓Groupe ${info.subject} rejoins avec succès`;
					await connexion.sendMessage(message.key.remoteJid,
						//si on a reussi a rejoindre direct san laisse demande on confirme
						{ text: succes },
						{ quoted: message });
				}
			} else if (type_lien.startsWith('whatsapp.com/channel')) { //gestion des chaine
				const metadata = await connexion.newsletterMetadata("invite", code_invitation);
				if (metadata?.id) {
					await connexion.newsletterFollow(metadata.id);
					//s'abonner aux mises à jour en direct de la chaîne pour recevoir les messages
					if (typeof connexion.subscribeNewsletterUpdates === 'function') {
						await connexion.subscribeNewsletterUpdates(metadata.id).catch(() => {});
					}
					//le succès est géré dans le bloc catch ci-dessous à cause du bug de Baileys
				} else {
					throw new Error(`[(rejoins), "${nom_session}"]: Impossible d'obtenir les métadonnées de la chaîne.`);
				}
			}
		} catch (erreur) {
			const message_erreur = erreur.message || '';
			if (message_erreur.includes('Failed to newsletter follow, unexpected response structure')) {
				//gestion de "l'erreur de succès" pour les chaînes
				const metadata = await connexion.newsletterMetadata("invite", code_invitation).catch(() => null);
				const nom_chaine = metadata?.thread_metadata?.name?.text || '';
				const succes_abonner = await trad('msg.succes_abonner', {mom_chaine : nom_chaine}) || `✓Abonné à la chaîne : ${nom_chaine}`;
				await connexion.sendMessage(message.key.remoteJid,
					//reussite
					{ text: succes_abonner },
					{ quoted: message });
			} else {
				//gestion des vraies erreurs
				const statut = erreur.data?.statut || erreur.output?.statutCode;
				if (statut === 410 || message_erreur.includes('expired')) {
					const lien_expire = await trad('msg.lien_expire') || "> Lien expiré";
					await connexion.sendMessage(message.key.remoteJid,
						//si le lien a expire
						{ text: lien_expire },
						{ quoted: message });
				} else if (statut === 401 || statut === 403 || message_erreur.includes('banned')) {
					const etait_banni = await trad('msg.etait_banni') || "> Impossible t'as été banni";
					await connexion.sendMessage(message.key.remoteJid,
						//si je em suis fait bannir par un admin
						{ text: etait_banni },
						{ quoted: message });
				} else {
					const message_erreur = await trad('msg.message_erreur') || "*Une erreur s'est produite*";
					//une erreur c'est produit on le mentionne
					await connexion.sendMessage(message.key.remoteJid,
						{ text: erreur },
						{ quoted: message });
				}
			}
		}
	}
};
