import fs from 'fs/promises';
import path from 'path';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import {traduire} from './langue.js'

//utilitaires de chemins

function obtenir_chemins(nom_session) {
	const dossier_de_base = path.join(process.cwd(), 'memoires', 'memoires_outils', 'mode', nom_session);
	return {
		dossier_de_base,
		priver: path.join(dossier_de_base, 'priver.json'),
		publique: path.join(dossier_de_base, 'publique.json'),
		tous: path.join(dossier_de_base, 'mode_tous.json')
	};
}

async function initialiser_dossier(dossier) {
	await fs.mkdir(dossier, { recursive: true });
}

async function lire_fichier(chemin, defaut) {
	try {
		const contenu = await fs.readFile(chemin, 'utf-8');
		return JSON.parse(contenu);
	} catch (e) {
		return defaut;
	}
}

async function sauvegarder_fichier(chemin, donnees) {
	await fs.writeFile(chemin, JSON.stringify(donnees, null, 2));
}

async function resoudre_jids(connexion, jid_brut) {
	if (jid_brut && jid_brut.endsWith('@lid')) {
		try {
			const pn = await connexion.signalRepository.lidMapping.getPNForLID(jid_brut);
			if (pn) return jidNormalizedUser(pn);
		} catch (e) {}
	}
	return jidNormalizedUser(jid_brut);
}

export default {
	nom: "mode",
	evenements: ["messages.upsert"],
	description: "Gestion du mode du bot",
	categorie: `Groupes && Privé`,
	affiche_menu: "vrai",
	infos: `Peut être utilisé en groupes ou privé pour mettre ce groupe, contact ou le bot en mode privé/publique. Pour mettre tout le bot en mode privé/publique, il faut utiliser l'argument \`tous\` après le mode que tu veux mettre, ex : \`.mode priver tous\`. Après cette commande, un message de confirmation apparaîtra disant que les paramètres ont été enregistrés. Pour les appliquer, il faut utiliser l'argument changer + le mode auquel tu veux passer, ex : \`.mode changer tous\``,

	execute: async (nom_evenement, donnees_evenement, { connexion, nom_session, prefixe }) => {

		const trad = async (cle, variables = {}) => (await traduire(nom_session, 'outils', 'mode', { [cle]: variables }))[cle];
		if (nom_evenement !== "messages.upsert") return;
		const { messages } = donnees_evenement;
		const message = messages[0];
		if (!message.message || message.key.remoteJid === 'status@broadcast') return;
		const discussion = message.key.remoteJid;
		const est_moi = message.key.fromMe || discussion.endsWith('@newsletter');
		const chemins = obtenir_chemins(nom_session);
		await initialiser_dossier(chemins.dossier_de_base);
		//charger les états avec le format spécifique [ { mode: "vrai/faux" }, { ... } ]
		let etat_priver = await lire_fichier(chemins.priver, [ { mode: "faux" }, { liste: [] } ]);
		let etat_publique = await lire_fichier(chemins.publique, [ { mode: "faux" }, { liste: [] } ]);
		let etat_tous = await lire_fichier(chemins.tous, [ { mode: "vrai" }, { mode_tous: "publique" } ]);
		const texte = message.message.conversation ||
			message.message.extendedTextMessage?.text ||
			message.message.imageMessage?.caption ||
			message.message.videoMessage?.caption;
		//traitement des commandes
		if (texte && texte.startsWith(prefixe)) {
			const [commandes_brute, ...args] = texte.slice(prefixe.length).trim().split(/\s+/);
			const commande = commandes_brute.toLowerCase();
			if (commande === "mode") {
				if (!est_moi) {
					const est_pas_moi = await trad('msg.est_pas_moi') || "```Tu ne peux pas utiliser cette commande.```";
					await connexion.sendMessage(discussion, { text: est_pas_moi }, { quoted: message });
					return 'ARRET';
				}

				//déterminer quel mode est actif pour l'affichage
				let mode_actuel = await trad("msg.mode_actuel.1") || "publique (tous)";
				if (etat_tous[0].mode === "vrai")
					mode_actuel = await trad("msg.mode_actuel.2", {
						etat: etat_tous[1].mode_tous
					}) || `${etat_tous[1].mode_tous} (tous)`;
				else if (etat_priver[0].mode === "vrai") mode_actuel = await trad("msg.mode_actuel.3") || "priver (liste)";
				else if (etat_publique[0].mode === "vrai") mode_actuel = await trad("msg.mode_actuel.4") || "publique (liste)";

				const argument1 = args[0]?.toLowerCase();
				const argument2 = args[1]?.toLowerCase();
				// .mode simple ou argument inconnu
				if (!argument1 || (argument1 !== "priver" && argument1 !== "publique" && argument1 !== "changer")) {
					let texte = "";
					if (argument1) texte += await trad("msg.texte.1") || "```Argument(s) inconnu(s).```\n";
					texte += await trad("msg.texte.2", {
						mode: mode_actuel
					}) || `> Mode : *${mode_actuel}*

Arguments:
-    \`.mode priver\` pour mettre la discussion actuelle en mode privé.
-    \`.mode publique\` pour faire l'inverse.
-    \`.mode {priver/publique} tous\` pour mettre toutes les discussions soit en privé ou publique.
-    \`.mode changer {publique/priver/tous}\` pour changerr la configuration des modes`;
					await connexion.sendMessage(discussion, { text: texte }, { quoted: message });
					return 'ARRET';
				}

				//résoudre le nom de la discussion pour les confirmatios
				let nom_discussion = await trad("msg.nom_discussion.1") || "Cette discussion";
				let mentions = [];
				try {
					if (discussion.endsWith('@g.us')) {
						const groupe_metadonnees = await connexion.groupMetadata(discussion);
						nom_discussion = await trad("msg.nom_discussion.2", {
							nom_discussion: groupe_metadonnees.subject
						}) || groupe_metadonnees.subject;
					} else {
						const jid_normaliser = await resoudre_jids(connexion, discussion);
						nom_discussion = await trad("msg.nom_discussion.3", {
							nom_discussion: jid_normaliser.split('@')[0]
						}) || `@${jid_normaliser.split('@')[0]}`;
						mentions = [jid_normaliser];
					}
				} catch (e) {
					nom_discussion = discussion.split('@')[0];
				}
				const parametre_enregistre = await trad("msg.reussite.parametre_enregistre") || "_Paramètre enregistré_";

				// .mode priver [tous]
				if (argument1 === "priver") {
					if (argument2 === "tous") {
						etat_tous[1].mode_tous = "priver";
						await sauvegarder_fichier(chemins.tous, etat_tous);
						await connexion.sendMessage(discussion, { text: parametre_enregistre }, { quoted: message });
					} else {
						const jid_normaliser = await resoudre_jids(connexion, discussion);
						//retirer de la liste publique s'il y est et ajouter à la liste privée
						etat_publique[1].liste = etat_publique[1].liste.filter(id => id !== jid_normaliser);
						if (!etat_priver[1].liste.includes(jid_normaliser)) {
							etat_priver[1].liste.push(jid_normaliser);
						}
						await sauvegarder_fichier(chemins.priver, etat_priver);
						await sauvegarder_fichier(chemins.publique, etat_publique);
						const discussion_priver = await trad("msg.reussite.discussion_priver",{
							nom_discussion: nom_discussion
						}) || `*${nom_discussion} en mode priver*\n> Ces paramètres prendront effet que si tu fais la commande \`.mode changer priver\``;
						await connexion.sendMessage(discussion, {
							text: discussion_priver,
							mentions: mentions
						}, { quoted: message });
					}
					return 'ARRET';
				}

				// .mode publique [tous]
				if (argument1 === "publique") {
					if (argument2 === "tous") {
						etat_tous[1].mode_tous = "publique";
						await sauvegarder_fichier(chemins.tous, etat_tous);
						await connexion.sendMessage(discussion, { text: parametre_enregistre }, { quoted: message });
					} else {
						const jid_normaliser = await resoudre_jids(connexion, discussion);
						//retirer de la liste privée s'il y est et ajouter à la liste publique
						etat_priver[1].liste = etat_priver[1].liste.filter(id => id !== jid_normaliser);
						if (!etat_publique[1].liste.includes(jid_normaliser)) {
							etat_publique[1].liste.push(jid_normaliser);
						}
						await sauvegarder_fichier(chemins.priver, etat_priver);
						await sauvegarder_fichier(chemins.publique, etat_publique);
						const discussion_publique= await trad("msg.reussite.discussion_publique", {
							nom_discussion: nom_discussion
						}) || `\`${nom_discussion}\` *en mode publique*\n> Ces paramètres prendront effet que si tu fais la commande \`.mode changer publique\``;
						await connexion.sendMessage(discussion, {
							text: discussion_publique,
							mentions: mentions
						}, { quoted: message });
					}
					return 'ARRET';
				}

				// .mode changer {publique/priver/tous}
				if (argument1 === "changer") {
					const cible = argument2;
					if (cible === "priver" || cible === "publique" || cible === "tous") {
						const ancien = mode_actuel;
						// désactiver tout
						etat_priver[0].mode = "faux";
						etat_publique[0].mode = "faux";
						etat_tous[0].mode = "faux";
						//activer la cible
						if (cible === "priver") etat_priver[0].mode = "vrai";
						else if (cible === "publique") etat_publique[0].mode = "vrai";
						else if (cible === "tous") etat_tous[0].mode = "vrai";
						await sauvegarder_fichier(chemins.priver, etat_priver);
						await sauvegarder_fichier(chemins.publique, etat_publique);
						await sauvegarder_fichier(chemins.tous, etat_tous);

						let nouveau = cible === "tous" ? await trad(`msg.reussite.changer.tous.${etat_tous[1].mode_tous}`, {
							etat: etat_tous[1].mode_tous
						}) || `${etat_tous[1].mode_tous} (tous)` : cible;
						const changement_reussi = await trad("msg.reussite.changer.changer", {
							ancien: ancien,
							nouveau: nouveau
						}) || `> changerment de ${ancien} à ${nouveau}`;
						await connexion.sendMessage(discussion, { text: changement_reussi }, { quoted: message });
					} else {
						const cible_invalide = await trad("msg.erreur.changer.cible_invalide") || "Cible de changerment invalide (priver/publique/tous).";
						await connexion.sendMessage(discussion, { text: cible_invalide }, { quoted: message });
					}
					return 'ARRET';
				}
			}
		}

		//logique de filtrage (si pas une commande .mode)
		if (est_moi) return;
		const jid_normaliser = await resoudre_jids(connexion, discussion);
		// cas :1 mode TOUS actif
		if (etat_tous[0].mode === "vrai") {
			if (etat_tous[1].mode_tous === "priver") return 'ARRET';
			return;
		}

		// cas 2: mode PUBLIQUE (liste) actif
		if (etat_publique[0].mode === "vrai") {
			if (etat_publique[1].liste.includes(jid_normaliser)) return;
			return 'ARRET';
		}

		// cas 3: mode PRIVER (liste) actif
		if (etat_priver[0].mode === "vrai") {
			if (etat_priver[1].liste.includes(jid_normaliser)) return 'ARRET';
			return;
		}
	}
};
