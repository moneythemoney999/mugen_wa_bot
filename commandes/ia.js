/* Cette commande est dependante de l'API de GEMINI donc faut installer @google/generative-ai avec npm
Et aller sur le site de des api gemini(https://aistudio.google.com) pour en creer une et le stocker dans ".secret/.cles_ia/.cles_ia.json:
{
"cle_gemini": "LA CLE DE GEMINI ICI"
}*/

//imports necessaire
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import { downloadMediaMessage, jidNormalizedUser } from "@whiskeysockets/baileys";


//configuration et preparation des fichier memoires et recherche de la cle gemini
const CHEMIN_SECRET = path.join(process.cwd(), ".secret", ".cles_ia", ".cles_ia.json");
const CHEMIN_MEMOIRE_IA = path.join(process.cwd(), "memoires", "memoires_commandes", "ia");
const DELAI_CONVERSATION = 5 * 60 * 1000;
const DELAI_PURGE_HISTORIQUE = 3 * 24 * 60 * 60 * 1000;

//definition des modeles qu'on va utiliser
const MODELES_PROPRIETAIRE = ["gemini-3-pro-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"];
const MODELES_AUTRES = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

//instruction qu'on envoi a gemini pour lui donner son rôle il doit être le plus (claire,nette et precis) que possible
const OBTENIR_INSTRUCTION_SYSTEME = (numeroBot) =>`Tu es Mugen♾️♾️, un assistant IA intelligent intégré dans WhatsApp, créé par Money Mugen♾️♾️, introduit sur WhatsApp par le biais de Mugen Bot♾️♾️ aussi créé par Money Mugen♾️♾️. Le bot est lié au compte (${numeroBot}), c'est lui ton proprio. Agis comme un humain, sois direct et ne mentionne jamais Google ou tes modèles. Si on te demande comment t'avoir, suggère de parler avec le proprio et si on te demande qui t'a créé, réponds Money Mugen♾️♾️ et mentionne que tu es lié au proprio. Tu recevras tes entrées sous forme de JSON pour le contexte (expéditeur, message, réponses). Analyse-les pour pouvoir répondre de manière plus fluide et naturelle. Et tu rrponds pas tout le temps en français tu réponds plutôt dan la langue qu'on te parle.`;

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
async function resoudreJid(sock, jid) {
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
    if (!cleApiDisponible) {
        // Log de l'absence de clé
        console.error(`[(ia), "${nomSession}"]; Cle ia introuvable il faut aller creer une cle gemini sur (https://aistudio.google.com) et le stocker dans : "${CHEMIN_SECRET}".`);
	//si la cle Api n'est pas là on envoi un message d'erreur
        await sock.sendMessage(message.key.remoteJid,
	    { text: "> L'IA n'est pas prête." },
	    { quoted: message });
        return;
    }

    const jidBrut = message.key.remoteJid;
    const jidResolut = await resoudreJid(sock, jidBrut);
    let messageIndicateur;
    let apiCallEstFinie = false;

    // Petit effet visuel pour faire patienter, puisque le rendu est meilleur que l'effet streaming de Gemini.
    const demarrerIndicateur = async () => {
        const textes = ["◐","◓","◑","◒"];
        let i = 0;
        try {
            messageIndicateur = await sock.sendMessage(jidBrut, { text: textes[0] }, { quoted: message });
            while (!apiCallEstFinie) {
                await new Promise(r => setTimeout(r, 600));
                if (apiCallEstFinie) break;
                i = (i + 1) % textes.length;
                await sock.sendMessage(jidBrut,
		    { text: textes[i], edit: messageIndicateur.key });
            }
        } catch(e) { apiCallEstFinie = true; }
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
                systemInstruction: { parts: [{ text: OBTENIR_INSTRUCTION_SYSTEME(numeroBot) }] }
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
            erreurFinale = err;
            if (err.status === 429 || err.status === 503) continue;
            break;
        }
    }

    apiCallEstFinie = true;
    if (reponseFinale) {
        await sock.sendMessage(jidBrut, { text: reponseFinale, edit: messageIndicateur.key });
        conversationsActives[jidResolut] = { lastAiMessageId: messageIndicateur.key.id, horodatage: Date.now() };
    } else {
	// Message en conséquence si les requêtes sont épuisées ou s'il y a une erreur.
        const msgErr = (erreurFinale?.status === 429 || erreurFinale?.status === 503) ? "> Plus de jus 😅" : "_Erreur_";
        await sock.sendMessage(jidBrut, { text: msgErr, edit: messageIndicateur.key });
    }
}

//eport et logique de la commande
export default {
    nom: "ia",
    description: "Mugen♾️♾️, IA pour discuter.",
    categorie: "Groupes && Privé",
    infos: `Pour discuter avec l'IA, il faut d'abord taper \`.ia ton message derrière\`. Il peut être en réponse à un ancien message de type (image, texte) ou même directement en légende d'une image.
Après avoir tapé .ia, il n'est plus nécessaire de le faire dans un délai de 5 minutes ; il suffit de répondre au dernier message de l'IA.

Il y a aussi une sous-commande pour réinitialiser la discussion avec l'IA si celle-ci part en vrille.

> NB : *Il pourrait y avoir certaines données (noms de profils, numéro du propriétaire) qui seront partagées avec l'IA pour son bon fonctionnement.*`,

    async execute({ sock, message, args, nomSession }) {
        const jidBrut = message.key.remoteJid;
        const nomAuteur = message.pushName || "Utilisateur";

        // Sous-commande de réinitialisation
        const premierArg = args[0]?.toLowerCase();
        if (premierArg === "reinitialise") {
            const jidResolut = await resoudreJid(sock, jidBrut);
            const cheminHist = await obtenirCheminHistorique(sock, nomSession, jidResolut);
            try {
                await fs.unlink(cheminHist);
                delete conversationsActives[jidResolut];
                return sock.sendMessage(jidBrut,
			  //confirmation si une historique a ete trouve
			  { text: "Historique de la conversation effacé." },
			  { quoted: message });
            } catch (e) {
                return sock.sendMessage(jidBrut,
			  //on mentionne aussi s'il n'y a pas d'historique
			  { text: "Info : Aucun historique trouvé pour cette discussion." },
			  { quoted: message });
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

        // Construction systématique de l'objet JSON
        const structurePrompt = {
            "expediteur": nomAuteur,
            "message": texteUtilisateur
        };

        if (msgCite) {
            const auteurCiteJid = contextInfo.participant || contextInfo.remoteJid;
            const auteurCiteJidResolut = await resoudreJid(sock, auteurCiteJid);
            const nomCite = auteurCiteJidResolut.split('@')[0];

            const texteCite = msgCite.conversation || msgCite.extendedTextMessage?.text;
            const imageCite = msgCite.imageMessage;

            structurePrompt.reponse = {
                "a": nomCite,
                "details": {
                    "type": texteCite ? "texte" : (imageCite ? "image" : "autre"),
                    "contenu": texteCite || (imageCite ? "image" : "autre"),
                    "legende": imageCite?.caption || null
                }
            };

            // On télécharge l'image citée SI ce n'est pas déjà une commande sur une image actuelle
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
            try {
                imageBuffer = await downloadMediaMessage(message, "buffer", {});
            } catch (e) {}
        }

        const promptFinal = JSON.stringify(structurePrompt, null, 2);

        if (!texteUtilisateur && !imageBuffer && !msgCite) {
	    // S'il n'y a aucun texte derrière la commande
            return sock.sendMessage(jidBrut,
		{ text: "Euh... C'est quoi la question ?" },
		{ quoted: message });
        }

        await executerConversationIA({ sock, message, nomSession, question: promptFinal, imageBuffer });
    },

    async handleNonCommand({ sock, message, nomSession }) {
        const jidBrut = message.key.remoteJid;
        const jidResolut = await resoudreJid(sock, jidBrut);
        const conv = conversationsActives[jidResolut];
        if (!conv) return false;

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const estRep = contextInfo?.stanzaId === conv.lastAiMessageId;
        const delai = (Date.now() - conv.horodatage) < DELAI_CONVERSATION;

        if (estRep && delai) {
            const q = message.message.conversation || message.message.extendedTextMessage?.text;
            if (q) {
                const structurePrompt = {
                    "expediteur": message.pushName || "Utilisateur",
                    "message": q
                };

                // Puisque c'est une réponse, on ajoute le bloc "reponse" comme dans execute
                const msgCite = contextInfo?.quotedMessage;
                if (msgCite) {
                    const texteCite = msgCite.conversation || msgCite.extendedTextMessage?.text;
                    const numeroBot = jidNormalizedUser(sock.user.id).split('@')[0];
                    structurePrompt.reponse = {
                        "a": numeroBot,
                        "details": {
                            "type": "texte",
                            "contenu": texteCite || "Message précédent"
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
