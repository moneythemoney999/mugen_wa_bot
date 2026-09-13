/* */

//imports necessaires
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { traduire } from '../outils/langue.js';

const nom_fichier = fileURLToPath(import.meta.url);
const nom_dossier = path.dirname(nom_fichier);
const chemin_url = (chemin) => pathToFileURL(chemin).href;


async function mettreAJourPhotoProfil(connexion, nom_session) {
    const cheminDossierSession = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session);
    const cheminProfil = path.join(cheminDossierSession, 'profil.jpg');

    try {
        const urlPhotoProfil = await connexion.profilePictureUrl(connexion.user.id, 'image');
        const reponse = await fetch(urlPhotoProfil);
        if (!reponse.ok) {
            throw new Error(`[(infos), "${nom_session}"]: Erreur dans la requête de récuperation du profil avec le statut : ${reponse.status}`);
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
            console.error(`[(infos), "${nom_session}"]: Erreur lors de la supression de l'ancienne photo de profil pour (${nom_session}):`, errSuppression);
        }
    }
}

export default {
    nom: "infos",
    description: "Avoir plus d'infos sur les commandes que la p'tit description de `.menu`.",
    categorie: "Groupes && Privé",
    infos: `Pour l'utiliser il faut faire la commande + la fonctionnalité dont tu veux plus d'infos.
> Exemple : \`.infos infos\`

La commande a aussi un argument :
    \`.infos photo\` : *Pour changer la photo de fond de la commande.*`,

    execute: async ({ connexion, message, arguments, nom_session }) => {
        const dossierInfosMemo = path.join(nom_dossier, '..', 'memoires', 'memoires_commandes', 'infos', nom_session);
        const cheminPhotoConfig = path.join(dossierInfosMemo, 'photo.json');

        const trad = (cle, vars = {}) => traduire(nom_session, 'commandes', 'infos', { [cle]: vars })[cle];

        if (arguments[0]?.toLowerCase() === 'photo') {
            if (!message.key.fromMe) {
                const msgPermis = trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
                return connexion.sendMessage(message.key.remoteJid, { text: msgPermis}, { quoted: message });
            }

            await fs.mkdir(dossierInfosMemo, { recursive: true });
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

            const statut = config[0].mon_profil === "vrai" ? (trad('msg.statut_mon_profil') || "mon profil") : (trad('msg.statut_profil_chat') || "profil du chat");
            const msgSucces = trad('msg.photo_changee', {statut: statut}) || `𑁍Photo de fond changée en *${statut}*᪥.`;
            return connexion.sendMessage(message.key.remoteJid, { text: msgSucces }, { quoted: message });
        }

        async function repondreAvecProfil(texte) {
            let mon_profil = "vrai";
            if (await fs.access(cheminPhotoConfig).then(() => true).catch(() => false)) {
                try {
                    const config = JSON.parse(await fs.readFile(cheminPhotoConfig, 'utf8'));
                    mon_profil = config[0].mon_profil;
                } catch (e) { mon_profil = "vrai"; }
            }

            if (mon_profil === "vrai") {
                const cheminProfil = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session, 'profil.jpg');
                try {
                    if (await fs.access(cheminProfil).then(() => true).catch(() => false)) {
                        const buffer = await fs.readFile(cheminProfil);
                        await connexion.sendMessage(message.key.remoteJid, { image: buffer, caption: texte }, { quoted: message });
                        mettreAJourPhotoProfil(connexion, nom_session);
                    } else {
                        const urlPhotoProfil = await connexion.profilePictureUrl(connexion.user.id, 'image');
                        const reponse = await fetch(urlPhotoProfil);
                        const bufferImage = Buffer.from(await reponse.arrayBuffer());
                        await fs.mkdir(path.dirname(cheminProfil), { recursive: true });
                        await fs.writeFile(cheminProfil, bufferImage);
                        await connexion.sendMessage(message.key.remoteJid, { image: bufferImage, caption: texte }, { quoted: message });
                    }
                } catch (e) {
                    await connexion.sendMessage(message.key.remoteJid, { text: texte }, { quoted: message });
                }
            } else {
                try {
                    const urlPhotoProfil = await connexion.profilePictureUrl(message.key.remoteJid, 'image');
                    const reponse = await fetch(urlPhotoProfil);
                    const bufferImage = Buffer.from(await reponse.arrayBuffer());
                    await connexion.sendMessage(message.key.remoteJid, { image: bufferImage, caption: texte }, { quoted: message });
                } catch (e) {
                    await connexion.sendMessage(message.key.remoteJid, { text: texte }, { quoted: message });
                }
            }
        }

        if (!arguments[0]) {
            const texteAide = trad('msg.texte_aide') || `Sur quelle fonctionnalité souhaites-tu avoir plus d'infos?\n> Fais par exemple : \`.infos infos\``;
            await repondreAvecProfil(texteAide);
            return;
        }

        const nomRecherche = arguments[0].toLowerCase();
        let cmdTrouvee = null;
        let outilTrouve = null;

        // 1. Recherche dans Commandes
        const fichiersCommandes = (await fs.readdir(nom_dossier)).filter(f => f.endsWith('.js'));
        for (const fichier of fichiersCommandes) {
            try {
                const module = await import(`${chemin_url(path.join(nom_dossier, fichier))}?t=${Date.now()}`);
                if (module.default?.nom?.toLowerCase() === nomRecherche) {
                    cmdTrouvee = { ...module.default };
                    break;
                }
            } catch (e) {}
        }

        // 2. Recherche dans Outils
        const cheminOutils = path.join(nom_dossier, '..', 'outils');
        if (await fs.access(cheminOutils).then(() => true).catch(() => false)) {
            const fichiersOutils = (await fs.readdir(cheminOutils)).filter(f => f.endsWith('.js'));
            for (const fichier of fichiersOutils) {
                try {
                    const module = await import(`${chemin_url(path.join(cheminOutils, fichier))}?t=${Date.now()}`);
                    if (module.default?.nom?.toLowerCase() === nomRecherche) {
                        outilTrouve = { ...module.default };
                        break;
                    }
                } catch (e) {}
            }
        }

        // Fonction pour formater un bloc d'info
        const formaterBloc = (objet, type) => {
            const tradsMeta = traduire(nom_session, type, objet.nom, {
                'meta.nom': {},
                'meta.infos': {}
            });

            const nomFinal = tradsMeta['meta.nom'] || objet.nom;
            const infosFinal = tradsMeta['meta.infos'] || objet.infos || trad('msg.aucune_infos') || "Aucune information disponible.";

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
            const separateur = trad('msg.separateur') || "\n\n⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜\n\n";

            await repondreAvecProfil(`${blocCmd}${separateur}${blocOutil}`);

        } else if (cmdTrouvee || outilTrouve) {
            // CAS SIMPLE RESULTAT
            const objet = cmdTrouvee || outilTrouve;
            const type = cmdTrouvee ? 'commandes' : 'outils';
            await repondreAvecProfil(formaterBloc(objet, type));

        } else {
            // AUCUN RESULTAT
            const reponseErreur = trad('msg.erreur_inexistant', { nom: nomRecherche }) || `La fonctionnalité ~${nomRecherche} n'existe pas.~ \n> Va lire \`.menu\` pour savoir les commandes.`;
            await repondreAvecProfil(reponseErreur);
        }
    }
};
