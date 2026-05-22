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

    execute: async ({ sock, message, args, nomSession }) => {
	const trad = (cle, vars = {}) => traduire(nomSession, 'commandes', 'rejoins', { [cle]: vars })[cle];
        if (!message.key.fromMe) {
	    //si c'est pas moi
	    const pas_le_bot = trad('msg.pas_le_bot') || "```T'y est pas autorisé```";
            await sock.sendMessage(message.key.remoteJid,
		{ text: pas_le_bot },
		{ quoted: message });
            return;
        }

        const lien = args[0];
        if (!lien) {
	    //s'il ya pas de lien derriere la command
	    const pas_de_lien = trad('msg.pas_de_lien') || "> Tu veux rejoindre quoi fait genre `.rejoins <le lien en question>`";
            await sock.sendMessage(message.key.remoteJid,
		{ text: pas_de_lien },
		{ quoted: message });
            return;
        }

	//nettoyage et verification du lien
        const regex = /(?:https?:\/\/)?(chat\.whatsapp\.com|whatsapp\.com\/channel)\/([A-Za-z0-9_-]+)/;
        const match = lien.match(regex);

        if (!match) {
	    const lien_invalide = trad('msg.lien_invalide') || "```Lien invalide```";
            await sock.sendMessage(message.key.remoteJid,
		//si le lien ne match pas
		{ text: lien_invalide },
		{ quoted: message });
            return;
        }

        const typeLien = match[1];
        const codeInvitation = match[2];

        try {

	    //gestion des liens de groupes si le lien match
            if (typeLien.startsWith('chat.whatsapp.com')) {
                const info = await sock.groupGetInviteInfo(codeInvitation);
                const groupesActuels = await sock.groupFetchAllParticipating();

                if (groupesActuels[info.id]) {
		    const deja_membre = trad('msg.deja_membre', {nom_groupe: info.subject}) || `> *Déjà membre de* : _${info.subject}._`;
                    await sock.sendMessage(message.key.remoteJid,
			//si t'es deja membre
			{ text: deja_membre },
			{ quoted: message });
                    return;
                }

                await sock.groupAcceptInvite(codeInvitation);

                if (info.joinApprovalMode === true) {
		    const attente_aprobation = trad('msg.attente_aprobation') || "> Demande laissé, en attente de l'approbation des admins";
                    await sock.sendMessage(message.key.remoteJid,
			//si l'abrobation d'un admin est necessaire pour rejoindre
			{ text: attente_aprobation },
			{ quoted: message });
                } else {
		    const succes = trad('msg.succes', {nom_groupe: info.subject}) || `✓Groupe ${info.subject} rejoins avec succès`;
                    await sock.sendMessage(message.key.remoteJid,
			//si on a reussi a rejoindre direct san laisse demande on confirme
			{ text: succes },
			{ quoted: message });
                }

            } else if (typeLien.startsWith('whatsapp.com/channel')) { //gestion des chaine
                const metadata = await sock.newsletterMetadata("invite", codeInvitation);
                if (metadata?.id) {
                    await sock.newsletterFollow(metadata.id);
                    //le succès est géré dans le bloc catch ci-dessous à cause du bug de Baileys
                } else {
                    throw new Error(`[(rejoins), "${nomSession}"]: Impossible d'obtenir les métadonnées de la chaîne.`);
                }
            }

        } catch (erreur) {
            const messageErreur = erreur.message || '';

            if (messageErreur.includes('Failed to newsletter follow, unexpected response structure')) {
                //gestion de "l'erreur de succès" pour les chaînes
                const metadata = await sock.newsletterMetadata("invite", codeInvitation).catch(() => null);
                const nomChaine = metadata?.thread_metadata?.name?.text || '';
		const succes_abonne = trad('msg.succesAbonne', {mom_chaine : nomChaine}) || `✓Abonné à la chaîne : ${nomChaine}`;
                await sock.sendMessage(message.key.remoteJid,
		    //reussite
		    { text: succes_abonne },
		    { quoted: message });
            } else {
                //gestion des vraies erreurs
                const statut = erreur.data?.statut || erreur.output?.statutCode;

                if (statut === 410 || messageErreur.includes('expired')) {
		    const lien_expire = trad('msg.lien_expire') || "> Lien expiré";
                    await sock.sendMessage(message.key.remoteJid,
			//si le lien a expire
			{ text: lien_expire },
			{ quoted: message });
                } else if (statut === 401 || statut === 403 || messageErreur.includes('banned')) {
		     const etait_banni = trad('msg.etait_banni') || "> Impossible t'as été banni";
                     await sock.sendMessage(message.key.remoteJid,
			 //si je em suis fait bannir par un admin
			 { text: etait_banni },
			 { quoted: message });
                } else {
		    const msgErreur = trad('msg.msgErreur') || "*Une erreur s'est produite*";
		    //une erreur c'est produit on le mentionne
                    await sock.sendMessage(message.key.remoteJid,
			{ text: erreur },
			{ quoted: message });
                }
            }
        }
    }
};
