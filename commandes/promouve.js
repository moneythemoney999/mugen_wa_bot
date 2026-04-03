/* */

//imports a faire
import { jidNormalizedUser } from "@whiskeysockets/baileys";

//logique
export default {
    nom: "promouve",
    description: "Promeut un membre au statut d\'administrateur.",
    categorie: "Groupes",
    infos: `Utilisation : \`.promouve @MEMBRE\` ou \`.promouve <numéro>\` pour nommer quelqu'un admin.
> Mais il faut être admin pour réussir.`,

    execute: async ({ sock, message, args }) => {
        const jid = message.key.remoteJid;
        const estGroupe = jid.endsWith('@g.us');

        if (!estGroupe) {
            await sock.sendMessage(jid,
		//si c'est uyilliser en prive on previens
	        { text: "C\'est pas utilisable en privé." },
		{ quoted: message });
            return;
        }

        try {
	    //appelle metadata et resolution des IDs
            const metadonneesGroupe = await sock.groupMetadata(jid);
            const participants = metadonneesGroupe.participants;

            const idAuteurBrut = message.key.participant;
            const idBotBrut = sock.user.id;
            const idBotLidBrut = sock.user.lid || idBotBrut;

            const participantAuteur = participants.find(p => p.id === idAuteurBrut);
            const estAdminAuteur = participantAuteur?.admin;

            const idBotLidNormalise = jidNormalizedUser(idBotLidBrut);
            const participantBot = participants.find(p => jidNormalizedUser(p.id) === idBotLidNormalise);
            const estAdminBot = participantBot?.admin;

            const idAuteurNormalise = jidNormalizedUser(idAuteurBrut);
            const estMoi = (idAuteurNormalise === idBotLidNormalise);

            //logique de vérification des permissions
            if (!estAdminAuteur) {
                if (estMoi) {
                    await sock.sendMessage(jid,
			//si c'est moi et que je suis pas admin on envoie un ça
			{ text: "> T\'es pas admin😂🤣." },
			{ quoted: message });
                } else {
                    await sock.sendMessage(jid,
			//poue quelqu'un d'autre qui n'est pas admin
			{ text: "Faut que tu sois admin" },
			{ quoted: message });
                }
                return;
            }

            if (!estAdminBot) {
                await sock.sendMessage(jid,
		    //ça vient d'un admin mais que le bot lui n'est pas admin
		    { text: "Faut me donner les droits d\'administration" },
		    { quoted: message });
                return;
            }

            //logique d'identification des cibles
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
                await sock.sendMessage(jid,
		    //detection d'aucun argument
		    { text: `Qui dois-je promouvoir.
*Répond à un de ses messages ou mets son num ou tag la personne derrière la commande*.
> ex: \`.promouve 56931437983\` \`.promouve @la_personne\`.` },
		    { quoted: message });
                return;
            }

            //logique de promotion
            const ciblesAPromouvoir = [];
            let nonTrouve = false;

            for (const cibleBrute of ciblesInitiales) {
                const cibleNormalisee = jidNormalizedUser(cibleBrute);
                const participant = participants.find(p => jidNormalizedUser(p.id) === cibleNormalisee);

                if (participant) {
                    if (participant.admin) {
                        await sock.sendMessage(jid,
			    //si la cible est deja admin
			    { text: `@${participant.id.split('@')[0]} était déjà administrateur`,
			    mentions: [participant.id] },
			    { quoted: message });
                        continue;
                    }
                    ciblesAPromouvoir.push(participant.id);
                } else {
                    nonTrouve = true;
                }
            }

	    //envoi de requete au serveur de whatsapp
            if (ciblesAPromouvoir.length > 0) {
                try {
                    await sock.groupParticipantsUpdate(jid, ciblesAPromouvoir, "promote");
                } catch (e) {
                    const jidParent = metadonneesGroupe.linkedParent;
                    if (jidParent) {
                        try {
                            await sock.groupParticipantsUpdate(jidParent, ciblesAPromouvoir, "promote");
                        } catch (e2) {
                            throw e2; //relance pour le catch global
                        }
                    } else {
                        throw e; //relance pour le catch global
                    }
                }

                for (const promus of ciblesAPromouvoir) {
                    await sock.sendMessage(jid, {
			//apres les requete si on reussi
                        text: `✓ @${promus.split('@')[0]} a été promu admin.`,
                        mentions: [promus]
                    }, { quoted: message });
                }
            } else if (nonTrouve) {
                await sock.sendMessage(jid,
		    //par contre si on pas trouve la personne dands metadata on envoi ça
		    { text: "~Cette personne n\'est pas un membre du groupe~" },
		    { quoted: message });
            }

        } catch (erreur) {
	    //si une erreur non identifie on le log et envoi un message d'erreur
            console.error(`[(promouve), "${nomSession}"]Erreur dans la commande promouve :`, erreur);
            await sock.sendMessage(jid,
		{ text: "Une erreur est survenue lors de la promotion." },
		{ quoted: message });
        }
    }
};
