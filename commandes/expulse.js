/* */
//imports necessaire
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { traduire} from "../outils/langue.js";

//export et logique de la commandes
export default {
    nom: "expulse",
    description: "Expulse un membre d'un groupe.",
    categorie: "Groupes",
    infos: `Utilisation : \`.expulse @membre\` ou \`.expulse <numéro>\` ou encore en répondant à un message de la personne avec ma commande.

Pour retirer quelqu'un du groupe il fait que tu sois admin du groupe.`,

    execute: async ({ sock, message, args, nomSession }) => {
        const jid = message.key.remoteJid;
        const estGroupe = jid.endsWith('@g.us');
        const trad = (cle, vars = {}) => traduire (nomSession, 'commandes', 'expulse', { [cle] : vars}) [cle];

        if (!estGroupe) {
            //si c'est utiliser en privé
            const msgSi_prive = trad('msg.msgSi_prive') || "C'est pas utilisable en privé";
            await sock.sendMessage(jid,
                { text: msgSi_prive },
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
                    const msgMoi_non_admin = trad("msg.msgMoi_non_admin") || "> T'es pas admin😂🤣";
                    await sock.sendMessage(jid,
                        { text: msgMoi_non_admin },
                        { quoted: message });
                } else {
                    //si quelqu'un d'autre et qu'il n'est pas admin
                    const msgAutre_non_admin = trad('msg.msgAutre_non_admin') || "Faut que tu sois admin";
                    await sock.sendMessage(jid,
                        { text: msgAutre_non_admin },
                        { quoted: message });
                }
                return;
            }

            if (!estAdminBot) {
                const msgBot_non_admin = trad('msg.msgBot_non_admin') || "Faut me donner les droits d'administration";
                await sock.sendMessage(jid,
                    //si un admi mais que le bot n'a pas les droits
                    { text: msgBot_non_admin },
                    { quoted: message });
                return;
            }

            //identification des cibles
            let ciblesInitiales = [];
            const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const numCible = args.find(arg => /^\+?\d+$/.test(arg))?.replace('+', '');
            const auteurReponduBrut = message.message?.extendedTextMessage?.contextInfo?.participant;

            if (mentions.length > 0) {
                ciblesInitiales.push(...mentions);
            } else if (auteurReponduBrut) {
                ciblesInitiales.push(auteurReponduBrut);
            } else if (numCible) {
                ciblesInitiales.push(`${numCible}@s.whatsapp.net`);
            } else {
                const msgPas_de_cible = trad('msg.msgPas_de_cible') || `Qui dois-je expulser.
*Mets son num ou tag la personne derrière la commande* ex: \`.expulse 56931437983\` \`.expulse @la_personne\`.`;
                //si on ne detecte pas de cible
                await sock.sendMessage(jid,
                    { text: msgPas_de_cible},
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
                        const msgSi_cible_bot = trad('msg.msgSi_cible_bot') || "```🫩🫩```";
                        await sock.sendMessage(jid,
                            { text: msgSi_cible_bot},
                            { quoted: message });
                        continue;
                    }
                    if (participant.admin === 'admin' || participant.admin === 'superadmin') {
                        const msgSi_admin = trad('msg.msgSi_admin') || "~Fait le toi même, flemme🥱😪~"
                        await sock.sendMessage(jid,
                            //si la cible est un administrateur on refuse
                            { text: msgSi_admin },
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
                    const msgSucces = trad('msg.msgSucces', {expulse: expulse.split('@')[0]}) || `~@${expulse.split('@')[0]}~ a été viré d'ici`
                    await sock.sendMessage(jid, {
                        text: msgSucces,
                        mentions: [expulse]
                    }, { quoted: message });
                }
            } else if (nonTrouve) {
                //si on trouve pas la personne dans la liste des participant
                const msgCible_non_membre = trad('msg.msgCible_non_membre') || "> Membre introuvable.";
                await sock.sendMessage(jid,
                    { text: msgCible_non_membre},
                    { quoted: message });
            }

        } catch (erreur) {
            //s'il y'a une autre erreur on l'affiche au terminal et envoi un message d'erreur sur whatsapp
            console.error(`[(expulse), "${nomSession}"]: Erreur dans la commande expulse :`, erreur);
            const msgErreur = trad('msg.msgErreur') ||  "Une erreur est survenue lors de l'expulsion.";
            await sock.sendMessage(jid,
                { text: msgErreur},
                { quoted: message });
        }
    }
};
