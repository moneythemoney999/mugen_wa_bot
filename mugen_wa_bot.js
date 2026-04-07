//import necessaire
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, jidNormalizedUser } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import util from 'util';


//cache metadata
const cacheGroupes = new Map();


//fonction pour avoir des infos sur un utilisateur ou un groupe : declaration
async function obtenirInfosExpediteur(sock, message) {
    const jidBrut = message.key.participant || message.key.remoteJid;
    let jidUtilisateur = jidBrut;

    //: correction pour résoudre les LID
    if (jidBrut && jidBrut.endsWith('@lid')) {
        try {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jidBrut);
            if (pn) {
                jidUtilisateur = jidNormalizedUser(pn);
            }
        } catch (e) {
            console.error(`[LID-Erreur] Impossible de résoudre le LID ${jidBrut}:`, e);
        }
    }
    //: fin de la correction

    const numero = jidUtilisateur ? jidUtilisateur.split("@")[0] : 'inconnu';

    const nomUtilisateur = message.pushName || numero;

    let nomGroupe = null;
    const jidGroupe = message.key.remoteJid;

    if (jidGroupe?.endsWith("@g.us")) {
        if (cacheGroupes.has(jidGroupe)) {
            nomGroupe = cacheGroupes.get(jidGroupe);
        } else {
            try {
                const metadata = await sock.groupMetadata(jidGroupe);
                nomGroupe = metadata.subject;
                cacheGroupes.set(jidGroupe, nomGroupe);
            } catch (e) {
                nomGroupe = "groupe inconnu";
            }
        }
    }

    return {
        jid: jidUtilisateur,
        numero,
        nomUtilisateur,
        nomGroupe
    };
}


//gestion des logs colores
const logOriginal = console.log;
const erreurOriginale = console.error;
const couleurs = { vert: '\x1b[32m', rouge: '\x1b[31m', reset: '\x1b[0m' };
const formaterMessage = (parametres) => parametres.map(param => (typeof param === 'object' && param !== null) ? util.inspect(param, { colors: false, depth: null }) : param).join(' ');
console.log = (...parametres) => logOriginal(`${couleurs.vert}${formaterMessage(parametres)}${couleurs.reset}`);
console.error = (...parametres) => erreurOriginale(`${couleurs.rouge}${formaterMessage(parametres)}${couleurs.reset}`);


//initialisation des chemins de memoires
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cheminMemoires = path.join(__dirname, "memoires");
const cheminMemoiresCommandes = path.join(cheminMemoires, "memoires_commandes");
const cheminMemoiresSessions = path.join(cheminMemoires, "memoires_sessions");
const cheminMemoiresOutils = path.join(cheminMemoires, "memoires_outils");
fs.mkdirSync(cheminMemoiresCommandes, { recursive: true });
fs.mkdirSync(cheminMemoiresSessions, { recursive: true });
fs.mkdirSync(cheminMemoiresOutils, { recursive: true });

//prefixe du bot
const PREFIXE = ".";


//chemin des commandes
const poserQuestion = (texte) => new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(`${couleurs.vert}${texte}${couleurs.reset}`, (reponse) => { rl.close(); resolve(reponse); }); });
const chargerCommande = (nomCommande) => { const chemin = path.join(__dirname, "commandes", `${nomCommande}.js`); return fs.existsSync(chemin) ? import(chemin) : null; };

//SYSTÈME D'OUTILS (NOUVEAU)
const chargerOutil = (nomOutil) => { const chemin = path.join(__dirname, "outils", `${nomOutil}.js`); return fs.existsSync(chemin) ? import(`${chemin}?update=${Date.now()}`) : null; };
const outilsCharges = [];

//fuction pour les outils
async function dispatcherEvenements(nomEvenement, donneesEvenement, sock, nomSession) {
    for (const outil of outilsCharges) {
        const module = outil.default;
        if (module.evenements && (module.evenements === nomEvenement || (Array.isArray(module.evenements) && module.evenements.includes(nomEvenement)))) {
            try {
                const resultat = await module.execute(nomEvenement, donneesEvenement, { sock, nomSession, prefixe: PREFIXE });
                if (resultat === 'STOP') return 'STOP';
            } catch (erreur) {
                console.error(`[(Mugen Bot♾️♾️))]; Erreur dans l'outil "${module.nom || 'inconnu'}" sur l'événement "${nomEvenement}":`, erreur);
            }
        }
    }
}


//chargement des outils
async function chargerLesOutils() {
    try {
        const cheminDossierOutils = path.join(__dirname, "outils");
        if (fs.existsSync(cheminDossierOutils)) {
            const fichiersOutils = fs.readdirSync(cheminDossierOutils).filter(f => f.endsWith('.js'));
            outilsCharges.length = 0; //vider la liste avant de recharger
            for (const fichier of fichiersOutils) {
                const nomOutil = path.parse(fichier).name;
                const moduleOutil = await chargerOutil(nomOutil);
                if (moduleOutil) {
                    outilsCharges.push(moduleOutil);
                    console.log(`[(Mugen Bot♾️♾️ )]; Outil "${moduleOutil.default.nom || nomOutil}" chargé.`);
                }
            }
        }
    } catch (erreur) {
        console.error(`[(Mugen Bot♾️♾️ )]; Erreur lors du chargement des outils:`, erreur);
    }
}
chargerLesOutils();


//fonction pour envoyer et retirer des reaction
async function envoyerReactionFinale(sock, jid, cleMessage, emoji) {
    await sock.sendMessage(jid, {
        react: { text: emoji, key: cleMessage }
    });
    setTimeout(() => {
        try {
            sock.sendMessage(jid, { react: { text: "", key: cleMessage } });
        } catch (e) {}
    }, 30000); //secondes
}


       //logique du bot : chargement des commandes et initialisation des sessions
async function demarrerBot(nomSession = "mugen") {

    try {
        const cheminDossierCommandes = path.join(__dirname, "commandes");
        const fichiersCommandes = fs.readdirSync(cheminDossierCommandes).filter(fichier => fichier.endsWith('.js') && !fichier.endsWith('_db.js'));

        for (const fichier of fichiersCommandes) {
            const nomCommande = path.parse(fichier).name;
            // : creation des dossiers memoires pour chaque commande
            const cheminDossierSessionDansCommande = path.join(cheminMemoiresCommandes, nomCommande, nomSession);
            fs.mkdirSync(cheminDossierSessionDansCommande, { recursive: true });
        }

        // : creation des dossiers memoires pour chaque outil
        const cheminDossierOutils = path.join(__dirname, "outils");
        if (fs.existsSync(cheminDossierOutils)) {
            const fichiersOutils = fs.readdirSync(cheminDossierOutils).filter(f => f.endsWith('.js'));
            for (const fichier of fichiersOutils) {
                const nomOutil = path.parse(fichier).name;
                const cheminDossierSessionDansOutil = path.join(cheminMemoiresOutils, nomOutil, nomSession,);
                fs.mkdirSync(cheminDossierSessionDansOutil, { recursive: true });
            }
        }
        console.log(`[(Mugen Bot♾️♾️ )]; Dossiers de mémoire pour la session "${nomSession}" vérifié`);
    } catch (erreur) {
        console.error(`[(Mugen Bot♾️♾️ )]; Erreur lors de la création des dossiers de mémoire pour "${nomSession}":`, erreur);
    }
    // : chargement des sessions si les fichiers authentification existe
    const cheminAuth = path.join(__dirname, ".secret/.auth", nomSession);
    const { state, saveCreds } = await useMultiFileAuthState(cheminAuth);
    const { version } = await fetchLatestBaileysVersion();
    // : creation du socket
    const sock = makeWASocket({
    //logger: pino({ level: 'silent' }),
	version,
	auth: state,
	browser: ["Ubuntu", "Chrome"],
	syncFullHistory: true,
	markOnlineOnConnect : false ,
	generateHighQualityLinkPreview : false ,
	retryRequestDelayMs : 500 ,
	maxMsgRetryCount : 5 ,
	});
    // : si les fichiers authentification existe pas on pose des questions sur la methode de de connexion
    let isPairingCodeChosen = false;
    if (!state.creds.registered) {
        const choix = await poserQuestion(`Authentification pour ${nomSession}
1: QR Code
2: Code de pairage\n\t:`);
        // : si code de pair est choisi comme methode
        if (choix.trim() === '2') {
            isPairingCodeChosen = true;
            const numeroTelephone = await poserQuestion(`Numéro de téléphone pour ${nomSession} (ex: 56931437983: `);
            const code = await sock.requestPairingCode(numeroTelephone);
            console.log(`\nVoilà le code: ${code}\n`);
        }
    }
    // : si qr code est choisi ou que le choix fait est pas dans la liste
    sock.ev.on("connection.update", async (miseAJour) => {
        if (await dispatcherEvenements("connection.update", miseAJour, sock, nomSession) === 'STOP') return;
        const { connection, lastDisconnect, qr } = miseAJour;
        if (qr && !isPairingCodeChosen) {
            qrcode.generate(qr, { small: true });
        }
        if (connection === "close") {
            const devraitReconnecter = lastDisconnect?.error?.output?.statusCode !== 401;
            if (devraitReconnecter) demarrerBot(nomSession);
        } else if (connection === "open") {
            console.log(`"${nomSession}" connecté`);
        }
    });

    //detection des evenements
    sock.ev.on("creds.update", async (creds) => {
        if (await dispatcherEvenements("creds.update", creds, sock, nomSession) === 'STOP') return;
        await saveCreds();
    });

    sock.ev.on("group-participants.update", async (donnees) => {
        if (await dispatcherEvenements("group-participants.update", donnees, sock, nomSession) === 'STOP') return;
    });

    sock.ev.on("messages.upsert", async (donnees) => {
        if (await dispatcherEvenements("messages.upsert", donnees, sock, nomSession) === 'STOP') return;

        const { messages, type } = donnees;
        const message = messages[0];

        if (!message.message) return;

        const texte = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption;
        // : si dans la fouille des evenements on trouve des messages avec le prefixe on le capture
        if (texte && texte.startsWith(PREFIXE)) {

		const infos = await obtenirInfosExpediteur(sock, message);

                // appelle au commandes : analyse des evenements qui contiennent le prefixe et appelle a la commande en question
                const [nomCommande, ...args] = texte.slice(PREFIXE.length).trim().split(/\s+/);
                const moduleCommande = await chargerCommande(nomCommande);

                // : en attente que la commande repond on envoie une réaction
                if (moduleCommande?.default?.execute) {
                    try {
                        await sock.sendMessage(message.key.remoteJid, { react: { text: "♾️", key: message.key } });
			    let log = `Commande/outil ${nomCommande} demandé depuis ${nomSession} par ${infos.nomUtilisateur} (${infos.numero})`;

				if (infos.nomGroupe) {
				    log += ` dans le groupe "${infos.nomGroupe}"`;
			  	}
				console.log(log);

                        // : si la commande nous revois NO_REACTION on envoi pas de reaction apres la commande
                        const resultat = await moduleCommande.default.execute({ sock, message, args, nomSession });
                        if (resultat !== 'NO_REACTION') {
                            // : mais si non on envoie la reaction
                            await envoyerReactionFinale(sock, message.key.remoteJid, message.key, "✅");
                            let logSucces = `Commande/outils ${nomCommande} éxecuté depuis ${nomSession} par ${infos.nomUtilisateur} (${infos.numero})`;
                            if (infos.nomGroupe) logSucces += ` dans le groupe "${infos.nomGroupe}"`;
                            console.log(logSucces);
                        }
                    } catch (erreur) {
                        console.error(`Erreur lors de l'exécution de la commande "${nomCommande}":`, erreur);
                        // : mais si la commande a eu un problème dans son execution on envoie cette rection et de même que l'autre il est soumis à NO_REACTION
                        await envoyerReactionFinale(sock, message.key.remoteJid, message.key, "❌");
                        let logErreur = `Commande/outil ${nomCommande} échoué depuis ${nomSession} par ${infos.nomUtilisateur} (${infos.numero})`;
                        if (infos.nomGroupe) logErreur += ` dans le groupe "${infos.nomGroupe}"`;
                        console.error(logErreur);
                    }
                } else {


                    // si au moment ou on essaie de joindre la commande on le trouve pas : on envoie cette reaction
                    await envoyerReactionFinale(sock, message.key.remoteJid, message.key, "❓");
                    let logInconnu = `Commande/outil ${nomCommande} inconnu depuis ${nomSession} par ${infos.nomUtilisateur} (${infos.numero})`;
                    if (infos.nomGroupe) logInconnu += ` dans le groupe "${infos.nomGroupe}"`;
                    console.error(logInconnu);

                    // : et ce message d'erreur
                    await sock.sendMessage(message.key.remoteJid, { text: `𒁂Commande ou outil inconnue ".${nomCommande}"𒁂` }, { quoted: message });
                }
            } else {

                // fonction et appelle des commandes sans besoin du evenement aillant le prefixe il est à la disposition de tous les commandes
                const cheminDossierCommandes = path.join(__dirname, "commandes");
                const fichiersCommandes = fs.readdirSync(cheminDossierCommandes).filter(f => f.endsWith('.js') && !f.endsWith('_db.js'));

                for (const fichier of fichiersCommandes) {
                    const nomCommande = path.parse(fichier).name;
                    const moduleCommande = await chargerCommande(nomCommande);
                    if (moduleCommande?.default?.handleNonCommand) {
                        try {
                            const messageGere = await moduleCommande.default.handleNonCommand({ sock, message, nomSession });
                            if (messageGere) break;
                        } catch (erreur) {
                            console.error(`Erreur dans handleNonCommand pour ${nomCommande}:`, erreur);
                        }
                    }
                }
            }
    });
}

//recherche des session à lancer dans "session.js"
const chargerSessions = () => {
    const cheminSessions = path.join(__dirname, "session.js");

    //si le fichier n'existe pas, on lance la session par défaut
    if (!fs.existsSync(cheminSessions)) {
        demarrerBot();
        return;
    }

    try {
        const contenuRaw = fs.readFileSync(cheminSessions, "utf8");

        //si le fichier est vide, on lance la session par défaut
        if (!contenuRaw.trim()) {
            demarrerBot();
            return;
        }

        //sinon, on cherche les appels actifs (non commentés)
        // On retire d'abord les blocs /* ... */
        let contenuNettoye = contenuRaw.replace(/\/\*[\s\S]*?\*\//g, "");
        const lignes = contenuNettoye.split("\n");

        for (let ligne of lignes) {
            //on ignore ce qui est après //
            const instruction = ligne.split("//")[0].trim();
            const match = instruction.match(/demarrerBot\s*\(\s*["']([^"']+)["']\s*\)/);

            if (match && match[1]) {
                demarrerBot(match[1]);
            }
        }
    } catch (erreur) {
        console.error("[(Mugen Bot♾️♾️ )]; Erreur lors de la lecture de session.js :", erreur);
    }
};

// Lancement automatique
chargerSessions();

