/* */

//imports necessaire
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//recherche de la version dans package.json
const cheminPackageJson = path.resolve('./package.json');
const pkg = JSON.parse(fs.readFileSync(cheminPackageJson, 'utf8'));

//fonction pour mettre à jour la photo de profil en arrière-plan
async function mettreAJourPhotoProfil(sock, nomSession) {
    const cheminDossierSession = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession);
    const cheminProfil = path.join(cheminDossierSession, 'profil.jpg');

    try {
        const urlPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
        const reponse = await fetch(urlPhotoProfil);
        if (!reponse.ok) {
            throw new Error(`[(mugen), "${nomSession}"]: La requête de la photo de profil a échoué avec le statut : ${reponse.status}`);
        }
        const bufferImage = Buffer.from(await reponse.arrayBuffer());

        await fsPromises.mkdir(cheminDossierSession, { recursive: true });
        await fsPromises.writeFile(cheminProfil, bufferImage);
	    console.log(`[(mugen), "${nomSession}"]: Photo de profil pour la session ${nomSession} mise à jour en arrière-plan.`);
    } catch (erreur) {
          console.error(`[(mugen), "${nomSession}"]: Erreur lors de la mise à jour en arrière-plan de la photo pour ${nomSession}:`, erreur);
          //si la mise à jour échoue (ex: l'utilisateur n'a plus de photo), on supprime l'ancienne du cache.
        try {
            if (fs.existsSync(cheminProfil)) {
                await fsPromises.unlink(cheminProfil);
                    console.log(`[(mugen), "${nomSession}"]: Ancienne photo de profil pour ${nomSession} supprimée car la mise à jour a échoué.`);
            }
        } catch (errSuppression) {
              console.error(`[(mugen), "${nomSession}"]: Erreur lors de la suppression de l'ancienne photo de profil pour ${nomSession}:`, errSuppression);
        }
    }
}

//logique principale
export default {
    nom: 'mugen',
    description: "Lance le bot",
    categorie: 'Groupes && Privé',
    infos: "> Sert plus ou moins à savoir si le bot est en ligne et aussi c'est en quelque sorte l'introd.",
    execute: async ({ sock, message, args, nomSession }) => {
        const légende = `> ╔❀══◄••❀••►══❀══❀══◄••❀••►══❀╗ 𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭             Mugen Bot♾️♾️ v${pkg.version} ╚❀══◄••❀••►══❀══❀══◄••❀••►══❀╝

⫸ Ici:
 > ⟁⃤ ♱ Mugen♾️♾️ Bot version v${pkg.version} ⟁⃤ ♱
⫸ Creer par:
 > Money Mugen♾️♾️

—͟͟͞͞Tappe \`.menu\`, \`.menu commandes\` ou \`.menu outils\` pour voir la liste des fonctionalités彡`;

        const cheminProfil = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession, 'profil.jpg');

        try {
            if (fs.existsSync(cheminProfil)) {
                //le profil existe on l'envoie et on met à jour en arrière-plan
                await sock.sendMessage(
                    message.key.remoteJid,
                    {
                        image: fs.readFileSync(cheminProfil),
                        caption: légende
                    },
                    { quoted: message }
                );
                //lancer la mise à jour sans attendre
                mettreAJourPhotoProfil(sock, nomSession);
            } else {
                //le profil n'existe pas on le télécharge sauvegarde et envoie
                const urlPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
                const reponse = await fetch(urlPhotoProfil);
                const bufferImage = Buffer.from(await reponse.arrayBuffer());

                //assurer que le dossier existe avant d'écrire
                await fsPromises.mkdir(path.dirname(cheminProfil), { recursive: true });
                fs.writeFileSync(cheminProfil, bufferImage);

                await sock.sendMessage(
                    message.key.remoteJid,
                    {
                        image: bufferImage,
                        caption: légende
                    },
                    { quoted: message }
                );
            }
        } catch (e) {
            console.error(`[(mugen), "${nomSession}"]: Erreur dans la commande mugen (gestion photo de profil) :`, e);
            //en cas d'erreur (ex: impossible de télécharger), envoyer le texte seul
            await sock.sendMessage(
                message.key.remoteJid,
                { text: légende },
                { quoted: message }
            );
        }
    }
};

