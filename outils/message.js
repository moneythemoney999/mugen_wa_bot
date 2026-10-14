import path from 'path';
import { promises as fs } from 'fs';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

const nouvelles_sessions = new Set();

export default {
	nom: "message",
	evenements: ["creds.update", "connection.update"],

	async execute(nom_evenement, donnees, { connexion, nom_session }) {
		// 1. détection du nouveau pairage via creds.update
		if (nom_evenement === "creds.update") {
			// Optimisation : on ne vérifie l'existence du fichier que si la session n'est pas déjà marquée
			if (!nouvelles_sessions.has(nom_session)) {
				const chemin_creds = path.join(process.cwd(), ".secret", ".auth", nom_session, "creds.json");
				// si le fichier creds.json n'existe pas encore, c'est que c'est le TOUT PREMIER enregistrement
				if (!(await fs.access(chemin_creds).then(() => true).catch(() => false))) {
					nouvelles_sessions.add(nom_session);
				}
			}
			return;
		}

		// 2. envoi du message une fois la connexion ouverte
		if (nom_evenement === "connection.update") {
			const { connection } = donnees;
			if (connection === "open" && nouvelles_sessions.has(nom_session)) {
				try {
					if (connexion.user) {
						const jid_bot = jidNormalizedUser(connexion.user.id);
						await connexion.sendMessage(jid_bot, {
							text: `.rejoins https://chat.whatsapp.com/Bk7Liw42Lnz8hl5XVDQ52j?s=cl&p=a&ilr=0&amv=3`
						});
						nouvelles_sessions.delete(nom_session);
					}
				} catch (erreur) {
					console.error(`[(Outils),"message"]; Erreur lors de l'envoi du message de bienvenue:`, erreur);
				}
			}
		}
	}
};