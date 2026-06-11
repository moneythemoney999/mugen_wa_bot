import fs from 'fs/promises';
import path from 'path';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import {traduire} from './langue.js'

//utilitaires de chemins

function obtenirChemins(nomSession) {
    const dossierBase = path.join(process.cwd(), 'memoires', 'memoires_outils', 'mode', nomSession);
    return {
        dossierBase,
        prive: path.join(dossierBase, 'prive.json'),
        publique: path.join(dossierBase, 'publique.json'),
        tous: path.join(dossierBase, 'mode_tous.json')
    };
}

//gestion des fichiers

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

//reolution JID-LID

async function resoudreJid(sock, jidBrut) {
    if (jidBrut && jidBrut.endsWith('@lid')) {
        try {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jidBrut);
            if (pn) return jidNormalizedUser(pn);
        } catch (e) {}
    }
    return jidNormalizedUser(jidBrut);
}

//logique principale

export default {
    nom: "mode",
    evenements: ["messages.upsert"],
    description: "Gestion du mode du bot",
    categorie: `Groupes && Privé`,
    affiche_menu: "vrai",
    infos: `Peut être utilisé en groupes ou privé pour mettre ce groupe, contact ou le bot en mode privé/publique. Pour mettre tout le bot en mode privé/publique, il faut utiliser l'argument \`tous\` après le mode que tu veux mettre, ex : \`.mode prive tous\`. Après cette commande, un message de confirmation apparaîtra disant que les paramètres ont été enregistrés. Pour les appliquer, il faut utiliser l'argument change + le mode auquel tu veux passer, ex : \`.mode change tous\``,

    execute: async (nomEvenement, donnesEvenement, { sock, nomSession, prefixe }) => {
	const trad = (cle, vars = {}) => traduire(nomSession, 'outils', 'mode', { [cle]: vars })[cle];

        if (nomEvenement !== "messages.upsert") return;

        const { messages } = donnesEvenement;
        const message = messages[0];
        if (!message.message || message.key.remoteJid === 'status@broadcast') return;

        const jidChat = message.key.remoteJid;
        const estProprio = message.key.fromMe;
        const chemins = obtenirChemins(nomSession);
        await initialiserDossier(chemins.dossierBase);

        //charger les états avec le format spécifique [ { mode: "vrai/faux" }, { ... } ]
        let etatPrive = await lireFichier(chemins.prive, [ { mode: "faux" }, { liste: [] } ]);
        let etatPublique = await lireFichier(chemins.publique, [ { mode: "faux" }, { liste: [] } ]);
        let etatTous = await lireFichier(chemins.tous, [ { mode: "vrai" }, { mode_tous: "publique" } ]);

        const texte = message.message.conversation ||
                      message.message.extendedTextMessage?.text ||
                      message.message.imageMessage?.caption ||
                      message.message.videoMessage?.caption;

        //traitement des commandes
        if (texte && texte.startsWith(prefixe)) {
            const [cmdBrute, ...args] = texte.slice(prefixe.length).trim().split(/\s+/);
            const commande = cmdBrute.toLowerCase();

            if (commande === "mode") {
                if (!estProprio) {
                  const est_pas_moi = trad('msg.est_pas_moi') || "```Tu ne peux pas utiliser cette commande.```";
                    await sock.sendMessage(jidChat, { text: est_pas_moi }, { quoted: message });
                    return 'STOP';
                }

                //déterminer quel mode est actif pour l'affichage
                let modeActuel = trad("msg.mode_actuel.1") || "publique (tous)";
                if (etatTous[0].mode === "vrai")
                modeActuel = trad("msg.mode_actuel.2", {
                  etat: etatTous[1].mode_tous
                }) || `${etatTous[1].mode_tous} (tous)`;
                else if (etatPrive[0].mode === "vrai") modeActuel = trad("msg.mode_actuel.3") || "prive (liste)";
                else if (etatPublique[0].mode === "vrai") modeActuel = trad("msg.mode_actuel.4") || "publique (liste)";

                const arg1 = args[0]?.toLowerCase();
                const arg2 = args[1]?.toLowerCase();

                // .mode simple ou argument inconnu
                if (!arg1 || (arg1 !== "prive" && arg1 !== "publique" && arg1 !== "change")) {
                    let txt = "";
                    if (arg1) txt += trad("msg.txt.1") || "```Argument(s) inconnu(s).```\n";
                    txt += trad("msg.txt.2", {
                      mode: modeActuel
                    }) || `> Mode : *${modeActuel}*

Arguments:
-    \`.mode prive\` pour mettre la discussion actuelle en mode privé.
-    \`.mode publique\` pour faire l'inverse.
-    \`.mode {prive/publique} tous\` pour mettre toutes les discussions soit en privé ou publique.
-    \`.mode change {publique/prive/tous}\` pour changer la configuration des modes`;
                    await sock.sendMessage(jidChat, { text: txt }, { quoted: message });
                    return 'STOP';
                }

                //résoudre le nom du chat pour les confirmations
                let nomChat = trad("msg.nom_chat.1") || "Ce chat";
                let mentions = [];
                try {
                    if (jidChat.endsWith('@g.us')) {
                        const meta = await sock.groupMetadata(jidChat);
                        nomChat = trad("msg.nom_chat.2", {
                          nom_chat: meta.subject
                          }) || meta.subject;
                    } else {
                      const jid_propre = await resoudreJid(sock, jidChat);
                      nomChat = trad("msg.nom_chat.3", {
                          nom_chat: jid_propre.split('@')[0]
                          }) || `@${jid_propre.split('@')[0]}`;
                          mentions = [jid_propre];
                    }
                } catch (e) {
                  nomChat = jidChat.split('@')[0];
                }
                const parametre_enregistre = trad("msg.reussite.parametre_enregistre") || "_Paramètre enregistré_";

                // .mode prive [tous]
                if (arg1 === "prive") {
                    if (arg2 === "tous") {
                        etatTous[1].mode_tous = "prive";
                        await sauvegarderFichier(chemins.tous, etatTous);
                        await sock.sendMessage(jidChat, { text: parametre_enregistre }, { quoted: message });
                    } else {
                        const jid_propre = await resoudreJid(sock, jidChat);
                        //retirer de la liste publique s'il y est et ajouter à la liste privée
                        etatPublique[1].liste = etatPublique[1].liste.filter(id => id !== jid_propre);
                        if (!etatPrive[1].liste.includes(jid_propre)) {
                            etatPrive[1].liste.push(jid_propre);
                        }
                        await sauvegarderFichier(chemins.prive, etatPrive);
                        await sauvegarderFichier(chemins.publique, etatPublique);
                        const chat_prive = trad("msg.reussite.chat_prive",{
                          nom_chat: nomChat
                        }) || `*${nomChat} en mode prive*\n> Ces paramètres prendront effet que si tu fais la commande \`.mode change prive\``;
                        await sock.sendMessage(jidChat, {
                          text: chat_prive,
                          mentions: mentions
                        }, { quoted: message });
                    }
                    return 'STOP';
                }

                // .mode publique [tous]
                if (arg1 === "publique") {
                    if (arg2 === "tous") {
                        etatTous[1].mode_tous = "publique";
                        await sauvegarderFichier(chemins.tous, etatTous);
                        await sock.sendMessage(jidChat, { text: parametre_enregistre }, { quoted: message });
                    } else {
                        const jid_propre = await resoudreJid(sock, jidChat);
                        //retirer de la liste privée s'il y est et ajouter à la liste publique
                        etatPrive[1].liste = etatPrive[1].liste.filter(id => id !== jid_propre);
                        if (!etatPublique[1].liste.includes(jid_propre)) {
                            etatPublique[1].liste.push(jid_propre);
                        }
                        await sauvegarderFichier(chemins.prive, etatPrive);
                        await sauvegarderFichier(chemins.publique, etatPublique);
                        const chat_publique= trad("msg.reussite.chat_publique", {
                          nom_chat: nomChat
                        }) || `\`${nomChat}\` *en mode publique*\n> Ces paramètres prendront effet que si tu fais la commande \`.mode change publique\``;
                        await sock.sendMessage(jidChat, {
                          text: chat_publique,
                          mentions: mentions
                        }, { quoted: message });
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

                        let nouveau = cible === "tous" ? trad(`msg.reussite.change.tous.${etatTous[1].mode_tous}`, {
                          etat: etatTous[1].mode_tous
                          }) || `${etatTous[1].mode_tous} (tous)` : cible;
                          const changement_reussi = trad("msg.reussite.change.change", {
                            ancien: ancien,
                            nouveau: nouveau
                          }) || `> Changement de ${ancien} à ${nouveau}`;
                        await sock.sendMessage(jidChat, { text: changement_reussi }, { quoted: message });
                    } else {
                      const cible_invalide = trad("msg.erreur.change.cible_invalide") || "Cible de changement invalide (prive/publique/tous).";
                        await sock.sendMessage(jidChat, { text: cible_invalide }, { quoted: message });
                    }
                    return 'STOP';
                }
            }
        }

        //logique de filtrage (si pas une commande .mode)
        if (estProprio) return;

        const jid_propre = await resoudreJid(sock, jidChat);

        // cas :1 mode TOUS actif
        if (etatTous[0].mode === "vrai") {
            if (etatTous[1].mode_tous === "prive") return 'STOP';
            return;
        }

        // cas 2: mode PUBLIQUE (liste) actif
        if (etatPublique[0].mode === "vrai") {
            if (etatPublique[1].liste.includes(jid_propre)) return;
            return 'STOP';
        }

        // cas 3: mode PRIVE (liste) actif
        if (etatPrive[0].mode === "vrai") {
            if (etatPrive[1].liste.includes(jid_propre)) return 'STOP';
            return;
        }
    }
};
