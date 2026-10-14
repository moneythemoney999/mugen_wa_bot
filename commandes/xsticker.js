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
		const contexte_info = message.message?.extendedTextMessage?.contextInfo;
		const message_sticker = contexte_info?.quotedMessage?.stickerMessage;
		//"Raccourci" de traduction importer depui le fichier outils/langue.js
		const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'xsticker', { [cle]: vars }))[cle];

		//si on trouve pas le sticker on envoi un message pour demander
		if (!message_sticker) {
			const pas_de_cible = await trad('msg.pas_de_cible') || "Il est où le sticker🫩.";
			return connexion.sendMessage(jid, { text: pas_de_cible }, { quoted: message });
		}

		//si le stickers est anime on dit que les stickers animes sont pas supporter
		if (message_sticker.isAnimated) {
			const sticker_animes = await trad('msg.sticker_animes') || "> ```Les stickers animés ne sont pas supportés.```";  
			return connexion.sendMessage(jid, { text: sticker_animes }, { quoted: message });
		}

		//chemin ou on stocke temporairement les fichiers
		const dossier_temporaire = os.tmpdir();
		const date = Date.now();
		const webp = path.join(dossier_temporaire, `sticker_${date}.webp`);
		const png = path.join(dossier_temporaire, `sticker_${date}.png`);

		try {
			//telechargement du sticker
			const telechargement = await downloadContentFromMessage(message_sticker, "sticker");
			//sauvegarde temporaire du sticker
			const morceaux = [];
			for await (const c of telechargement) morceaux.push(c);
			await fs.writeFile(webp, Buffer.concat(morceaux));
			//convertion du sticker en image avec ffmpeg
			await execAsync(`ffmpeg -y -i "${webp}" -frames:v 1 "${png}"`);
			//envoi de l'image
			const tampon_image = await fs.readFile(png);
			const legende_reussite = await trad('msg.legende_reussite') || "_Voilà l'image_.";
			await connexion.sendMessage(jid, {
				image: tampon_image,
				caption: legende_reussite }, { quoted: message }
			);
		} catch (e) {
			//si on a recontrer un probleme
			const erreur = await trad('msg.erreur') || "Une erreur est survenue lors de la conversion.";
			await connexion.sendMessage(jid, { text: erreur }, { quoted: message });
			console.error(`[(xsticker), "${nom_session}"]; Une erreur est survenue lors de la conversion :`, e);
		} finally { //finalisation et nettoiyage des fichier temporaire
			if (await fs.access(webp).then(() => true).catch(() => false)) await fs.unlink(webp);
			if (await fs.access(png).then(() => true).catch(() => false)) await fs.unlink(png);
		}
	}
};