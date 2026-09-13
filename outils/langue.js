import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const capitaliser = (chaine) => chaine.charAt(0).toUpperCase() + chaine.slice(1).toLowerCase();

/**
 * Fonction centrale pour récupérer les traductions
 * Supporte la notation par point récursive (ex: msg.erreurs.404)
 * @param {string} nom_session - Nom de la session active
 * @param {string} type - 'commandes' ou 'outils'
 * @param {string} nom - Nom du fichier (ex: 'mugen')
 * @param {object} clesDemandes - Objet { cle: { var1: val1 } }
 */
export async function traduire(nom_session, type, nom, clesDemandes) {
    const cheminSessionLangue = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nom_session, 'langue.json');
    let codeLangue = 'fr'; // Français par défaut

    // 1. On récupère la langue de la session
    if (await fs.access(cheminSessionLangue).then(() => true).catch(() => false)) {
        try {
            codeLangue = JSON.parse(await fs.readFile(cheminSessionLangue, 'utf8')).langue;
        } catch (e) {}
    }

    // 2. On identifie le dossier de la langue via son code
    const cheminDossierLangues = path.join(__dirname, '..', 'langues');
    if (!(await fs.access(cheminDossierLangues).then(() => true).catch(() => false))) {
        await fs.mkdir(cheminDossierLangues, { recursive: true });
    }

    const elementsDossier = await fs.readdir(cheminDossierLangues, { withFileTypes: true });
    const listeDossiers = elementsDossier.filter(f => f.isDirectory()).map(f => f.name);

    let nomDossierLangue = 'français'; // Dossier par défaut
    let trouvé = false;
    for (const dossier of listeDossiers) {
        const cheminConfig = path.join(cheminDossierLangues, dossier, `${dossier}.json`);
        if (await fs.access(cheminConfig).then(() => true).catch(() => false)) {
            try {
                if (JSON.parse(await fs.readFile(cheminConfig, 'utf8')).code === codeLangue) {
                    nomDossierLangue = dossier;
                    trouvé = true;
                    break;
                }
            } catch (e) {}
        }
    }

    // 3. Chargement du fichier de traduction
    const cheminTrad = path.join(cheminDossierLangues, nomDossierLangue, type, `${nom}.json`);
    let dictionnaire = { metadonnees: {}, messages: {} };
    let aEteModifie = false;

    if (await fs.access(cheminTrad).then(() => true).catch(() => false)) {
        try {
            const contenu = await fs.readFile(cheminTrad, 'utf8');
            if (contenu.trim()) dictionnaire = JSON.parse(contenu);
        } catch (e) {
            console.error(`[(Langage)]: Erreur de lecture de ${cheminTrad}`);
        }
    } else {
        await fs.mkdir(path.dirname(cheminTrad), { recursive: true });
        await fs.writeFile(cheminTrad, JSON.stringify(dictionnaire, null, 1));
    }

    const resultats = {};
    const cles = Object.keys(clesDemandes);

    // Helper pour creuser dans l'objet de manière récursive
    const creuser = (obj, path) => path.reduce((acc, curr) => (acc && acc[curr] !== undefined) ? acc[curr] : undefined, obj);

    // 4. Extraction et injection des variables
    cles.forEach(cleBrute => {
        const parties = cleBrute.split('.');
        let chemin = [...parties];
        let section = 'messages';
        let estExplicite = false;

        // Détection du préfixe de section (meta. ou msg.)
        const prefixe = parties[0].toLowerCase();
        if (['meta', 'i', 'metadonnees'].includes(prefixe)) {
            section = 'metadonnees';
            chemin = parties.slice(1);
            estExplicite = true;
        } else if (['msg', 'm', 'messages'].includes(prefixe)) {
            section = 'messages';
            chemin = parties.slice(1);
            estExplicite = true;
        }

        let texte = creuser(dictionnaire[section], chemin);

        // Fallback intelligent : si pas trouvé dans la section spécifique, on cherche partout
        if (!texte || (typeof texte === 'string' && texte.trim() === "")) {
            const fallbackMsg = creuser(dictionnaire.messages, chemin);
            const fallbackMeta = creuser(dictionnaire.metadonnees, chemin);
            texte = fallbackMsg || fallbackMeta;
        }

        if (texte && typeof texte === 'string' && texte.trim() !== "") {
            const variables = clesDemandes[cleBrute];
            if (typeof variables === 'object') {
                Object.keys(variables).forEach(v => {
                    texte = texte.replace(new RegExp(`{${v}}`, 'g'), variables[v]);
                });
            }
            resultats[cleBrute] = texte;
        } else {
            // Création automatique récursive uniquement si demande explicite
            if (estExplicite) {
                const existeDeja = creuser(dictionnaire.messages, chemin) !== undefined || creuser(dictionnaire.metadonnees, chemin) !== undefined;
                if (!existeDeja) {
                    if (!dictionnaire[section]) dictionnaire[section] = {};
                    let temp = dictionnaire[section];
                    for (let i = 0; i < chemin.length - 1; i++) {
                        if (temp[chemin[i]] === undefined || typeof temp[chemin[i]] !== 'object') {
                            temp[chemin[i]] = {};
                        }
                        temp = temp[chemin[i]];
                    }
                    temp[chemin[chemin.length - 1]] = "";
                    aEteModifie = true;
                }
            }
            resultats[cleBrute] = null;
        }
    });

    if (aEteModifie) {
        await fs.writeFile(cheminTrad, JSON.stringify(dictionnaire, null, 1));
    }

    return resultats;
}

export default {
    nom: 'langue',
    description: 'Changer la langue du bot',
    evenements: 'messages.upsert',
    categorie: 'Bot',
    infos: `Permet d'afficher et de changer la langue du bot l'utilisation est très simple il faut faire la commande puis le nom ou code de la langue ensuite ex: \`.langue ht\`.
*NB: Il ya certaines langues qui ne seront pas disponible dans le bot, si c'est le cas un message d'erreur sera plutôt afficher disant que la langue n'existe pas ou n'est pas disponible.

> Pour afficher les langues disponibles c'est simple il suffit de faire la commande sans argument de langue : \`.langue\`.*`,
    affiche_menu: 'vrai',

    execute: async (nomEvenement, donneesEvenement, { connexion, nom_session, prefixe }) => {
	const { messages } = donneesEvenement;
	const message = messages[0];
	if (!message.message) return;

	const texte = message.message.conversation ||
		      message.message.extendedTextMessage?.text ||
                      message.message.imageMessage?.caption ||
                      message.message.videoMessage?.caption;

        if (!texte || !texte.startsWith(prefixe)) return;
        const [commande, ...arguments_] = texte.slice(prefixe.length).trim().split(/\s+/);

        if (commande.toLowerCase() !== 'langue') return;

        // Le "Raccourci" local, sans boucle infinie
        const trad = async (cle, vars = {}) => (await traduire(nom_session, 'outils', 'langue', { [cle]: vars }))[cle];

        if (!message.key.fromMe) {
            const pas_moi = (await trad('msg.pas_moi')) || "⊙```T'as pas l'autorisation necéssaire```";
            await connexion.sendMessage(message.key.remoteJid, { text: pas_moi }, { quoted: message });
            return 'STOP';
        }

        const cheminDossierLangues = path.join(__dirname, '..', 'langues');
        const cheminSessionLangue = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nom_session, 'langue.json');

        const elementsDossier = await fs.readdir(cheminDossierLangues, { withFileTypes: true });
        const listeDossiers = elementsDossier.filter(f => f.isDirectory()).map(f => f.name);
        
        const donneesLangues = [];
        for (const dossier of listeDossiers) {
            const cheminJsonIdentity = path.join(cheminDossierLangues, dossier, `${dossier}.json`);
            if (await fs.access(cheminJsonIdentity).then(() => true).catch(() => false)) {
                try {
                    const contenu = JSON.parse(await fs.readFile(cheminJsonIdentity, 'utf8'));
                    donneesLangues.push({
                      dossier,
                      code: contenu.code,
                      nom: contenu.nom || dossier
                    });
                } catch (e) { continue; }
            }
        }

        if (!arguments_[0]) {
            let reponse = (await trad('msg.reponse.1')) || "> Voici les langues disponible :\n\n";
            for (const l of donneesLangues) {
              const variables_reponse_nom = (await trad(`msg.variables.variables_langues.${l.code}.nom`)) || capitaliser(l.nom);
              const variables_reponse_code = (await trad(`msg.variables.variables_langues.${l.code}.code`)) || l.code;
		reponse += (await trad('msg.reponse.2', {
		    nom: variables_reponse_nom,
		    code: variables_reponse_code
		    })) || `- ${capitaliser(l.nom)} (\`${l.code}\`)\n`;
            }
            await connexion.sendMessage(message.key.remoteJid, { text: reponse }, { quoted: message });
            return 'STOP';
        }

        const argumentChoisi = arguments_[0].toLowerCase();
        const langueCible = donneesLangues.find(l => l.dossier.toLowerCase() === argumentChoisi || l.code.toLowerCase() === argumentChoisi);

        if (!langueCible) {
            const  langue_pas_trouve = (await trad('msg.erreur.langue_pas_trouve')) || "𒀰Langue indisponible ou inexistante𒀰";
            await connexion.sendMessage(message.key.remoteJid, { text: langue_pas_trouve }, { quoted: message });
            return 'STOP';
        }

        let ancien_code = 'fr';
        if (await fs.access(cheminSessionLangue).then(() => true).catch(() => false)) {
            try {
                ancien_code = JSON.parse(await fs.readFile(cheminSessionLangue, 'utf8')).langue;
            } catch (e) {}
        }

        const nouvelleConfig = { langue: langueCible.code };
        if (!(await fs.access(path.dirname(cheminSessionLangue)).then(() => true).catch(() => false))) await fs.mkdir(path.dirname(cheminSessionLangue), { recursive: true });
        await fs.writeFile(cheminSessionLangue, JSON.stringify(nouvelleConfig, null, 1));

        // Maintenant que la session est mise à jour, trad() utilisera le nouveau dictionnaire
        const ancienneLangueNom = (await trad(`msg.variables.variables_langues.${ancien_code}.nom`)) || capitaliser(ancien_code);
        const nouvelleLangueNom = (await trad(`msg.variables.variables_langues.${langueCible.code}.nom`)) || capitaliser(langueCible.nom);

        const succes_change_langue = (await trad('msg.succes.change_langue', {
            ancienne: ancienneLangueNom,
            nouvelle: nouvelleLangueNom
        })) || `🗘Langue changé de ${ancienneLangueNom} ➜ ${nouvelleLangueNom}✓`;

        await connexion.sendMessage(message.key.remoteJid, { text: succes_change_langue }, { quoted: message });

        return 'STOP';
    }
};