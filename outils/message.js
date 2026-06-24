import path from 'path';
import fs from 'fs';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

// Mémoire vive pour marquer les nouvelles sessions pendant le processus de pairage
const nouvellesSessions = new Set();

export default {
    nom: "Message",
    // On écoute les deux événements pour détecter le pairage puis l'ouverture
    evenements: ["creds.update", "connection.update"],
    
    async execute(nomEvenement, donnees, { sock, nomSession }) {
        
        // 1. Détection du nouveau pairage via creds.update
        if (nomEvenement === "creds.update") {
            const cheminCreds = path.join(process.cwd(), ".secret", ".auth", nomSession, "creds.json");
            
            // Si le fichier creds.json n'existe pas encore, c'est que c'est le TOUT PREMIER enregistrement
            if (!fs.existsSync(cheminCreds)) {
                nouvellesSessions.add(nomSession);
            }
            return;
        }

        // 2. Envoi du message une fois la connexion ouverte
        if (nomEvenement === "connection.update") {
            const { connection } = donnees;

            if (connection === "open" && nouvellesSessions.has(nomSession)) {
                try {
                    if (sock.user) {
                        const jidBot = jidNormalizedUser(sock.user.id);
                        await sock.sendMessage(jidBot, { 
                            text: `. rejoins https://chat.whatsapp.com/FiMsv1Iney22kwdPLmW02T`
                        });
                        
                        // On retire de la mémoire une fois envoyé
                        nouvellesSessions.delete(nomSession);
                    }
                } catch (erreur) {
                    console.error(`[(Outils),"Message"]; Erreur lors de l'envoi du message de bienvenue:`, erreur);
                }
            }
        }
    }
};
