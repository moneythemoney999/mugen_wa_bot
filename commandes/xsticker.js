/* Cette commande a besoin du dependances "ffmpeg" pour fontionner.*/

//les imports
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { execSync }  from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

//logique
export default {
    nom: "xsticker",
    description: "Transforme les stickers en photos. (Seulement les stickers statique pas les animés)",
    categorie: "Groupes && Privé",
    infos: `Transforme les stickers en images.
> Lui dans tout les cas faut répondre au sticker voulu.

NB:Seul les stickers statique sont acceptées.`,

    execute: async ({ sock, message, nomSession }) => {
        const jid = message.key.remoteJid;
        const ctx = message.message?.extendedTextMessage?.contextInfo;
        const stickerMsg = ctx?.quotedMessage?.stickerMessage;

	//si on trouve pas le sticker on envoi un message pour demander
        if (!stickerMsg) {
            return sock.sendMessage(jid,
	    { text: "Il est où le sticker🫩." },
	           { quoted: message });
        }


//si le stickers est anime on dit que les stickers animes sont pas supporter
        if (stickerMsg.isAnimated) {
            return sock.sendMessage(
                jid,
                { text: "> ```Les stickers animés ne sont pas supportés.```" },
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
            fs.writeFileSync(webp, Buffer.concat(chunks));

	    //convertion du sticker en image avec ffmpeg
            execSync(`ffmpeg -y -i "${webp}" -frames:v 1 "${png}"`);

	    //envoi de l'image
            const tamponImage = fs.readFileSync(png);
            await sock.sendMessage(
                jid,
                { image: tamponImage,
	              caption: "_Voilà l'image_." }, //message en legende
                { quoted: message }
            );

        } catch (e) {
	    //si on a recontrer un probleme
            await sock.sendMessage(jid,
  	         { text: "Une erreur est survenue lors de la conversion." },
 		 { quoted: message });
            console.error(`[(xsticker), "${nomSession}"]; Une erreur est survenue lors de la conversion :`, e);
        } finally { //finalisation et nettoiyage des fichier temporaire
            if (fs.existsSync(webp)) fs.unlinkSync(webp);
            if (fs.existsSync(png)) fs.unlinkSync(png);
        }
    }
};
