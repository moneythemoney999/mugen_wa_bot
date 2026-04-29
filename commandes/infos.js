/* */

//imports necessaires
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { traduire } from '../outils/langue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


async function mettreAJourPhotoProfil(sock, nomSession) {
    const cheminDossierSession = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession);
    const cheminProfil = path.join(cheminDossierSession, 'profil.jpg');

    try {
        const urlPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
        const reponse = await fetch(urlPhotoProfil);
        if (!reponse.ok) {
            throw new Error(`[(infos), "${nomSession}"]: Erreur dans la requête de récuperation du profil avec le statut : ${reponse.status}`);
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
            console.error(`[(infos), "${nomSession}"]: Erreur lors de la supression de l'ancienne photo de profil pour (${nomSession}):`, errSuppression);
        }
    }
}

export default {
    nom: "infos",
    description: "Avoir plus d'infos sur les commandes que la p'tit description de `.menu`.",
    categorie: "Groupes && Privé",
    infos: `Pour l'utiliser il faut faire la commande + la commande dont tu veux plus d'infos.
> Exemple : \`.infos infos\`

La commande a aussi un argument :
    \`.infos photo\` : *Pour changer la photo de fond de la commande.*`,

    execute: async ({ sock, message, args, nomSession }) => {
        const dossierInfosMemo = path.join(__dirname, '..', 'memoires', 'memoires_commandes', 'infos', nomSession);
        const cheminPhotoConfig = path.join(dossierInfosMemo, 'photo.json');

        const trad = (cle, vars = {}) => traduire(nomSession, 'commandes', 'infos', { [cle]: vars })[cle];

        if (args[0]?.toLowerCase() === 'photo') {
            if (!message.key.fromMe) {
                const msgPermis = trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
                return sock.sendMessage(message.key.remoteJid, { text: msgPermis}, { quoted: message });
            }

            await fsPromises.mkdir(dossierInfosMemo, { recursive: true });
            let config = [{ "mon_profil": "vrai" }];

            if (fs.existsSync(cheminPhotoConfig)) {
                try {
                    config = JSON.parse(fs.readFileSync(cheminPhotoConfig, 'utf8'));
                } catch (e) {
                    config = [{ "mon_profil": "vrai" }];
                }
            }

            config[0].mon_profil = config[0].mon_profil === "vrai" ? "faux" : "vrai";
            fs.writeFileSync(cheminPhotoConfig, JSON.stringify(config, null, 1));

            const statut = config[0].mon_profil === "vrai" ? (trad('msg.statut_mon_profil') || "mon profil") : (trad('msg.statut_profil_chat') || "profil du chat");
            const msgSucces = trad('msg.photo_changee', {statut: statut}) || `𑁍Photo de fond changée en *${statut}*᪥.`;
            return sock.sendMessage(message.key.remoteJid, { text: msgSucces }, { quoted: message });
        }

        async function repondreAvecProfil(texte) {
            let mon_profil = "vrai";
            if (fs.existsSync(cheminPhotoConfig)) {
                try {
                    const config = JSON.parse(fs.readFileSync(cheminPhotoConfig, 'utf8'));
                    mon_profil = config[0].mon_profil;
                } catch (e) { mon_profil = "vrai"; }
            }

            if (mon_profil === "vrai") {
                const cheminProfil = path.join(__dirname, '..', 'memoires', 'memoires_sessions', nomSession, 'profil.jpg');
                try {
                    if (fs.existsSync(cheminProfil)) {
                        await sock.sendMessage(message.key.remoteJid, { image: fs.readFileSync(cheminProfil), caption: texte }, { quoted: message });
                        mettreAJourPhotoProfil(sock, nomSession);
                    } else {
                        const urlPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
                        const reponse = await fetch(urlPhotoProfil);
                        const bufferImage = Buffer.from(await reponse.arrayBuffer());
                        await fsPromises.mkdir(path.dirname(cheminProfil), { recursive: true });
                        fs.writeFileSync(cheminProfil, bufferImage);
                        await sock.sendMessage(message.key.remoteJid, { image: bufferImage, caption: texte }, { quoted: message });
                    }
                } catch (e) {
                    await sock.sendMessage(message.key.remoteJid, { text: texte }, { quoted: message });
                }
            } else {
                try {
                    const urlPhotoProfil = await sock.profilePictureUrl(message.key.remoteJid, 'image');
                    const reponse = await fetch(urlPhotoProfil);
                    const bufferImage = Buffer.from(await reponse.arrayBuffer());
                    await sock.sendMessage(message.key.remoteJid, { image: bufferImage, caption: texte }, { quoted: message });
                } catch (e) {
                    await sock.sendMessage(message.key.remoteJid, { text: texte }, { quoted: message });
                }
            }
        }

        if (!args[0]) {
            const texteAide = trad('msg.texte_aide') || `Sur quelle commande/outil souhaites-tu avoir plus d'infos?\n> Fais par exemple : \`.infos infos\``;
            await repondreAvecProfil(texteAide);
            return;
        }

        const nomRecherche = args[0].toLowerCase();
        let cmdTrouvee = null;
        let outilTrouve = null;

        // 1. Recherche dans Commandes
        const fichiersCommandes = fs.readdirSync(__dirname).filter(f => f.endsWith('.js'));
        for (const fichier of fichiersCommandes) {
            try {
                const module = await import(`./${fichier}?t=${Date.now()}`);
                if (module.default?.nom?.toLowerCase() === nomRecherche) {
                    cmdTrouvee = { ...module.default };
                    break;
                }
            } catch (e) {}
        }

        // 2. Recherche dans Outils
        const cheminOutils = path.join(__dirname, '..', 'outils');
        if (fs.existsSync(cheminOutils)) {
            const fichiersOutils = fs.readdirSync(cheminOutils).filter(f => f.endsWith('.js'));
            for (const fichier of fichiersOutils) {
                try {
                    const module = await import(`../outils/${fichier}?t=${Date.now()}`);
                    if (module.default?.nom?.toLowerCase() === nomRecherche) {
                        outilTrouve = { ...module.default };
                        break;
                    }
                } catch (e) {}
            }
        }

        // Fonction pour formater un bloc d'info
        const formaterBloc = (objet, type) => {
            const tradsMeta = traduire(nomSession, type, objet.nom, {
                'meta.nom': {},
                'meta.infos': {}
            });

            const nomFinal = tradsMeta['meta.nom'] || objet.nom;
            const infosFinal = tradsMeta['meta.infos'] || objet.infos || trad('msg.aucune_info') || "Aucune information disponible.";

            // Détermination du type pour le titre
            const labelType = type === 'commandes' ? (trad('msg.type_commande') || "la commande") : (trad('msg.type_outil') || "l'outil");
            
	    //const titreResultat = trad('msg.titre_resultat', { nom: nomFinal }) || `> Voici les infos de la commande ${nomFinal}.`;
            const titreResultat = trad(`msg.titre_resultat_${type}`, { nom: nomFinal }) || 
                                 trad('msg.titre_resultat', { nom: nomFinal, type: labelType }) || 
                                 `> Voici les infos de ${labelType} ${nomFinal}.`;

            const nom_resultat = trad('msg.nom_resultat') || "Nom";
            const infos_resultat = trad('msg.infos_resultat') || "Infos";

            return `${titreResultat}\n- ${nom_resultat} : *${nomFinal}*\n\n- ${infos_resultat} : ${infosFinal}`;
        };

        if (cmdTrouvee && outilTrouve) {
            // CAS DOUBLE RESULTAT
            const blocCmd = formaterBloc(cmdTrouvee, 'commandes');
            const blocOutil = formaterBloc(outilTrouve, 'outils');
            const separateur = "\n\n⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜\n\n";
            
            await repondreAvecProfil(`${blocCmd}${separateur}${blocOutil}`);

        } else if (cmdTrouvee || outilTrouve) {
            // CAS SIMPLE RESULTAT
            const objet = cmdTrouvee || outilTrouve;
            const type = cmdTrouvee ? 'commandes' : 'outils';
            await repondreAvecProfil(formaterBloc(objet, type));

        } else {
            // AUCUN RESULTAT
            const reponseErreur = trad('msg.erreur_inexistant', { nom: nomRecherche }) || `La commande ~${nomRecherche} n'existe pas.~ \n> Vas lire \`.menu\` pour savoir les commandes.`;
            await repondreAvecProfil(reponseErreur);
        }
    }
};
