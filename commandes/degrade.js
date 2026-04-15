/* */
// Imports nécessaires au fichier
import { jidNormalizedUser } from "@whiskeysockets/baileys";

// Export et logique que le fichier principal va venir importer
export default {
    nom: "degrade",
    description: "Rétrograde un administrateur d'un groupe.",
    categorie: "Groupes",
    infos: `Utilisation : \`.degrade @membre\` ou \`.degrade <numéro>\` pour rétrograder un admin.
Mais il faut que tu sois admin aussi et tu ne peux pas rétrograder la personne qui a créé le groupe.`,
    // Logique de la commande
    execute: async ({ sock, message, args }) => {
        const jid = message.key.remoteJid;
        const estGroupe = jid.endsWith('@g.us');
	// Si c'est utilisé en privé, on envoie ça pour ne pas provoquer d'erreurs
        if (!estGroupe) {
            await sock.sendMessage(jid,
		{ text: "C'est pas utilisable en privé." },
		{ quoted: message });
            return;
        }

        try {
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

            // Vérification des permissions
            if (!estAdminAuteur) {
                if (estMoi) {
                    await sock.sendMessage(jid,
			{ text: "> T'es pas admin😂🤣." }, //si c'est moi mais que je suis pas admin
			{ quoted: message });
                } else {
                    await sock.sendMessage(jid, { text: "Faut que tu sois admin" }, //si c'est quelqu'un d'autre et qu'il n'est pas admin
			{ quoted: message });
                }
                return;
            }

            if (!estAdminBot) {
                await sock.sendMessage(jid,
		    { text: "Faut me donner les droits d'administration" }, //si c'est un admin mais que le bot lui n'est pas admin
		    { quoted: message });
                return;
            }

            // Identification des cibles
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
		// S'il n'y a pas de cible précisée
                await sock.sendMessage(jid,
		    { text: `> Qui dois-je rétrograder.
*Répond à un de ses messages ou mets son num ou tag la personne derrière la commande* ex: \`.degrade 56931437983\` ou \`.degrade @la_personne\`.` },
		    { quoted: message });
                return;
            }

            // Rétrogradation
            const ciblesARetrograder = [];
            let nonTrouve = false;

            for (const cibleBrute of ciblesInitiales) {
                let participant;
                if (cibleBrute.endsWith('@s.whatsapp.net')) {
                    participant = participants.find(p => p.phoneNumber === cibleBrute);
                } else {
                    participant = participants.find(p => p.id === cibleBrute);
                }

                if (participant) {
                    if (jidNormalizedUser(participant.id) === idBotLidNormalise) {
			// Si quelqu'un essaie de rétrograder le bot lui-même
                        await sock.sendMessage(jid,
			    { text: "```Je peux pas me rétrograder```" },
			    { quoted: message });
                        continue;
                    }
                    if (participant.admin === 'superadmin') {
			// On n'essaie pas de rétrograder le créateur du groupe pour ne pas provoquer une erreur
                        await sock.sendMessage(jid,
			    { text: "~Impossible de rétrograder le créateur du groupe~" },
			    { quoted: message });
                        continue;
                    }
                    if (!participant.admin) {
			// Si la cible n'était pas admin
                        await sock.sendMessage(jid,
			    { text: `_@${participant.id.split('@')[0]} n'était pas administrateur_`,
			    mentions: [participant.id] },
			    { quoted: message });
                        continue;
                    }
                    ciblesARetrograder.push(participant.id);
                } else {
                    nonTrouve = true;
                }
            }
	    // Envoi des requêtes de rétrogradation à WhatsApp
            if (ciblesARetrograder.length > 0) {
                try {
                    await sock.groupParticipantsUpdate(jid, ciblesARetrograder, "demote");
                } catch (e) {
                    const jidParent = metadonneesGroupe.linkedParent;
                    if (jidParent) {
                        try {
                            await sock.groupParticipantsUpdate(jidParent, ciblesARetrograder, "demote");
                        } catch (e2) {
                            throw e2; // Relance pour le catch global
                        }
                    } else {
                        throw e; // Relance pour le catch global
                    }
                }
		// Après l'envoi des requêtes, si la rétrogradation a réussi
                for (const retrogrades of ciblesARetrograder) {
                    await sock.sendMessage(jid, {
                        text: `✓@${retrogrades.split('@')[0]} a bien été rétrogradé.`,
                        mentions: [retrogrades]
			},
			{ quoted: message });
                }
            } else if (nonTrouve) {
		// Si les requêtes n'ont pas abouti du fait qu'on n'a pas trouvé la personne dans la liste des participants
                await sock.sendMessage(jid,
		    { text: "~Cette personne n'est pas un membre du groupe~" },
		    { quoted: message });
            }

        } catch (erreur) {
	    // S'il y a eu une erreur quelconque, on l'affiche dans le terminal et on envoie un message sur WhatsApp pour le faire savoir.
            console.error(`[(degrade), "${nomSession}"]: Erreur dans la commande degrade :`, erreur);
            await sock.sendMessage(jid,
		{ text: "Une erreur est survenue lors de la rétrogradation." },
		{ quoted: message });
        }
    }
};
