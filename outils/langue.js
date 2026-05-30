import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const capitaliser = (chaine) => chaine.charAt(0).toUpperCase() + chaine.slice(1).toLowerCase();

/**
 * Fonction centrale pour récupérer les traductions
 * Supporte la notation par point récursive (ex: msg.erreurs.404)
 * @param {string} nomSession - Nom de la session active
 * @param {string} type - 'commandes' ou 'outils'
 * @param {string} nom - Nom du fichier (ex: 'mugen')
 * @param {object} clesDemandes - Objet { cle: { var1: val1 } }
 */
export function traduire(nomSession, type, nom, clesDemandes) {
    const cheminSessionLangue = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession, 'langue.json');
    let codeLangue = 'fr'; // Français par défaut

    // 1. On récupère la langue de la session
    if (fs.existsSync(cheminSessionLangue)) {
        try {
            codeLangue = JSON.parse(fs.readFileSync(cheminSessionLangue, 'utf8')).langue;
        } catch (e) {}
    }

    // 2. On identifie le dossier de la langue via son code
    const cheminDossierLangues = path.join(__dirname, '..', 'langues');
    if (!fs.existsSync(cheminDossierLangues)) fs.mkdirSync(cheminDossierLangues, { recursive: true });

    const listeDossiers = fs.readdirSync(cheminDossierLangues).filter(f => fs.statSync(path.join(cheminDossierLangues, f)).isDirectory());
    
    let nomDossierLangue = 'français'; // Dossier par défaut
    let trouvé = false;
    for (const dossier of listeDossiers) {
        const cheminConfig = path.join(cheminDossierLangues, dossier, `${dossier}.json`);
        if (fs.existsSync(cheminConfig)) {
            try {
                if (JSON.parse(fs.readFileSync(cheminConfig, 'utf8')).code === codeLangue) {
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

    if (fs.existsSync(cheminTrad)) {
        try {
            const contenu = fs.readFileSync(cheminTrad, 'utf8');
            if (contenu.trim()) dictionnaire = JSON.parse(contenu);
        } catch (e) {
            console.error(`[(Langage)]: Erreur de lecture de ${cheminTrad}`);
        }
    } else {
        if (!fs.existsSync(path.dirname(cheminTrad))) fs.mkdirSync(path.dirname(cheminTrad), { recursive: true });
        fs.writeFileSync(cheminTrad, JSON.stringify(dictionnaire, null, 1));
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
        fs.writeFileSync(cheminTrad, JSON.stringify(dictionnaire, null, 1));
    }

    return resultats;
}

export default {
    nom: 'gestionnaire_langue',
    evenements: 'messages.upsert',

    execute: async (nomEvenement, donneesEvenement, { sock, nomSession, prefixe }) => {
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

        if (!message.key.fromMe) {
            await sock.sendMessage(message.key.remoteJid, { text: "⊙```T'as pas l'autorisation necéssaire```" }, { quoted: message });
            return 'STOP';
        }

        const cheminDossierLangues = path.join(__dirname, '..', 'langues');
        const cheminSessionLangue = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession, 'langue.json');

        const listeDossiers = fs.readdirSync(cheminDossierLangues).filter(f => fs.statSync(path.join(cheminDossierLangues, f)).isDirectory());
        const donneesLangues = listeDossiers.map(dossier => {
            const cheminJsonIdentity = path.join(cheminDossierLangues, dossier, `${dossier}.json`);
            if (fs.existsSync(cheminJsonIdentity)) {
                try {
                    const contenu = JSON.parse(fs.readFileSync(cheminJsonIdentity, 'utf8'));
                    return { dossier, code: contenu.code, nom: contenu.nom || dossier };
                } catch (e) { return null; }
            }
            return null;
        }).filter(l => l !== null);

        if (!arguments_[0]) {
            let reponse = "> Voici les langues disponible :\n\n";
            donneesLangues.forEach(l => {
                reponse += `- ${capitaliser(l.nom)} (\`${l.code}\`)\n`;
            });
            await sock.sendMessage(message.key.remoteJid, { text: reponse }, { quoted: message });
            return 'STOP';
        }

        const argumentChoisi = arguments_[0].toLowerCase();
        const langueCible = donneesLangues.find(l => l.dossier.toLowerCase() === argumentChoisi || l.code.toLowerCase() === argumentChoisi);

        if (!langueCible) {
            await sock.sendMessage(message.key.remoteJid, { text: "𒀰Langue indisponible ou inexistant𒀰" }, { quoted: message });
            return 'STOP';
        }

        let ancienneLangueNom = "Français";
        if (fs.existsSync(cheminSessionLangue)) {
            try {
                const configActuelle = JSON.parse(fs.readFileSync(cheminSessionLangue, 'utf8'));
                const ancienne = donneesLangues.find(l => l.code === configActuelle.langue);
                if (ancienne) ancienneLangueNom = capitaliser(ancienne.nom);
            } catch (e) {}
        }

        const nouvelleConfig = { langue: langueCible.code };
        if (!fs.existsSync(path.dirname(cheminSessionLangue))) fs.mkdirSync(path.dirname(cheminSessionLangue), { recursive: true });
        fs.writeFileSync(cheminSessionLangue, JSON.stringify(nouvelleConfig, null, 1));

        const messageSucces = `🗘Langue changé de ${ancienneLangueNom} ➜ ${capitaliser(langueCible.nom)}✓`;
        await sock.sendMessage(message.key.remoteJid, { text: messageSucces }, { quoted: message });

        return 'STOP';
    }
};
