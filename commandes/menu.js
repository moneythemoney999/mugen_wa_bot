/* */

//imports
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { traduire } from '../outils/langue.js';

//récupérer la version du bot depuis package.json
const chemin_package_json = path.resolve('./package.json');
const pkg = JSON.parse(await fs.readFile(chemin_package_json, 'utf8'));

//pour nom_dossier en ES modules
const nom_fichier = fileURLToPath(import.meta.url);
const nom_dossier = path.dirname(nom_fichier);
const lien_chemin = (chemin) => pathToFileURL(chemin).href;

//fonction pour mettre à jour l'image  de profil en arrière-plan
async function mettre_a_jour_image(connexion, nom_session) {
	const chemin_dossier_session = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session);
	const chemin_image = path.join(chemin_dossier_session, 'image_profil.jpg');
	try {
		const lien_image = await connexion.profilePictureUrl(connexion.user.id, 'image');
		const reponse = await fetch(lien_image);
		if (!reponse.ok) {
			//s'il y'a eu un problème
			throw new Error(`[(menu), "${nom_session}"]: La requête de recupération de l'image  profil a échoué avec le statut : ${reponse.status}`);
		}
		const tampon_image = Buffer.from(await reponse.arrayBuffer());
		await fs.mkdir(chemin_dossier_session, { recursive: true });
		await fs.writeFile(chemin_image, tampon_image);
	} catch (erreur) {
		console.error(erreur.message || erreur);
		try {
			if (await fs.access(chemin_image).then(() => true).catch(() => false)) {
				await fs.unlink(chemin_image);
			}
		} catch (erreur_suppression) {
			//si la supression echoue
			console.error(`[(menu), "${nom_session}"]: Erreur lors de la suppression de l'ancienne image  de profil pour ${nom_session}:`, erreur_suppression);
		}
	}
}

//logique de la commande
export default {
	nom: 'menu',
	description: "Affiche le menu du bot.",
	categorie: 'Groupes && Privé',
	infos: `*Pour connaître toutes les commandes/outils existantes de Mugen♾️♾️*.
La commande a ausssi trois arguments:
		\`.menu commandes\` : *Pour affiche seulment les commandes sans ~les outils~*
		\`.menu outils\` : *Pour les outils sans ~les commandes~*
		\`.menu image \` : *Pour changer l'image de fond de la commande.*`,
	execute: async ({ connexion, message, args, nom_session }) => {
		const dossier_commandes = nom_dossier;
		const dossier_outils = path.join(nom_dossier, '..', 'outils');
		const argument = args[0]?.toLowerCase();
		const memoire_commande_menu = path.join(nom_dossier, '..', 'memoires', 'memoires_commandes', 'menu', nom_session);
		const chemin_config_image = path.join(memoire_commande_menu, 'config_image.json');
		//"Raccourci" de traduction importer depui le fichier outils/langue.js
		const trad = async (cle, variables = {}) => (await traduire(nom_session, 'commandes', 'menu', { [cle]: variables }))[cle];
		//pour traduire et bien faire en sorte que les commandes ou outils sans catégories aparraisse toujours à la fin
		const categorie_autres = await trad('msg.categorie_autres') || 'Autres';

		//gestion de la sous-commande "image"
		if (argument === 'image') {
			//vérification si l'expéditeur est le bot lui-même
			const est_moi = message.key.fromMe || message.key.remoteJid.endsWith("@newsletter");
			if (!est_moi) {
				const message_permis = await trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
				return connexion.sendMessage(message.key.remoteJid, { text: message_permis }, { quoted: message });
			}
			await fs.mkdir(memoire_commande_menu, { recursive: true });
			let config = [{ "mon_profil": "vrai" }];
			if (await fs.access(chemin_config_image).then(() => true).catch(() => false)) {
				try {
					config = JSON.parse(await fs.readFile(chemin_config_image, 'utf8'));
				} catch (e) {
					config = [{ "mon_profil": "vrai" }];
				}
			}
			//basculement de la valeur
			config[0].mon_profil = config[0].mon_profil === "vrai" ? "faux" : "vrai";
			await fs.writeFile(chemin_config_image, JSON.stringify(config, null, 1));
			const statut = config[0].mon_profil === "vrai" ? (await trad('msg.statut_mon_profil') || "mon profil") : (await trad('msg.statut_profil_chat') || "profil du chat")
				const message_succes = await trad('msg.image_changer', {statut: statut }) || `𑁍Photo de fond changée en *${statut}*᪥.`
					return connexion.sendMessage(message.key.remoteJid, { text: message_succes },
		{ quoted: message });
		}
		const categorie_commandes = {};
		const categorie_outils = {};
		//charger les Commandes
		const fichiers_commandes = (await fs.readdir(dossier_commandes)).filter(f => f.endsWith('.js'));
		for (const fichier of fichiers_commandes) {
			try {
				const module = await import(lien_chemin(path.join(dossier_commandes, fichier)));
				let commande = { ...module.default }; //on clone pour ne pas polluer l'original en cache
				if (!commande || !commande.nom) continue;
				//traduction des métadonnées de la commande
				const traduction = await traduire(nom_session, 'commandes', commande.nom, {
					'meta.nom': {},
					'meta.description': {},
					'meta.categorie': {}
				});
				if (traduction['meta.nom']) commande.nom = traduction['meta.nom'];
				if (traduction['meta.description']) commande.description = traduction['meta.description'];
				if (traduction['meta.categorie']) commande.categorie = traduction['meta.categorie'];
				const categorie = commande.categorie || categorie_autres;
				if (!categorie_commandes[categorie]) categorie_commandes[categorie] = [];
				categorie_commandes[categorie].push(commande);
			} catch (err) {
				console.error(`[(menu, "${nom_session}")]: Erreur en chargeant la commande ${fichier}:`, err);
			}
		}
		//charger les Outils
		if (await fs.access(dossier_outils).then(() => true).catch(() => false)) {
			const fichiers_outils = (await fs.readdir(dossier_outils)).filter(f => f.endsWith('.js'));
			for (const fichier of fichiers_outils) {
				try {
					const module = await import(lien_chemin(path.join(dossier_outils, fichier)));
					let outil = { ...module.default };
					if (!outil || !outil.nom) continue;
					const vrai = "vrai";
					if (outil.affiche_menu !== vrai) continue;
					//traduction des métadonnées de l'outil
					const traduction = await traduire(nom_session, 'outils', outil.nom, {
						'meta.nom': {},
						'meta.description': {},
						'meta.categorie': {}
					});
					if (traduction['meta.nom']) outil.nom = traduction['meta.nom'];
					if (traduction['meta.description']) outil.description = traduction['meta.description'];
					if (traduction['meta.categorie']) outil.categorie = traduction['meta.categorie'];
					const categorie = outil.categorie || categorie_autres;
					if (!categorie_outils[categorie]) categorie_outils[categorie] = [];
					categorie_outils[categorie].push(outil);
				} catch (err) {
					console.error(`[(menu), "${nom_session}"]: Erreur en chargeant l'outil ${fichier}:`, err);
				}
			}
		}
		//construction du message à mettre en legende
			let texte_menu = `┏╋━━━━━━━━━━━━◥◣◆◢◤━━━━━━━━━━━━╋┓
> 𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭					『 Mugen♾️♾️ Bot v${pkg.version} 』`;
		//1- section Commandes
		if (!argument || argument === "commandes" || argument === "commande") {
			const titre_commandes = await trad('msg.titre_commandes') || "『 📋VOILÀ LES COMMANDES📜 』";
			texte_menu += `\n\n   ╔════════❀═══◄••❀••►═══❀════════╗
		𓅓 ${titre_commandes} 𓅓
   ╚════════❀═══◄••❀••►═══❀════════╝
┏`;
			let categories_commande = Object.keys(categorie_commandes).filter(c => c !== categorie_autres).sort().concat(categorie_commandes[categorie_autres] ? [categorie_autres] : []);
			categories_commande.forEach((categorie, debut_categorie) => {
				texte_menu += `\n\n> ☰📁 ${categorie}`;
				const commandes = categorie_commandes[categorie];
				commandes.forEach((commande, i) => {
					texte_menu += `\n┣ .${commande.nom}\n┃ ➪ ${commande.description}`;
					if (i < commandes.length - 1) {
						texte_menu += `\n⥱\n⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋`;
					}
				});
				if (debut_categorie < categories_commande.length - 1) {
					texte_menu += `\n━━━━━══━━━━━ • ✧ • ⚝ • ✧ • ━━━━━══━━━━━`;
				}
			});
		}
		//2- section Outils
		let categories_outils = Object.keys(categorie_outils).filter(c => c !== categorie_autres).sort().concat(categorie_outils[categorie_autres] ? [categorie_autres] : []);
		if (categories_outils.length > 0 && (!argument || argument === "outils" || argument === "outil")) {
			//si on affiche les deux, on met le séparateur de section
			if (!argument) {
				texte_menu += `\n\n> ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀`;
			}
			const tritre_outils = await trad('msg.titre_outils') || "『 🛠️VOILÀ LES OUTILS⚙️ 』";
			texte_menu += `\n\n   ╔════════❀═══◄••❀••►═══❀════════╗
			𓅓 ${tritre_outils} 𓅓
   ╚════════❀═══◄••❀••►═══❀════════╝`;

			categories_outils.forEach((categorie, debut_categorie) => {
				texte_menu += `\n> ❏⚙️ ${categorie}`;
				const outils = categorie_outils[categorie];
				outils.forEach((outil, i) => {
					texte_menu += `\n┣ .${outil.nom}\n┃ ➪ ${outil.description}`;
					if (i < outils.length - 1) {
						texte_menu += `⥱\n⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋`;
					}
				});
				if (debut_categorie < categories_outils.length - 1) {
					texte_menu += `\n━━━━━══━━━━━ • ✧ • ⚝ • ✧ • ━━━━━══━━━━━`;
				}
			});
		}
		texte_menu += `\n┗╋━━━━━━━━━━━━◥◣◆◢◤━━━━━━━━━━━━╋┛`;
		//lecture de la configuration image
		let mon_profil = "vrai";
		if (await fs.access(chemin_config_image).then(() => true).catch(() => false)) {
			try {
				const config = JSON.parse(await fs.readFile(chemin_config_image, 'utf8'));
				mon_profil = config[0].mon_profil;
			} catch (e) {
				mon_profil = "vrai";
			}
		}
		if (mon_profil === "vrai") {
			const chemin_image = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session, 'image_profil.jpg');
			try {
				if (await fs.access(chemin_image).then(() => true).catch(() => false)) {
					const tampon = await fs.readFile(chemin_image);
					await connexion.sendMessage(message.key.remoteJid, { image: tampon, caption: texte_menu }, { quoted: message });
					mettre_a_jour_image(connexion, nom_session);
				} else {
					const lien_image = await connexion.profilePictureUrl(connexion.user.id, 'image');
					const reponse = await fetch(lien_image);
					const tampon_image = Buffer.from(await reponse.arrayBuffer());
					await fs.mkdir(path.dirname(chemin_image), { recursive: true });
					await fs.writeFile(chemin_image, tampon_image);
					await connexion.sendMessage(message.key.remoteJid, { image: tampon_image, caption: texte_menu }, { quoted: message });
				}
			} catch (e) {
				console.error(`[(menu, "${nom_session}")]: Erreur lors de l'envoi de l'image de profil :`, e.message);
				//envoi final du menu
				await connexion.sendMessage(message.key.remoteJid, { text: texte_menu }, { quoted: message });
			}
		} else {
			//utiliser l'image  de la discussion actuelle
			try {
				const lien_image = await connexion.profilePictureUrl(message.key.remoteJid, 'image');
				const reponse = await fetch(lien_image);
				if (!reponse.ok) throw new Error(`[(menu, "${nom_session}")]: Impossible de récupérer l'image `);
				const tampon_image = Buffer.from(await reponse.arrayBuffer());
				await connexion.sendMessage(message.key.remoteJid, { image: tampon_image, caption: texte_menu }, { quoted: message });
			} catch (e) {
				console.warn(`[(menu, "${nom_session}")]: Impossible de récupérer l'image  de discussion. Envoi en texte seul.`);
				//envoi en texte seul si pas d'image
				await connexion.sendMessage(message.key.remoteJid, { text: texte_menu }, { quoted: message });
			}
		}
	}
};