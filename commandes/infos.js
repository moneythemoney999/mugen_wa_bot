/* */

//imports necessaires
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//declaration des dossier/fichier pour stocker la photo de profil histoire de ne pa le telecharger a chaque fois ce qui rend le bot plus rapide
async function mettreAJourPhotoProfil(sock, nomSession) {
    const cheminDossierSession = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession);
    const cheminProfil = path.join(cheminDossierSession, 'profil.jpg');

    try {
        const urlPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
        const reponse = await fetch(urlPhotoProfil);
        if (!reponse.ok) {
	    //si la requête pour recuper la profil a échoue on le logs avec l'erreur associe
            throw new Error(`[(infos), "${nomSession}"]: Erreur dans la requête de récuperation du profil avec le statut : ${reponse.status}`);
        }
        const bufferImage = Buffer.from(await reponse.arrayBuffer());
	//puis ensuite pour mettre à jour la photo on suprime l'ancienne
        await fsPromises.mkdir(cheminDossierSession, { recursive: true });
        await fsPromises.writeFile(cheminProfil, bufferImage);
    } catch (erreur) {
        console.error(erreur.message || erreur);
        try {
            if (fs.existsSync(cheminProfil)) {
                await fsPromises.unlink(cheminProfil);
            }
        } catch (errSuppression) {
	    //si une erreur se produit on le log
            console.error(`[(infos), "${nomSession}"]: Erreur lors de la supression de l'ancienne photo de profil pour (${nomSession}):`, errSuppression);
        }
    }
}

//vrai logique que le ficchier principale va venir importer
export default {
    nom: "infos",
    description: "Avoir plus d'infos sur les commandes que la p'tit description de `.menu`.",
    categorie: "Groupes && Privé",
    infos: `Pour l'utiliser il faut faire la commande + la commande dont tu veux plus d'infos.
> Exemple : \`.infos infos\`

Pour ne pas avoir un message d'erreur il faut que la commande que t'as mis en argument existe vraiment pour ça faut lire \`.menu\`.`, 

    execute: async ({ sock, message, args, nomSession }) => {

        async function repondreAvecProfil(texte) {
	    //recherche de la photo de profil pour constituer le message
            const cheminProfil = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession, 'profil.jpg');
            try {
                if (fs.existsSync(cheminProfil)) {
                    await sock.sendMessage(
                        message.key.remoteJid,
                        { image: fs.readFileSync(cheminProfil), caption: texte },
                        { quoted: message }
                    );
                    mettreAJourPhotoProfil(sock, nomSession);
                } else {
                    const urlPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
                    const reponse = await fetch(urlPhotoProfil);
                    const bufferImage = Buffer.from(await reponse.arrayBuffer());

                    await fsPromises.mkdir(path.dirname(cheminProfil), { recursive: true });
                    fs.writeFileSync(cheminProfil, bufferImage);

                    await sock.sendMessage(
                        message.key.remoteJid,
                        { image: bufferImage, caption: texte },
                        { quoted: message }
                    );
                }
            } catch (e) {
                await sock.sendMessage(
                    message.key.remoteJid,
                    { text: texte },
                    { quoted: message }
                );
            }
        }

        if (!args[0]) {
	    //si on ne detecte aucun arguemnt derriere la commande on evois ce message pour indiquer qu'il faut en mettre
            const texteAide = `Sur quelle commande souhaites-tu avoir plus d'infos?\n> Fait par exemple : \`.infos infos\``;
            await repondreAvecProfil(texteAide);
            return;
        }
	//s'il y avait une argument on le prend pour aller chercher dans le donnsier "commandes" à quelle commande ça correspond
        const nomRecherche = args[0].toLowerCase();
        let commandeTrouvee = false;

        const cheminCommandes = path.join(__dirname);
        const fichiersCommandes = fs.readdirSync(cheminCommandes);

        for (const fichier of fichiersCommandes) {
            if (fichier.endsWith('.js')) {
                try {
                    const moduleCommande = await import(`./${fichier}?t=${Date.now()}`);
                    if (moduleCommande.default?.nom?.toLowerCase() === nomRecherche) {
                        commandeTrouvee = true;
                        const nomResultat = moduleCommande.default.nom;
			//si on trouve la commande on essaie d'importer "infos" si on le trouve pas on envoi  un message pour indique que cette commande n'en a pas
                        const infosResultat = moduleCommande.default.infos || "Aucune information disponible pour cette commande.";
			//si l'importation avait retouner quelque chose on va construir le message avec
                        const reponse = `> Voici les infos de la commande ${nomResultat}.
- Nom : *${nomResultat}*

- Infos : ${infosResultat}`;
                        await repondreAvecProfil(reponse);
                        break;
                    }
                } catch (e) {
		    //s'il y'a une erreur non identifié on log
                    console.error(`[(infos), "${nomSession}"]: Erreur lors du chargement de la commande ${fichier}:`, e);
                }
            }
        }

        if (!commandeTrouvee) {
	    //si la recherche dans le dossier commandes n'a pas trouver la comande on preare plustot un autre message pour le faire savoir
            const reponseErreur = `La commande ~${nomRecherche} n'existe pas.~
> Vas lire \`.menu\` pour savoir les commandes.`;
            await repondreAvecProfil(reponseErreur);
        }
    }
};
