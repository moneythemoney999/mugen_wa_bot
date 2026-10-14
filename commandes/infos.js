/* */

//imports necessaires
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { traduire } from '../outils/langue.js';

const nom_fichier = fileURLToPath(import.meta.url);
const nom_dossier = path.dirname(nom_fichier);
const chemin_lien = (chemin) => pathToFileURL(chemin).href;


async function mettre_a_jour_image(connexion, nom_session) {
	const chemin_dossier_session = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session);
	const chemin_image = path.join(chemin_dossier_session, 'image_profil.jpg');
	try {
		const lien_image = await connexion.profilePictureUrl(connexion.user.id, 'image');
		const reponse = await fetch(lien_image);
		if (!reponse.ok) {
			throw new Error(`[(infos), "${nom_session}"]: Erreur dans la requête de récuperation du profil avec le statut : ${reponse.status}`);
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
		} catch (erreur_supression) {
			console.error(`[(infos), "${nom_session}"]: Erreur lors de la supression de l'ancienne image de profil pour (${nom_session}):`, erreur_supression);
		}
	}
}

export default {
	nom: "infos",
	description: "Avoir plus d'infos sur les commandes que la p'tit description de `.menu`.",
	categorie: "Groupes && Privé",
	infos: `Pour l'utiliser il faut faire la commande + la fonctionnalité dont tu veux plus d'infos.
> Exemple : \`.infos infos\`

La commande a aussi un argument :
\`.infos image\` : *Pour changer l'image de fond de la commande.*`,

	execute: async ({ connexion, message, args, nom_session }) => {
		const memoire_commande_infos = path.join(nom_dossier, '..', 'memoires', 'memoires_commandes', 'infos', nom_session);
		const chemin_config_image = path.join(memoire_commande_infos, 'config_image.json');
		const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'infos', { [cle]: vars }))[cle];
		if (args[0]?.toLowerCase() === 'image') {
			const est_moi = message.key.fromMe || message.key.remoteJid.endsWith("@newsletter");
			if (!est_moi) {
				const message_permis = await trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
				return connexion.sendMessage(message.key.remoteJid, { text: message_permis}, { quoted: message });
			}
			await fs.mkdir(memoire_commande_infos, { recursive: true });
			let config = [{ "mon_profil": "vrai" }];
			if (await fs.access(chemin_config_image).then(() => true).catch(() => false)) {
				try {
					config = JSON.parse(await fs.readFile(chemin_config_image, 'utf8'));
				} catch (e) {
					config = [{ "mon_profil": "vrai" }];
				}
			}
			config[0].mon_profil = config[0].mon_profil === "vrai" ? "faux" : "vrai";
			await fs.writeFile(chemin_config_image, JSON.stringify(config, null, 1));
			const statut = config[0].mon_profil === "vrai" ? (await trad('msg.statut_mon_profil') || "mon profil") : (await trad('msg.statut_profil_chat') || "profil du chat");
			const message_succes = await trad('msg.image_changer', {statut: statut}) || `𑁍Image de fond changée en *${statut}*᪥.`;
			return connexion.sendMessage(message.key.remoteJid, { text: message_succes }, { quoted: message });
		}
		async function repondre_avec_image(texte) {
			let mon_profil = "vrai";
			if (await fs.access(chemin_config_image).then(() => true).catch(() => false)) {
				try {
					const config = JSON.parse(await fs.readFile(chemin_config_image, 'utf8'));
					mon_profil = config[0].mon_profil;
				} catch (e) { mon_profil = "vrai"; }
			}
			if (mon_profil === "vrai") {
				const chemin_image = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session, 'image_profil.jpg');
				try {
					if (await fs.access(chemin_image).then(() => true).catch(() => false)) {
						const tampon = await fs.readFile(chemin_image);
						await connexion.sendMessage(message.key.remoteJid, { image: tampon, caption: texte }, { quoted: message });
						mettre_a_jour_image(connexion, nom_session);
					} else {
						const lien_image = await connexion.profilePictureUrl(connexion.user.id, 'image');
						const reponse = await fetch(lien_image);
						const tampon_image = Buffer.from(await reponse.arrayBuffer());
						await fs.mkdir(path.dirname(chemin_image), { recursive: true });
						await fs.writeFile(chemin_image, tampon_image);
						await connexion.sendMessage(message.key.remoteJid, { image: tampon_image, caption: texte }, { quoted: message });
					}
				} catch (e) {
					await connexion.sendMessage(message.key.remoteJid, { text: texte }, { quoted: message });
				}
			} else {
				try {
					const lien_image = await connexion.profilePictureUrl(message.key.remoteJid, 'image');
					const reponse = await fetch(lien_image);
					const tampon_image = Buffer.from(await reponse.arrayBuffer());
					await connexion.sendMessage(message.key.remoteJid, { image: tampon_image, caption: texte }, { quoted: message });
				} catch (e) {
					await connexion.sendMessage(message.key.remoteJid, { text: texte }, { quoted: message });
				}
			}
		}
		if (!args[0]) {
			const texte_aide = await trad('msg.texte_aide') || `Sur quelle fonctionnalité souhaites-tu avoir plus d'infos?\n> Fais par exemple : \`.infos infos\``;
			await repondre_avec_image(texte_aide);
			return;
		}
		const nom_recherche = args[0].toLowerCase();
		let commandes_trouver = null;
		let outils_trouver = null;

		// 1. Recherche dans Commandes
		const fichiers_commandes = (await fs.readdir(nom_dossier)).filter(f => f.endsWith('.js'));
		for (const fichier of fichiers_commandes) {
			try {
				const module = await import(`${chemin_lien(path.join(nom_dossier, fichier))}?t=${Date.now()}`);
				if (module.default?.nom?.toLowerCase() === nom_recherche) {
					commandes_trouver = { ...module.default };
					break;
				}
			} catch (e) {}
		}

		// 2. Recherche dans Outils
		const chemin_outils = path.join(nom_dossier, '..', 'outils');
		if (await fs.access(chemin_outils).then(() => true).catch(() => false)) {
			const fichiers_outils = (await fs.readdir(chemin_outils)).filter(f => f.endsWith('.js'));
			for (const fichier of fichiers_outils) {
				try {
					const module = await import(`${chemin_lien(path.join(chemin_outils, fichier))}?t=${Date.now()}`);
					if (module.default?.nom?.toLowerCase() === nom_recherche) {
						outils_trouver = { ...module.default };
						break;
					}
				} catch (e) {}
			}
		}
		//fonction pour formater un bloc d'info
		const formater_bloque = async (objet, type) => {
			const traduction  = await traduire(nom_session, type, objet.nom, {
				'meta.nom': {},
				'meta.infos': {}
			});
			const nom_final = traduction ['meta.nom'] || objet.nom;
			const infos_final = traduction ['meta.infos'] || objet.infos || await trad('msg.aucune_infos') || "Aucune information disponible.";
			//détermination du type pour le titre
			const type_fonctionalite = type === 'commandes' ? (await trad('msg.type_commande') || "la commande") : (await trad('msg.type_outil') || "l'outil");
			//const titre = await trad('msg.titre_resultat', { nom: nom_final }) || `> Voici les infos de la commande ${nom_final}.`;
			const titre = await trad(`msg.titre_resultat_${type}`, { nom: nom_final }) ||
				await trad('msg.titre_resultat', { nom: nom_final, type: type_fonctionalite }) ||
				`> Voici les infos de ${type_fonctionalite} ${nom_final}.`;
			const nom_resultat = await trad('msg.nom_resultat') || "Nom";
			const infos_resultat = await trad('msg.infos_resultat') || "Infos";
			return `${titre}\n- ${nom_resultat} : *${nom_final}*\n\n- ${infos_resultat} : ${infos_final}`;
		};
		if (commandes_trouver && outils_trouver) {
			//CAS DOUBLE RESULTAT
			const bloque_commandes = await formater_bloque(commandes_trouver, 'commandes');
			const bloque_outils = await formater_bloque(outils_trouver, 'outils');
			const separateur = await trad('msg.separateur') || "\n\n⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜ ⃞⃝⃪⃜\n\n";
			await repondre_avec_image(`${bloque_commandes}${separateur}${bloque_outils}`);
		} else if (commandes_trouver || outils_trouver) {
			//CAS SIMPLE RESULTAT
			const objet = commandes_trouver || outils_trouver;
			const type = commandes_trouver ? 'commandes' : 'outils';
			await repondre_avec_image(await formater_bloque(objet, type));
		} else {
			//AUCUN RESULTAT
			const fonctionnalite_inexistante = await trad('msg.erreur_inexistance', { nom: nom_recherche }) || `La fonctionnalité ~${nom_recherche} n'existe pas.~ \n> Va lire \`.menu\` pour savoir les commandes.`;
			await repondre_avec_image(fonctionnalite_inexistante);
		}
	}
};