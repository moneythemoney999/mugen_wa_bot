import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const nom_fichier = fileURLToPath(import.meta.url);
const nom_dossier = path.dirname(nom_fichier);
const normaliser = (chaine) => chaine.charAt(0).toUpperCase() + chaine.slice(1).toLowerCase();

export async function traduire(nom_session, type, nom, cles_demander) {
	const chemin_memoire_session = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session, 'langue.json');
	let code_langue = 'fr'; // Français par défaut

	// 1. on récupère la langue de la session
	if (await fs.access(chemin_memoire_session).then(() => true).catch(() => false)) {
		try {
			code_langue = JSON.parse(await fs.readFile(chemin_memoire_session, 'utf8')).langue;
		} catch (e) {}
	}
	// 2. on identifie le dossier de la langue via son code
	const dossier_langues = path.join(nom_dossier, '..', 'langues');
	if (!(await fs.access(dossier_langues).then(() => true).catch(() => false))) {
		await fs.mkdir(dossier_langues, { recursive: true });
	}

	const element_dossier_langues = await fs.readdir(dossier_langues, { withFileTypes: true });
	const liste_des_dossier = element_dossier_langues.filter(f => f.isDirectory()).map(f => f.name);
	let nom_dossier_langue = 'français'; // Dossier par défaut
	for (const dossier of liste_des_dossier) {
		const chemin_config = path.join(dossier_langues, dossier, `${dossier}.json`);
		if (await fs.access(chemin_config).then(() => true).catch(() => false)) {
			try {
				if (JSON.parse(await fs.readFile(chemin_config, 'utf8')).code === code_langue) {
					nom_dossier_langue = dossier;
					break;
				}
			} catch (e) {}
		}
	}

	// 3. chargement du fichier de traduction
	const chemin_traduction = path.join(dossier_langues, nom_dossier_langue, type, `${nom}.json`);
	let dictionnaire = { metadonnees: {}, messages: {} };
	let a_ete_modifier = false;

	if (await fs.access(chemin_traduction).then(() => true).catch(() => false)) {
		try {
			const contenu = await fs.readFile(chemin_traduction, 'utf8');
			if (contenu.trim()) dictionnaire = JSON.parse(contenu);
		} catch (e) {
			console.error(`[(Langage)]: Erreur de lecture de ${chemin_traduction}`);
		}
	} else {
		await fs.mkdir(path.dirname(chemin_traduction), { recursive: true });
		await fs.writeFile(chemin_traduction, JSON.stringify(dictionnaire, null, 1));
	}

	const resultats = {};
	const cles = Object.keys(cles_demander);
	const creuser = (obj, path) => path.reduce((acc, curr) => (acc && acc[curr] !== undefined) ? acc[curr] : undefined, obj);

	// 4. extraction et injection des variables
	cles.forEach(cle_brute => {
		const parties = cle_brute.split('.');
		let chemin = [...parties];
		let section = 'messages';
		let dictionnaire_est_specifier = false;
		// détection du préfixe de section (meta. ou msg.)
		const prefixe = parties[0].toLowerCase();
		if (['meta', 'metadonnees', 'metadonnee'].includes(prefixe)) {
			section = 'metadonnees';
			chemin = parties.slice(1);
			dictionnaire_est_specifier = true;
		} else if (['msg', 'm', 'messages', 'message'].includes(prefixe)) {
			section = 'messages';
			chemin = parties.slice(1);
			dictionnaire_est_specifier = true;
		}

		let texte = creuser(dictionnaire[section], chemin);
		// fallback intelligent : si pas trouvé dans la section spécifique, on cherche partout
		if (!texte || (typeof texte === 'string' && texte.trim() === "")) {
			const recherche_partout_msg = creuser(dictionnaire.messages, chemin);
			const recherche_partout_meta = creuser(dictionnaire.metadonnees, chemin);
			texte = recherche_partout_msg || recherche_partout_meta;
		}

		if (texte && typeof texte === 'string' && texte.trim() !== "") {
			const variables = cles_demander[cle_brute];
			if (typeof variables === 'object') {
				Object.keys(variables).forEach(v => {
					texte = texte.replace(new RegExp(`{${v}}`, 'g'), variables[v]);
				});
			}
			resultats[cle_brute] = texte;
		} else {
			// création automatique, récursive uniquement si demande explicite
			if (dictionnaire_est_specifier) {
				const existe_deja = creuser(dictionnaire.messages, chemin) !== undefined || creuser(dictionnaire.metadonnees, chemin) !== undefined;
				if (!existe_deja) {
					if (!dictionnaire[section]) dictionnaire[section] = {};
					let temporaire = dictionnaire[section];
					for (let indice = 0; indice < chemin.length - 1; indice++) {
						if (temporaire[chemin[indice]] === undefined || typeof temporaire[chemin[indice]] !== 'object') {
							temporaire[chemin[indice]] = {};
						}
						temporaire = temporaire[chemin[indice]];
					}
					temporaire[chemin[chemin.length - 1]] = "";
					a_ete_modifier = true;
				}
			}
			resultats[cle_brute] = null;
		}
	});

	if (a_ete_modifier) {
		await fs.writeFile(chemin_traduction, JSON.stringify(dictionnaire, null, 1));
	}

	return resultats;
}

export default {
	nom: 'langue',
	description: 'Changer la langue du bot',
	evenements: 'messages.upsert',
	categorie: 'Bot',
	infos: `Permet d'afficher et de changer la langue du bot l'utilisation est très simple il faut faire la commande puis le nom ou code de la langue ensuite ex: \`.langue ht\`.
*NB: Il ya certaines langues qui ne seront pas disponible dans le bot, si c'est le cas un message d'erreur sera plutôt afficher disant que la langue n'existe pas ou n'est pas disponible.

> Pour afficher les langues disponibles c'est simple il suffit de faire la commande sans argument de langue : \`.langue\`.*`,
	affiche_menu: 'vrai',

	execute: async (nom_evenements, donnees_evenements, { connexion, nom_session, prefixe }) => {
		const { messages } = donnees_evenements;
		const message = messages[0];
		if (!message.message) return;
		const texte = message.message.conversation ||
			message.message.extendedTextMessage?.text ||
			message.message.imageMessage?.caption ||
			message.message.videoMessage?.caption;

		if (!texte || !texte.startsWith(prefixe)) return;
		const [commande, ...arguments_] = texte.slice(prefixe.length).trim().split(/\s+/);
		if (commande.toLowerCase() !== 'langue') return;
		const trad = async (cle, variables = {}) => (await traduire(nom_session, 'outils', 'langue', { [cle]: variables }))[cle];

		if (!message.key.fromMe && !message.key.remoteJid?.endsWith('@newsletter')) {
			const pas_moi = (await trad('msg.pas_moi')) || "⊙```T'as pas l'autorisation necéssaire```";
			await connexion.sendMessage(message.key.remoteJid, { text: pas_moi }, { quoted: message });
			return 'ARRET';
		}

		const dossier_langues = path.join(nom_dossier, '..', 'langues');
		const chemin_memoire_session = path.join(nom_dossier, '..', 'memoires', 'memoires_sessions', nom_session, 'langue.json');
		const element_dossier_langues = await fs.readdir(dossier_langues, { withFileTypes: true });
		const liste_des_dossier = element_dossier_langues.filter(f => f.isDirectory()).map(f => f.name);
		const donnees_langue = [];
		for (const dossier of liste_des_dossier) {
			const chemin_donnees_langue = path.join(dossier_langues, dossier, `${dossier}.json`);
			if (await fs.access(chemin_donnees_langue).then(() => true).catch(() => false)) {
				try {
					const contenu = JSON.parse(await fs.readFile(chemin_donnees_langue, 'utf8'));
					donnees_langue.push({
						dossier,
						code: contenu.code,
						nom: contenu.nom || dossier
					});
				} catch (e) { continue; }
			}
		}

		if (!arguments_[0]) {
			let reponse = (await trad('msg.reponse.1')) || "> Voici les langues disponible :\n\n";
			for (const l of donnees_langue) {
				const variables_reponse_nom = (await trad(`msg.variables.variables_langues.${l.code}.nom`)) || normaliser(l.nom);
				const variables_reponse_code = (await trad(`msg.variables.variables_langues.${l.code}.code`)) || l.code;
				reponse += (await trad('msg.reponse.2', {
					nom: variables_reponse_nom,
					code: variables_reponse_code
				})) || `- ${normaliser(l.nom)} (\`${l.code}\`)\n`;
			}
			await connexion.sendMessage(message.key.remoteJid, { text: reponse }, { quoted: message });
			return 'ARRET';
		}

		const argument_choisi = arguments_[0].toLowerCase();
		const langue_cible = donnees_langue.find(l => l.dossier.toLowerCase() === argument_choisi || l.code.toLowerCase() === argument_choisi);
		if (!langue_cible) {
			const  langue_non_trouver = (await trad('msg.erreur.langue_non_trouver')) || "𒀰Langue indisponible ou inexistante𒀰";
			await connexion.sendMessage(message.key.remoteJid, { text: langue_non_trouver }, { quoted: message });
			return 'ARRET';
		}

		let ancien_code = 'fr';
		if (await fs.access(chemin_memoire_session).then(() => true).catch(() => false)) {
			try {
				ancien_code = JSON.parse(await fs.readFile(chemin_memoire_session, 'utf8')).langue;
			} catch (e) {}
		}

		const nouvelle_config = { langue: langue_cible.code };
		if (!(await fs.access(path.dirname(chemin_memoire_session)).then(() => true).catch(() => false))) await fs.mkdir(path.dirname(chemin_memoire_session), { recursive: true });
		await fs.writeFile(chemin_memoire_session, JSON.stringify(nouvelle_config, null, 1));
		const nom_ancienne_langue = (await trad(`msg.variables.variables_langues.${ancien_code}.nom`)) || normaliser(ancien_code);
		const nom_nouvelle_langue = (await trad(`msg.variables.variables_langues.${langue_cible.code}.nom`)) || normaliser(langue_cible.nom);
		const succes_change_langue = (await trad('msg.succes.change_langue', {
			ancienne: nom_ancienne_langue,
			nouvelle: nom_nouvelle_langue
		})) || `🗘Langue changé de ${nom_ancienne_langue} ➜ ${nom_nouvelle_langue}✓`;
		await connexion.sendMessage(message.key.remoteJid, { text: succes_change_langue }, { quoted: message });
		return 'ARRET';
	}
};