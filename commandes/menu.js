/* */

//imports
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { traduire } from '../outils/langue.js';

//récupérer la version du bot depuis package.json
const packageJsonPath = path.resolve('./package.json');
const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

//pour nom_dossier en ES modules
const nom_fichier = fileURLToPath(import.meta.url);
const nom_dossier = path.dirname(nom_fichier);
const chemin_url = (chemin) => pathToFileURL(chemin).href;

//fonction pour mettre à jour la photo de profil en arrière-plan
async function mettreAJourPhotoProfil(connexion, nom_session) {
    const cheminDossierSession = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session);
    const cheminProfil = path.join(cheminDossierSession, 'profil.jpg');

    try {
        const urlPhotoProfil = await connexion.profilePictureUrl(connexion.user.id, 'image');
        const reponse = await fetch(urlPhotoProfil);
        if (!reponse.ok) {
	    //s'il y'a eu un problème
            throw new Error(`[(menu), "${nom_session}"]: La requête de recupération de la photo profil a échoué avec le statut : ${reponse.status}`);
        }
        const bufferImage = Buffer.from(await reponse.arrayBuffer());

        await fs.mkdir(cheminDossierSession, { recursive: true });
        await fs.writeFile(cheminProfil, bufferImage);
    } catch (erreur) {
        console.error(erreur.message || erreur);
        try {
            if (await fs.access(cheminProfil).then(() => true).catch(() => false)) {
                await fs.unlink(cheminProfil);
            }
        } catch (errSuppression) {
	    //si la supression echoue
            console.error(`[(menu), "${nom_session}"]: Erreur lors de la suppression de l'ancienne photo de profil pour ${nom_session}:`, errSuppression);
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
    execute: async ({ connexion, message, arguments, nom_session }) => {
        const dossierCommandes = nom_dossier;
        const dossierOutils = path.join(nom_dossier, '..', 'outils');
        const argument = arguments[0]?.toLowerCase();

        const dossierMenuMemo = path.join(nom_dossier, '..', 'memoires', 'memoires_commandes', 'menu', nom_session);
        const cheminPhotoConfig = path.join(dossierMenuMemo, 'photo.json');

	//"Raccourci" de traduction importer depui le fichier outils/langue.js
	const trad = (cle, vars = {}) => traduire(nom_session, 'commandes', 'menu', { [cle]: vars })[cle];

	//pour traduire et bien faire en sorte que les commandes ou outils sans catégories aparraisse toujours à la fin
	const texteCatAutres = trad('msg.cat_autres');
	const catAutres = texteCatAutres || 'Autres';

        //gestion de la sous-commande "photo"
        if (argument === 'photo') {
            //vérification si l'expéditeur est le bot lui-même
            if (!message.key.fromMe) {
		const msgPermis = trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
                return connexion.sendMessage(message.key.remoteJid, { text: msgPermis },
		    { quoted: message });
            }

            await fs.mkdir(dossierMenuMemo, { recursive: true });
            let config = [{ "mon_profil": "vrai" }];

            if (await fs.access(cheminPhotoConfig).then(() => true).catch(() => false)) {
                try {
                    config = JSON.parse(await fs.readFile(cheminPhotoConfig, 'utf8'));
                } catch (e) {
                    config = [{ "mon_profil": "vrai" }];
                }
            }

            //basculement de la valeur
            config[0].mon_profil = config[0].mon_profil === "vrai" ? "faux" : "vrai";
            await fs.writeFile(cheminPhotoConfig, JSON.stringify(config, null, 1));

	    const statut = config[0].mon_profil === "vrai" ? (trad('msg.statut_mon_profil') || "mon profil") : (trad('msg.statut_profil_chat') || "profil du chat");
	    const msgSucces = trad('msg.photo_changee', {statut: statut }) || `𑁍Photo de fond changée en *${statut}*᪥.`
            return connexion.sendMessage(message.key.remoteJid, { text: msgSucces },
		{ quoted: message });
        }

        const categoriesCommandes = {};
        const categoriesOutils = {};

        //charger les Commandes
        const fichiersCommandes = (await fs.readdir(dossierCommandes)).filter(f => f.endsWith('.js'));

        for (const fichier of fichiersCommandes) {
            try {
                const commandeModule = await import(chemin_url(path.join(dossierCommandes, fichier)));
                let cmd = { ...commandeModule.default }; //on clone pour ne pas polluer l'original en cache
                if (!cmd || !cmd.nom) continue;

                //traduction des métadonnées de la commande
                const tradsMeta = traduire(nom_session, 'commandes', cmd.nom, {
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
                console.error(`[(menu, "${nom_session}")]: Erreur en chargeant la commande ${fichier}:`, err);
            }
        }

        //charger les Outils
        if (await fs.access(dossierOutils).then(() => true).catch(() => false)) {
            const fichiersOutils = (await fs.readdir(dossierOutils)).filter(f => f.endsWith('.js'));

            for (const fichier of fichiersOutils) {
                try {
                    const outilModule = await import(chemin_url(path.join(dossierOutils, fichier)));
                    let outil = { ...outilModule.default };
                    if (!outil || !outil.nom) continue;

                    const vrai = "vrai";
                    if (outil.affiche_menu !== vrai) continue;

                    //traduction des métadonnées de l'outil
                    const tradsMeta = traduire(nom_session, 'outils', outil.nom, {
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
                    console.error(`[(menu), "${nom_session}"]: Erreur en chargeant l'outil ${fichier}:`, err);
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
           ╚════════❀══◄══❀══╝`;

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
        if (await fs.access(cheminPhotoConfig).then(() => true).catch(() => false)) {
            try {
                const config = JSON.parse(await fs.readFile(cheminPhotoConfig, 'utf8'));
                mon_profil = config[0].mon_profil;
            } catch (e) {
                mon_profil = "vrai";
            }
        }

        if (mon_profil === "vrai") {
            const cheminProfil = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session, 'profil.jpg');
            try {
                if (await fs.access(cheminProfil).then(() => true).catch(() => false)) {
                    const buffer = await fs.readFile(cheminProfil);
                    await connexion.sendMessage(message.key.remoteJid, { image: buffer, caption: menuTexte }, { quoted: message });
                    mettreAJourPhotoProfil(connexion, nom_session);
                } else {
                    const urlPhotoProfil = await connexion.profilePictureUrl(connexion.user.id, 'image');
                    const reponse = await fetch(urlPhotoProfil);
                    const bufferImage = Buffer.from(await reponse.arrayBuffer());
                    await fs.mkdir(path.dirname(cheminProfil), { recursive: true });
                    await fs.writeFile(cheminProfil, bufferImage);
                    await connexion.sendMessage(message.key.remoteJid, { image: bufferImage, caption: menuTexte }, { quoted: message });
                }
            } catch (e) {
                console.error(`[(menu, "${nom_session}")]: Erreur lors de l'envoi de l'image de profil :`, e.message);
	        //envoi final du menu
                await connexion.sendMessage(message.key.remoteJid, { text: menuTexte },
		    { quoted: message });
            }
        } else {
            //utiliser la photo de la discussion actuelle
            try {
                const urlPhotoProfil = await connexion.profilePictureUrl(message.key.remoteJid, 'image');
                const reponse = await fetch(urlPhotoProfil);
                if (!reponse.ok) throw new Error(`[(menu, "${nom_session}")]: Impossible de récupérer la photo`);
                const bufferImage = Buffer.from(await reponse.arrayBuffer());
                await connexion.sendMessage(message.key.remoteJid, { image: bufferImage, caption: menuTexte }, { quoted: message });
            } catch (e) {
                console.warn(`[(menu, "${nom_session}")]: Impossible de récupérer la photo de discussion. Envoi en texte seul.`);
                //envoi en texte seul si pas de photo
                await connexion.sendMessage(message.key.remoteJid, { text: menuTexte }, { quoted: message });
            }
        }
    }
};