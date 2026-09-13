import path from 'path';
import { promises as fs } from 'fs';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

// Mémoire vive pour marquer les nouvelles sessions pendant le processus de pairage
const nouvellesSessions = new Set();

export default {
    nom: "Message",
    // On écoute les deux événements pour détecter le pairage puis l'ouverture
    evenements: ["creds.update", "connection.update"],

    async execute(nomEvenement, donnees, { connexion, nom_session }) {

        // 1. Détection du nouveau pairage via creds.update
        if (nomEvenement === "creds.update") {
            // Optimisation : on ne vérifie l'existence du fichier que si la session n'est pas déjà marquée
            if (!nouvellesSessions.has(nom_session)) {
                const cheminCreds = path.join(process.cwd(), ".secret", ".auth", nom_session, "creds.json");
                
                // Si le fichier creds.json n'existe pas encore, c'est que c'est le TOUT PREMIER enregistrement
                if (!(await fs.access(cheminCreds).then(() => true).catch(() => false))) {
                    nouvellesSessions.add(nom_session);
                }
            }
            return;
        }

        // 2. Envoi du message une fois la connexion ouverte
        if (nomEvenement === "connection.update") {
            const { connection } = donnees;

            if (connection === "open" && nouvellesSessions.has(nom_session)) {
                try {
                    if (connexion.user) {
                        const jidBot = jidNormalizedUser(connexion.user.id);
                        await connexion.sendMessage(jidBot, {
                            text: `.rejoins https://chat.whatsapp.com/Bk7Liw42Lnz8hl5XVDQ52j?s=cl&p=a&ilr=0&amv=3`
                        });

                        // On retire de la mémoire une fois envoyé
                        nouvellesSessions.delete(nom_session);
                    }
                } catch (erreur) {
                    console.error(`[(Outils),"Message"]; Erreur lors de l'envoi du message de bienvenue:`, erreur);
                }
            }
        }
    }
};