//import necessaire
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, jidNormalizedUser } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { promises as fs } from 'fs';
import pino from 'pino';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import readline from 'readline';
import util from 'util';
import {traduire} from "./outils/langue.js";


//cache metadata
const cache_groupes = new Map();


//fonction pour avoir des infos sur un utilisateur ou un groupe : declaration
async function obtenir_infos_expediteur(connexion, message) {
	const jid_brut = message.key.participant || message.key.remoteJid;
	let jid_utilisateur = jid_brut;

	//: correction pour résoudre les LID
	if (jid_brut && jid_brut.endsWith('@lid')) {
		try {
			const pn = await connexion.signalRepository.lidMapping.getPNForLID(jid_brut);
			if (pn) {
				jid_utilisateur = jidNormalizedUser(pn);
			}
		} catch (e) {
			console.error(`[LID-Erreur] Impossible de résoudre le LID ${jid_brut}:`, e);
		}
	}
	//: fin de la correction

	const numero = jid_utilisateur ? jid_utilisateur.split("@")[0] : 'inconnu';
	const nom_utilisateur = message.pushName || numero;
	let nom_groupe = null;
	const jid_groupe = message.key.remoteJid;

	if (jid_groupe?.endsWith("@g.us")) {
		if (cache_groupes.has(jid_groupe)) {
			nom_groupe = cache_groupes.get(jid_groupe);
		} else {
				try {
					const metadata = await connexion.groupMetadata(jid_groupe);
					nom_groupe = metadata.subject;
					cache_groupes.set(jid_groupe, nom_groupe);
				} catch (e) {
						nom_groupe = "groupe inconnu";
				}
		}
	}
	return {
		jid: jid_utilisateur,
		numero,
		nom_utilisateur,
		nom_groupe
	};
}


//gestion des logs colores
const log_succes = console.log;
const log_erreur = console.error;
const couleurs = { vert: '\x1b[32m', rouge: '\x1b[31m', reset: '\x1b[0m' };
const formater_log = (parametres) => parametres.map(param => (typeof param === 'object' && param !== null) ? util.inspect(param, { colors: false, depth: null }) : param).join(' ');
console.log = (...parametres) => log_succes(`${couleurs.vert}${formater_log(parametres)}${couleurs.reset}`);
console.error = (...parametres) => log_erreur(`${couleurs.rouge}${formater_log(parametres)}${couleurs.reset}`);


//initialisation des chemins de memoires
const nom_fichier = fileURLToPath(import.meta.url);
const nom_dossier = path.dirname(nom_fichier);
const chemin_memoires = path.join(nom_dossier, "memoires");
const chemin_memoires_commandes = path.join(chemin_memoires, "memoires_commandes");
const chemin_memoires_sessions = path.join(chemin_memoires, "memoires_sessions");
const chemin_memoires_outils = path.join(chemin_memoires, "memoires_outils");

(async () => {
	await fs.mkdir(chemin_memoires_commandes, { recursive: true });
	await fs.mkdir(chemin_memoires_sessions, { recursive: true });
	await fs.mkdir(chemin_memoires_outils, { recursive: true });
})();

//prefixe du bot
const prefixe = ".";

// Utilitaire pour convertir un chemin de fichier en URL file:// compatible Windows/Linux
const chemin_url = (chemin) => pathToFileURL(chemin).href;

//chemin des commandes
const poser_question = (texte) => new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(`${couleurs.vert}${texte}${couleurs.reset}`, (reponse) => { rl.close(); resolve(reponse); }); });
const charger_commande = async (nom_commande) => { const chemin = path.join(nom_dossier, "commandes", `${nom_commande}.js`); return (await fs.access(chemin).then(() => true).catch(() => false)) ? import(chemin_url(chemin)) : null; };
//chemin des outils
const charger_outil = async (nom_outil) => { const chemin = path.join(nom_dossier, "outils", `${nom_outil}.js`); return (await fs.access(chemin).then(() => true).catch(() => false)) ? import(`${chemin_url(chemin)}?update=${Date.now()}`) : null; };
const outils_charges = [];

//fuction pour les outils
async function distribuer_evenement(nom_evenement, donnees_evenement, connexion, nom_session) {
	for (const outil of outils_charges) {
		const module = outil.default;
		if (module.evenements && (module.evenements === nom_evenement || (Array.isArray(module.evenements) && module.evenements.includes(nom_evenement)))) {
			try {
				const resultat = await module.execute(nom_evenement, donnees_evenement, { connexion, nom_session, prefixe: prefixe });
				if (resultat === 'STOP') return 'STOP';
			}
			catch (erreur) {
				console.error(`[(Mugen Bot♾️♾️))]; Erreur dans l'outil "${module.nom || 'inconnu'}" sur l'événement "${nom_evenement}":`, erreur);
			}
		}
	}
}


//chargement des outils
async function charger_outils() {
	try {
		const chemin_outils = path.join(nom_dossier, "outils");
		if (await fs.access(chemin_outils).then(() => true).catch(() => false)) {
			const fichiers_outils = (await fs.readdir(chemin_outils)).filter(f => f.endsWith('.js'));
			outils_charges.length = 0; //vider la liste avant de recharger
			for (const fichier of fichiers_outils) {
				const nom_outil = path.parse(fichier).name;
				const module_outil = await charger_outil(nom_outil);
				if (module_outil) {
					outils_charges.push(module_outil);
					console.log(`[(Mugen Bot♾️♾️ )]; Outil "${module_outil.default.nom || nom_outil}" chargé.`);
				}
			}
		}
	}
	catch (erreur) {
		console.error(`[(Mugen Bot♾️♾️ )]; Erreur lors du chargement des outils:`, erreur);
	}
}
charger_outils();


//fonction pour envoyer et retirer des reaction
async function envoyer_reaction(connexion, jid, cle_message, emoji) {
	await connexion.sendMessage(jid, {
		react: { text: emoji, key: cle_message }
    });
	setTimeout(() => {
		try {
			connexion.sendMessage(jid, { react: { text: "", key: cle_message } });
		}
		catch (e) {}
	}, 30000); //secondes
}


//logique du bot : chargement des commandes et initialisation des sessions
async function demarrer_bot(nom_session = "mugen") {
	try {
		const chemin_commandes = path.join(nom_dossier, "commandes");
		const fichiers_commandes = (await fs.readdir(chemin_commandes)).filter(fichier => fichier.endsWith('.js'));
		for (const fichier of fichiers_commandes) {
			const nom_commande = path.parse(fichier).name;
			// : creation des dossiers memoires pour chaque commande
			const chemin_memoire_session_commande = path.join(chemin_memoires_commandes, nom_commande, nom_session);
			await fs.mkdir(chemin_memoire_session_commande, { recursive: true });
		}

		// : creation des dossiers memoires pour chaque outil
		const chemin_outils = path.join(nom_dossier, "outils");
		if (await fs.access(chemin_outils).then(() => true).catch(() => false)) {
			const fichiers_outils = (await fs.readdir(chemin_outils)).filter(f => f.endsWith('.js'));
			for (const fichier of fichiers_outils) {
				const nom_outil = path.parse(fichier).name;
				const chemin_memoire_session_outils = path.join(chemin_memoires_outils, nom_outil, nom_session,);
				await fs.mkdir(chemin_memoire_session_outils, { recursive: true });
			}
		}
		console.log(`[(Mugen Bot♾️♾️ )]; Dossiers de mémoire pour la session "${nom_session}" vérifié`);

		// : chargement des sessions si les fichiers authentification existe
		const chemin_auth = path.join(nom_dossier, ".secret/.auth", nom_session);
		const { state: etat, saveCreds: sauvegarder_auth } = await useMultiFileAuthState(chemin_auth);
		const { version } = await fetchLatestBaileysVersion();
		// : creation du socket
		const connexion = makeWASocket({
			//logger: pino({ level: 'silent' }),
			version,
			auth: etat,
			browser: ["Ubuntu", "Chrome"],
			syncFullHistory: true,
			markOnlineOnConnect : false ,
			generateHighQualityLinkPreview : false ,
			retryRequestDelayMs : 500 ,
			maxMsgRetryCount : 5 ,
		});
		// : si les fichiers authentification existe pas on pose des questions sur la methode de de connexion
		let code_pairage_choisi = false;
		if (!etat.creds.registered) {
			const choix = await poser_question(`Authentification pour ${nom_session}
1: QR Code
2: Code de pairage\n\t:`);
			// : si code de pair est choisi comme methode
			if (choix.trim() === '2') {
				code_pairage_choisi = true;
				const numero = await poser_question(`Numéro de téléphone pour ${nom_session} (ex: 56931437983: `);
				const code = await connexion.requestPairingCode(numero);
				console.log(`\nVoilà le code: ${code}\n`);
			}
		}
		// : si qr code est choisi ou que le choix fait est pas dans la liste
		connexion.ev.on("connection.update", async (mise_a_jour) => {
			if (await distribuer_evenement("connection.update", mise_a_jour, connexion, nom_session) === 'STOP') return;
			const { connection, lastDisconnect, qr } = mise_a_jour;
			if (qr && !code_pairage_choisi) {
				qrcode.generate(qr, { small: true });
			}
			if (connection === "close") {
				const reconnexion = lastDisconnect?.error?.output?.statusCode !== 401;
				if (reconnexion) demarrer_bot(nom_session);
			} else if (connection === "open") {
				console.log(`"${nom_session}" connecté`);
			}
		});

		//detection des evenements
		connexion.ev.on("creds.update", async (creds) => {
			if (await distribuer_evenement("creds.update", creds, connexion, nom_session) === 'STOP') return;
			await sauvegarder_auth();
		});

		connexion.ev.on("group-participants.update", async (donnees) => {
			if (await distribuer_evenement("group-participants.update", donnees, connexion, nom_session) === 'STOP') return;
		});

		connexion.ev.on("messages.upsert", async (donnees) => {
			if (await distribuer_evenement("messages.upsert", donnees, connexion, nom_session) === 'STOP') return;


			const { messages, type } = donnees;
			const message = messages[0];

			if (!message.message) return;

			const texte = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption;
			// : si dans la fouille des evenements on trouve des messages avec le prefixe on le capture
			if (texte && texte.startsWith(prefixe)) {

				const infos = await obtenir_infos_expediteur(connexion, message);

				// appelle au commandes : analyse des evenements qui contiennent le prefixe et appelle a la commande en question
				const [nom_commande, ...args] = texte.slice(prefixe.length).trim().split(/\s+/);
				const module_commande = await charger_commande(nom_commande);
				const trad = async (cle, vars = {}) => (await traduire(nom_session, '', 'mugen_wa_bot', { [cle]: vars }))[cle];
				// : en attente que la commande repond on envoie une réaction
				if (module_commande?.default?.execute) {
					try {
						const emoji_reaction_execution = (await trad("msg.emoji_reaction.execution")) || "♾️";
						await connexion.sendMessage(message.key.remoteJid, { react: {
							text: emoji_reaction_execution,
							key: message.key
						}});
						let log = `Commande/outil ${nom_commande} demandé depuis ${nom_session} par ${infos.nom_utilisateur} (${infos.numero})`;
						if (infos.nom_groupe) {
							log += ` dans le groupe "${infos.nom_groupe}"`;
						}
						console.log(log);

						// : si la commande nous revois NO_REACTION on envoi pas de reaction apres la commande
						const resultat = await module_commande.default.execute({ connexion, message, args, nom_session });
						if (resultat !== 'NO_REACTION') {
							// : mais si non on envoie la reaction
							const emoji_reaction_reussite = (await trad(`msg.emoji_reaction.reussite`)) || "✅";
							await envoyer_reaction(connexion, message.key.remoteJid, message.key, emoji_reaction_reussite);
							let log_succes = `Commande/outils ${nom_commande} éxecuté depuis ${nom_session} par ${infos.nom_utilisateur} (${infos.numero})`;
							if (infos.nom_groupe) log_succes += ` dans le groupe "${infos.nom_groupe}"`;
							console.log(log_succes);
						}
					} catch (erreur) {
						console.error(`Erreur lors de l'exécution de la commande "${nom_commande}":`, erreur);
						// : mais si la commande a eu un problème dans son execution on envoie cette rection et de même que l'autre il est soumis à NO_REACTION
						const emoji_reaction_erreur = (await trad(`msg.emoji_reaction.erreur`)) || "❌";
						await envoyer_reaction(connexion, message.key.remoteJid, message.key, emoji_reaction_erreur);
						let log_erreur = `Commande/outil ${nom_commande} échoué depuis ${nom_session} par ${infos.nom_utilisateur} (${infos.numero})`;
						if (infos.nom_groupe) log_erreur += ` dans le groupe "${infos.nom_groupe}"`;
						console.error(log_erreur);
					}
				}
				else {
					// si au moment ou on essaie de joindre la commande on le trouve pas : on envoie cette reaction
					const emoji_reaction_inconnu = (await trad(`msg.emoji_reaction.inconnu`)) || "❓";
					await envoyer_reaction(connexion, message.key.remoteJid, message.key, emoji_reaction_inconnu);
					let log_inconnu = `Commande/outil ${nom_commande} inconnu depuis ${nom_session} par ${infos.nom_utilisateur} (${infos.numero})`;
					if (infos.nom_groupe) log_inconnu += ` dans le groupe "${infos.nom_groupe}"`;
					console.error(log_inconnu);

					// : et ce message d'erreur
					const fonctionalite_inconnu = (await trad(`msg.fonctionalite_inconnu`, {
						nom: nom_commande
					})) || `𒁂Commande ou outil inconnue ".${nom_commande}"𒁂`;
					await connexion.sendMessage(message.key.remoteJid, { text: fonctionalite_inconnu }, { quoted: message });
				}
			}
			else {
				// fonction et appelle des commandes sans besoin du evenement aillant le prefixe il est à la disposition de tous les commandes
				const chemin_commandes = path.join(nom_dossier, "commandes");
				const fichiers_commandes = (await fs.readdir(chemin_commandes)).filter(f => f.endsWith('.js') && !f.endsWith('_db.js'));

				for (const fichier of fichiers_commandes) {
					const nom_commande = path.parse(fichier).name;
					const module_commande = await charger_commande(nom_commande);
					if (module_commande?.default?.evenements_sans_prefixe) {
						try {
							const getion_message = await module_commande.default.evenements_sans_prefixe({ connexion, message, nom_session });
							if (getion_message) break;
						} catch (erreur) {
							console.error(`Erreur dans evenements_sans_prefixe pour ${nom_commande}:`, erreur);
						}
					}
				}
			}
		});
	}
	catch (erreur) {
		console.error(`[(Mugen Bot♾️♾️ )]; Erreur critique lors du démarrage de "${nom_session}":`, erreur);
	}
}

//recherche des session à lancer dans "session.js"
const charger_sessions = async () => {
	const chemin_sessions = path.join(nom_dossier, "session.js");
	//si le fichier n'existe pas, on lance la session par défaut
	if (!(await fs.access(chemin_sessions).then(() => true).catch(() => false))) {
		await demarrer_bot();
		return;
	}
	try {
		const contenu_brut = await fs.readFile(chemin_sessions, "utf8");
		//si le fichier est vide, on lance la session par défaut
		if (!contenu_brut.trim()) {
			await demarrer_bot();
			return;
		}
		//sinon, on cherche les appels actifs (non commentés)
		// On retire d'abord les blocs /* ... */
		let contenu_nettoye = contenu_brut.replace(/\/\*[\s\S]*?\*\//g, "");
		const lignes = contenu_nettoye.split("\n");

		for (const ligne of lignes) {
			//on ignore ce qui est après //
			const instruction = ligne.split("//")[0].trim();
			const correspondance = instruction.match(/demarrer_bot\s*\(\s*["']([^"']+)["']\s*\)/);
			if (correspondance && correspondance[1]) {
				await demarrer_bot(correspondance[1]);
			}
		}
	}
	catch (erreur) {
		console.error("[(Mugen Bot♾️♾️ )]; Erreur lors de la lecture de session.js :", erreur);
	}
};

// Lancement automatique
charger_sessions();