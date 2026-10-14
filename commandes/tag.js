/* */

//imports
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { traduire } from '../outils/langue.js';

//configuration des LIMITES
const limite_utilisation = {
	bot: 50,
	admins: 7,
	membres: 5,
};

//pour nom_dossier en ES modules
const nom_fichier = fileURLToPath(import.meta.url);
const nom_dossier = path.dirname(nom_fichier);

//fonctions utilitaires et resolutions des identifiants
async function resoudre_jid(connexion, jid) {
	if (jid && jid.endsWith('@lid')) {
		try {
			const pn = await connexion.signalRepository.lidMapping.getPNForLID(jid);
			if (pn) return jidNormalizedUser(pn);
		} catch (e) {
			console.error(`[(tag)]: Erreur LID ${jid}:`, e);
		}
	}
	return jidNormalizedUser(jid);
}

//fonction pour mettre à jour l'image de profil en arriere-plan
async function mettre_a_jour_image(connexion, nom_session) {
	const chemin_memoire_session = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session);
	const chemin_image = path.join(chemin_memoire_session, 'image_profil.jpg');

	try {
		const lien_image = await connexion.profilePictureUrl(connexion.user.id, 'image');
		const reponse = await fetch(lien_image);
		if (!reponse.ok) {
			throw new Error(`[(tag), "${nom_session}"]: La requête a échoué avec le statut : ${reponse.status}`);
		}
		const tampon_image = Buffer.from(await reponse.arrayBuffer());
		await fs.mkdir(chemin_memoire_session, { recursive: true });
		await fs.writeFile(chemin_image, tampon_image);
	} catch (erreur) {
		try {
			if (await fs.access(chemin_image).then(() => true).catch(() => false)) {
				await fs.unlink(chemin_image);
			}
		} catch (errSuppression) {
			console.error(`[(tag), "${nom_session}"]: Erreur lors de la suppression de l'ancienne image de profil pour ${nom_session}:`, errSuppression);
		}
	}
}

//logique que le fichier principale va venir importer
export default {
	nom: "tag",
	description: "Tag tout le groupe",
	categorie: "Groupes",
	infos: `Permet de taguer les membres du groupe.
La commande a aussi un argument spécial :
	\`.tag image\` : *Pour changer l'image de fond de la commande.*`,

	execute: async ({ connexion, message, args, nom_session }) => {
		const jid = message.key.remoteJid;
		const est_groupe = jid.endsWith('@g.us');
		const memoire_commande_tag = path.join(nom_dossier, '..', 'memoires', 'memoires_commandes', 'tag', nom_session);
		const chemin_config_image = path.join(memoire_commande_tag, 'config_image.json');
		//"Raccourci" de traduction importer depui le fichier outils/langue.js
		const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'tag', { [cle]: vars }))[cle];
		const est_moi = message.key.fromMe || jid.endsWith("@newsletter");

		//gestion de la sous-commande "image"
		if (args[0]?.toLowerCase() === 'image' && args.length === 1) {
			//si ce n'est pas le bot, on envoie le message de refus et on s'arrête là (pas de tag)
			if (!est_moi) {
				const erreur_permis = await trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
				return connexion.sendMessage(jid, { text: erreur_permis }, { quoted: message });
			}
			await fs.mkdir(memoire_commande_tag, { recursive: true });
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
			const statut = config[0].mon_profil === "vrai" ? await trad('msg.statut_mon_profil') || "mon profil" : await trad('msg.statut_profil_chat') || "profil du chat";
			const profil_changer = await trad('msg.profil_changer', {statut: statut}) || `𑁍Image de fond changée en *${statut}*᪥.`;
			return connexion.sendMessage(jid, { text: profil_changer }, { quoted: message });
		}
		if (!est_groupe) {
			//s'il est executer en privé
			const erreur_discussion = await trad('msg.erreur_discussion') || "Cette commande fonctionne uniquement dans les groupes.";
			return await connexion.sendMessage(jid, { text: erreur_discussion }, { quoted: message });
		}

		//gestion des restrictions et limites
		const jid_expediteur_brut = message.key.participant;
		if (!jid_expediteur_brut) return;
		const jid_expediteur_resolu = await resoudre_jid(connexion, jid_expediteur_brut);

		//appel au meta-donnees du groupe
		let metadonnees_du_groupe;
		try {
			metadonnees_du_groupe = await connexion.groupMetadata(jid);
		} catch (e) {
			const erreur_infos_groupe = await trad('msg.erreur_infos_groupe') || "Erreur lors de la récupération des infos du groupe."
				return connexion.sendMessage(jid, { text: erreur_infos_groupe }, { quoted: message });
		}

		//preparration des chemins pour lecture et sauvegarde des données
		const dossier_limites = path.join(memoire_commande_tag, `${jid}`);
		await fs.mkdir(dossier_limites, { recursive: true });
		const dossier_limites_utilisateur = path.join(dossier_limites, `${jid_expediteur_resolu}.json`);
		let donnes_utilisateur = { nom: message.pushName, numero: jid_expediteur_resolu, limite: 0, date: '' };

		if (await fs.access(dossier_limites_utilisateur).then(() => true).catch(() => false)) {
			try {
				donnes_utilisateur = JSON.parse(await fs.readFile(dossier_limites_utilisateur, 'utf-8'));
			} catch (e) { /*gérer erreur de parsing si nécessaire*/ }
		}
		const date_actuelle = new Date().toISOString().split('T')[0];
		if (donnes_utilisateur.date !== date_actuelle) {
			donnes_utilisateur.limite = 0;
			donnes_utilisateur.date = date_actuelle;
		}
		donnes_utilisateur.nom = message.pushName;

		let limite = limite_utilisation.participants;
		if (est_moi) {
			limite = limite_utilisation.bot;
		} else {
			const membres = metadonnees_du_groupe.participants.find(p => p.id === jid_expediteur_resolu);
			if (membres?.admin === 'admin' || membres?.admin === 'superadmin') {
				limite = limite_utilisation.admins;
			}
		}

		//si quelqu'un atteint la limite on le bloque
		if (donnes_utilisateur.limite >= limite) {
			const message_limite = await trad('msg.message_limite', {donnees_limite
				: donnes_utilisateur.limite, limite: limite}
										) || `Tu as atteint ta limite d'utilisation pour aujourd'hui: ${donnes_utilisateur.limite}/${limite}.`
				return connexion.sendMessage(jid, { text: message_limite }, { quoted: message });
		}
		//fin de la gestion des limite limites

		const membres = metadonnees_du_groupe.participants;
		const mentions = membres.map(p => p.id);
		const auteur = message.key.participant || message.key.remoteJid;
		const tag_auteur = "@" + auteur.split("@")[0];
		//récupération du texte original pour préserver les sauts de ligne
		const texte_original = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption || "";
		//on retire la commande (.tag) et les espaces qui suivent pour garder le reste intact
		const texte_auteur = texte_original.replace(/^\.\w+\s*/, "").trim();
		let texte_final;

		if (texte_auteur.length > 0) {
			const modele_ligne = await trad('msg.format_ligne_tag', {ligne : '{ligne}' }) || `> {ligne}`;
			//applique le symbole "> " uniquement aux lignes qui contiennent du texte
			texte_final = texte_auteur.split('\n')
				.map(ligne => {
					if (!ligne.trim()) return "";
					return modele_ligne.replace('{ligne}', ligne.trim());
				})
				.join('\n');

			await connexion.sendMessage(jid, {
				text: texte_final,
				mentions
			}, { quoted: message });
		} else {
			//s'il y avait pas de texte derriere on prepare une mise en forme d'une liste
			const separation_apres = 5;
			const separateur = await trad('msg.separateur') || "──────────\n";
			let texte = await trad('msg.texte1', {auteur: tag_auteur}) || `╭──「Tag lancé par ${tag_auteur}」\n`;
			let compteur = 0;
			for (const p of membres) {
				const tag = "@" + p.id.split("@")[0];
				texte += await trad('msg.texte2', {tag: tag}) || `├─➩${tag}\n`;
				compteur++;
				if (compteur % separation_apres === 0) {
					texte += separateur;
				}
			}
			texte += await trad('msg.texte3') || `╰`;
			texte_final = texte;

			//lecture de la configuration image
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
						await connexion.sendMessage(jid, {
							image: tampon,
							caption: texte_final,
							mentions
						}, { quoted: message });
						mettre_a_jour_image(connexion, nom_session);
					} else {
						const lien_image = await connexion.profilePictureUrl(connexion.user.id, 'image');
						const reponse = await fetch(lien_image);
						const tampon_image = Buffer.from(await reponse.arrayBuffer());
						await fs.mkdir(path.dirname(chemin_image), { recursive: true });
						await fs.writeFile(chemin_image, tampon_image);

						await connexion.sendMessage(jid, {
							image: tampon_image,
							caption: texte_final,
							mentions
						}, { quoted: message });
					}
				} catch (e) {
					await connexion.sendMessage(jid, {
						text: texte_final,
						mentions
					}, { quoted: message });
				}
			} else {
				//utiliser l'image du groupe
				try {
					const lien_image = await connexion.profilePictureUrl(jid, 'image');
					const reponse = await fetch(lien_image);
					if (!reponse.ok) throw new Error();
					const tampon_image = Buffer.from(await reponse.arrayBuffer());
					await connexion.sendMessage(jid, {
						image: tampon_image,
						caption: texte_final,
						mentions
					}, { quoted: message });
				} catch (e) {
					await connexion.sendMessage(jid, {
						text: texte_final,
						mentions
					}, { quoted: message });
				}
			}
		}
		//mettre à jour le compteur et sauvegarder APRÈS l'exécution
		donnes_utilisateur.limite++;
		await fs.writeFile(dossier_limites_utilisateur, JSON.stringify(donnes_utilisateur, null, 2));
	}
};