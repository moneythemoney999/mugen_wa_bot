/* */

import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';

const execute = promisify(exec);

export default {
    nom: 'telecharge',
    description: "Télécharge du contenu depuis n'importe quel lien (YouTube, TikTok, FB, etc.) via yt-dlp.",
    categorie: 'Groupes && Privé',
    infos: `Utilisation : \`.telecharge <lien>\`
Le bot utilisera yt-dlp pour trouver le meilleur format et te l'enverra.`,

    execute: async ({ sock, message, args, nomSession }) => {
        const jid = message.key.remoteJid;
        const lien = args[0];

        // 1. Vérification de la présence du lien
        if (!lien) {
            return sock.sendMessage(jid, { text: "Quel est le contenu à télécharger ?" }, { quoted: message });
        }

        // 2. Validation sommaire de l'URL
        if (!lien.startsWith('http')) {
            return sock.sendMessage(jid, { text: "> Lien invalide" }, { quoted: message });
        }

        try {
            // Message de patience
            // await sock.sendMessage(jid, { text: "⏳ Analyse du lien en cours..." }, { quoted: message });

            // 3. Appel de yt-dlp pour obtenir le lien direct et le titre
            // --get-url : récupère l'URL directe du média
            // --get-filename : récupère le nom du fichier suggéré
            // -f "best" : choisit le meilleur format
            const { stdout, stderr } = await execute(`yt-dlp -g -f "best[ext=mp4]/best" --no-playlist "${lien}"`);
            
            if (stderr && !stdout) {
                console.error(`[(telecharge), "${nomSession}"]: Erreur yt-dlp :`, stderr);
                return sock.sendMessage(jid, { text: "> Impossible de récupérer le contenu (Lien protégé ou invalide)" }, { quoted: message });
            }

            const directUrl = stdout.trim().split('\n')[0]; // Parfois yt-dlp renvoie plusieurs URLs (vidéo + audio séparés)

            // 4. Téléchargement du buffer
            const reponse = await fetch(directUrl);
            const arrayBuffer = await reponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 5. Détection du type de fichier
            const type = await fileTypeFromBuffer(buffer);
            
            // On essaye de trouver un nom propre
            const { stdout: titleOutput } = await execute(`yt-dlp --get-filename -o "%(title)s.%(ext)s" --no-playlist "${lien}"`);
            const nomFichier = titleOutput.trim() || `file_${Date.now()}.${type?.ext || 'bin'}`;

            // 6. Envoi selon le type détecté
            if (!type) {
                // Si on ne connaît pas le type, on envoie comme document par défaut
                return sock.sendMessage(jid, { 
                    document: buffer, 
                    mimetype: 'application/octet-stream', 
                    fileName: nomFichier 
                }, { quoted: message });
            }

            if (type.mime.startsWith('image/')) {
                return sock.sendMessage(jid, { image: buffer, caption: `✅ Image : ${nomFichier}` }, { quoted: message });
            } else if (type.mime.startsWith('video/')) {
                return sock.sendMessage(jid, { video: buffer, caption: `✅ Vidéo : ${nomFichier}` }, { quoted: message });
            } else if (type.mime.startsWith('audio/')) {
                return sock.sendMessage(jid, { audio: buffer, mimetype: type.mime }, { quoted: message });
            } else {
                // Pour tout le reste (PDF, ZIP, etc.)
                return sock.sendMessage(jid, { 
                    document: buffer, 
                    mimetype: type.mime, 
                    fileName: nomFichier 
                }, { quoted: message });
            }

        } catch (erreur) {
            console.error(`[(telecharge), "${nomSession}"]: Erreur lors du téléchargement de ${lien} :`, erreur.message);
            return sock.sendMessage(jid, { text: "> Lien invalide ou erreur de téléchargement" }, { quoted: message });
        }
    }
};
