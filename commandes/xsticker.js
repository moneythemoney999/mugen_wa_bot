/* Cette commande a besoin du dependances "ffmpeg" pour fontionner.*/

//les imports
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { traduire } from '../outils/langue.js';

const execAsync = promisify(exec);

//logique
export default {
    nom: "xsticker",
    description: "Transforme les stickers en photos. (Seulement les stickers statique pas les animés)",
    categorie: "Groupes && Privé",
    infos: `Transforme les stickers en images.
> Lui dans tout les cas faut répondre au sticker voulu.

NB:Seul les stickers statique sont acceptées.`,

    execute: async ({ connexion, message, nom_session }) => {
        const jid = message.key.remoteJid;
        const ctx = message.message?.extendedTextMessage?.contextInfo;
        const stickerMsg = ctx?.quotedMessage?.stickerMessage;

	//"Raccourci" de traduction importer depui le fichier outils/langue.js
	const trad = (cle, vars = {}) => traduire(nom_session, 'commandes', 'xsticker', { [cle]: vars })[cle];

	//si on trouve pas le sticker on envoi un message pour demander
        if (!stickerMsg) {
            const pas_de_cible = trad('msg.pas_de_cible') || "Il est où le sticker🫩.";
            return connexion.sendMessage(jid,
	    { text: pas_de_cible },
	           { quoted: message });
        }


//si le stickers est anime on dit que les stickers animes sont pas supporter
        if (stickerMsg.isAnimated) {
            const stick_animes = trad('msg.sticker_animes') || "> ```Les stickers animés ne sont pas supportés.```";  
            return connexion.sendMessage(
                jid,
                { text: stick_animes },
                { quoted: message }
            );
        }

	//chemin ou on stocke temporairement les fichiers
        const tmp = os.tmpdir();
        const ts = Date.now();
        const webp = path.join(tmp, `sticker_${ts}.webp`);
        const png = path.join(tmp, `sticker_${ts}.png`);

        try {
	    //telechargement du sticker
            const stream = await downloadContentFromMessage(stickerMsg, "sticker");

	    //sauvegarde temporaire du sticker
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            await fs.writeFile(webp, Buffer.concat(chunks));

	    //convertion du sticker en image avec ffmpeg
            await execAsync(`ffmpeg -y -i "${webp}" -frames:v 1 "${png}"`);

	    //envoi de l'image
            const tamponImage = await fs.readFile(png);
            const legende_reussite = trad('msg.legende_reussite') || "_Voilà l'image_.";
            await connexion.sendMessage(
                jid,
                { image: tamponImage,
	              caption: legende_reussite }, //message en legende
                { quoted: message }
            );

        } catch (e) {
	    //si on a recontrer un probleme
	    const msg_erreur = trad('msg.msg_erreur') || "Une erreur est survenue lors de la conversion.";
            await connexion.sendMessage(jid,
  	         { text: msg_erreur },
 		 { quoted: message });
            console.error(`[(xsticker), "${nom_session}"]; Une erreur est survenue lors de la conversion :`, e);
        } finally { //finalisation et nettoiyage des fichier temporaire
            if (await fs.access(webp).then(() => true).catch(() => false)) await fs.unlink(webp);
            if (await fs.access(png).then(() => true).catch(() => false)) await fs.unlink(png);
        }
    }
};