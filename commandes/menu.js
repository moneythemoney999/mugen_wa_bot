/* */

//imports
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { traduire } from '../outils/langue.js';

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
    infos: `*Pour connaître toutes les commandes/outils existantes de Mugen♾️♾️*.
La commande a ausssi trois arguments:
        \`.menu commandes\` : *Pour affiche seulment les commandes sans ~les outils~*
        \`.menu outils\` : *Pour les outils sans ~les commandes~*
        \`.menu photo\` : *Pour changer la de fond de la commande.*`,
    execute: async ({ sock, message, args, nomSession }) => {
        const dossierCommandes = __dirname;
        const dossierOutils = path.join(__dirname, '..', 'outils');
        const argument = args[0]?.toLowerCase();

        const dossierMenuMemo = path.join(__dirname, '..', 'memoires', 'memoires_commandes', 'menu', nomSession);
        const cheminPhotoConfig = path.join(dossierMenuMemo, 'photo.json');

	//"Raccourci" de traduction importer depui le fichier outils/langue.js
	const trad = (cle, vars = {}) => traduire(nomSession, 'commandes', 'menu', { [cle]: vars })[cle];

	//pour traduire et bien faire en sorte que les commandes ou outils sans catégories aparraisse toujours à la fin
	const texteCatAutres = trad('msg.cat_autres');
	const catAutres = texteCatAutres || 'Autres';

        //gestion de la sous-commande "photo"
        if (argument === 'photo') {
            //vérification si l'expéditeur est le bot lui-même
            if (!message.key.fromMe) {
		const msgPermis = trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
                return sock.sendMessage(message.key.remoteJid, { text: msgPermis },
		    { quoted: message });
            }

            await fsPromises.mkdir(dossierMenuMemo, { recursive: true });
            let config = [{ "mon_profil": "vrai" }];

            if (fs.existsSync(cheminPhotoConfig)) {
                try {
                    config = JSON.parse(fs.readFileSync(cheminPhotoConfig, 'utf8'));
                } catch (e) {
                    config = [{ "mon_profil": "vrai" }];
                }
            }

            //basculement de la valeur
            config[0].mon_profil = config[0].mon_profil === "vrai" ? "faux" : "vrai";
            fs.writeFileSync(cheminPhotoConfig, JSON.stringify(config, null, 1));

	    const statut = config[0].mon_profil === "vrai" ? (trad('msg.statut_mon_profil') || "mon profil") : (trad('msg.statut_profil_chat') || "profil du chat");
	    const msgSucces = trad('msg.photo_changee', {statut: statut }) || `𑁍Photo de fond changée en *${statut}*᪥.`
            return sock.sendMessage(message.key.remoteJid, { text: msgSucces },
		{ quoted: message });
        }

        const categoriesCommandes = {};
        const categoriesOutils = {};

        //charger les Commandes
        const fichiersCommandes = fs.readdirSync(dossierCommandes).filter(f => f.endsWith('.js'));

        for (const fichier of fichiersCommandes) {
            try {
                const commandeModule = await import(path.join(dossierCommandes, fichier));
                let cmd = { ...commandeModule.default }; //on clone pour ne pas polluer l'original en cache
                if (!cmd || !cmd.nom) continue;

                //traduction des métadonnées de la commande
                const tradsMeta = traduire(nomSession, 'commandes', cmd.nom, {
                    'meta.nom': {},
                    'meta.description': {},
                    'meta.categorie': {}
                });

                if (tradsMeta['meta.nom']) cmd.nom = tradsMeta['meta.nom'];

                if (tradsMeta['meta.description']) cmd.description = tradsMeta['meta.description'];

                if (tradsMeta['meta.categorie']) cmd.categorie = tradsMeta['meta.categorie'];

                const cat = cmd.categorie || catAutres;
                if (!categoriesCommandes[cat]) categoriesCommandes[cat] = [];
                categoriesCommandes[cat].push(cmd);
            } catch (err) {
                console.error(`[(menu, "${nomSession}")]: Erreur en chargeant la commande ${fichier}:`, err);
            }
        }

        //charger les Outils
        if (fs.existsSync(dossierOutils)) {
            const fichiersOutils = fs.readdirSync(dossierOutils).filter(f => f.endsWith('.js'));

            for (const fichier of fichiersOutils) {
                try {
                    const outilModule = await import(path.join(dossierOutils, fichier));
                    let outil = { ...outilModule.default };
                    if (!outil || !outil.nom) continue;

                    const vrai = "vrai";
                    if (outil.affiche_menu !== vrai) continue;

                    //traduction des métadonnées de l'outil
                    const tradsMeta = traduire(nomSession, 'outils', outil.nom, {
                        'meta.nom': {},
                        'meta.description': {},
                        'meta.categorie': {}
                    });

                    if (tradsMeta['meta.nom']) outil.nom = tradsMeta['meta.nom'];

                    if (tradsMeta['meta.description']) outil.description = tradsMeta['meta.description'];

                    if (tradsMeta['meta.categorie']) outil.categorie = tradsMeta['meta.categorie'];

                    const cat = outil.categorie || catAutres;
                    if (!categoriesOutils[cat]) categoriesOutils[cat] = [];
                    categoriesOutils[cat].push(outil);
                } catch (err) {
                    console.error(`[(menu), "${nomSession}"]: Erreur en chargeant l'outil ${fichier}:`, err);
                }
            }
        }

	//construction du message à mettre en legende
        let menuTexte = `┏╋━━━━━━━━━━━━━━◥◣◆◢◤━━━━━━━━━━━━━━╋┓

> 𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭                    『 Mugen♾️♾️ Bot v${pkg.version} 』\n`;

        //1- section Commandes
        if (!argument || argument === "commandes" || argument === "commande") {
            const texteTitreCmd = trad('msg.titre_commandes');
            const titreCmd = texteTitreCmd || "『 📋VOILÀ LES COMMANDES📜 』";

            menuTexte += `            ╔════════❀══◄••❀••►══❀════════╗
               𓅓 ${titreCmd} 𓅓
            ╚════════❀══◄••❀••►══❀════════╝
┏`;
            let catsCmd = Object.keys(categoriesCommandes).filter(c => c !== catAutres).sort().concat(categoriesCommandes[catAutres] ? [catAutres] : []);
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
        let catsOutil = Object.keys(categoriesOutils).filter(c => c !== catAutres).sort().concat(categoriesOutils[catAutres] ? [catAutres] : []);
        if (catsOutil.length > 0 && (!argument || argument === "outils" || argument === "outil")) {
            //si on affiche les deux, on met le séparateur de section
            if (!argument) {
                menuTexte += `\n\n▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n\n`;
            }

            const texteTitreOutil = trad('msg.titre_outils');
            const titreOutil = texteTitreOutil || "『 🛠️VOILÀ LES OUTILS⚙️ 』";

            menuTexte += `\n> 𑲭𑲭𑲭𑲭
           ╔════════❀══◄••❀••►══❀════════╗
                𓅓 ${titreOutil} 𓅓
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

        //lecture de la configuration photo
        let mon_profil = "vrai";
        if (fs.existsSync(cheminPhotoConfig)) {
            try {
                const config = JSON.parse(fs.readFileSync(cheminPhotoConfig, 'utf8'));
                mon_profil = config[0].mon_profil;
            } catch (e) {
                mon_profil = "vrai";
            }
        }

        if (mon_profil === "vrai") {
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
                console.error(`[(menu, "${nomSession}")]: Erreur lors de l'envoi de l'image de profil :`, e.message);
	        //envoi final du menu
                await sock.sendMessage(message.key.remoteJid, { text: menuTexte },
		    { quoted: message });
            }
        } else {
            //utiliser la photo de la discussion actuelle
            try {
                const urlPhotoProfil = await sock.profilePictureUrl(message.key.remoteJid, 'image');
                const reponse = await fetch(urlPhotoProfil);
                if (!reponse.ok) throw new Error(`[(menu, "${nomSession}")]: Impossible de récupérer la photo`);
                const bufferImage = Buffer.from(await reponse.arrayBuffer());
                await sock.sendMessage(message.key.remoteJid, { image: bufferImage, caption: menuTexte }, { quoted: message });
            } catch (e) {
                console.warn(`[(menu, "${nomSession}")]: Impossible de récupérer la photo de discussion. Envoi en texte seul.`);
                //envoi en texte seul si pas de photo
                await sock.sendMessage(message.key.remoteJid, { text: menuTexte }, { quoted: message });
            }
        }
    }
};