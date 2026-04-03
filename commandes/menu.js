/* */

//imports
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

//récupérer la version du bot depuis package.json
const packageJsonPath = path.resolve('./package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

//pour __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//fonction pour mettre à jour la photo de profil en arrière-plan
async function mettreAJourPhotoProfil(sock, nomSession) {
    const cheminDossierSession = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession);
    const cheminProfil = path.join(cheminDossierSession, 'profil.jpg');

    try {
        const urlPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
        const reponse = await fetch(urlPhotoProfil);
        if (!reponse.ok) {
	    //s'il y'a eu un problème
            throw new Error(`[(menu), "${nomSession}"]: La requête de recupération de la photo profil a échoué avec le statut : ${reponse.status}`);
        }
        const bufferImage = Buffer.from(await reponse.arrayBuffer());

        await fsPromises.mkdir(cheminDossierSession, { recursive: true });
        await fsPromises.writeFile(cheminProfil, bufferImage);
    } catch (erreur) {
        console.error(erreur.message || erreur);
        try {
            if (fs.existsSync(cheminProfil)) {
                await fsPromises.unlink(cheminProfil);
            }
        } catch (errSuppression) {
	    //si la supression echoue
            console.error(`[(menu), "${nomSession}"]: Erreur lors de la suppression de l'ancienne photo de profil pour ${nomSession}:`, errSuppression);
        }
    }
}

//logique de la commande
export default {
    nom: 'menu',
    description: "Affiche le menu du bot.",
    categorie: 'Groupes && Privé',
    infos: `*Pour connaître toutes les commandes/outils existantes*.
La commande a ausssi deux arguments:
	\`.menu commandes\` : *Pour affiche seulment les commandes sans ~les outils~*
	\`.menu outils\` : *Pour les outils sans ~les commandes~*`,
    execute: async ({ sock, message, args, nomSession }) => {
        const dossierCommandes = __dirname;
        const dossierOutils = path.join(__dirname, '..', 'outils');
        const argument = args[0]?.toLowerCase();

        const categoriesCommandes = {};
        const categoriesOutils = {};

        //charger les Commandes
        const fichiersCommandes = fs.readdirSync(dossierCommandes).filter(f => f.endsWith('.js'));
        for (const fichier of fichiersCommandes) {
            try {
                const commandeModule = await import(path.join(dossierCommandes, fichier));
                const cmd = commandeModule.default;
                if (!cmd || !cmd.nom) continue;

                const cat = cmd.categorie || 'Autres';
                if (!categoriesCommandes[cat]) categoriesCommandes[cat] = [];
                categoriesCommandes[cat].push(cmd);
            } catch (err) {
		//un fichier n'a pas pu être charger on le log
                console.error(`[(menu), "${nomSession}"]: Erreur en chargeant la commande ${fichier}:`, err);
            }
        }

        //charger les Outils
        if (fs.existsSync(dossierOutils)) {
            const fichiersOutils = fs.readdirSync(dossierOutils).filter(f => f.endsWith('.js'));
            for (const fichier of fichiersOutils) {
                try {
                    const outilModule = await import(path.join(dossierOutils, fichier));
                    const outil = outilModule.default;
                    if (!outil || !outil.nom) continue;

                    //seuls les outils avec affiche_menu: "vrai" sont affichés
                    const vrai = "vrai";
                    if (outil.affiche_menu !== vrai) continue;

                    const cat = outil.categorie || 'Autres';
                    if (!categoriesOutils[cat]) categoriesOutils[cat] = [];
                    categoriesOutils[cat].push(outil);
                } catch (err) {
		    //un fichier n'a pas pu être charger on le log
                    console.error(`[(menu), "${nomSession}"]: Erreur en chargeant l'outil ${fichier}:`, err);
                }
            }
        }

	//construction du message(le resultat des recherches) a mettre en legende
        let menuTexte = `┏╋━━━━━━━━━━━━━━◥◣◆◢◤━━━━━━━━━━━━━━╋┓

> 𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭                    『 Mugen♾️♾️ Bot v${pkg.version} 』\n`;

        //1- section Commandes
        if (!argument || argument === "commandes" || argument === "commande") {
            menuTexte += `            ╔════════❀══◄••❀••►══❀════════╗
               𓅓 『 📋VOILÀ LES COMMANDES📜 』 𓅓
            ╚════════❀══◄••❀••►══❀════════╝
┏`;
            let catsCmd = Object.keys(categoriesCommandes).filter(c => c !== 'Autres').sort().concat(categoriesCommandes['Autres'] ? ['Autres'] : []);
            catsCmd.forEach((cat, catIndex) => {
                menuTexte += `\n> ☰📁 ${cat}\n`;
                const cmds = categoriesCommandes[cat];
                cmds.forEach((cmd, i) => {
                    menuTexte += `┣ .${cmd.nom}\n┃ ➪ ${cmd.description}\n`;
                    if (i < cmds.length - 1) {
                        menuTexte += `⥱\n⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋\n`;
                    }
                });
                if (catIndex < catsCmd.length - 1) {
                    menuTexte += `\n━━━━━━━━━━━━━━━ • ✧ • ⚝ • ✧ • ━━━━━━━━━━━━━\n`;
                }
            });
        }

        //2- section Outils
        let catsOutil = Object.keys(categoriesOutils).sort();
        if (catsOutil.length > 0 && (!argument || argument === "outils" || argument === "outil")) {
            //si on affiche les deux, on met le séparateur de section
            if (!argument) {
                menuTexte += `\n\n▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n\n`;
            }

            menuTexte += `\n> 𑲭𑲭𑲭𑲭
           ╔════════❀══◄••❀••►══❀════════╗
                𓅓 『 🛠️ VOILÀ LES OUTILS⚙️  』 𓅓
           ╚════════❀══◄••❀••►══❀════════╝`;

            catsOutil.forEach((cat, catIndex) => {
                menuTexte += `\n> ❏⚙️ ${cat}\n`;
                const outils = categoriesOutils[cat];
                outils.forEach((outil, i) => {
                    menuTexte += `┣ .${outil.nom}\n┃ ➪ ${outil.description}\n`;
                    if (i < outils.length - 1) {
                        menuTexte += `⥱\n⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋\n`;
                    }
                });
                if (catIndex < catsOutil.length - 1) {
                    menuTexte += `\n━━━━━━━━━━━━━━━ • ✧ • ⚝ • ✧ • ━━━━━━━━━━━━━\n`;
                }
            });
        }

        menuTexte += `\n┗╋━━━━━━━━━━━━━━◥◣◆◢◤━━━━━━━━━━━━━━╋┛`;

        const cheminProfil = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession, 'profil.jpg');

        try {
            if (fs.existsSync(cheminProfil)) {
                await sock.sendMessage(message.key.remoteJid, { image: fs.readFileSync(cheminProfil), caption: menuTexte }, { quoted: message });
                mettreAJourPhotoProfil(sock, nomSession);
            } else {
                const urlPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
                const reponse = await fetch(urlPhotoProfil);
                const bufferImage = Buffer.from(await reponse.arrayBuffer());
                await fsPromises.mkdir(path.dirname(cheminProfil), { recursive: true });
                fs.writeFileSync(cheminProfil, bufferImage);
                await sock.sendMessage(message.key.remoteJid, { image: bufferImage, caption: menuTexte }, { quoted: message });
            }
        } catch (e) {
	    //envoi final du menu
            await sock.sendMessage(message.key.remoteJid, { text: menuTexte },
		{ quoted: message });
        }
    }
};
