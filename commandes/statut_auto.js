/* */

//imports nécessaire
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { jidNormalizedUser } from '@whiskeysockets/baileys';


//fonctions utilitaires pour la gestion de la mémoire
function obtenirCheminsMemoire(nomSession) {
    const nomFichier = fileURLToPath(import.meta.url);
    const cheminDossier = path.dirname(nomFichier);
    const nomCommande = "statut_auto";

    const cheminDossierMemoire = path.join(cheminDossier, '..', 'memoires', 'memoires_commandes', nomCommande, nomSession);
    fs.mkdirSync(cheminDossierMemoire, { recursive: true });

    return {
        infosFichier: path.join(cheminDossierMemoire, `infos.json`),
        lusFichier: path.join(cheminDossierMemoire, 'statuts_lus.json'),
        exclusFichier: path.join(cheminDossierMemoire, 'personne_exclu.json')
    };
}

function chargerInfos(cheminFichier) {
    const infosParDefaut = {
        etat: "desactive",
        like: {
            etat: "active",
            emoji: "♾️"
        }
    };

    if (fs.existsSync(cheminFichier)) {
        try {
            const contenu = JSON.parse(fs.readFileSync(cheminFichier, 'utf-8'));
            return { ...infosParDefaut, ...contenu, like: { ...infosParDefaut.like, ...(contenu.like || {}) } };
        } catch (e) {
            return infosParDefaut;
        }
    }
    return infosParDefaut;
}

function sauvegarderInfos(cheminFichier, nouvellesInfos, nomSession) {
    try {
        fs.writeFileSync(cheminFichier, JSON.stringify(nouvellesInfos, null, 2));
    } catch (e) { console.error(`[(statut_auto), "${nomSession}"]: Erreur d'écriture du fichier d'infos:`, e); }
}

function chargerStatutsLus(cheminFichier) {
    if (fs.existsSync(cheminFichier)) {
        try { return JSON.parse(fs.readFileSync(cheminFichier, 'utf-8')); } catch (e) { return []; }
    }
    return [];
}

function sauvegarderStatutsLus(cheminFichier, objets, nomSession) {
    try {
        fs.writeFileSync(cheminFichier, JSON.stringify(objets, null, 2));
    } catch (e) { console.error(`[(statut_auto), "${nomSession}"]: Erreur d'écriture du fichier des statuts lus:`, e); }
}

function chargerPersonnesExclues(cheminFichier) {
    if (fs.existsSync(cheminFichier)) {
        try { return JSON.parse(fs.readFileSync(cheminFichier, 'utf-8')); } catch (e) { return []; }
    }
    return [];
}

function sauvegarderPersonnesExclues(cheminFichier, jids, nomSession) {
    try {
        fs.writeFileSync(cheminFichier, JSON.stringify(jids, null, 2));
    } catch (e) { console.error(`[(statut_auto), "${nomSession}"]: Erreur d'écriture du fichier d'exclusion:`, e); }
}


// export et logique la commande
export default {
    nom: "statut_auto",
    description: "Lecture de statut automatique.",
    categorie: "Statuts",
    infos: `Pour lire les statuts automatiquement c'est une commande flexible prenant plusieurs sous-commandes utilisables seulement par le bot lui même.
> Voilà les sous-commandes et ce qu'il font.
꧁\`.statut_auto active\`   ꙰Pour activé la commande et qu'il lit les statuts.꧂
꧁\`.statut_auto desactive\`   ꙰Lui il fait le contraire de \`statut_auto active\`.꧂
꧁\`.statut_auto exclu\`   ꙰Permet de de retirer quelques sous l'emprise de la commande c'est-à-dire que ses statuts ne seront plus lu.
> En groupe on peut l'utiliser en taguant quelqu'un après la commande ou mettre son numéro tout coller et sans l'indicatif (+) ex: 56931437983.
> Et la méthode avec le numéro (\`.statut_auto exclu 56931437983\` marche aussi en privé, mais principalement si oa commnde est faite ne privé et il n'ya pas de numéro derrière c'est la personne avec qui tu parle qui sera la cible.
꧁\`.statut_auto inclu\`   ꙰C'est le même délire que \`.statut_auto exclu\` sauf qu'à l'inverse lui il retire la personne s'il était dans la liste d'exclusion.
> Le mode d'utilisation est le même aussi.
꧁\`.statut_auto like\`   ꙰Permet de désactiver ou de réactiver l'auto-j'aime des statuts puisque que par défaut c'est activé et aussi personnalisé l'émoji du j'aime, l'émoji par défaut est l'infini(♾️).
> Pour le désactiver il suffit de taper tout simplement \`.statut_auto like\` et c'est de même pour le désactiver.
> Si c'est l'émoji que tu veux changer il suffit de taper la même chose mais cette fois avec l'émoji que tu veux à la toute fin ex: \`.statut_auto like 🫩\`.  NB : *Si la commande globale \`.statut_auto\` était à l'état désactiver les modifications de seront enregistrés mais appliquer qu'à l'activation de la commande globale.`,

    execute: async ({ sock, message, args, nomSession }) => {
        if (!message.key.fromMe) {
            await sock.sendMessage(message.key.remoteJid,
		//si c'est pas moi
		{ text: "> Tu ne peux pas utiliser cette commande" },
		{ quoted: message });
            return;
        }
	//gestion des sous-commnades
        const chemins = obtenirCheminsMemoire(nomSession);
        const premierArgument = args[0]?.toLowerCase();
        const infos = chargerInfos(chemins.infosFichier);

        switch (premierArgument) {
	    //sous-commandes actve && desactive
            case "active":
            case "desactive": {
                if (infos.etat === premierArgument) {
                    await sock.sendMessage(message.key.remoteJid,
			{ text: `Statuts automatique ~était déjà~ \`${premierArgument}\`` },
			{ quoted: message });
                } else {
                    infos.etat = premierArgument;
                    sauvegarderInfos(chemins.infosFichier, infos, nomSession);
                    await sock.sendMessage(message.key.remoteJid,
			{ text: `Statuts automatique ${premierArgument === 'active' ? 'activé' : 'désactivé'}` },
			{ quoted: message });
                }
                break;
            }

	     //sous-commandes like
             case "like": {
                const nouvelEmoji = args[1];
                let texteConfirmation = "";

                if (nouvelEmoji) {
                    const ancienEmoji = infos.like.emoji;
                    infos.like.emoji = nouvelEmoji;
                    texteConfirmation = `L'émoji a été changé de ${ancienEmoji} à ${nouvelEmoji}.\n> État: ${infos.like.etat}`;
                } else {
                    const ancienEtatLike = infos.like.etat;
                    infos.like.etat = ancienEtatLike === 'active' ? 'desactive' : 'active';
                    texteConfirmation = `Passage de ${ancienEtatLike} à ${infos.like.etat}.\n> Émoji: ${infos.like.emoji}`;
                }

                sauvegarderInfos(chemins.infosFichier, infos, nomSession);

                const messageFinal = infos.etat === 'desactive'
                    ? "La commande globale `statut_auto` est ~désactivée~. *Les modifications seront appliquées à son activation*."
                    : texteConfirmation;

                await sock.sendMessage(message.key.remoteJid, { text: messageFinal }, { quoted: message });
                break;
            }
	    //sous-commandes exclu && inclu
            case "exclu":
            case "inclu": {
                let jidsCibles = [];
                const numeroFourni = args[1];
                const estGroupe = message.key.remoteJid.endsWith('@g.us');

                if (numeroFourni) {
                    jidsCibles.push(numeroFourni.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                } else if (estGroupe) {
                    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const auteurRepondu = message.message?.extendedTextMessage?.contextInfo?.participant;
                    if (mentions.length > 0) jidsCibles.push(...mentions);
                    else if (auteurRepondu) jidsCibles.push(auteurRepondu);
                } else {
                    jidsCibles.push(message.key.remoteJid);
                }

                let jidsResolus = [];
                for (const jid of jidsCibles) {
                    let idFinal = jid;
                    if (jid.endsWith('@lid')) {
                        try {
                            const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
                            if (pn) idFinal = pn;
                        } catch (e) {}
                    }
                    jidsResolus.push(jidNormalizedUser(idFinal));
                }

                if (jidsResolus.length > 0) {
                    const exclusActuels = chargerPersonnesExclues(chemins.exclusFichier);
                    let affectes = [];
                    let dejaDansEtat = [];

                    if (premierArgument === "exclu") {
                        jidsResolus.forEach(id => {
                            if (!exclusActuels.includes(id)) {
                                exclusActuels.push(id);
                                affectes.push(id);
                            } else {
                                dejaDansEtat.push(id);
                            }
                        });
                    } else {
                        jidsResolus.forEach(id => {
                            if (exclusActuels.includes(id)) {
                                affectes.push(id);
                            } else {
                                dejaDansEtat.push(id);
                            }
                        });
                        if (affectes.length > 0) {
                            const nouvelleListe = exclusActuels.filter(id => !affectes.includes(id));
                            exclusActuels.splice(0, exclusActuels.length, ...nouvelleListe);
                        }
                    }

                    if (affectes.length > 0) {
                        sauvegarderPersonnesExclues(chemins.exclusFichier, exclusActuels, nomSession);
                    }

                    const verbe = premierArgument;
                    let messageResultat = [];

                    if (affectes.length > 0) {
                        const noms = affectes.map(id => id.split('@')[0]).join(', ');
                        messageResultat.push(`*${noms} ${verbe}${affectes.length > 1 ? 's' : ''}*`);
                    }

                    if (dejaDansEtat.length > 0) {
                        const noms = dejaDansEtat.map(id => id.split('@')[0]).join(', ');
                        messageResultat.push(`> ${noms} déjà ${verbe}${dejaDansEtat.length > 1 ? 's' : ''}`);
                    }

                    await sock.sendMessage(message.key.remoteJid, { text: messageResultat.join('\n') }, { quoted: message });
                }
                break;
            }

            default: {
		//message pour montrer les sous-commandes
                const messageAide = `État de la commande: ${infos.etat}
╭──Voici les arguments───────────────────────────
├─➩ ".statut_auto active"
├─➩ ".statut_auto desactive"
├─➩ ".statut_auto exclu <@user|numéro>"
├─➩ ".statut_auto inclu <@user|numéro>"
├─➩ ".statut_auto like < |emoji>"
╰──────────────────────────────────────────`;
                await sock.sendMessage(message.key.remoteJid, { text: messageAide }, { quoted: message });
                break;
            }
        }
    },

    //le handler qui reçoit vraiment les statuts et les lus
    handleNonCommand: async ({ sock, message, nomSession }) => {
        if (message.key.remoteJid !== 'status@broadcast') {
            return false;
        }

	//list ede statuts quon cosidere comme valides
        const contenu = message.message;
        const estStatutValide = contenu && (contenu.imageMessage || contenu.videoMessage || contenu.extendedTextMessage || contenu.audioMessage);
        if (!estStatutValide) {
            return false;
        }

	//si ça vient de moi on ignore
        let auteur = message.key.participant;
        if (!auteur) {
            return false;
        }
	//normalisation des IDs avnt de les utilliser
        if (auteur.endsWith('@lid')) {
            try {
                const pn = await sock.signalRepository.lidMapping.getPNForLID(auteur);
                if (pn) auteur = pn;
            } catch (e) {}
        }
        auteur = jidNormalizedUser(auteur);

        if (auteur === jidNormalizedUser(sock.user.id)) {
            return false;
        }

	//recherche et lecture des fichiers des personnes exclues
        const chemins = obtenirCheminsMemoire(nomSession);
        const personnesExclues = chargerPersonnesExclues(chemins.exclusFichier);

        if (personnesExclues.includes(auteur)) {
            return false;
        }

        const infos = chargerInfos(chemins.infosFichier);
        if (infos.etat !== "active") {
            return false;
        }
	//fonction pour l'auto-suppressio
        const maintenant = Date.now();
        const vingtQuatreHeures = 24 * 60 * 60 * 1000;
        const idStatut = message.key.id;

	//verification de la liste des statuts lus
        const statutsLus = chargerStatutsLus(chemins.lusFichier);
        const statutsRecents = statutsLus.filter(statut => (maintenant - statut.dateLecture) < vingtQuatreHeures);

	//si le statut nettait pas dans la liste on continu si non on l'ignore
        if (!statutsRecents.some(statut => statut.id === idStatut)) {
            try {
                await sock.readMessages([message.key]);

		//si l'aito j'aime est actif
                if (infos.like.etat === "active") {
		    //on charge la reaction qu'on a dans les fichiers si non on envoi l'emoi par defaut
                    const emojiReaction = infos.like.emoji || "♾️";
                    await sock.sendMessage(
                        'status@broadcast',
                        { react: { text: emojiReaction, key: message.key } },
                        { statusJidList: [auteur] }
                    );
                }

		//apres on enregistre le nouveau statut qu'on vient de lire
                statutsRecents.push({ id: idStatut, dateLecture: maintenant });
                sauvegarderStatutsLus(chemins.lusFichier, statutsRecents, nomSession);
            } catch(e) {
		//pour une erreur non identifie
                console.error(`[(statut_auto), "${nomSession}"]: Erreur pendant le traitement:`, e);
            }
        }
        return false;
    }
};
