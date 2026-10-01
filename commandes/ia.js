/* Cette commande est dependante de l'API de GEMINI donc faut installer @google/generative-ai avec npm
Et aller sur le site de des api gemini(https://aistudio.google.com/apikey) pour en creer une et le stocker dans ".secret/.cles_ia/.cles_ia.json:
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
const chemin_cle_ia = path.join(process.cwd(), ".secret", ".cles_ia", ".cles_ia.json");
const chemin_memoire_ia = path.join(process.cwd(), "memoires", "memoires_commandes", "ia");
const delai_convention = 5 * 60 * 1000;
const delai_purge_historique = 3 * 24 * 60 * 60 * 1000;

//definition des modeles qu'on va utiliser
const modeles_proprietaire = ["gemini-3.1-flash-lite-preview"];
const modeles_autres = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

//instruction qu'on envoi a gemini pour lui donner son rôle il doit être le plus (claire,nette et precis) que possible
const chemin_instructions = path.join(process.cwd(), "stockage", "commandes", "ia.json");

function creuser(objet, chemin) {
	return chemin.reduce((accumulation, cle) => (accumulation && accumulation[cle] !== undefined ? accumulation[cle] : undefined), objet);
}

export async function obtenir_prompt(cle, variables = {}) {
	try {
		const contenu = await fs.readFile(chemin_instructions, "utf-8");
		const donnees = JSON.parse(contenu);
		const chemin = cle.split(".");
		let texte = creuser(donnees, chemin);

		if (typeof texte !== "string") return null;
		// injection variables
		for (const v in variables) {
			texte = texte.replace(new RegExp(`{${v}}`, "g"), variables[v]);
		}
		return texte;
	} catch (e) {
		return null;
	}
}

const obtenir_instructions_ia = async (num_bot, nom_session) => {
	const instruction = async (cle, variables = {}) => await obtenir_prompt(cle, variables);
	const trad = (cle, variables = {}) => traduire(nom_session, 'commandes', 'ia', { [cle]: variables })[cle];
	const instructions = [
		trad("msg.instruction_systeme.identiter") || await instruction("instruction_systeme.identiter"),
		trad("msg.instruction_systeme.createur") || await instruction("instruction_systeme.createur"),
		trad("msg.instruction_systeme.proprietaire", {
			num_bot: num_bot }) || await instruction("instruction_systeme.proprietaire", {
			num_bot: num_bot }),
		trad("msg.instruction_systeme.reponse_au_question.1") || await instruction("instruction_systeme.reponse_au_question.1"),
		trad("msg.instruction_systeme.reponse_au_question.2") || await instruction("instruction_systeme.reponse_au_question.2"),
		trad("msg.instruction_systeme.reponse_au_question.3") || await instruction("instruction_systeme.reponse_au_question.3"),
		trad("msg.instruction_systeme.reponse_au_question.4") || await instruction("instruction_systeme.reponse_au_question.4"),
		trad("msg.instruction_systeme.comportement") || await instruction("instruction_systeme.comportement"),
		trad("msg.instruction_systeme.contexte") || await instruction("instruction_systeme.contexte")
	];

	const resultat = await Promise.all(instructions);
	return resultat.filter(Boolean).join("\n\n").trim();
};

const conversations_actives = {};
let gen_ai;
let cles_api_dispo = false;

(async () => {
	try {
		const contenu_cle = await fs.readFile(chemin_cle_ia, "utf-8");
		const { cle_gemini } = JSON.parse(contenu_cle);
		if (cle_gemini) {
			gen_ai = new GoogleGenerativeAI(cle_gemini);
			cles_api_dispo = true;
		}
	} catch (e) {}
})();

//fonctions utilitaires et resolutions des IDs
async function resoudreJid(connexion, jid, nom_session) {
	if (jid && jid.endsWith('@lid')) {
		try {
			const pn = await connexion.signalRepository.lidMapping.getPNForLID(jid);

			if (pn) return jidNormalizedUser(pn);
		} catch (e) {
			console.error(`[(ia), "${nom_session}"]: Erreur LID ${jid}:`, e);
		}
	}
	return jidNormalizedUser(jid);
}

async function avoir_chemin_historique(connexion, nom_session, jid_resolut) {
	let nom_fichier = jid_resolut;
	const type = jid_resolut.endsWith('@g.us') ? 'groupe' : 'prive';

	if (type === 'groupe') {
		try {
			const metadata = await connexion.groupMetadata(jid_resolut);
			const nom_groupe_nettoyer = metadata.subject.replace(/[\/\?%*:|"<>]/g, '-');
			nom_fichier = `${nom_groupe_nettoyer}_${jid_resolut}`;
		} catch (e) {}
	}

	const chemin_dossiers = path.join(chemin_memoire_ia, nom_session, type);
	await fs.mkdir(chemin_dossiers, { recursive: true });
	return path.join(chemin_dossiers, `${nom_fichier}.json`);
}

async function lire_et_purge_historique(chemin_historique) {
	try {
		const contenu = await fs.readFile(chemin_historique, "utf-8");
		const historique = JSON.parse(contenu);
		const date = Date.now();
		return historique.filter(message => message.horodatage && (date - message.horodatage) < delai_purge_historique);
	} catch (e) { return []; }
}

async function sauvegarder_historique(chemin_historique, historique) {
	try { await fs.writeFile(chemin_historique, JSON.stringify(historique, null, 2)); } catch (e) {}
}

//logique principale de l'IA
async function executer_conversation({ connexion, message, nom_session, question, tampon_image }) {
	const trad = (cle, variables = {}) => traduire(nom_session, 'commandes', 'ia', { [cle]: variables })[cle];

	if (!cles_api_dispo) {
		console.error(`[(ia), "${nom_session}"]; Cle ia introuvable il faut aller creer une cle gemini sur (https://aistudio.google.com/apikey) et le stocker dans : "${chemin_cle_ia}".`);
		const cle_api_introuvable = trad("msg.cle_api_introuvable") || "> L'IA n'est pas prête.";
		await connexion.sendMessage(message.key.remoteJid, { text: cle_api_introuvable }, { quoted: message });
		return;
	}

	const jid_brut = message.key.remoteJid;
	const jid_resolut = await resoudreJid(connexion, jid_brut, nom_session);
	let message_attente;
	let appel_api_fini = false;
	const textes_attente = trad("msg.textes_attente") || ["◐♾", "♾◓", "◑♾", "♾◒", "♾️"];

	try {
		message_attente = await connexion.sendMessage(jid_brut, { text: textes_attente[0] }, { quoted: message });
	} catch (e) {}

	const demarrer_attente = async () => {
		let indice = 0;
		try {
			while (!appel_api_fini && message_attente) {
				await new Promise(r => setTimeout(r, 600));
				if (appel_api_fini) break;
				indice = (indice + 1) % textes_attente.length;
				await connexion.sendMessage(jid_brut, { text: textes_attente[indice], edit: message_attente.key });
			}
		} catch (e) { appel_api_fini = true; }
	};
	demarrer_attente();

	const est_bot = message.key.fromMe;
	const modeles = est_bot ? [...modeles_proprietaire, ...modeles_autres] : modeles_autres;
	let reponse_finale = null;
	let erreur_finale = null;

	for (const nom_modele of modeles) {
		try {
			const num_bot = jidNormalizedUser(connexion.user.id).split('@')[0];
			const modele_actuel = gen_ai.getGenerativeModel({
				model: nom_modele,
				systemInstruction: { parts: [{ text: await obtenir_instructions_ia(num_bot, nom_session) }] }
			});

			const chemin_historique = await avoir_chemin_historique(connexion, nom_session, jid_resolut);
			const historique = await lire_et_purge_historique(chemin_historique);
			const api_historique = historique.map(({ role, parts }) => ({ role, parts }));
			const inscriptions_utilisateur = [{ text: question }];

			if (tampon_image) {
				inscriptions_utilisateur.unshift({ inlineData: { mimeType: "image/jpeg", data: tampon_image.toString("base64") } });
			}

			const chat = modele_actuel.startChat({ history: api_historique });
			const resultat = await chat.sendMessage(inscriptions_utilisateur);
			reponse_finale = resultat.response.text();
			historique.push({ role: "user", parts: inscriptions_utilisateur, horodatage: Date.now() });
			historique.push({ role: "model", parts: [{ text: reponse_finale }], horodatage: Date.now() });
			await sauvegarder_historique(chemin_historique, historique);
			break;

		} catch (err) {
			console.error(`[(ia), "${nom_session}"]: Erreur avec le modèle ${nom_modele}:`, err);
			erreur_finale = err;
			if (err.status === 429 || err.status === 503) continue;
			break;
		}
	}

	appel_api_fini = true;
	if (reponse_finale) {
		if (message_attente) {
			await connexion.sendMessage(jid_brut, { text: reponse_finale, edit: message_attente.key });
		} else {
			message_attente = await connexion.sendMessage(jid_brut, { text: reponse_finale }, { quoted: message });
		}
		conversations_actives[jid_resolut] = { lastAiMessageId: message_attente.key.id, horodatage: Date.now() };
	} else {
		const message_erreur = (erreur_finale?.status === 429 || erreur_finale?.status === 503) ? trad("msg.erreurs.plus_de_token") || trad("msg.erreurs.autres") || "> Plus de jus 😅" : "_Erreur_";
		if (message_attente) {
			await connexion.sendMessage(jid_brut, { text: message_erreur, edit: message_attente.key });
		} else {
			await connexion.sendMessage(jid_brut, { text: message_erreur }, { quoted: message });
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

	async execute({ connexion, message, args, nom_session }) {
		const trad = (cle, variables = {}) => traduire(nom_session, 'commandes', 'ia', { [cle]: variables })[cle];
		const jid_brut = message.key.remoteJid;
		const nom_auteur = message.pushName || trad('msg.nom_auteur') || "Utilisateur";
		const premier_argument = args[0]?.toLowerCase();
		if (premier_argument === "reinitialise") {
			const jid_resolut = await resoudreJid(connexion, jid_brut, nom_session);
			const chemin_historique = await avoir_chemin_historique(connexion, nom_session, jid_resolut);
			try {
				await fs.unlink(chemin_historique);
				delete conversations_actives[jid_resolut];
				const succes_supression = trad("msg.succes_supression") || "Historique de la conversation effacé.";
				return connexion.sendMessage(jid_brut, { text: succes_supression }, { quoted: message });
			} catch (e) {
				const pas_de_historique = trad("msg.pas_de_historique") || "Info : Aucun historique trouvé pour cette discussion.";
				return connexion.sendMessage(jid_brut, { text: pas_de_historique }, { quoted: message });
			}
		}

		const image = message.message?.imageMessage;
		const legende = image?.caption || "";
		const est_legende_image = !!image;
		let texte_utilisateur = args.join(" ").trim();

		if (!texte_utilisateur && legende) {
			texte_utilisateur = legende.replace(/^\.ia\s*/i, "").trim();
		}

		const infos_contexte = message.message?.extendedTextMessage?.infos_contexte || image?.infos_contexte;
		const message_repondu = infos_contexte?.quotedMessage;
		let tampon_image;
		const structure_instruction = {
			[trad("msg.structure_instruction.expediteur") || "expediteur"]: nom_auteur,
			[trad("msg.structure_instruction.message") || "message"]: texte_utilisateur
		};

		if (message_repondu) {
			const jid_auteur_repondu = infos_contexte.participant || infos_contexte.remoteJid;
			const jid_resolut_auteur_repondu = await resoudreJid(connexion, jid_auteur_repondu, nom_session);
			const nom_auteur_repondu = jid_resolut_auteur_repondu.split('@')[0];
			const texte_repondu = message_repondu.conversation || message_repondu.extendedTextMessage?.text;
			const image_repondu = message_repondu.imageMessage;
			structure_instruction[trad("msg.structure_instruction.reponse.reponse") || "reponse"] = {
				[trad("msg.structure_instruction.reponse.a") || "à"]: nom_auteur_repondu,
				[trad("msg.structure_instruction.reponse.details.details") || "details"]: {
					[trad("msg.structure_instruction.reponse.details.type.type") || "type"]: texte_repondu ? (trad("msg.structure_instruction.reponse.details.type.texte") || "texte") : (image_repondu ? (trad("msg.structure_instruction.reponse.details.type.image") || "image") : (trad("msg.structure_instruction.reponse.details.type.autre") || "autre")),
					[trad("msg.structure_instruction.reponse.details.contenu.contenu") || "contenu"]: texte_repondu || (image_repondu ? (trad("msg.structure_instruction.reponse.details.contenu.image") || "image") : (trad("msg.structure_instruction.reponse.details.contenu.autre") || "autre")),
					[trad("msg.structure_instruction.reponse.details.legende") || "legende"]: image_repondu?.caption || null
				}
			};

			if (image_repondu && !est_legende_image) {
				try {
					tampon_image = await downloadMediaMessage({
						key: { remoteJid: jid_brut, id: infos_contexte.stanzaId, participant: jid_auteur_repondu },
						message: { imageMessage: image_repondu }
					}, "buffer", {});
				} catch (e) {}
			}
		}

		if (est_legende_image) {
			try { tampon_image = await downloadMediaMessage(message, "buffer", {}); } catch (e) {}
		}

		if (!texte_utilisateur && !tampon_image && !message_repondu) {
			const pas_de_question = trad("msg.pas_de_question") || "Euh... C'est quoi la question ?";
			return connexion.sendMessage(jid_brut, { text: pas_de_question }, { quoted: message });
		}

		await executer_conversation({ connexion, message, nom_session, question: JSON.stringify(structure_instruction, null, 2), tampon_image });
	},

	async evenements_sans_prefixe({ connexion, message, nom_session }) {
		const trad = (cle, variables = {}) => traduire(nom_session, 'commandes', 'ia', { [cle]: variables })[cle];
		const jid_brut = message.key.remoteJid;
		const jid_resolut = await resoudreJid(connexion, jid_brut, nom_session);
		const conversation = conversations_actives[jid_resolut];
		if (!conversation) return false;
		const infos_contexte = message.message?.extendedTextMessage?.infos_contexte;
		const est_reponse = infos_contexte?.stanzaId === conversation.lastAiMessageId;
		const delai = (Date.now() - conversation.horodatage) < delai_convention;

		if (est_reponse && delai) {
			const question = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption;
			if (question) {
				const structure_instruction = {
					[trad("msg.structure_instruction.expediteur") || "expediteur"]: message.pushName || (trad("msg.structure_instruction.utilisateur") || "Utilisateur"),
					[trad("msg.structure_instruction.message") || "message"]: question
				};

				const message_repondu = infos_contexte?.quotedMessage;
				if (message_repondu) {
					const texte_repondu = message_repondu.conversation || message_repondu.extendedTextMessage?.text;
					const num_bot = jidNormalizedUser(connexion.user.id).split('@')[0];
					structure_instruction[trad("msg.structure_instruction.reponse.reponse") || "reponse"] = {
						[trad("msg.structure_instruction.reponse.a") || "a"]: num_bot,
						[trad("msg.structure_instruction.reponse.details.details") || "details"]: {
							[trad("msg.structure_instruction.reponse.details.type") || "type"]: trad("msg.structure_instruction.reponse.details.type.texte") || "texte",
							[trad("msg.structure_instruction.reponse.details.contenu") || "contenu"]: texte_repondu || (trad("msg.structure_instruction.reponse.details.contenu.msg_precedent") || "Message précédent")
						}
					};
				}

				await executer_conversation({ connexion, message, nom_session, question: JSON.stringify(structure_instruction, null, 2) });
				return true;
			}
		}
		if (!delai) delete conversations_actives[jid_resolut];
		return false;
	}
};
