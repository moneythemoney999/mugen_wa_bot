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

    execute: async ({ sock, message, args, nomSession}) => {
        const jid = message.key.remoteJid;
        const botJid = sock.user.id;

	//"Raccourci" de traduction importer depui le fichier outils/langue.js
	const trad = (cle, vars = {}) => traduire(nomSession, 'commandes', 'sticker', { [cle]: vars })[cle];

	//meta-donnees des stickers on mets le non de packs que la personne a mis en argument s'il y'en a pas on mets un par defaut et le nom d'auteur lui est fixe
        const nomPack = args.filter(arg => !arg.startsWith('@')).join(' ') || "Mugen♾️♾️";
        const nomAuteur = "Mugen Bot♾️♾️";

        try {
	    //detection des medias cibles
            const contexteInfo = message.message?.extendedTextMessage?.contextInfo;
            const msgRepondu = contexteInfo?.quotedMessage;
            let tamponCible;

	   //pour les reponse a un message on verifie si c'est um medias et on le telecharge
            if (msgRepondu) {
		//image
                if (msgRepondu.imageMessage) {
                    tamponCible = await downloadMediaMessage({ key: message.key, message: msgRepondu }, "buffer", {});
                } else if (msgRepondu.videoMessage) {
		    //video et les gif aussi puisqu'en gros ce sont aussi des videos
                    tamponCible = await downloadMediaMessage({ key: message.key, message: msgRepondu }, "buffer", {});
                } else if (msgRepondu.stickerMessage) {
		    //pour les stickers
                    tamponCible = await downloadMediaMessage({ key: message.key, message: msgRepondu }, "buffer", {});
                } else {
		    //si quelqu'un essai de transformer ma profil on refuse
                    let jidCible = contexteInfo.participant;
                    if (jidNormalizedUser(jidCible) === jidNormalizedUser(botJid) && !message.key.fromMe) {
		    const pas_ma_profil = trad('msg.pas_ma_profil') || `Et pourquoi ma profil🫤🫥.`;
		    return sock.sendMessage(jid, { text: pas_ma_profil }, { quoted: message });
                    }
		    //si profil de quelqu'un d'autre on continu en telechargant la photo
		    const lien = await sock.profilePictureUrl(jidCible, "image");
                    const reponse = await fetch(lien);
                    tamponCible = Buffer.from(await reponse.arrayBuffer());
                }
            } else if (contexteInfo?.mentionedJid?.length > 0) { //si la cible etait plutot mentionner dans un groupe on recupere d'abord ses identifiant
                const jidCible = contexteInfo.mentionedJid[0];
                const lien = await sock.profilePictureUrl(jidCible, "image");
                const reponse = await fetch(lien);
                tamponCible = Buffer.from(await reponse.arrayBuffer());
            } else if (message.message?.imageMessage || message.message?.videoMessage) {
                tamponCible = await downloadMediaMessage(message, "buffer", {});
            } else {
		//si c'est la profil du groupe la cible
                const estGroupe = jid.endsWith("@g.us");
                const jidCible = estGroupe ? jid : (message.key.participant || jid);
                const lien = await sock.profilePictureUrl(jidCible, "image");
                const reponse = await fetch(lien);
                tamponCible = Buffer.from(await reponse.arrayBuffer());
            }

            if (!tamponCible) {
		//si on trouve aucune profil ou pas de media repondu ou ayant la commande en legende
		const pas_de_media = trad('msg.pas_de_media') || "```Aucun média trouvé.```";
                return sock.sendMessage(jid, { text: pas_de_media }, { quoted: message });
            }

	    //on construit le sticker apres avoir trouver et telecharger l'image cible
            const idSticker = crypto.createHash('md5').update(tamponCible).digest('hex');
            const sticker = new Sticker(tamponCible, {
                pack: nomPack,
                author: nomAuteur,
                type: StickerTypes.FULL,
                quality: 60,
                id: idSticker
            });

	    //on l'envoi
            await sock.sendMessage(jid, await sticker.toMessage(), { quoted: message });

        } catch (erreur) {
	    //si une erreur on le logs et envoi un message
            console.error(`[(sticker), "${nomSession}"] Erreur:`, erreur);
	    const erreur_creation = trad('msg.erreur_creation') || "_La création du sticker a échoué. Une erreur s'est produite._";
            await sock.sendMessage(jid, { text: erreur_creation }, { quoted: message });
        }
    }
};
