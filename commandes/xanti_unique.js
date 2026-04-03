/* */

//les imports
import { downloadMediaMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

//congiguration des LIMITES
const LIMITES_UTILISATION = {
    BOT: 50,
    ADMIN: 5,
    MEMBRE: 3,
};

//logique d'export
export default {
    nom: "xanti_unique",
    description: "Débloque les messages en vue unique.",
    categorie: "Groupes && Privé",
    infos: `*Pour l'utiliser peut importe l'endroit il faut répondre au média souhaité et il faut que se soit vraiment un message en vue unique*.
\`La commande à aussi un argument *prive* lui qui envera le message debloqué a soit meme au lieu du chat actuel.\`

> _Il ya aussi une limite d'utilisation par jour dans les groupes \`${LIMITES_UTILISATION.ADMIN}\` pour les admin, \`${LIMITES_UTILISATION.MEMBRE}\` pour ceux qui ne sont pas admin et \`${LIMITES_UTILISATION.BOT}\` pour le bot lui même_.

> *Et en privé seul le bot peut l'utiliser si l'interlocuteur essaie ~il sera bloqué~*.`,

    execute: async ({ sock, message, args, nomSession }) => {
        const jid = message.key.remoteJid;
        const estGroupe = jid.endsWith('@g.us');
        const estPriveDemande = args[0]?.toLowerCase() === 'prive';

        //sous-commande 'prive' réservée au propriétaire
        if (estPriveDemande && !message.key.fromMe) {
            return; //silence si ce n'est pas le propriétaire
        }

        let limite;
        let donneesUtilisateur;

        //gestion des RESTRICTIONS & LIMITES
        if (estGroupe) {
            const expediteurJid = message.key.participant;
            if (!expediteurJid) return;

            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            let metadonneesGroupe;
            try {
                metadonneesGroupe = await sock.groupMetadata(jid);
            } catch (e) {
                console.error(`[(xanti_unique), "${nomSession}"]: Erreur métadonnées:`, e);
                return sock.sendMessage(jid, { text: "Erreur lors de la récupération des infos du groupe." }, { quoted: message });
            }

            const nomGroupeNettoye = (metadonneesGroupe.subject || "groupe").replace(/[\/\\?%*:|"<>]/g, '-');
            const cheminDossierGroupe = path.join(__dirname, '..', 'memoires', 'memoires_commandes', 'xanti_unique', nomSession, 'groupes', `${nomGroupeNettoye}_${jid.split('@')[0]}`);
            fs.mkdirSync(cheminDossierGroupe, { recursive: true });
            const cheminFichierUtilisateur = path.join(cheminDossierGroupe, `${expediteurJid.split('@')[0]}.json`);

            donneesUtilisateur = { NOM: message.pushName, NUM: expediteurJid, LIMITE: 0, DATE: '' };
            try {
                if (fs.existsSync(cheminFichierUtilisateur)) {
                    donneesUtilisateur = JSON.parse(fs.readFileSync(cheminFichierUtilisateur, 'utf-8'));
                }
            } catch (e) { console.error(`[(xanti_unique), "${nomSession}"]; Erreur lecture:`, e); }

            const dateActuelle = new Date().toISOString().split('T')[0];
            if (donneesUtilisateur.DATE !== dateActuelle) {
                donneesUtilisateur.LIMITE = 0;
                donneesUtilisateur.DATE = dateActuelle;
            }
            donneesUtilisateur.NOM = message.pushName;

            limite = LIMITES_UTILISATION.MEMBRE;
            if (message.key.fromMe) {
                limite = LIMITES_UTILISATION.BOT;
            } else {
                const participant = metadonneesGroupe.participants.find(p => p.id === expediteurJid);
                if (participant?.admin) {
                    limite = LIMITES_UTILISATION.ADMIN;
                }
            }

            if (donneesUtilisateur.LIMITE >= limite) {
		//quand quelqu'un atteint la limite
                return sock.sendMessage(jid, { text: `Tu as atteint ta limite d'utilisation (${limite}).` },
		    { quoted: message });
            }

            donneesUtilisateur.LIMITE++;
            fs.writeFileSync(cheminFichierUtilisateur, JSON.stringify(donneesUtilisateur, null, 2));

        } else if (!message.key.fromMe) {
	    //en prive si c'est pas moi ou si le message vient de moi dans un groupe
            return sock.sendMessage(jid, { text: "Tu ne peux pas utiliser cette commande." },
		{ quoted: message });
        }

        //detections du media
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        let msgRepondu = contextInfo?.quotedMessage;

        if (!msgRepondu) {
	    //si le message n'est pas vraiment une vue unique
            return sock.sendMessage(jid, { text: "Tu dois répondre à un média en vue unique." },
		{ quoted: message });
        }

        //support V2
        if (msgRepondu.viewOnceMessageV2) msgRepondu = msgRepondu.viewOnceMessageV2.message;
        if (msgRepondu.viewOnceMessage) msgRepondu = msgRepondu.viewOnceMessage.message;

	//liste des types de message considere comme vue unique
        const typeMedia = msgRepondu.imageMessage ? "image" : msgRepondu.videoMessage ? "video" : msgRepondu.audioMessage ? "audio" : null;
        const media = msgRepondu.imageMessage || msgRepondu.videoMessage || msgRepondu.audioMessage;

        if (!typeMedia || !media) {
	    //si le contenue du message ne conrespond pas l'un des types
            return sock.sendMessage(jid, { text: "Ce message n'est pas un média en vue unique reconnu." },
		{ quoted: message });
        }

        //preparation du transfer
        const destination = estPriveDemande ? jidNormalizedUser(sock.user.id) : jid;
        const jidBrutAuteur = contextInfo.participant;
        let auteurJid = jidNormalizedUser(jidBrutAuteur);

        //résolution du LID en numéro (JID) si nécessaire
        if (jidBrutAuteur && jidBrutAuteur.endsWith('@lid')) {
            try {
                const pn = await sock.signalRepository.lidMapping.getPNForLID(jidBrutAuteur);
                if (pn) {
                    auteurJid = jidNormalizedUser(pn);
                }
            } catch (e) {
                console.error(`[(xanti_unique), "${nomSession}"]; Impossible de résoudre le LID ${jidBrutAuteur}:`, e);
            }
        }

        const numeroAuteur = auteurJid.split('@')[0];
        const nomAuteur = message.pushName || numeroAuteur;
        const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        //récupération du nom du groupe si c'est un groupe
        let nomGroupe = "";
        if (estGroupe) {
            try {
                const meta = await sock.groupMetadata(jid);
                nomGroupe = meta.subject || "le groupe";
            } catch (e) {
                nomGroupe = "le groupe";
            }
        }

	//legende qu'on mets en legende s'il y en avait pas
        const legendePrive = estGroupe
            ? `Message débloqué de ${nomAuteur}(+${numeroAuteur}) dans ${nomGroupe} à ${heure}.`
            : `Message débloqué de ${nomAuteur}(+${numeroAuteur}) à ${heure}.`;

	//mais s'il y en avait on lutillise de preference
        const messageOriginal = {
            key: { remoteJid: jid, id: contextInfo.stanzaId, fromMe: false, participant: auteurJid },
            message: msgRepondu
        };

        try {
            const buffer = await downloadMediaMessage(messageOriginal, "buffer", {});

            if (typeMedia === "image") {
                const caption = estPriveDemande ? legendePrive : (media.caption || "");
                await sock.sendMessage(destination, { image: buffer, caption: caption }, { quoted: estPriveDemande ? null : message });
            } else if (typeMedia === "video") {
                const caption = estPriveDemande ? legendePrive : (media.caption || "");
                await sock.sendMessage(destination, { video: buffer, caption: caption }, { quoted: estPriveDemande ? null : message });
            } else if (typeMedia === "audio") {
                const msgAudio = await sock.sendMessage(destination, { audio: buffer, mimetype: 'audio/mp4', ptt: true }, { quoted: estPriveDemande ? null : message });
                if (estPriveDemande) {
                    await sock.sendMessage(destination, { text: legendePrive }, { quoted: msgAudio });
                }
            }

        } /*une erreur s'est produite alors en log et on envoi ça*/ catch (e) {
            console.error(`[(xanti_unique), "${nomSession}"]; Erreur:`, e);
            return sock.sendMessage(jid, { text: "Erreur lors du déblocage du média." }, { quoted: message });
        }
    }
};
