/* Cette commandes telechage directos tous les statut et les sauvegarde pour que quand tu aime un statut il puisse te l'envoiyé.
Pourquoi utilliser le disque c'est parceque whasapp pour economiser la bande passante n'envoi les vrai statut que lorqu'il sont mis pour la premiere fois.
Ce qui fait que quand tu aime le statut whatsapp n'envoi que que l'id du j'aime le j'aime et l'id du statut auquel il est associé.
Si non sans ce stockage il falllait utiliser la Ram ce qui ne garde les infos qu'un instant ou faire la commandes manuellement ce qui oblige whatsapp à envoiyé le statut.
Pour ne pas staturer le disque on suprime tout les 24h et si le statut est suprimmer par son auteur. */

//imports nécessaires
import { downloadMediaMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

//variables de la base de données et le temps de nettoyage
const CHEMIN_BASE = path.join(process.cwd(), 'memoires', 'memoires_commandes', 'xstatut');
const DUREE_24H = 24 * 60 * 60 * 1000;

//fonction utilitaire pour préparer le dossier de session
function preparerDossier(nomSession) {
    const dossier = path.join(CHEMIN_BASE, nomSession);
    if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });
    return dossier;
}

//gestion de la base de données JSON unique (texte.json) par session
async function gererBaseDonnees(nomSession, nouvelleEntree = null) {
    const dossier = preparerDossier(nomSession);
    const cheminBaseDo = path.join(dossier, 'texte.json');
    let baseDo = [];

    if (fs.existsSync(cheminBaseDo)) {
        try {
            baseDo = JSON.parse(fs.readFileSync(cheminBaseDo, 'utf-8'));
        } catch (erreur) {
            baseDo = [];
        }
    }

    const maintenant = Date.now();

    //nettoyage automatique : on ne garde que les statuts de moins de 24h
    const baseDoFiltre = baseDo.filter(element => {
        const estValide = (maintenant - element.date) < DUREE_24H;
        if (!estValide && element.type !== 'texte') {
            const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
            const cheminMedia = path.join(dossier, `${element.id}${extension}`);
            if (fs.existsSync(cheminMedia)) {
                try { fs.unlinkSync(cheminMedia); } catch (e) {}
            }
        }
        return estValide;
    });

    if (nouvelleEntree) {
        baseDoFiltre.push(nouvelleEntree);
    }

    fs.writeFileSync(cheminBaseDo, JSON.stringify(baseDoFiltre, null, 2));
    return baseDoFiltre;
}

//export et vraie logique de la commande
export default {
    nom: "xstatut",
    description: `Récupérer les statuts des gens.`,
    categorie: "Statuts",
    infos: `Pour récupérer les statuts :
Soit en _répondant au statut de la personne ou en aimant le statut_ *attention si c'est en aimant le statut il sera envoyé à toi pas dans le chat de la personne qui a mis le statut*.`,
    execute: async ({ sock, message, args, nomSession }) => {
	//PARTIE AVEC MANUELLE
        if (!message.key.fromMe) return;

        const infosContexte = message.message?.extendedTextMessage?.contextInfo;
        const msgRepondu = infosContexte?.quotedMessage;
	//partie manuelle: si pas de reponse à aucun message
        if (!msgRepondu) {
            return sock.sendMessage(message.key.remoteJid, { text: "Il est où le statut à recuper 🫉" }, { quoted: message });
        }

        const estUnStatut = infosContexte?.remoteJid === 'status@broadcast' || (infosContexte?.participant && infosContexte.participant.endsWith('status@broadcast'));
	//partie manuelle: s'il y'a reponse mais que c'est pas à un statut
        if (!estUnStatut) {
            return sock.sendMessage(message.key.remoteJid, { text: "_C'est pas un statut c'truc_" }, { quoted: message });
        }

        const destination = message.key.remoteJid;
        try {
            const texte = msgRepondu.conversation || msgRepondu.extendedTextMessage?.text;
	    //partie manuelle: si reponse à un statut (texte)
            if (texte) {
                await sock.sendMessage(destination, { text: `> ${texte}` }, { quoted: message });
            } /*si c'est plutot une image/video*/ else if (msgRepondu.imageMessage || msgRepondu.videoMessage) {
                const tampon = await downloadMediaMessage({ key: { id: infosContexte.stanzaId }, message: msgRepondu }, 'buffer', {});
                const type = msgRepondu.imageMessage ? 'image' : 'video';
                await sock.sendMessage(destination, { [type]: tampon, caption: msgRepondu[type + 'Message'].caption || "" },
		    { quoted: message });
            } /*pour les audio*/ else if (msgRepondu.audioMessage) {
                const tampon = await downloadMediaMessage({ key: { id: infosContexte.stanzaId }, message: msgRepondu }, 'buffer', {});
                await sock.sendMessage(destination, { audio: tampon, mimetype: 'audio/mp4' }, { quoted: message });
            }
        } /*s'il est arrivé une erreur*/ catch (erreur) {
            await sock.sendMessage(destination, { text: "Impossible de récupérer ce média." }, { quoted: message });
        }
    },

    //PARTIE SANS COMMANDES
    handleNonCommand: async ({ sock, message, nomSession }) => {
	//definition des evenments de statuts
        const estStatutBroadcast = message.key.remoteJid === 'status@broadcast';
        if (!estStatutBroadcast) return; //si l'evenment ne correspond pas à notre definition des statuts on ignore

	//recuperation de l'objet message.message que whatsapp va envoiyé
        const msg = message.message;
        if (!msg) return;

        const jidBot = jidNormalizedUser(sock.user.id);
        const lidBotBrut = sock.user.lid || 'inconnu';
        const lidBotNettoye = lidBotBrut.split(':')[0] + '@lid';

        //1. gestion des reaction: definition des variable de reaction de, la personne a mis et si cette personne est moi
        if (msg.reactionMessage) {
            const reaction = msg.reactionMessage;
            const participantAction = message.key.participant || 'inconnu';
            const estMaReaction = message.key.fromMe || (participantAction === jidBot) || (participantAction === lidBotNettoye);

	    //si c'est pas de moi on ignore
            if (!estMaReaction) return;

            const id = reaction.key.id;
            const baseDo = await gererBaseDonnees(nomSession);
            const element = baseDo.find(el => el.id === id);

            if (!element) return;

            const jidCible = jidBot;
            const heure = new Date(element.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            //resolution des IDs
            let auteurJid = element.participant;
            if (auteurJid.endsWith('@lid')) {
                try {
                    const pn = await sock.signalRepository.lidMapping.getPNForLID(auteurJid);
                    if (pn) auteurJid = pn;
                } catch (e) {}
            }
            const jidNettoye = jidNormalizedUser(auteurJid);
            const numero = jidNettoye.split('@')[0];
	    //message qu'on mets lors de l'envoi de statut
            const piedDePage = `\n> De ${element.pushName || numero} (+${numero}) à ${heure}`;

            try {
		//pour les textes on mets mets le messsage mets le message (piedDePage) en sautant de ligne
                if (element.type === "texte") {
                    await sock.sendMessage(jidCible, { text: `${element.texte}${piedDePage}` });
                } else {
                    const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
                    const cheminMedia = path.join(preparerDossier(nomSession), `${id}${extension}`);
                    if (!fs.existsSync(cheminMedia)) return;

                    const tampon = fs.readFileSync(cheminMedia);
                    const legende = element.texte ? `${element.texte}${piedDePage}` : piedDePage.trim();

		    //si image on mets en legende
                    if (element.type === "image") await sock.sendMessage(jidCible, { image: tampon, caption: legende });
		    //de meme pour les videos
                    else if (element.type === "video") await sock.sendMessage(jidCible, { video: tampon, caption: legende });
		    //mais pou les audio comme on peut mettre ni legende ni apres saut à la ligne on envoi le message en reponse après l'audio
                    else if (element.type === "audio") {
                        const m = await sock.sendMessage(jidCible, { audio: tampon, mimetype: 'audio/mp4', ptt: true });
                        await sock.sendMessage(jidCible, { text: piedDePage.trim() }, { quoted: m });
                    }
                }
            } catch (erreur) {}
            return;
        }

        //2. capture et sauvegarde des statuts dans la memoires
	//ça se fera que si c'est pas de moi
        if (!message.key.fromMe) {
            //nettoyage immédiat si suppression(revoke)
            if (msg.protocolMessage && msg.protocolMessage.type === 0) {
                const idOrigine = msg.protocolMessage.key.id;
                const dossier = preparerDossier(nomSession);
                const cheminBaseDo = path.join(dossier, 'texte.json');

                if (fs.existsSync(cheminBaseDo)) {
                    let baseDo = JSON.parse(fs.readFileSync(cheminBaseDo, 'utf-8'));
                    const indice = baseDo.findIndex(element => element.id === idOrigine);

                    if (indice !== -1) {
                        const element = baseDo[indice];
                        if (element.type !== 'texte') {
                            const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
                            const cheminMedia = path.join(dossier, `${idOrigine}${extension}`);
                            if (fs.existsSync(cheminMedia)) {
                                try { fs.unlinkSync(cheminMedia); } catch (erreur) {}
                            }
                        }
                        baseDo.splice(indice, 1);
                        fs.writeFileSync(cheminBaseDo, JSON.stringify(baseDo, null, 2));
                    }
                }
                return;
            }

            //capture de statut classique
            let type = "texte";
            if (msg.imageMessage) type = "image";
            else if (msg.videoMessage) type = "video";
            else if (msg.audioMessage) type = "audio";

            //resolution LID -> PN dès la capture
            let auteurJid = message.key.participant || '';
            if (auteurJid.endsWith('@lid')) {
                try {
                    const pn = await sock.signalRepository.lidMapping.getPNForLID(auteurJid);
                    if (pn) auteurJid = pn;
                } catch (e) {}
            }
            const jidParticipantNettoye = jidNormalizedUser(auteurJid);

	    //construction du fichier texte.json
            const entree = {
                id: message.key.id,
                participant: jidParticipantNettoye,
                pushName: message.pushName,
                texte: msg.imageMessage?.caption || msg.videoMessage?.caption || msg.conversation || msg.extendedTextMessage?.text || "",
                date: Date.now(),
                type: type
            };

            if (type !== "texte") {
                try {
                    const tampon = await downloadMediaMessage(message, 'buffer', {});
                    const extension = type === 'image' ? '.jpg' : (type === 'video' ? '.mp4' : '.mp3');
                    fs.writeFileSync(path.join(preparerDossier(nomSession), `${entree.id}${extension}`), tampon);
                } catch (erreur) {}
            }
            await gererBaseDonnees(nomSession, entree);
        }
    }
};
