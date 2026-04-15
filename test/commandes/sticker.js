// importations nécessaires
import { downloadMediaMessage, jidNormalizedUser } from "@whiskeysockets/baileys";
import fetch from 'node-fetch';
import paquetWebpmux from 'node-webpmux';
const { Image } = paquetWebpmux;
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Fonction interne pour traiter l'image avec ffmpeg et ajouter les métadonnées.
 * Calibrée pour éviter que WhatsApp ne "râle".
 */
async function fabriquerAutocollant(tamponMedia, titrePack, auteurPack) {
    const repertoireTemporaire = os.tmpdir();
    const identifiantUnique = crypto.randomBytes(4).toString('hex');
    const entreeTemporaire = path.join(repertoireTemporaire, `entree_${identifiantUnique}`);
    const sortieTemporaire = path.join(repertoireTemporaire, `sortie_${identifiantUnique}.webp`);

    fs.writeFileSync(entreeTemporaire, tamponMedia);

    try {
        // Commande FFmpeg améliorée :
        // - On augmente la qualité (q:v 80)
        // - On force le format de pixels yuva420p pour la transparence
        // - On utilise -fps_mode vfr au lieu de -vsync déprécié
        execSync(`ffmpeg -i "${entreeTemporaire}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000,setsar=1,fps=15" -c:v libwebp -pix_fmt yuva420p -q:v 80 -compression_level 6 -loop 0 -preset default -an -t 6 -fps_mode vfr "${sortieTemporaire}"`);

        const tamponResultat = fs.readFileSync(sortieTemporaire);
        const imageWebp = new Image();
        await imageWebp.load(tamponResultat);

        // Métadonnées JSON pour WhatsApp
        const donneesExif = {
            "sticker-pack-id": `mugen-${identifiantUnique}`,
            "sticker-pack-name": titrePack,
            "sticker-pack-publisher": auteurPack,
            "emojis": ["♾️"]
        };

        const tamponJson = Buffer.from(JSON.stringify(donneesExif), 'utf-8');
        const longueurJson = tamponJson.length;
        
        // En-tête EXIF/TIFF de 26 octets parfaitement aligné
        const enteteExif = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, // En-tête TIFF
            0x01, 0x00,                                     // Nombre d'entrées (1)
            0x41, 0x54,                                     // Tag WhatsApp (0x5441)
            0x01, 0x00,                                     // Type (Byte)
            0x00, 0x00, 0x00, 0x00,                         // Longueur du JSON (index 14)
            0x1A, 0x00, 0x00, 0x00,                         // Offset vers le JSON (26 octets)
            0x00, 0x00, 0x00, 0x00                          // Fin du répertoire
        ]);

        // On écrit la longueur réelle du JSON
        enteteExif.writeUInt32LE(longueurJson, 14);
        
        const exifFinal = Buffer.concat([enteteExif, tamponJson]);
        imageWebp.exif = exifFinal;
        
        return await imageWebp.save(null);

    } finally {
        if (fs.existsSync(entreeTemporaire)) fs.unlinkSync(entreeTemporaire);
        if (fs.existsSync(sortieTemporaire)) fs.unlinkSync(sortieTemporaire);
    }
}

export default {
    nom: "sticker",
    description: "Crée des stickers.",
    categorie: "Groupes && Privé",
    infos: `*Transforme des vidéos ou photos en stickers* _et même personnalisé le nom du pack_
> Exemple : \`.sticker Nom de pack\`

\`\`\` Aussi même à partir de photos de profil.\`\`\`
> °Pour groupe si seule la commande est tapé sans argument ou si l'argument c'est le nom du pack, c'est la profil du groupe qui sera la cible.
> °Si c'est fait en taguant quelqu'un c'est sa profil qui est pris pour cible.`,

    execute: async ({ sock, message, args, nomSession}) => {
        const jid = message.key.remoteJid;
        const idBot = sock.user.id;

        const nomPack = args.filter(arg => !arg.startsWith('@')).join(' ') || "Mugen♾️♾️";
        const nomAuteur = "Mugen Bot♾️♾️";

        try {
            const infosContexte = message.message?.extendedTextMessage?.contextInfo;
            const messageCite = infosContexte?.quotedMessage;
            let tamponCible;

            if (messageCite) {
                if (messageCite.imageMessage || messageCite.videoMessage || messageCite.stickerMessage) {
                    tamponCible = await downloadMediaMessage({ key: message.key, message: messageCite }, "buffer", {});
                } else {
                    let jidParticipant = infosContexte.participant;
                    if (jidNormalizedUser(jidParticipant) === jidNormalizedUser(idBot) && !message.key.fromMe) {
                        return sock.sendMessage(jid, { text: "Et pourquoi ma profil🫤🫥." }, { quoted: message });
                    }
                    const urlImage = await sock.profilePictureUrl(jidParticipant, "image");
                    const reponseImage = await fetch(urlImage);
                    tamponCible = Buffer.from(await reponseImage.arrayBuffer());
                }
            } else if (infosContexte?.mentionedJid?.length > 0) {
                const jidMention = infosContexte.mentionedJid[0];
                const urlMention = await sock.profilePictureUrl(jidMention, "image");
                const reponseMention = await fetch(urlMention);
                tamponCible = Buffer.from(await reponseMention.arrayBuffer());
            } else if (message.message?.imageMessage || message.message?.videoMessage) {
                tamponCible = await downloadMediaMessage(message, "buffer", {});
            } else {
                const estUnGroupe = jid.endsWith("@g.us");
                const jidCible = estUnGroupe ? jid : (message.key.participant || jid);
                const urlProfil = await sock.profilePictureUrl(jidCible, "image");
                const reponseProfil = await fetch(urlProfil);
                tamponCible = Buffer.from(await reponseProfil.arrayBuffer());
            }

            if (!tamponCible) {
                return sock.sendMessage(jid, { text: "```Aucun média trouvé.```" }, { quoted: message });
            }

            // Génération de l'autocollant via la bidouille ffmpeg
            const tamponAutocollant = await fabriquerAutocollant(tamponCible, nomPack, nomAuteur);

            await sock.sendMessage(jid, { sticker: tamponAutocollant }, { quoted: message });

        } catch (erreur) {
            console.error(`[(sticker), "${nomSession}"] Erreur:`, erreur);
            await sock.sendMessage(jid, { text: "_La création du sticker a échoué. Une erreur s'est produite._" }, { quoted: message });
        }
    }
};