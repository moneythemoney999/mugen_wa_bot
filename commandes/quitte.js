/* */

//imports
import { jidNormalizedUser } from "@whiskeysockets/baileys";


//export et logique
export default {
    nom: "quitte",
    description: "Pour quitter des groupes/communautés ou se désabonner à des chaînes.",
    categorie: "Groupes && Privé",
    infos: "Utilisation : `.quitte` dans un groupe, ou `.quitte <lien>` pour quitter une discussion spécifique.",

    execute: async ({ sock, message, args }) => {
        if (!message.key.fromMe) {
            await sock.sendMessage(message.key.remoteJid,
		//si pas moi on refuse
		{ text: "```T'es pas autorisé à exécuter cette commande```" },
		{ quoted: message });
            return;
        }

        const lien = args[0];
        const jid = message.key.remoteJid;

        if (!lien) {
            if (jid.endsWith('@g.us')) {
                try {
                    const groupesActuels = await sock.groupFetchAllParticipating();
                    const infoGroupe = groupesActuels[jid];
                    if (!infoGroupe) {
                        await sock.sendMessage(sock.user.id,
			    //si on n'etait pas membre du groupe
			    { text: "```Je ne suis déjà plus dans ce groupe.```" },
			    { quoted: message });
                        return 'NO_REACTION';
                    }
                    const nomGroupe = infoGroupe.subject;
                    const idBotNormalise = jidNormalizedUser(sock.user.id);
                    await sock.sendMessage(idBotNormalise,
			//message de succes
			{ text: `_Groupe : ${nomGroupe} quitté avec succès._` },
			{ quoted: message});
                    await sock.groupLeave(jid);
                    return 'NO_REACTION';
                } catch (e) {
		    //une erreur non identifié on le log
                    console.error(`[(quitte), "${nomSession}": Erreur dans .quitte (groupe actuel) :`, e);
                }
            } else {
                await sock.sendMessage(jid,
		    { text: `> Inutilisable en privé.
*Où si c'est une autre discussion que tu veux quitter mets le lien de derrière la commande.*` },
		    { quoted: message });
            }
            return;
        }
	//nettoyage et verfication du lien si
        const regex = /(?:https?:\/\/)?(chat\.whatsapp\.com|whatsapp\.com\/channel)\/([A-Za-z0-9_-]+)/;
        const match = lien.match(regex);

        if (!match) {
            await sock.sendMessage(jid,
		//si le lien est invalide
		{ text: "```Lien invalide```" },
		{ quoted: message });
            return;
        }
	//comme c'est valide on continu
        const typeLien = match[1];
        const codeInvitation = match[2];

        try {
	    //si c'est le lien d'un groupe on recupere les infos du groupe
            if (typeLien.startsWith('chat.whatsapp.com')) {
                const info = await sock.groupGetInviteInfo(codeInvitation);
                const groupesActuels = await sock.groupFetchAllParticipating();
                if (!groupesActuels[info.id]) {
                    await sock.sendMessage(jid,
			//si apres verificaton on etait pas membre du groupe on s'arrete sans envoiye de requetes
			{ text: "> Tu n'étais pas membre de la discussion" },
			{ quoted: message });
                    return;
                }
		//mais si le contraire on est bien dans le groupe on envoit la requete a whatsapp
                await sock.groupLeave(info.id);
                await sock.sendMessage(jid,
		    //puis si on reussi on le confirme
		    { text: `*Discussion quittée avec succès* : ~${info.subject}~` },
		    { quoted: message });

            } else if (typeLien.startsWith('whatsapp.com/channel')) { // dans le cas d'une chaine c'est un peu le meme delire mais en envoiyant "unfollow" au lieu de "leave"
                const metadata = await sock.newsletterMetadata("invite", codeInvitation);
                if (!metadata?.id) {
		     //si la recheche avec le lien a echoue
                     throw new Error(`[(quitte), "${nomSession}"]: Métadonnées de la chaîne introuvables via le code.`);
                }
                await sock.newsletterUnfollow(metadata.id);
                //ce code n'est probablement jamais atteint le succès est géré dans le catch
            }
        } catch (e) {
            const messageErreur = e.message || '';
            if (messageErreur.includes('Failed to newsletter unfollow, unexpected response structure')) {
                //gestion de l'erreur de succès on envoie un message neutre
                const metadata = await sock.newsletterMetadata("invite", codeInvitation).catch(() => null);
                const nomChaine = metadata?.thread_metadata?.name?.text || '';
                await sock.sendMessage(jid,
		    //comme on est ne gere pas bien la detection que si si on etait deja pas dans la chaine on envoi un message assez neutre
		    { text: `✓ Opération terminée pour la chaîne : ~${nomChaine}~` },
		    { quoted: message });
            } else if (e.message?.includes('not a subscriber')) { //hypothèse pour le cas "non abonné"
                 await sock.sendMessage(jid,
		     //si on arrive a faire la detection on porra envoiyé ce message
		     { text: "> Tu n'étais pas abonné à cette chaîne" },
		     { quoted: message });
            } else {
		//si pendans les requete quelque chose d'inatendu c'est produit on le log et envoi une notif
                console.error(`[(quitte), "${nomSession}"]: Erreur dans .quitte (avec lien) :`, e);
                await sock.sendMessage(jid,
		    { text: "*Une erreur s'est produite*" },
		    { quoted: message });
            }
        }
    }
};
