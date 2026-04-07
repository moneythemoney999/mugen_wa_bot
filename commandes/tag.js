/* */

//imports
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { jidNormalizedUser } from "@whiskeysockets/baileys";

//configuration des LIMITES
const LIMITES_UTILISATION = {
    BOT: 50,
    ADMIN: 7,
    MEMBRE: 5,
};

//pour __dirname en ES modules
const nomFichier = fileURLToPath(import.meta.url);
const cheminDossier = path.dirname(nomFichier);

//fonctions utilitaires et resolutions des IDs
async function resoudreJid(sock, jid) {
    if (jid && jid.endsWith('@lid')) {
        try {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
            if (pn) return jidNormalizedUser(pn);
        } catch (e) {
            console.error(`[(tag)]: Erreur LID ${jid}:`, e);
        }
    }
    return jidNormalizedUser(jid);
}

//fonction pour mettre à jour la photo de profil en arriere-plan
async function mettreAJourPhotoProfil(sock, nomSession) {
    const cheminDossierSession = path.join(cheminDossier, '..', 'memoires', 'memoires_sessions', nomSession);
    const cheminProfil = path.join(cheminDossierSession, 'profil.jpg');

    try {
        const lienPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
        const reponse = await fetch(lienPhotoProfil);
        if (!reponse.ok) {
            throw new Error(`[(tag), "${nomSession}"]: La requête a échoué avec le statut : ${reponse.status}`);
        }
        const tamponImage = Buffer.from(await reponse.arrayBuffer());

        await fsPromises.mkdir(cheminDossierSession, { recursive: true });
        await fsPromises.writeFile(cheminProfil, tamponImage);
    } catch (erreur) {
        try {
            if (fs.existsSync(cheminProfil)) {
                await fsPromises.unlink(cheminProfil);
            }
        } catch (errSuppression) {
            console.error(`[(tag), "${nomSession}"]: Erreur lors de la suppression de l'ancienne photo de profil pour ${nomSession}:`, errSuppression);
        }
    }
}

//logique que le fichier principale va venir importer
export default {
    nom: "tag",
    description: "Tag tout le groupe",
    categorie: "En developpement", //"Groupes",
    infos: `Permet de taguer les membres du groupe.
La commande a aussi un argument spécial :
    \`.tag photo\` : *Pour changer la photo de fond de la commande.*`,

    execute: async ({ sock, message, args, nomSession }) => {
        const jid = message.key.remoteJid;
        const estGroupe = jid.endsWith('@g.us');

        const dossierTagMemo = path.join(cheminDossier, '..', 'memoires', 'memoires_commandes', 'tag', nomSession);
        const cheminPhotoConfig = path.join(dossierTagMemo, 'photo.json');

        //gestion de la sous-commande "photo"
        if (args[0]?.toLowerCase() === 'photo' && args.length === 1) {
            //si ce n'est pas le bot, on envoie le message de refus et on s'arrête là (pas de tag)
            if (!message.key.fromMe) {
                return sock.sendMessage(jid, { text: "⤫Tu peux pas l'executer⤫" },
		    { quoted: message });
            }

            await fsPromises.mkdir(dossierTagMemo, { recursive: true });
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

            const statut = config[0].mon_profil === "vrai" ? "mon profil" : "profil du chat";
            return sock.sendMessage(jid, { text: `𑁍Photo de fond changée en *${statut}*᪥.` },
		{ quoted: message });
        }

        if (!estGroupe) {
	    //s'il est executer en privé
            return await sock.sendMessage(jid, { text: "Cette commande fonctionne uniquement dans les groupes." },
		{ quoted: message });
        }

        //gestion des RESTRICTIONS & LIMITES
        const jidBrutExpediteur = message.key.participant;
        if (!jidBrutExpediteur) return;
        const expediteurJid = await resoudreJid(sock, jidBrutExpediteur);

	//appel au meta-donnees du groupe
        let metadonneesGroupe;
        try {
            metadonneesGroupe = await sock.groupMetadata(jid);
        } catch (e) {
            return sock.sendMessage(jid, { text: "Erreur lors de la récupération des infos du groupe." },
		{ quoted: message });
        }

	//preparration des chemins pour lecture et sauvegarde des donees
        const nomGroupeNettoye = metadonneesGroupe.subject.replace(/[\/\\?%*:|"<>]/g, '-');
        const cheminDossierStatut = path.join(dossierTagMemo, `${nomGroupeNettoye}_${jid}`);
        fs.mkdirSync(cheminDossierStatut, { recursive: true });
        const cheminFichierUtilisateur = path.join(cheminDossierStatut, `${expediteurJid}.json`);

        let donneesUtilisateur = { NOM: message.pushName, NUM: expediteurJid, LIMITE: 0, DATE: '' };
        if (fs.existsSync(cheminFichierUtilisateur)) {
            try {
                donneesUtilisateur = JSON.parse(fs.readFileSync(cheminFichierUtilisateur, 'utf-8'));
            } catch (e) { /*gérer erreur de parsing si nécessaire*/ }
        }

        const dateActuelle = new Date().toISOString().split('T')[0];
        if (donneesUtilisateur.DATE !== dateActuelle) {
            donneesUtilisateur.LIMITE = 0;
            donneesUtilisateur.DATE = dateActuelle;
        }
        donneesUtilisateur.NOM = message.pushName;

        let limite = LIMITES_UTILISATION.MEMBRE;
        if (message.key.fromMe) {
            limite = LIMITES_UTILISATION.BOT;
        } else {
            const participant = metadonneesGroupe.participants.find(p => p.id === expediteurJid);
            if (participant?.admin === 'admin' || participant?.admin === 'superadmin') {
                limite = LIMITES_UTILISATION.ADMIN;
            }
        }

	//si quelqu'un atteint la limite on le bloque
        if (donneesUtilisateur.LIMITE >= limite) {
            return sock.sendMessage(jid, { text: `Tu as atteint ta limite d'utilisation pour aujourd'hui: ${donneesUtilisateur.LIMITE}/${limite}.` },
		{ quoted: message });
        }
        //fin de la gestion des limite LIMITES

        const participants = metadonneesGroupe.participants;
        const mentions = participants.map(p => p.id);
        const auteur = message.key.participant || message.key.remoteJid;
        const auteurTag = "@" + auteur.split("@")[0];
        //récupération du texte original pour préserver les sauts de ligne
        const texteOriginal = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption || "";
        //on retire la commande (.tag) et les espaces qui suivent pour garder le reste intact
        const auteurTexte = texteOriginal.replace(/^\.\w+\s*/, "").trim();

        let texteFinal;

        if (auteurTexte.length > 0) {
            //applique le symbole "> " uniquement aux lignes qui contiennent du texte
            texteFinal = auteurTexte.split('\n').map(ligne => ligne.trim() ? `> ${ligne}` : "").join('\n');
            await sock.sendMessage(jid, {
                text: texteFinal,
                mentions
            }, { quoted: message });
        } else {
	    //s'il y avait pas de texte derriere on prepare une mise en forme d'une liste
            const SEPARATION_APRES = 5;
            const SEPARATEUR = "──────────\n";
            let texte = `╭──「Tag lancé par ${auteurTag}」\n`;
            let compteur = 0;
            for (const p of participants) {
                const tag = "@" + p.id.split("@")[0];
                texte += `├─➩${tag}\n`;
                compteur++;
                if (compteur % SEPARATION_APRES === 0) {
                    texte += SEPARATEUR;
                }
            }
            texte += `╰`;
            texteFinal = texte;

            //lecture de la configuration photo
            let mon_profil = "vrai";
            if (fs.existsSync(cheminPhotoConfig)) {
                try {
                    const config = JSON.parse(fs.readFileSync(cheminPhotoConfig, 'utf8'));
                    mon_profil = config[0].mon_profil;
                } catch (e) { mon_profil = "vrai"; }
            }

            if (mon_profil === "vrai") {
                const cheminProfil = path.join(cheminDossier, '..', 'memoires', 'memoires_sessions', nomSession, 'profil.jpg');
                try {
                    if (fs.existsSync(cheminProfil)) {
                        await sock.sendMessage(jid, {
                            image: fs.readFileSync(cheminProfil),
                            caption: texteFinal,
                            mentions
                        }, { quoted: message });
                        mettreAJourPhotoProfil(sock, nomSession);
                    } else {
                        const lienPhotoProfil = await sock.profilePictureUrl(sock.user.id, 'image');
                        const reponse = await fetch(lienPhotoProfil);
                        const tamponImage = Buffer.from(await reponse.arrayBuffer());

                        await fsPromises.mkdir(path.dirname(cheminProfil), { recursive: true });
                        fs.writeFileSync(cheminProfil, tamponImage);

                        await sock.sendMessage(jid, {
                            image: tamponImage,
                            caption: texteFinal,
                            mentions
                        }, { quoted: message });
                    }
                } catch (e) {
                    await sock.sendMessage(jid, {
                        text: texteFinal,
                        mentions
                    }, { quoted: message });
                }
            } else {
                //utiliser la photo du groupe
                try {
                    const urlPhotoProfil = await sock.profilePictureUrl(jid, 'image');
                    const reponse = await fetch(urlPhotoProfil);
                    if (!reponse.ok) throw new Error();
                    const tamponImage = Buffer.from(await reponse.arrayBuffer());
                    await sock.sendMessage(jid, {
                        image: tamponImage,
                        caption: texteFinal,
                        mentions
                    }, { quoted: message });
                } catch (e) {
                    await sock.sendMessage(jid, {
                        text: texteFinal,
                        mentions
                    }, { quoted: message });
                }
            }
        }

        //mettre à jour le compteur et sauvegarder APRÈS l'exécution
        donneesUtilisateur.LIMITE++;
        fs.writeFileSync(cheminFichierUtilisateur, JSON.stringify(donneesUtilisateur, null, 2));
    }
};
