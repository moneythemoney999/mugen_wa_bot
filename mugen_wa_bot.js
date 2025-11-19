// Importation des modules nécessaires
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Préfixe pour les commandes
const PREFIX = '.';

// Fonction pour charger une commande depuis le dossier "commande"
function chargerCommande(nomCommande) {
	const cheminCommande = path.join(__dirname, 'commande', nomCommande + '.js');
	if (fs.existsSync(cheminCommande)) {
		return require(cheminCommande);
	}
	return null;
}

// Fonction principale du bot
async function demarrerBot(sessionName = 'auth') {
	// Préparer le dossier d'auth pour cette session
	const authPath = path.join(__dirname, 'auth', sessionName);
	// Ne crée le dossier que si l'authentification n'existe pas déjà
	if (!fs.existsSync(authPath)) {
		// On vérifie s'il existe déjà des fichiers d'authentification
		// (Baileys les créera si besoin lors du scan QR)
		// Donc on ne crée rien ici, on laisse Baileys gérer
	}

	// Authentification multi-fichiers (par session)
	const { state, saveCreds } = await useMultiFileAuthState(authPath);
	const { version, isLatest } = await fetchLatestBaileysVersion();

	// Création de la socket WhatsApp
	const sock = makeWASocket({
		version,
		auth: state,
	});

	// Gestion de la connexion et affichage du QR code
	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect, qr } = update;
		
		// Affichage du QR code
		if (qr) {
			qrcode.generate(qr, { small: true });
		}
		
		// État de la connexion
		if (connection === 'close') {
			const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
			if (shouldReconnect) {
				demarrerBot(sessionName);
			}
		} else if (connection === 'open') {
			console.log('✅ Bot connecté avec succès !');
		}

	// Sauvegarde des identifiants à chaque changement
	sock.ev.on('creds.update', saveCreds);

	// Événement de réception de message
	sock.ev.on('messages.upsert', async ({ messages, type }) => {
		if (type !== 'notify') return;
		for (const message of messages) {
			// Vérification que le message est textuel et non envoyé par le bot
			if (!message.message || message.key.fromMe) continue;
			const texte = message.message.conversation || message.message.extendedTextMessage?.text;
			if (!texte || !texte.startsWith(PREFIX)) continue;

			// Extraction du nom de la commande et des arguments
			const [nomCommande, ...args] = texte.slice(PREFIX.length).trim().split(/\s+/);
			const commande = chargerCommande(nomCommande);

			if (commande && typeof commande.execute === 'function') {
				// Exécution de la commande
				await commande.execute({
					sock,
					message,
					args,
				});
			} else {
				// Commande inconnue
				await sock.sendMessage(message.key.remoteJid, {
					text: `𒁂Commande inconnue t'as tapé "${texte}" c'est quoi ce machin ?𒁂`,
				}, { quoted: message });
			}
		}
	});
}

// Appels explicites : tu choisis ici quelles sessions démarrer
demarrerBot('mugen');
// Ajoute ou retire les lignes ci-dessus selon les sessions à activer