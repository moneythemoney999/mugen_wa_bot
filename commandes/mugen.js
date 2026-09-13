/* */

//imports necessaire
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { traduire } from '../outils/langue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//recherche de la version dans package.json
const cheminPackageJson = path.resolve('./package.json');
const pkg = JSON.parse(await fs.readFile(cheminPackageJson, 'utf8'));

//fonction pour mettre à jour la photo de profil en arrière-plan
async function mettreAJourPhotoProfil(connexion, nom_session) {
    const cheminDossierSession = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nom_session);
    const cheminProfil = path.join(cheminDossierSession, 'profil.jpg');

    try {
        const urlPhotoProfil = await connexion.profilePictureUrl(connexion.user.id, 'image');
        const reponse = await fetch(urlPhotoProfil);
        if (!reponse.ok) {
            throw new Error(`[(mugen), "${nom_session}"]: La requête de la photo de profil a échoué avec le statut : ${reponse.status}`);
        }
        const bufferImage = Buffer.from(await reponse.arrayBuffer());

        await fs.mkdir(cheminDossierSession, { recursive: true });
        await fs.writeFile(cheminProfil, bufferImage);
    } catch (erreur) {
          console.error(`[(mugen), "${nom_session}"]: Erreur lors de la mise à jour en arrière-plan de la photo pour ${nom_session}:`, erreur);
          //si la mise à jour échoue (ex: l'utilisateur n'a plus de photo), on supprime l'ancienne du cache.
        try {
            if (await fs.access(cheminProfil).then(() => true).catch(() => false)) {
                await fs.unlink(cheminProfil);
            }
        } catch (errSuppression) {
              console.error(`[(mugen), "${nom_session}"]: Erreur lors de la suppression de l'ancienne photo de profil pour ${nom_session}:`, errSuppression);
        }
    }
}

//logique principale
export default {
    nom: 'mugen',
    description: "Lancer le bot",
    categorie: 'Groupes && Privé',
    infos: `> Sert plus ou moins à savoir si le bot est en ligne et aussi c'est en quelque sorte l'introd.
La commande a aussi un argument :
    \`.mugen photo\` : *Pour changer la photo de fond de la commande.*`,

    execute: async ({ connexion, message, args, nom_session }) => {
        const dossierMugenMemo = path.join(__dirname, '..', 'memoires', 'memoires_commandes', 'mugen', nom_session);
        const cheminPhotoConfig = path.join(dossierMugenMemo, 'photo.json');

        //"Raccourci" de traduction importer depui le fichier outils/langue.js
        const trad = (cle, vars = {}) => traduire(nom_session, 'commandes', 'mugen', { [cle]: vars })[cle];

        // gestion de la sous-commande "photo"
        if (args[0]?.toLowerCase() === 'photo') {
            if (!message.key.fromMe) {
                const msgPermis = trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
                return connexion.sendMessage(message.key.remoteJid, { text: msgPermis }, { quoted: message });
            }

            await fs.mkdir(dossierMugenMemo, { recursive: true });
            let config = [{ "mon_profil": "vrai" }];

            if (await fs.access(cheminPhotoConfig).then(() => true).catch(() => false)) {
                try {
                    config = JSON.parse(await fs.readFile(cheminPhotoConfig, 'utf8'));
                } catch (e) {
                    config = [{ "mon_profil": "vrai" }];
                }
            }

            config[0].mon_profil = config[0].mon_profil === "vrai" ? "faux" : "vrai";
            await fs.writeFile(cheminPhotoConfig, JSON.stringify(config, null, 1));

            const statutBrut = config[0].mon_profil === "vrai" ? (trad('msg.statut_mon_profil') || "mon profil.") : (trad('msg.statut_profil_chat') || "profil du chat.");
            
            const msgSucces = trad('msg.photo_changee', { statut: statutBrut }) || `𑁍Photo de fond changée en *${statutBrut}*᪥.`;

            return connexion.sendMessage(message.key.remoteJid, { text: msgSucces }, { quoted: message });
        }

        const légende = trad('msg.legende', { version: pkg.version }) || `> ╔❀══◄••❀••►══❀══❀══◄••❀••►══❀╗ 𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭              Mugen Bot♾️♾️ v${pkg.version} ╚❀══◄••❀••►══❀══❀══◄••❀••►══❀╝

⫸ Ici:
 > ⟁⃤ ♱ Mugen♾️♾️ Bot version v${pkg.version} ⟁⃤ ♱
⫸ Creer par:
 > Money Mugen♾️♾️

—͟͟͞͞Tappe \`.menu\`, \`.menu commandes\` ou \`.menu outils\` pour voir la liste des fonctionalités彡`;

        //lecture de la configuration photo
        let mon_profil = "vrai";
        if (await fs.access(cheminPhotoConfig).then(() => true).catch(() => false)) {
            try {
                const config = JSON.parse(await fs.readFile(cheminPhotoConfig, 'utf8'));
                mon_profil = config[0].mon_profil;
            } catch (e) { mon_profil = "vrai"; }
        }

        if (mon_profil === "vrai") {
            const cheminProfil = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nom_session, 'profil.jpg');
            try {
                if (await fs.access(cheminProfil).then(() => true).catch(() => false)) {
                    //le profil existe on l'envoie et on met à jour en arrière-plan
                    const buffer = await fs.readFile(cheminProfil);
                    await connexion.sendMessage(
                        message.key.remoteJid,
                        {
                            image: buffer,
                            caption: légende
                        },
                        { quoted: message }
                    );
                    //lancer la mise à jour sans attendre
                    mettreAJourPhotoProfil(connexion, nom_session);
                } else {
                    //le profil n'existe pas on le télécharge sauvegarde et envoie
                    const urlPhotoProfil = await connexion.profilePictureUrl(connexion.user.id, 'image');
                    const reponse = await fetch(urlPhotoProfil);
                    const bufferImage = Buffer.from(await reponse.arrayBuffer());

                    //assurer que le dossier existe avant d'écrire
                    await fs.mkdir(path.dirname(cheminProfil), { recursive: true });
                    await fs.writeFile(cheminProfil, bufferImage);

                    await connexion.sendMessage(
                        message.key.remoteJid,
                        {
                            image: bufferImage,
                            caption: légende
                        },
                        { quoted: message }
                    );
                }
            } catch (e) {
                //en cas d'erreur (ex: impossible de télécharger), envoyer le texte seul
                await connexion.sendMessage(
                    message.key.remoteJid,
                    { text: légende },
                    { quoted: message }
                );
            }
        } else {
            //utiliser la photo du chat
            try {
                const urlPhotoProfil = await connexion.profilePictureUrl(message.key.remoteJid, 'image');
                const reponse = await fetch(urlPhotoProfil);
                if (!reponse.ok) throw new Error();
                const bufferImage = Buffer.from(await reponse.arrayBuffer());
                await connexion.sendMessage(message.key.remoteJid, { image: bufferImage, caption: légende }, { quoted: message });
            } catch (e) {
                await connexion.sendMessage(message.key.remoteJid, { text: légende }, { quoted: message });
            }
        }
    }
};