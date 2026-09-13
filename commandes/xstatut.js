/* Cette commandes telechage directos tous les statut et les sauvegarde pour que quand tu aime un statut il puisse te l'envoiyé.
Pourquoi utilliser le disque c'est parceque whasapp pour economiser la bande passante n'envoi les vrai statut que lorqu'il sont mis pour la premiere fois.
Ce qui fait que quand tu aime le statut whatsapp n'envoi que que l'id du j'aime le j'aime et l'id du statut auquel il est associé.
Si non sans ce stockage il falllait utiliser la Ram ce qui ne garde les infos qu'un instant ou faire la commandes manuellement ce qui oblige whatsapp à envoiyé le statut.
Pour ne pas staturer le disque on suprime tout les 24h et si le statut est suprimmer par son auteur. */

//imports nécessaires
import { promises as fs } from 'fs';
import path from 'path';
import { downloadMediaMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import { traduire } from '../outils/langue.js';

//variables de la base de données et le temps de nettoyage
const CHEMIN_BASE = path.join(process.cwd(), 'memoires', 'memoires_commandes', 'xstatut');
const DUREE_24H = 24 * 60 * 60 * 1000;

//fonction utilitaire pour préparer le dossier de session
async function preparerDossier(nom_session) {
    const dossier = path.join(CHEMIN_BASE, nom_session);
    await fs.mkdir(dossier, { recursive: true });
    return dossier;
}

//gestion de la base de données JSON unique (texte.json) par session
async function gererBaseDonnees(nom_session, nouvelleEntree = null) {
    const dossier = await preparerDossier(nom_session);
    const cheminBaseDo = path.join(dossier, 'texte.json');
    let baseDo = [];

    if (await fs.access(cheminBaseDo).then(() => true).catch(() => false)) {
        try {
            baseDo = JSON.parse(await fs.readFile(cheminBaseDo, 'utf-8'));
        } catch (erreur) {
            baseDo = [];
        }
    }

    const maintenant = Date.now();

    //nettoyage automatique : on ne garde que les statuts de moins de 24h
    const baseDoFiltre = [];
    for (const element of baseDo) {
        const estValide = (maintenant - element.date) < DUREE_24H;
        if (!estValide && element.type !== 'texte') {
            const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
            const cheminMedia = path.join(dossier, `${element.id}${extension}`);
            try {
                await fs.unlink(cheminMedia);
            } catch (e) {}
        } else {
            baseDoFiltre.push(element);
        }
    }

    if (nouvelleEntree) {
        baseDoFiltre.push(nouvelleEntree);
    }

    await fs.writeFile(cheminBaseDo, JSON.stringify(baseDoFiltre, null, 2));
    return baseDoFiltre;
}

//export et vraie logique de la commande
export default {
    nom: "xstatut",
    description: `Récupérer les statuts des gens.`,
    categorie: "Statuts",
    infos: `Pour récupérer les statuts :
Soit en _répondant au statut de la personne ou en aimant le statut_ *attention si c'est en aimant le statut il sera envoyé à toi pas dans le chat de la personne qui a mis le statut*.`,
    execute: async ({ connexion, message, arguments, nom_session }) => {

	const trad = (cle, vars = {}) => traduire(nom_session, 'commandes', 'xstatut', { [cle]: vars })[cle];

	//PARTIE AVEC MANUELLE
        if (!message.key.fromMe) return;

        const infosContexte = message.message?.extendedTextMessage?.contextInfo;
        const msgRepondu = infosContexte?.quotedMessage;
	//partie manuelle: si pas de reponse à aucun message
        if (!msgRepondu) {
	    const pas_de_cible = trad('msg.pas_de_cible') || "Il est où le statut à recuper  ";
            return connexion.sendMessage(message.key.remoteJid,
		{ text: pas_de_cible },
		{ quoted: message });
        }

        const estUnStatut = infosContexte?.remoteJid === 'status@broadcast' || (infosContexte?.participant && infosContexte.participant.endsWith('status@broadcast'));
	//partie manuelle: s'il y'a reponse mais que c'est pas à un statut
        if (!estUnStatut) {
	    const cible_pas_statut = trad('msg.cible_pas_statut') || "_C'est pas un statut c'truc_";
            return connexion.sendMessage(message.key.remoteJid,
		{ text: cible_pas_statut },
		{ quoted: message });
        }

        const destination = message.key.remoteJid;
        try {
            const texte = msgRepondu.conversation || msgRepondu.extendedTextMessage?.text;
	    //partie manuelle: si reponse à un statut (texte)
            if (texte) {
		const manuel_statut_texte = trad('msg.manuel_statut_texte', {texte: texte}) || `> ${texte}`;
                await connexion.sendMessage(destination,
		    { text: manuel_statut_texte }, { quoted: message });
            } /*si c'est plutot une image/video*/ else if (msgRepondu.imageMessage || msgRepondu.videoMessage) {
                const tampon = await downloadMediaMessage({ key: { id: infosContexte.stanzaId }, message: msgRepondu }, 'buffer', {});
                const type = msgRepondu.imageMessage ? 'image' : 'video';
		const manuel_statut_media = trad('msg.manuel_statut_media', {legende: msgRepondu[type + 'Message'].caption || ""}) || (msgRepondu[type + 'Message'].caption || "");
                await connexion.sendMessage(destination, { [type]: tampon,
		    caption: manuel_statut_media },
		    { quoted: message });
            } /*pour les audio*/ else if (msgRepondu.audioMessage) {
                const tampon = await downloadMediaMessage({ key: { id: infosContexte.stanzaId }, message: msgRepondu }, 'buffer', {});
                await connexion.sendMessage(destination, { audio: tampon, mimetype: 'audio/mp4' }, { quoted: message });
            }
        } /*s'il est arrivé une erreur*/ catch (erreur) {
	    const erreur_recuperation = trad('msg.erreur_recuperation') || "Impossible de récupérer ce média.";
            await connexion.sendMessage(destination,
		{ text: erreur_recuperation },
		{ quoted: message });
        }
    },

    //PARTIE SANS COMMANDES
    evenements_sans_prefixe: async ({ connexion, message, nom_session }) => {
	const trad = (cle, vars = {}) => traduire(nom_session, 'commandes', 'xstatut', { [cle]: vars })[cle];
	//definition des evenments de statuts
        const estStatutBroadcast = message.key.remoteJid === 'status@broadcast';
        if (!estStatutBroadcast) return; //si l'evenment ne correspond pas à notre definition des statuts on ignore

	//recuperation de l'objet message.message que whatsapp va envoiyé
        const msg = message.message;
        if (!msg) return;

        const jidBot = jidNormalizedUser(connexion.user.id);
        const lidBotBrut = connexion.user.lid || trad('msg.lidBotBrut_inconnu') || 'inconnu';
        const lidBotNettoye = lidBotBrut.split(':')[0] + '@lid';

        //1. gestion des reaction: definition des variable de reaction de, la personne a mis et si cette personne est moi
        if (msg.reactionMessage) {
            const reaction = msg.reactionMessage;
            const participantAction = message.key.participant || trad('msg.participantAction_inconnu') || 'inconnu';
            const estMaReaction = message.key.fromMe || (participantAction === jidBot) || (participantAction === lidBotNettoye);

	    //si c'est pas de moi on ignore
            if (!estMaReaction) return;

            const id = reaction.key.id;
            const baseDo = await gererBaseDonnees(nom_session);
            const element = baseDo.find(el => el.id === id);

            if (!element) return;

            const jidCible = jidBot;
            const heure = new Date(element.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            //resolution des IDs
            let auteurJid = element.participant;
            if (auteurJid.endsWith('@lid')) {
                try {
                    const pn = await connexion.signalRepository.lidMapping.getPNForLID(auteurJid);
                    if (pn) auteurJid = pn;
                } catch (e) {}
            }
            const jidNettoye = jidNormalizedUser(auteurJid);
            const numero = jidNettoye.split('@')[0];
	    //message qu'on mets lors de l'envoi de statut
	    const piedDePage = trad('msg.format_legende', {
                auteur: element.pushName || numero,
                numero: numero,
                heure: heure
                }) || `\n> *De ${element.pushName || numero} (+${numero}) à ${heure}*`;

            try {
		//pour les textes on mets mets le messsage et le message (piedDePage) en sautant de ligne
                if (element.type === "texte") {
		    const auto_statut_texte = trad('msg.auto_statut_texte', {
			texte: element.texte,
			pied_de_page: piedDePage
			}) || `${element.texte}${piedDePage}`;
                    await connexion.sendMessage(jidCible,
			{ text: auto_statut_texte });
                } else {
                    const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
                    const cheminMedia = path.join(await preparerDossier(nom_session), `${id}${extension}`);
                    if (!(await fs.access(cheminMedia).then(() => true).catch(() => false))) return;

                    const tampon = await fs.readFile(cheminMedia);
		    const legende = element.texte ? trad('msg.legende', {
			texte: element.texte,
			pied_de_page: `\n${piedDePage.trim()}`
			}) || `${element.texte}${piedDePage}` : piedDePage.trim();

		    //si image on mets en legende
                    if (element.type === "image") {
			const legende_auto_image = trad('msg.legende_auto_image', {legende: legende}) || `${legende}`;
			await connexion.sendMessage(jidCible, { image: tampon, caption: legende_auto_image });
			}
		    //de meme pour les videos
                    else if (element.type === "video") {
			const legende_auto_video = trad('msg.legende_auto_video', {legende: legende}) || `${legende}`;
			await connexion.sendMessage(jidCible, { video: tampon, caption: legende_auto_video });
			}
		    //mais pou les audio comme on peut mettre ni legende ni apres saut à la ligne on envoi le message en reponse après l'audio
                    else if (element.type === "audio") {
                        const m = await connexion.sendMessage(jidCible, { audio: tampon, mimetype: 'audio/mp4', ptt: true });
			const legende_auto_audio = trad('msg.legende_auto_audio', {message: piedDePage.trim()}) || `${piedDePage.trim()}`;
                        await connexion.sendMessage(jidCible, { text: legende_auto_audio }, { quoted: m });
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
                const dossier = await preparerDossier(nom_session);
                const cheminBaseDo = path.join(dossier, 'texte.json');

                if (await fs.access(cheminBaseDo).then(() => true).catch(() => false)) {
                    let baseDo = JSON.parse(await fs.readFile(cheminBaseDo, 'utf-8'));
                    const indice = baseDo.findIndex(element => element.id === idOrigine);

                    if (indice !== -1) {
                        const element = baseDo[indice];
                        if (element.type !== 'texte') {
                            const extension = element.type === 'image' ? '.jpg' : (element.type === 'video' ? '.mp4' : '.mp3');
                            const cheminMedia = path.join(dossier, `${idOrigine}${extension}`);
                            try {
                                await fs.unlink(cheminMedia);
                            } catch (erreur) {}
                        }
                        baseDo.splice(indice, 1);
                        await fs.writeFile(cheminBaseDo, JSON.stringify(baseDo, null, 2));
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
                    const pn = await connexion.signalRepository.lidMapping.getPNForLID(auteurJid);
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
                    await fs.writeFile(path.join(await preparerDossier(nom_session), `${entree.id}${extension}`), tampon);
                } catch (erreur) {}
            }
            await gererBaseDonnees(nom_session, entree);
        }
    }
};