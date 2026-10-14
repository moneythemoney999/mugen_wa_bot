/* */

//imports necessaire
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { traduire } from '../outils/langue.js';

const nom_fichier = fileURLToPath(import.meta.url);
const nom_dossier = path.dirname(nom_fichier);

//recherche de la version dans package.json
const chemin_package_json = path.resolve('./package.json');
const pkg = JSON.parse(await fs.readFile(chemin_package_json, 'utf8'));

//fonction pour mettre à jour l'image de profil en arrière-plan
async function mettre_a_jour_image(connexion, nom_session) {
	const chemin_memoire_session = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session);
	const chemin_image = path.join(chemin_memoire_session, 'image_profil.jpg');

	try {
		const lien_image = await connexion.profilePictureUrl(connexion.user.id, 'image');
		const reponse = await fetch(lien_image);
		if (!reponse.ok) {
			throw new Error(`[(mugen), "${nom_session}"]: La requête de image de profil a échoué avec le statut : ${reponse.status}`);
		}
		const tampon_image = Buffer.from(await reponse.arrayBuffer());
		await fs.mkdir(chemin_memoire_session, { recursive: true });
		await fs.writeFile(chemin_image, tampon_image);
	} catch (erreur) {
		console.error(`[(mugen), "${nom_session}"]: Erreur lors de la mise à jour en arrière-plan de image pour ${nom_session}:`, erreur);
		//si la mise à jour échoue (ex: l'utilisateur n'a plus de image de profil), on supprime l'ancienne du cache.
		try {
			if (await fs.access(chemin_image).then(() => true).catch(() => false)) {
				await fs.unlink(chemin_image);
			}
		} catch (errSuppression) {
			console.error(`[(mugen), "${nom_session}"]: Erreur lors de la suppression de l'ancienne image de profil pour ${nom_session}:`, errSuppression);
		}
	}
}

//logique principale
export default {
	nom: 'mugen',
	description: "Lancer le bot",
	categorie: 'Groupes && Privé',
	infos: `> Sert plus ou moins à savoir si le bot est en ligne et aussi c'est en quelque sorte l'introd.
La commande a aussi un argument :
	\`.mugen image\` : *Pour changer image de fond de la commande.*`,

	execute: async ({ connexion, message, args, nom_session }) => {
		const memoire_commande_mugen = path.join(nom_dossier, '..', 'memoires', 'memoires_commandes', 'mugen', nom_session);
		const chemin_config_image = path.join(memoire_commande_mugen, 'config_image.json');

		//"Raccourci" de traduction importer depui le fichier outils/langue.js
			const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'mugen', { [cle]: vars }))[cle];

		// gestion de la sous-commande "image"
		if (args[0]?.toLowerCase() === 'image') {
			const est_moi = message.key.fromMe || message.key.remoteJid.endsWith("@newsletter");
			if (!message.key.fromMe) {
				const message_permis = await trad('msg.erreur_permis') || "⤫Tu peux pas l'executer⤫";
				return connexion.sendMessage(message.key.remoteJid, { text: message_permis }, { quoted: message });
			}

			await fs.mkdir(memoire_commande_mugen, { recursive: true });
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
			const statut = config[0].mon_profil === "vrai" ? (await trad('msg.statut_mon_profil') || "mon profil.") : (await trad('msg.statut_profil_chat') || "profil du chat.");
			const message_succes = await trad('msg.image_changer', { statut: statut }) || `𑁍Image de fond changée en *${statut}*᪥.`;
			return connexion.sendMessage(message.key.remoteJid, { text: message_succes }, { quoted: message });
		}
		const legende = await trad('msg.legende', { version: pkg.version }) || `> ╔❀══◄••❀••►══❀══❀══◄••❀••►══❀╗ 𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭𑲭              Mugen Bot♾️♾️ v${pkg.version} ╚❀══◄••❀••►══❀══❀══◄••❀••►══❀╝

⫸ Ici:
 > ⟁⃤ ♱ Mugen♾️♾️ Bot version v${pkg.version} ⟁⃤ ♱
⫸ Creer par:
 > Money Mugen♾️♾️

—͟͟͞͞Tappe \`.menu\`, \`.menu commandes\` ou \`.menu outils\` pour voir la liste des fonctionalités彡`;

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
					//le profil existe on l'envoie via { url } et on met à jour en arrière-plan
					await connexion.sendMessage(
						message.key.remoteJid,
						{
							image: { url: chemin_image },
							caption: legende
						},
						{ quoted: message }
					);
					//lancer la mise à jour sans attendre
					mettre_a_jour_image(connexion, nom_session);
				} else {
					//le profil n'existe pas on le télécharge, sauvegarde et envoie via { url }
					const lien_image = await connexion.profilePictureUrl(connexion.user.id, 'image');
					const reponse = await fetch(lien_image);
					const tampon_image = Buffer.from(await reponse.arrayBuffer());
					//assurer que le dossier existe avant d'écrire
					await fs.mkdir(path.dirname(chemin_image), { recursive: true });
					await fs.writeFile(chemin_image, tampon_image);
					await connexion.sendMessage(
						message.key.remoteJid,
						{
							image: { url: chemin_image },
							caption: legende
						},
						{ quoted: message }
					);
				}
			} catch (e) {
				//en cas d'erreur (ex: impossible de télécharger), envoyer le texte seul
				await connexion.sendMessage(
					message.key.remoteJid,
					{ text: legende },
					{ quoted: message }
				);
			}
		} else {
			//utiliser image du chat (enregistrée temporairement puis envoyée via { url })
			const chemin_profil_chat = path.join(memoire_commande_mugen, 'chat_profil.jpg');
			try {
				const lien_image = await connexion.profilePictureUrl(message.key.remoteJid, 'image');
				const reponse = await fetch(lien_image);
				if (!reponse.ok) throw new Error();
				const tampon_image = Buffer.from(await reponse.arrayBuffer());

				await fs.mkdir(memoire_commande_mugen, { recursive: true });
				await fs.writeFile(chemin_profil_chat, tampon_image);
				await connexion.sendMessage(
					message.key.remoteJid,
					{
						image: { url: chemin_profil_chat },
						caption: legende
					},
					{ quoted: message }
				);
			} catch (e) {
				await connexion.sendMessage(
					message.key.remoteJid,
					{ text: legende },
					{ quoted: message }
				);
			}
		}
	}
};
