/* */

//imports
import { jidNormalizedUser } from "@whiskeysockets/baileys";

//logique
export default {
    nom: "rejoins",
    description: "Pour rejoindre des groupes, communautés ou s'abonner à des chaînes depuis un lien d'invitation.",
    categorie: "Bot",
    infos: "Utilisation : `.rejoins <lien>` pour rejoindre une discussion.",

    execute: async ({ sock, message, args }) => {
        if (!message.key.fromMe) {
	    //si c'est pas moi
            await sock.sendMessage(message.key.remoteJid,
		{ text: "```T'y est pas autorisé```" },
		{ quoted: message });
            return;
        }

        const lien = args[0];
        if (!lien) {
	    //s'il ya pas de lien derriere la commande
            await sock.sendMessage(message.key.remoteJid,
		{ text: "> Tu veux rejoindre quoi fait genre `.rejoins <le lien en question>`" },
		{ quoted: message });
            return;
        }

	//nettoyage et verification du lien
        const regex = /(?:https?:\/\/)?(chat\.whatsapp\.com|whatsapp\.com\/channel)\/([A-Za-z0-9_-]+)/;
        const match = lien.match(regex);

        if (!match) {
            await sock.sendMessage(message.key.remoteJid,
		//si le lien ne match pas
		{ text: "```Lien invalide```" },
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
                    await sock.sendMessage(message.key.remoteJid,
			//si t'es deja membre
			{ text: `> *Déjà membre de* : _${info.subject}._` },
			{ quoted: message });
                    return;
                }

                await sock.groupAcceptInvite(codeInvitation);

                if (info.joinApprovalMode === true) {
                    await sock.sendMessage(message.key.remoteJid,
			//si l'abrobation d'un admin est necessaire pour rejoindre
			{ text: "> J'ai laissé une demande, en attente de l'approbation des admins" },
			{ quoted: message });
                } else {
                    await sock.sendMessage(message.key.remoteJid,
			//si on a reussi a rejoindre direct san laisse demande on confirme
			{ text: `✓ J'ai bien rejoint le groupe : ${info.subject}` },
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
                await sock.sendMessage(message.key.remoteJid,
		    //reussite
		    { text: `✓ Je me suis abonné à la chaîne : ${nomChaine}` },
		    { quoted: message });
            } else {
                //gestion des vraies erreurs
                const statut = erreur.data?.statut || erreur.output?.statutCode;

                if (statut === 410 || messageErreur.includes('expired')) {
                    await sock.sendMessage(message.key.remoteJid,
			//si le lien a expire
			{ text: "> Lien expiré" },
			{ quoted: message });
                } else if (statut === 401 || statut === 403 || messageErreur.includes('banned')) {
                     await sock.sendMessage(message.key.remoteJid,
			 //si je em suis fait bannir par un admin
			 { text: "> Impossible t'as été banni" },
			 { quoted: message });
                } else {
		    //une erreur c'est produit on le mentionne
                    await sock.sendMessage(message.key.remoteJid, { text: "*Une erreur s'est produite*" }, { quoted: message });
                }
            }
        }
    }
};
