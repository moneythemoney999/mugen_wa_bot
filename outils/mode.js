import fs from 'fs/promises';
import path from 'path';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

// --- Utilitaires de Chemins ---

function obtenirChemins(nomSession) {
    const dossierBase = path.join(process.cwd(), 'memoires', 'memoires_outils', 'mode', nomSession);
    return {
        dossierBase,
        prive: path.join(dossierBase, 'prive.json'),
        publique: path.join(dossierBase, 'publique.json'),
        tous: path.join(dossierBase, 'mode_tous.json')
    };
}

// --- Gestion des Fichiers ---

async function initialiserDossier(dossier) {
    await fs.mkdir(dossier, { recursive: true });
}

async function lireFichier(chemin, defaut) {
    try {
        const contenu = await fs.readFile(chemin, 'utf-8');
        return JSON.parse(contenu);
    } catch (e) {
        return defaut;
    }
}

async function sauvegarderFichier(chemin, donnees) {
    await fs.writeFile(chemin, JSON.stringify(donnees, null, 2));
}

// --- Résolution JID ---

async function resoudreJid(sock, jidBrut) {
    if (jidBrut && jidBrut.endsWith('@lid')) {
        try {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jidBrut);
            if (pn) return jidNormalizedUser(pn);
        } catch (e) {}
    }
    return jidNormalizedUser(jidBrut);
}

// --- Main Tool ---

export default {
    nom: "mode",
    evenements: ["messages.upsert"],
    description: "Gestion du mode du bot",
    categorie: `Groupes && Privé`,
    affiche_menu: "vrai",
    infos: `Peut être utilisé en groupes ou privé pour mettre ce groupe ou contact en mode privé. Pour tout mettre en privé, il faut utiliser l'argument tous après le mode que tu veux mettre, ex : \`.mode prive tous\`. Après cette commande, un message de confirmation apparaîtra disant que les paramètres ont été enregistrés. Pour les appliquer, il faut utiliser l'argument change + le mode auquel tu veux passer, ex : \`.mode change prive\``,
    
    execute: async (nomEvenement, donnesEvenement, { sock, nomSession, prefixe }) => {
        if (nomEvenement !== "messages.upsert") return;

        const { messages } = donnesEvenement;
        const message = messages[0];
        if (!message.message || message.key.remoteJid === 'status@broadcast') return;

        const jidChat = message.key.remoteJid;
        const estProprio = message.key.fromMe;
        const chemins = obtenirChemins(nomSession);
        await initialiserDossier(chemins.dossierBase);

        // Charger les états avec le format spécifique [ { mode: "vrai/faux" }, { ... } ]
        let etatPrive = await lireFichier(chemins.prive, [ { mode: "faux" }, { liste: [] } ]);
        let etatPublique = await lireFichier(chemins.publique, [ { mode: "faux" }, { liste: [] } ]);
        let etatTous = await lireFichier(chemins.tous, [ { mode: "vrai" }, { mode_tous: "publique" } ]);

        const texte = message.message.conversation || 
                      message.message.extendedTextMessage?.text || 
                      message.message.imageMessage?.caption || 
                      message.message.videoMessage?.caption;

        // --- 1. Traitement des Commandes ---
        if (texte && texte.startsWith(prefixe)) {
            const [cmdBrute, ...args] = texte.slice(prefixe.length).trim().split(/\s+/);
            const commande = cmdBrute.toLowerCase();

            if (commande === "mode") {
                if (!estProprio) {
                    await sock.sendMessage(jidChat, { text: "```Tu ne peux pas utiliser cette commande.```" }, { quoted: message });
                    return 'STOP';
                }

                // Déterminer quel mode est actif pour l'affichage
                let modeActuel = "publique (tous)";
                if (etatTous[0].mode === "vrai") modeActuel = `${etatTous[1].mode_tous} (tous)`;
                else if (etatPrive[0].mode === "vrai") modeActuel = "prive (liste)";
                else if (etatPublique[0].mode === "vrai") modeActuel = "publique (liste)";

                const arg1 = args[0]?.toLowerCase();
                const arg2 = args[1]?.toLowerCase();

                // .mode simple ou argument inconnu
                if (!arg1 || (arg1 !== "prive" && arg1 !== "publique" && arg1 !== "change")) {
                    let txt = "";
                    if (arg1) txt += "```Argument(s) inconnu(s).```\n";
                    txt += `> Mode : *${modeActuel}*
                    
Arguments: 
-    \`.mode prive\` pour mettre la discussion actuelle en mode privé.
-    \`.mode publique\` pour faire l'inverse.
-    \`.mode {prive/publique} tous\` pour mettre toutes les discussions soit en privé ou publique.
-    \`.mode change {publique/prive/tous}\` pour changer la configuration des modes`;
                    await sock.sendMessage(jidChat, { text: txt }, { quoted: message });
                    return 'STOP';
                }

                // Résoudre le nom du chat pour les confirmations
                let nomChat = "Ce chat";
                try {
                    if (jidChat.endsWith('@g.us')) {
                        const meta = await sock.groupMetadata(jidChat);
                        nomChat = meta.subject;
                    } else {
                        nomChat = message.pushName || jidChat.split('@')[0];
                    }
                } catch (e) {}

                // .mode prive [tous]
                if (arg1 === "prive") {
                    if (arg2 === "tous") {
                        etatTous[1].mode_tous = "prive";
                        await sauvegarderFichier(chemins.tous, etatTous);
                        await sock.sendMessage(jidChat, { text: "_Paramètre enregistré_" }, { quoted: message });
                    } else {
                        const jidPropre = await resoudreJid(sock, jidChat);
                        if (!etatPrive[1].liste.includes(jidPropre)) {
                            etatPrive[1].liste.push(jidPropre);
                            await sauvegarderFichier(chemins.prive, etatPrive);
                        }
                        await sock.sendMessage(jidChat, { text: `\`${nomChat}\` *en mode prive*` }, { quoted: message });
                    }
                    return 'STOP';
                }

                // .mode publique [tous]
                if (arg1 === "publique") {
                    if (arg2 === "tous") {
                        etatTous[1].mode_tous = "publique";
                        await sauvegarderFichier(chemins.tous, etatTous);
                        await sock.sendMessage(jidChat, { text: "_Paramètre enregistré_" }, { quoted: message });
                    } else {
                        const jidPropre = await resoudreJid(sock, jidChat);
                        if (!etatPublique[1].liste.includes(jidPropre)) {
                            etatPublique[1].liste.push(jidPropre);
                            await sauvegarderFichier(chemins.publique, etatPublique);
                        }
                        await sock.sendMessage(jidChat, { text: `\`${nomChat}\` *en mode publique*` }, { quoted: message });
                    }
                    return 'STOP';
                }

                // .mode change {publique/prive/tous}
                if (arg1 === "change") {
                    const cible = arg2;
                    if (cible === "prive" || cible === "publique" || cible === "tous") {
                        const ancien = modeActuel;
                        // Désactiver tout
                        etatPrive[0].mode = "faux";
                        etatPublique[0].mode = "faux";
                        etatTous[0].mode = "faux";

                        // Activer la cible
                        if (cible === "prive") etatPrive[0].mode = "vrai";
                        else if (cible === "publique") etatPublique[0].mode = "vrai";
                        else if (cible === "tous") etatTous[0].mode = "vrai";

                        await sauvegarderFichier(chemins.prive, etatPrive);
                        await sauvegarderFichier(chemins.publique, etatPublique);
                        await sauvegarderFichier(chemins.tous, etatTous);

                        let nouveau = cible === "tous" ? `${etatTous[1].mode_tous} (tous)` : cible;
                        await sock.sendMessage(jidChat, { text: `> Changement de ${ancien} à ${nouveau}` }, { quoted: message });
                    } else {
                        await sock.sendMessage(jidChat, { text: "Cible de changement invalide (prive/publique/tous)." }, { quoted: message });
                    }
                    return 'STOP';
                }
            }
        }

        // --- 2. Logique de Filtrage (si pas une commande .mode) ---
        if (estProprio) return; 

        const jidPropre = await resoudreJid(sock, jidChat);

        // Cas 1: Mode TOUS actif
        if (etatTous[0].mode === "vrai") {
            if (etatTous[1].mode_tous === "prive") return 'STOP'; 
            return; 
        }

        // Cas 2: Mode PUBLIQUE (liste) actif
        if (etatPublique[0].mode === "vrai") {
            if (etatPublique[1].liste.includes(jidPropre)) return; 
            return 'STOP'; 
        }

        // Cas 3: Mode PRIVE (liste) actif
        if (etatPrive[0].mode === "vrai") {
            if (etatPrive[1].liste.includes(jidPropre)) return 'STOP'; 
            return; 
        }
    }
};
