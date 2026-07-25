/* Cette commande est dependante de l'API de GEMINI donc faut installer @google/generative-ai avec npm
Et aller sur le site de des api gemini(https://aistudio.google.com/api-keys?project=gen-lang-client-0988145692) pour en creer une et le stocker dans ".secret/.cles_ia/.cles_ia.json:
{
"cle_gemini": "LA CLE DE GEMINI ICI"
}*/

//imports necessaire
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import { downloadMediaMessage, jidNormalizedUser } from "@whiskeysockets/baileys";
import { traduire } from "../outils/langue.js";

//configuration et preparation des fichier memoires et recherche de la cle gemini
const CHEMIN_SECRET = path.join(process.cwd(), ".secret", ".cles_ia", ".cles_ia.json");
const CHEMIN_MEMOIRE_IA = path.join(process.cwd(), "memoires", "memoires_commandes", "ia");
const DELAI_CONVERSATION = 5 * 60 * 1000;
const DELAI_PURGE_HISTORIQUE = 3 * 24 * 60 * 60 * 1000;

//definition des modeles qu'on va utiliser
const MODELES_PROPRIETAIRE = ["gemini-3.1-flash-lite-preview"];
const MODELES_AUTRES = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

//instruction qu'on envoi a gemini pour lui donner son rôle il doit être le plus (claire,nette et precis) que possible
const CHEMIN = path.join(process.cwd(), "stockage", "commandes", "ia.json");

function creuser(obj, chemin) {
    return chemin.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

export async function obtenir_prompt(cle, vars = {}) {
    try {
        const contenu = await fs.readFile(CHEMIN, "utf-8");
        const data = JSON.parse(contenu);
        const chemin = cle.split(".");
        let texte = creuser(data, chemin);

        if (typeof texte !== "string") return null;
        // injection variables
        for (const v in vars) {
            texte = texte.replace(new RegExp(`{${v}}`, "g"), vars[v]);
        }
        return texte;
    } catch (e) {
        return null;
    }
}

const OBTENIR_INSTRUCTION_SYSTEME = async (numeroBot, nomSession) => {
    const prompt = async (cle, vars = {}) => await obtenir_prompt(cle, vars);
    const trad = (cle, vars = {}) => traduire(nomSession, 'commandes', 'ia', { [cle]: vars })[cle];

    const instructions = [
        trad("msg.instruction_systeme.identite") || await prompt("instruction_systeme.identite"),
        trad("msg.instruction_systeme.createur") || await prompt("instruction_systeme.createur"),
        trad("msg.instruction_systeme.proprietaire",
		{ num_bot: numeroBot }) || await prompt("instruction_systeme.proprietaire",
	{ num_bot: numeroBot }),
        trad("msg.instruction_systeme.reponse_au_question.1") || await prompt("instruction_systeme.reponse_au_question.1"),
        trad("msg.instruction_systeme.reponse_au_question.2") || await prompt("instruction_systeme.reponse_au_question.2"),
        trad("msg.instruction_systeme.reponse_au_question.3") || await prompt("instruction_systeme.reponse_au_question.3"),
        trad("msg.instruction_systeme.reponse_au_question.4") || await prompt("instruction_systeme.reponse_au_question.4"),
        trad("msg.instruction_systeme.comportement") || await prompt("instruction_systeme.comportement"),
        trad("msg.instruction_systeme.contexte") || await prompt("instruction_systeme.contexte")
    ];

    const result = await Promise.all(instructions);
    return result.filter(Boolean).join("\n\n").trim();
};

const conversationsActives = {};
let genAI;
let cleApiDisponible = false;

(async () => {
    try {
        const contenuCle = await fs.readFile(CHEMIN_SECRET, "utf-8");
        const { cle_gemini } = JSON.parse(contenuCle);
        if (cle_gemini) {
            genAI = new GoogleGenerativeAI(cle_gemini);
            cleApiDisponible = true;
        }
    } catch (e) {}
})();

//fonctions utilitaires et resolutions des IDs
async function resoudreJid(sock, jid, nomSession) {
    if (jid && jid.endsWith('@lid')) {
        try {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
            if (pn) return jidNormalizedUser(pn);
        } catch (e) {
            console.error(`[(ia), "${nomSession}"]: Erreur LID ${jid}:`, e);
        }
    }
    return jidNormalizedUser(jid);
}

async function obtenirCheminHistorique(sock, nomSession, jidResolut) {
    let nomFichier = jidResolut;
    const type = jidResolut.endsWith('@g.us') ? 'groupe' : 'prive';

    if (type === 'groupe') {
        try {
            const metadata = await sock.groupMetadata(jidResolut);
            const nomGroupeNettoye = metadata.subject.replace(/[\/\?%*:|"<>]/g, '-');
            nomFichier = `${nomGroupeNettoye}_${jidResolut}`;
        } catch (e) {}
    }

    const cheminDossier = path.join(CHEMIN_MEMOIRE_IA, nomSession, type);
    await fs.mkdir(cheminDossier, { recursive: true });
    return path.join(cheminDossier, `${nomFichier}.json`);
}

async function lireEtPurgerHistorique(cheminHistorique) {
    try {
        const contenu = await fs.readFile(cheminHistorique, "utf-8");
        const historique = JSON.parse(contenu);
        const maintenant = Date.now();
        return historique.filter(msg => msg.horodatage && (maintenant - msg.horodatage) < DELAI_PURGE_HISTORIQUE);
    } catch (e) { return []; }
}

async function sauvegarderHistorique(cheminHistorique, historique) {
    try { await fs.writeFile(cheminHistorique, JSON.stringify(historique, null, 2)); } catch (e) {}
}

//logique principale de l'IA
async function executerConversationIA({ sock, message, nomSession, question, imageBuffer }) {
    const trad = (cle, vars = {}) => traduire(nomSession, 'commandes', 'ia', { [cle]: vars })[cle];

    if (!cleApiDisponible) {
        console.error(`[(ia), "${nomSession}"]; Cle ia introuvable il faut aller creer une cle gemini sur (https://aistudio.google.com) et le stocker dans : "${CHEMIN_SECRET}".`);
        const cleAPI_introuvable = trad("msg.cleAPI_introuvable") || "> L'IA n'est pas prête.";
        await sock.sendMessage(message.key.remoteJid, { text: cleAPI_introuvable }, { quoted: message });
        return;
    }

    const jidBrut = message.key.remoteJid;
    const jidResolut = await resoudreJid(sock, jidBrut, nomSession);
    let messageIndicateur;
    let apiCallEstFinie = false;

    const textesAttente = trad("msg.textes_de_attente") || ["◐♾", "♾◓", "◑♾", "♾◒", "♾️"];
    try {
        messageIndicateur = await sock.sendMessage(jidBrut, { text: textesAttente[0] }, { quoted: message });
    } catch (e) {}

    const demarrerIndicateur = async () => {
        let i = 0;
        try {
            while (!apiCallEstFinie && messageIndicateur) {
                await new Promise(r => setTimeout(r, 600));
                if (apiCallEstFinie) break;
                i = (i + 1) % textesAttente.length;
                await sock.sendMessage(jidBrut, { text: textesAttente[i], edit: messageIndicateur.key });
            }
        } catch (e) { apiCallEstFinie = true; }
    };
    demarrerIndicateur();

    const estProprietaire = message.key.fromMe;
    const modeles = estProprietaire ? [...MODELES_PROPRIETAIRE, ...MODELES_AUTRES] : MODELES_AUTRES;

    let reponseFinale = null;
    let erreurFinale = null;

    for (const nomModele of modeles) {
        try {
            const numeroBot = jidNormalizedUser(sock.user.id).split('@')[0];
            const modeleActuel = genAI.getGenerativeModel({
                model: nomModele,
                systemInstruction: { parts: [{ text: await OBTENIR_INSTRUCTION_SYSTEME(numeroBot, nomSession) }] }
            });

            const cheminHist = await obtenirCheminHistorique(sock, nomSession, jidResolut);
            const historique = await lireEtPurgerHistorique(cheminHist);
            const apiHistory = historique.map(({ role, parts }) => ({ role, parts }));

            const promptParts = [{ text: question }];
            if (imageBuffer) {
                promptParts.unshift({ inlineData: { mimeType: "image/jpeg", data: imageBuffer.toString("base64") } });
            }

            const chat = modeleActuel.startChat({ history: apiHistory });
            const result = await chat.sendMessage(promptParts);
            reponseFinale = result.response.text();

            historique.push({ role: "user", parts: promptParts, horodatage: Date.now() });
            historique.push({ role: "model", parts: [{ text: reponseFinale }], horodatage: Date.now() });
            await sauvegarderHistorique(cheminHist, historique);
            break;

        } catch (err) {
            console.error(`[(ia), "${nomSession}"]: Erreur avec le modèle ${nomModele}:`, err);
            erreurFinale = err;
            if (err.status === 429 || err.status === 503) continue;
            break;
        }
    }

    apiCallEstFinie = true;
    if (reponseFinale) {
        if (messageIndicateur) {
            await sock.sendMessage(jidBrut, { text: reponseFinale, edit: messageIndicateur.key });
        } else {
            messageIndicateur = await sock.sendMessage(jidBrut, { text: reponseFinale }, { quoted: message });
        }
        conversationsActives[jidResolut] = { lastAiMessageId: messageIndicateur.key.id, horodatage: Date.now() };
    } else {
        const msgErr = (erreurFinale?.status === 429 || erreurFinale?.status === 503) ? trad("msg.erreurs.plus_de_token") || trad("msg.erreurs.autres") || "> Plus de jus 😅" : "_Erreur_";
        if (messageIndicateur) {
            await sock.sendMessage(jidBrut, { text: msgErr, edit: messageIndicateur.key });
        } else {
            await sock.sendMessage(jidBrut, { text: msgErr }, { quoted: message });
        }
    }
}

//export et logique de la commande
export default {
    nom: "ia",
    description: "Mugen♾️♾️, IA pour discuter.",
    categorie: "Groupes && Privé",
    infos: `Pour discuter avec l'IA, il faut d'abord taper \`.ia ton message derrière\`. Il peut être en réponse à un ancien message de type (image, texte) ou même directement en légende d'une image.
Après avoir tapé .ia, il n'est plus nécessaire de le faire dans un délai de 5 minutes ; il suffit de répondre au dernier message de l'IA.

Il y a aussi une sous-commande pour réinitialiser la discussion avec l'IA si celle-ci part en vrille.

> NB : *Il pourrait y avoir certaines données (noms de profils, numéro du compte) qui seront partagées avec l'IA pour son bon fonctionnement.*`,

    async execute({ sock, message, args, nomSession }) {
        const trad = (cle, vars = {}) => traduire(nomSession, 'commandes', 'ia', { [cle]: vars })[cle];
        const jidBrut = message.key.remoteJid;
        const nomAuteur = message.pushName || trad('msg.nomAuteur') || "Utilisateur";

        const premierArg = args[0]?.toLowerCase();
        if (premierArg === "reinitialise") {
            const jidResolut = await resoudreJid(sock, jidBrut, nomSession);
            const cheminHist = await obtenirCheminHistorique(sock, nomSession, jidResolut);
            try {
                await fs.unlink(cheminHist);
                delete conversationsActives[jidResolut];
                const succes_supression = trad("msg.succes_supression") || "Historique de la conversation effacé.";
                return sock.sendMessage(jidBrut, { text: succes_supression }, { quoted: message });
            } catch (e) {
                const pas_de_historique = trad("msg.pas_de_historique") || "Info : Aucun historique trouvé pour cette discussion.";
                return sock.sendMessage(jidBrut, { text: pas_de_historique }, { quoted: message });
            }
        }

        const currentImage = message.message?.imageMessage;
        const currentCaption = currentImage?.caption || "";
        const estLegendeImage = !!currentImage;

        let texteUtilisateur = args.join(" ").trim();
        if (!texteUtilisateur && currentCaption) {
            texteUtilisateur = currentCaption.replace(/^\.ia\s*/i, "").trim();
        }

        const contextInfo = message.message?.extendedTextMessage?.contextInfo || currentImage?.contextInfo;
        const msgCite = contextInfo?.quotedMessage;
        let imageBuffer;

        const structurePrompt = {
            [trad("msg.structurePrompt.expediteur") || "expediteur"]: nomAuteur,
            [trad("msg.structurePrompt.message") || "message"]: texteUtilisateur
        };

        if (msgCite) {
            const auteurCiteJid = contextInfo.participant || contextInfo.remoteJid;
            const auteurCiteJidResolut = await resoudreJid(sock, auteurCiteJid, nomSession);
            const nomCite = auteurCiteJidResolut.split('@')[0];
            const texteCite = msgCite.conversation || msgCite.extendedTextMessage?.text;
            const imageCite = msgCite.imageMessage;

            structurePrompt[trad("msg.structurePrompt.reponse.reponse") || "reponse"] = {
                [trad("msg.structurePrompt.reponse.a") || "à"]: nomCite,
                [trad("msg.structurePrompt.reponse.details.details") || "details"]: {
                    [trad("msg.structurePrompt.reponse.details.type.type") || "type"]: texteCite ? (trad("msg.structurePrompt.reponse.details.type.texte") || "texte") : (imageCite ? (trad("msg.structurePrompt.reponse.details.type.image") || "image") : (trad("msg.structurePrompt.reponse.details.type.autre") || "autre")),
                    [trad("msg.structurePrompt.reponse.details.contenu.contenu") || "contenu"]: texteCite || (imageCite ? (trad("msg.structurePrompt.reponse.details.contenu.image") || "image") : (trad("msg.structurePrompt.reponse.details.contenu.autre") || "autre")),
                    [trad("msg.structurePrompt.reponse.details.legende") || "legende"]: imageCite?.caption || null
                }
            };

            if (imageCite && !estLegendeImage) {
                try {
                    imageBuffer = await downloadMediaMessage({
                        key: { remoteJid: jidBrut, id: contextInfo.stanzaId, participant: auteurCiteJid },
                        message: { imageMessage: imageCite }
                    }, "buffer", {});
                } catch (e) {}
            }
        }

        if (estLegendeImage) {
            try { imageBuffer = await downloadMediaMessage(message, "buffer", {}); } catch (e) {}
        }

        if (!texteUtilisateur && !imageBuffer && !msgCite) {
            const pas_de_question = trad("msg.pas_de_question") || "Euh... C'est quoi la question ?";
            return sock.sendMessage(jidBrut, { text: pas_de_question }, { quoted: message });
        }

        await executerConversationIA({ sock, message, nomSession, question: JSON.stringify(structurePrompt, null, 2), imageBuffer });
    },

    async handleNonCommand({ sock, message, nomSession }) {
        const trad = (cle, vars = {}) => traduire(nomSession, 'commandes', 'ia', { [cle]: vars })[cle];
        const jidBrut = message.key.remoteJid;
        const jidResolut = await resoudreJid(sock, jidBrut, nomSession);
        const conv = conversationsActives[jidResolut];
        if (!conv) return false;

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const estRep = contextInfo?.stanzaId === conv.lastAiMessageId;
        const delai = (Date.now() - conv.horodatage) < DELAI_CONVERSATION;

        if (estRep && delai) {
            const q = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption;
            if (q) {
                const structurePrompt = {
                    [trad("msg.structurePrompt.expediteur") || "expediteur"]: message.pushName || (trad("msg.structurePrompt.utilisateur") || "Utilisateur"),
                    [trad("msg.structurePrompt.message") || "message"]: q
                };

                const msgCite = contextInfo?.quotedMessage;
                if (msgCite) {
                    const texteCite = msgCite.conversation || msgCite.extendedTextMessage?.text;
                    const numeroBot = jidNormalizedUser(sock.user.id).split('@')[0];
                    structurePrompt[trad("msg.structurePrompt.reponse.reponse") || "reponse"] = {
                        [trad("msg.structurePrompt.reponse.a") || "a"]: numeroBot,
                        [trad("msg.structurePrompt.reponse.details.details") || "details"]: {
                            [trad("msg.structurePrompt.reponse.details.type") || "type"]: trad("msg.structurePrompt.reponse.details.type.texte") || "texte",
                            [trad("msg.structurePrompt.reponse.details.contenu") || "contenu"]: texteCite || (trad("msg.structurePrompt.reponse.details.contenu.msg_precedent") || "Message précédent")
                        }
                    };
                }

                await executerConversationIA({ sock, message, nomSession, question: JSON.stringify(structurePrompt, null, 2) });
                return true;
            }
        }
        if (!delai) delete conversationsActives[jidResolut];
        return false;
    }
};
