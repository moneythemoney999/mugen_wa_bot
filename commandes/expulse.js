/* */
//imports necessaire
import { jidNormalizedUser } from "@whiskeysockets/baileys";

//export et logique de la commandes
export default {
    nom: "expulse",
    description: "Expulse un membre d'un groupe.",
    categorie: "Groupes",
    infos: `Utilisation : \`.expulse @membre\` ou \`.expulse <numéro>\` ou envore en répondant à un message de la personne avec ma commande.

Pour retirer quelqu'un du groupe il fait que tu sois admin du groupe.`,

    execute: async ({ sock, message, args }) => {
        const jid = message.key.remoteJid;
        const estGroupe = jid.endsWith('@g.us');

        if (!estGroupe) {
	    //si c'est utiliser en privé
            await sock.sendMessage(jid,
		{ text: "C'est pas utilisable en privé" },
		{ quoted: message });
            return;
        }

        try {
            const metadonneesGroupe = await sock.groupMetadata(jid);
            const participants = metadonneesGroupe.participants;

            const idAuteurBrut = message.key.participant;
            const idBotBrut = sock.user.id;
            const idBotLidBrut = sock.user.lid || idBotBrut;

            //on cherche le rôle de l'auteur avec son ID brut (qui est un LID propre)
            const participantAuteur = participants.find(p => p.id === idAuteurBrut);
            const estAdminAuteur = participantAuteur?.admin;

            //on cherche le rôle du bot en utilisant une version NORMALISÉE de son LID
            const idBotLidNormalise = jidNormalizedUser(idBotLidBrut);
            const participantBot = participants.find(p => jidNormalizedUser(p.id) === idBotLidNormalise);
            const estAdminBot = participantBot?.admin;

            //on compare les JIDs normalisés pour savoir si l'auteur est le bot
            const idAuteurNormalise = jidNormalizedUser(idAuteurBrut);
            const estMoi = (idAuteurNormalise === idBotLidNormalise);

            //vérification des permissions
            if (!estAdminAuteur) {
                if (estMoi) {
		    //si c'est moi mais que chuis pas admin
                    await sock.sendMessage(jid,
			{ text: "> T'es pas admin" },
			{ quoted: message });
                } else {
		    //si quelqu'un d'autre et qu'il n'est pas admin
                    await sock.sendMessage(jid,
			{ text: "Faut que tu sois admin" },
			{ quoted: message });
                }
                return;
            }

            if (!estAdminBot) {
                await sock.sendMessage(jid,
		    //si un admi mais que le bot n'a pas les droits
		    { text: "Faut me donner les droits d\'administration" },
		    { quoted: message });
                return;
            }

            //identification des cibles
            let ciblesInitiales = [];
            const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const numCible = args.find(arg => /^\d+$/.test(arg));
            const auteurReponduBrut = message.message?.extendedTextMessage?.contextInfo?.participant;

            if (mentions.length > 0) {
                ciblesInitiales.push(...mentions);
            } else if (auteurReponduBrut) {
                ciblesInitiales.push(auteurReponduBrut);
            } else if (numCible) {
                ciblesInitiales.push(`${numCible}@s.whatsapp.net`);
            } else {
		//si on ne detecte pas de cible
                await sock.sendMessage(jid,
		    { text: `Qui dois-je expulser.
*Mets son num ou tag la personne derrière la commande* ex: \`.expulse 56931437983\` \`.expulse @la_personne\`.`},
		    { quoted: message });
                return;
            }

            //expulsion
            const ciblesAExpulser = [];
            let nonTrouve = false;

            for (const cibleBrute of ciblesInitiales) {
                let participant;
                if (cibleBrute.endsWith('@s.whatsapp.net')) {
                    //cible est un JID (venant d'un numéro@s.whatsapp.net) on cherche dans 'phoneNumber'
                    participant = participants.find(p => p.phoneNumber === cibleBrute);
                } else {
                    //cible est un LID (venant d'une mention/réponse) on cherche dans 'id'
                    participant = participants.find(p => p.id === cibleBrute);
                }

                if (participant) {
                    // On compare avec l'ID normalisé du bot pour être sûr
                    if (jidNormalizedUser(participant.id) === idBotLidNormalise) {
                        await sock.sendMessage(jid,
			    { text: "```🫩🫩```" },
			    { quoted: message });
                        continue;
                    }
                    if (participant.admin === 'admin' || participant.admin === 'superadmin') {
                        await sock.sendMessage(jid,
			    //si la cible est un administrateur on refuse
			    { text: "~Fait le toi même, flemme🥱😪~" },
			    { quoted: message });
                        continue;
                    }
                    ciblesAExpulser.push(participant.id);
                } else {
                    nonTrouve = true;
                }
            }

	    //envoi de la requête a whatsapp
            if (ciblesAExpulser.length > 0) {
                await sock.groupParticipantsUpdate(jid, ciblesAExpulser, "remove");
                for (const expulse of ciblesAExpulser) {
		    //si on reussi on envoi ce message de confirmation
                    await sock.sendMessage(jid, {
                        text: `~@${expulse.split('@')[0]}~ à été viré d'ici.`,
                        mentions: [expulse]
                    }, { quoted: message });
                }
            } else if (nonTrouve) {
		//si on trouve pas la personne dans la liste des participant
                await sock.sendMessage(jid,
		    { text: "> Membre introuvable."},
		    { quoted: message });
            }

        } catch (erreur) {
	    //s'il y'a une autre erreur on l'affiche au terminal et envoi un message d'erreur sur whatsapp
            console.error(`[(expulse), "${nomSession}"]: Erreur dans la commande expulse :`, erreur);
            await sock.sendMessage(jid,
		{ text: "Une erreur est survenue lors de l'expulsion."},
		{ quoted: message });
        }
    }
};
