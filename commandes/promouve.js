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

    execute: async ({ sock, nomSession, message, args }) => {

        const trad = (cle, vars = {}) =>
            traduire(nomSession, 'commandes', 'promouve', { [cle]: vars })[cle];

        const jid = message.key.remoteJid;
        const estGroupe = jid.endsWith('@g.us');

        if (!estGroupe) {
            const msgSi_prive = trad('msg.msgSi_prive') || "C'est pas utilisable en privé.";

            await sock.sendMessage(jid,
                //si c'est utilisé en privé on préviens
                { text: msgSi_prive },
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

                    const msgMoi_non_admin = trad('msg.msgMoi_non_admin') || "> T'es pas admin😂🤣.";

                    await sock.sendMessage(jid,
                        //si c'est moi et que je suis pas admin on envoie un ça
                        { text: msgMoi_non_admin },
                        { quoted: message });

                } else {

                    const msgAutre_non_admin = trad('msg.msgAutre_non_admin') || "Faut que tu sois admin";

                    await sock.sendMessage(jid,
                        //pour quelqu'un d'autre qui n'est pas admin
                        { text: msgAutre_non_admin },
                        { quoted: message });
                }

                return;
            }

            if (!estAdminBot) {

                const msgBot_non_admin = trad('msg.msgBot_non_admin') || "Faut me donner les droits d'administration";

                await sock.sendMessage(jid,
                    //ça vient d'un admin mais que le bot lui n'est pas admin
                    { text: msgBot_non_admin },
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

                const msgPas_de_cible = trad('msg.msgPas_de_cible') || `Qui dois-je promouvoir.
*Répond à un de ses messages ou mets son num ou tag la personne derrière la commande*.
> ex: \`.promouve 56931437983\` \`.promouve @la_personne\`.`;

                await sock.sendMessage(jid,
                    //detection d'aucun argument
                    { text: msgPas_de_cible },
                    { quoted: message });

                return;
            }

            //logique de promotion
            const ciblesAPromouvoir = [];
            let nonTrouve = false;

            for (const cibleBrute of ciblesInitiales) {

                const cibleNormalisee = jidNormalizedUser(cibleBrute);

                const participant = participants.find(
                    p => jidNormalizedUser(p.id) === cibleNormalisee
                );

                if (participant) {

                    if (participant.admin) {

                        const msgCible_deja_admin =
                            trad('msg.msgCible_deja_admin', {
                                cible: participant.id.split('@')[0]
                            }) ||
                            `@${participant.id.split('@')[0]} était déjà administrateur`;

                        await sock.sendMessage(jid,
                            {
                                //si la cible est deja admin
                                text: msgCible_deja_admin,
                                mentions: [participant.id]
                            },
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

                    await sock.groupParticipantsUpdate(
                        jid,
                        ciblesAPromouvoir,
                        "promote"
                    );

                } catch (e) {

                    const jidParent = metadonneesGroupe.linkedParent;

                    if (jidParent) {

                        try {

                            await sock.groupParticipantsUpdate(
                                jidParent,
                                ciblesAPromouvoir,
                                "promote"
                            );

                        } catch (e2) {

                            throw e2; //relance pour le catch global
                        }

                    } else {

                        throw e; //relance pour le catch global
                    }
                }

                for (const promus of ciblesAPromouvoir) {

                    const msgSucces =
                        trad('msg.msgSucces', {
                            cible: promus.split('@')[0]
                        }) ||
                        `✓ @${promus.split('@')[0]} a été promu admin.`;

                    await sock.sendMessage(jid,
                        {
                            //apres les requete si on reussi
                            text: msgSucces,
                            mentions: [promus]
                        },
                        { quoted: message });
                }

            } else if (nonTrouve) {

                const msgCible_non_membre =
                    trad('msg.msgCible_non_membre') ||
                    "~Cette personne n'est pas un membre du groupe~";

                await sock.sendMessage(jid,
                    //par contre si on pas trouve la personne dans metadata
                    { text: msgCible_non_membre },
                    { quoted: message });
            }

        } catch (erreur) {

            //si une erreur non identifie on le log et envoi un message d'erreur
            console.error(`[(promouve), "${nomSession}"] Erreur dans la commande promouve :`, erreur);

            const msgErreur =
                trad('msg.msgErreur') ||
                "Une erreur est survenue lors de la promotion.";

            await sock.sendMessage(jid,
                { text: msgErreur },
                { quoted: message });
        }
    }
};
