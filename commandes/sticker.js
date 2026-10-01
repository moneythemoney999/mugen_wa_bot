/* Cette commande necessite wa-sticker-formatter pour fonctionner et lui aussi a besoin de sharp qui n'a pas de version pré-compiler pour termux simple donc pensez à executer le fichier "../installation.sh" si vous utiliser termux sans un vrai linux d'installer.
Mais si vous en avez un ou que vou n'utiliser pas termux du tout vous en faite pas installer juste les dependances avec "npm install"*/

//imports
import { downloadMediaMessage, jidNormalizedUser } from "@whiskeysockets/baileys";
import fetch from 'node-fetch';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import crypto from 'crypto';
import { traduire } from '../outils/langue.js';

//logique d'export
export default {
	nom: "sticker",
	description: "Creer des stickers.",
	categorie: "Groupes && Privé",
	infos: `*Transforme des vidéos ou photos en stickers* _et même personnalisé le nom du pack_
> Exemple : \`.sticker Nom de pack\`

\`\`\` Aussi même à partir de photos de profil.\`\`\`
> °Pour groupe si seule la commande est tapé sans argument ou si l'argument c'est le nom du pack, c'est la profil du groupe qui sera la cible.
> °Si c'est fait en taguant quelqu'un c'est sa profil qui est pris pour cible.`,

	execute: async ({ connexion, message, args, nom_sesession}) => {
		const jid = message.key.remoteJid;
		const jid_du_bot = connexion.user.id;
		//"Raccourci" de traduction importer depui le fichier outils/langue.js
		const trad = (cle, vars = {}) => traduire(nom_sesession, 'commandes', 'sticker', { [cle]: vars })[cle];
		//meta-donnees des stickers on mets le non de packs que la personne a mis en argument s'il y'en a pas on mets un par defaut et le nom d'auteur lui est fixe
		const nom_du_pack = args.filter(arg => !arg.startsWith('@')).join(' ') || "Mugen♾️♾️";
		const nom_de_auteur = "Mugen Bot♾️♾️";

		try {
			//detection des medias cibles
			const contexte_info = message.message?.extendedTextMessage?.contextInfo;
			const message_repondu = contexte_info?.quotedMessage;
			let tampon_du_cible;

			//pour les reponse a un message on verifie si c'est um medias et on le telecharge
			if (message_repondu) {
				//image
				if (message_repondu.imageMessage) {
					tampon_du_cible = await downloadMediaMessage({ key: message.key, message: message_repondu }, "buffer", {});
				} else if (message_repondu.videoMessage) {
					//video et les gif aussi puisqu'en gros ce sont aussi des videos
					tampon_du_cible = await downloadMediaMessage({ key: message.key, message: message_repondu }, "buffer", {});
				} else if (message_repondu.stickerMessage) {
					//pour les stickers
					tampon_du_cible = await downloadMediaMessage({ key: message.key, message: message_repondu }, "buffer", {});
				} else {
					//si quelqu'un essai de transformer ma profil on refuse
					let jid_du_cible = contexte_info.participant;
					if (jidNormalizedUser(jid_du_cible) === jidNormalizedUser(jid_du_bot) && !message.key.fromMe) {
						const pas_ma_profil = trad('msg.pas_ma_profil') || `Et pourquoi ma profil🫤🫥.`;
						return connexion.sendMessage(jid, { text: pas_ma_profil }, { quoted: message });
					}
					//si profil de quelqu'un d'autre on continu en telechargant la photo
					const lien = await connexion.profilePictureUrl(jid_du_cible, "image");
					const reponse = await fetch(lien);
					tampon_du_cible = Buffer.from(await reponse.arrayBuffer());
				}
			} else if (contexte_info?.mentionedJid?.length > 0) { //si la cible etait plutot mentionner dans un groupe on recupere d'abord ses identifiant
				const jid_du_cible = contexte_info.mentionedJid[0];
				const lien = await connexion.profilePictureUrl(jid_du_cible, "image");
				const reponse = await fetch(lien);
				tampon_du_cible = Buffer.from(await reponse.arrayBuffer());
			} else if (message.message?.imageMessage || message.message?.videoMessage) {
				tampon_du_cible = await downloadMediaMessage(message, "buffer", {});
			} else {
				//si c'est la profil du groupe la cible
				const est_groupe = jid.endsWith("@g.us");
				const jid_du_cible = est_groupe ? jid : (message.key.participant || jid);
				const lien = await connexion.profilePictureUrl(jid_du_cible, "image");
				const reponse = await fetch(lien);
				tampon_du_cible = Buffer.from(await reponse.arrayBuffer());
			}

			if (!tampon_du_cible) {
				//si on trouve aucune profil ou pas de media repondu ou ayant la commande en legende
				const pas_de_media = trad('msg.pas_de_media') || "```Aucun média trouvé.```";
				return sock.sendMessage(jid, { text: pas_de_media }, { quoted: message });
			}

			// Adaptation dynamique de la qualité pour préserver les petits médias
			const taille_ko = tampon_du_cible.length / 1024;
			const qualite_sticker = taille_ko < 100 ? 95 : (taille_ko > 500 ? 70 : 85);

			//on construit le sticker apres avoir trouver et telecharger l'image cible
			const id_sticker = crypto.createHash('md5').update(tampon_du_cible).digest('hex');
			const sticker = new Sticker(tampon_du_cible, {
				pack: nom_du_pack,
				author: nom_de_auteur,
				type: StickerTypes.FULL,
				quality: qualite_sticker,
				id: id_sticker
			});

			//on l'envoi
			await connexion.sendMessage(jid, await sticker.toMessage(), { quoted: message });
		} catch (erreur) {
			//si une erreur on le logs et envoi un message
			console.error(`[(sticker), "${nom_sesession}"] Erreur:`, erreur);
			const erreur_creation = trad('msg.erreur_creation') || "_La création du sticker a échoué. Une erreur s'est produite._";
			await connexion.sendMessage(jid, { text: erreur_creation }, { quoted: message });
		}
	}
};
