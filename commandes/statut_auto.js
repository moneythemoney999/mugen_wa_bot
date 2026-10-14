/* */

//imports nécessaire
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import {traduire} from '../outils/langue.js';


//fonctions utilitaires pour la gestion de la mémoire
async function obtenir_chemin_memoire(nom_session) {
	const nom_fichier = fileURLToPath(import.meta.url);
	const chemin_dossier = path.dirname(nom_fichier);
	const nom_commande = "statut_auto";
	const chemin_memoire = path.join(chemin_dossier, '..', 'memoires', 'memoires_commandes', nom_commande, nom_session);
	await fs.mkdir(chemin_memoire, { recursive: true });
	return {
		fichier_de_config: path.join(chemin_memoire, `config.json`),
		fichier_statuts_lu: path.join(chemin_memoire, 'statuts_lus.json'),
		fichier_personne_exclu: path.join(chemin_memoire, 'personne_exclu.json')
	};
}

async function charger_config(chemin_fichier) {
	const config_par_defaut = {
		etat: "desactiver",
		like: {
			etat: "activer",
			emoji: "♾️"
		}
	};

	if (await fs.access(chemin_fichier).then(() => true).catch(() => false)) {
		try {
			const contenu = JSON.parse(await fs.readFile(chemin_fichier, 'utf-8'));
			return { ...config_par_defaut, ...contenu, like: { ...config_par_defaut.like, ...(contenu.like || {}) } };
		} catch (e) {
			return config_par_defaut;
		}
	}
	return config_par_defaut;
}

async function sauvegarder_config(chemin_fichier, nouvelles_config, nom_session) {
	try {
		await fs.writeFile(chemin_fichier, JSON.stringify(nouvelles_config, null, 2));
	} catch (e) { console.error(`[(statut_auto), "${nom_session}"]: Erreur d'écriture du fichier d'infos:`, e); }
}

async function charger_statuts_lu(chemin_fichier) {
    if (await fs.access(chemin_fichier).then(() => true).catch(() => false)) {
        try { return JSON.parse(await fs.readFile(chemin_fichier, 'utf-8')); } catch (e) { return []; }
    }
    return [];
}

async function sauvegarder_statuts_lu(chemin_fichier, objets, nom_session) {
	try {
		await fs.writeFile(chemin_fichier, JSON.stringify(objets, null, 2));
	} catch (e) { console.error(`[(statut_auto), "${nom_session}"]: Erreur d'écriture du fichier des statuts lus:`, e); }
}

async function charger_personnes_exlu(chemin_fichier) {
	if (await fs.access(chemin_fichier).then(() => true).catch(() => false)) {
		try { return JSON.parse(await fs.readFile(chemin_fichier, 'utf-8')); } catch (e) { return []; }
	}
	return [];
}

async function sauvegarder_personnes_exclu(chemin_fichier, jids, nom_session) {
	try {
		await fs.writeFile(chemin_fichier, JSON.stringify(jids, null, 2));
	} catch (e) { console.error(`[(statut_auto), "${nom_session}"]: Erreur d'écriture du fichier d'exclusion:`, e); }
}


// export et logique la commande
export default {
	nom: "statut_auto",
	description: "Lecture de statut automatique.",
	categorie: "Statuts",
    infos: `Pour lire les statuts automatiquement c'est une commande flexible prenant plusieurs sous-commandes utilisables seulement par le bot lui même.
> Voilà les sous-commandes et ce qu'il font.
꧁\`.statut_auto activer\`   ꙰Pour activé la commande et qu'il lit les statuts.꧂
꧁\`.statut_auto desactiver\`   ꙰Lui il fait le contraire de \`statut_auto activer\`.꧂
꧁\`.statut_auto exclu\`   ꙰Permet de de retirer quelques sous l'emprise de la commande c'est-à-dire que ses statuts ne seront plus lu.
> En groupe on peut l'utiliser en taguant quelqu'un après la commande ou mettre son numéro tout coller et sans l'indicatif (+) ex: 56931437983.
> Et la méthode avec le numéro (\`.statut_auto exclu 56931437983\` marche aussi en privé, mais principalement si oa commnde est faite ne privé et il n'ya pas de numéro derrière c'est la personne avec qui tu parle qui sera la cible.
꧁\`.statut_auto inclu\`   ꙰C'est le même délire que \`.statut_auto exclu\` sauf qu'à l'inverse lui il retire la personne s'il était dans la liste d'exclusion.
> Le mode d'utilisation est le même aussi.
꧁\`.statut_auto like\`   ꙰Permet de désactiver ou de réactiver l'auto-j'aime des statuts puisque que par défaut c'est activé et aussi personnalisé l'émoji du j'aime, l'émoji par défaut est l'infini(♾️).
> Pour le désactiver il suffit de taper tout simplement \`.statut_auto like\` et c'est de même pour le désactiver.
> Si c'est l'émoji que tu veux changer il suffit de taper la même chose mais cette fois avec l'émoji que tu veux à la toute fin ex: \`.statut_auto like 🫩\`.  NB : *Si la commande globale \`.statut_auto\` était à l'état désactiver les modifications de seront enregistrés mais appliquer qu'à l'activation de la commande globale.`,

	execute: async ({ connexion, message, args, nom_session }) => {
	const trad = async (cle, vars = {}) => (await traduire(nom_session, 'commandes', 'statut_auto', { [cle]: vars }))[cle];
		const est_moi = message.key.fromMe || message.key.remoteJid.endsWith("@newsletter");
		if (!est_moi) {
			const si_pas_moi = await trad('msg.si_pas_moi') || "> Tu ne peux pas utiliser cette commande";
			await connexion.sendMessage(message.key.remoteJid,
				//si c'est pas moi
				{ text: si_pas_moi },
				{ quoted: message });
			return;
		}
		//gestion des sous-commnades
		const chemins = await obtenir_chemin_memoire(nom_session);
		const premier_argument = args[0]?.toLowerCase();
		const configuration = await charger_config(chemins.fichier_de_config);

		switch (premier_argument) {
				//sous-commandes activer/desactiver
			case "activer":
			case "desactiver": {
				const etat_commande = await trad(`msg.${premier_argument}`) || premier_argument;
				if (configuration.etat === premier_argument) {
					const deja_etat = await trad('msg.deja_etat', {
						etat: etat_commande
					}) || `Statuts automatique ~était déjà~ \`${etat_commande}\``;
					await connexion.sendMessage(message.key.remoteJid,
						{ text: deja_etat },
						{ quoted: message });
				} else {
					configuration.etat = premier_argument;
					await sauvegarder_config(chemins.fichier_de_config, configuration, nom_session);
					const etat_changer = await trad('msg.etat_changer',{ etat: etat_commande}) || `Statuts automatique ${etat_commande}`;
					await connexion.sendMessage(message.key.remoteJid, { text: etat_changer }, { quoted: message });
				}
				break;
			}

				//sous-commandes like
			case "like": {
				const nouveau_emoji = args[1];
				let texte_confirmation = "";

				if (nouveau_emoji) {
					const ancien_emoji = configuration.like.emoji;
					configuration.like.emoji = nouveau_emoji;
					texte_confirmation = await trad('msg.texte_confirmation1',{
						ancien_emoji: ancien_emoji,
						nouveau_emoji: nouveau_emoji,
						infos_like_etat: await trad(`msg.${configuration.like.etat}`) || configuration.like.etat
					}) || `L'émoji a été changé de ${ancien_emoji} à ${nouveau_emoji}.\n> État: ${configuration.like.etat}`;
				} else {
					const ancien_etat_de_like = configuration.like.etat;
					configuration.like.etat = ancien_etat_de_like === 'activer' ? 'desactiver' : 'activer';
					const traduction_ancien_etat = await trad(`msg.${ancien_etat_de_like}`) || ancien_etat_de_like;
					const traduction_nouvel_etat = await trad(`msg.${configuration.like.etat}`) || configuration.like.etat;
					texte_confirmation = await trad('msg.texte_confirmation2',{
						ancien_etat: traduction_ancien_etat,
						nouvel_etat: traduction_nouvel_etat,
						infos_like_emoji: configuration.like.emoji
					}) || `Passage de ${traduction_ancien_etat} à ${traduction_nouvel_etat}.\n> Émoji: ${configuration.like.emoji}`;
				}

				await sauvegarder_config(chemins.fichier_de_config, configuration, nom_session);

				const message_final = configuration.etat === 'desactiver'
					? await trad("msg.message_final") || "La commande globale `statut_auto` est ~désactivée~. *Les modifications seront appliquées à son activation*."
					: texte_confirmation;

				await connexion.sendMessage(message.key.remoteJid, { text: message_final }, { quoted: message });
				break;
			}
				//sous-commandes exclu/inclu
			case "exclu":
			case "inclu": {
				let jids_cibles = [];
				const num_fourni = args[1];
				const est_groupe = message.key.remoteJid.endsWith('@g.us');

				if (num_fourni) {
					jids_cibles.push(num_fourni.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
				} else if (est_groupe) {
					const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
					const auteur_repondu = message.message?.extendedTextMessage?.contextInfo?.participant;
					if (mentions.length > 0) jids_cibles.push(...mentions);
					else if (auteur_repondu) jids_cibles.push(auteur_repondu);
				} else {
					jids_cibles.push(message.key.remoteJid);
				}
				let jids_resolus = [];
				for (const jid of jids_cibles) {
					let jid_final = jid;
					if (jid.endsWith('@lid')) {
						try {
							const pn = await connexion.signalRepository.lidMapping.getPNForLID(jid);
							if (pn) jid_final = pn;
						} catch (e) {}
					}
					jids_resolus.push(jidNormalizedUser(jid_final));
				}

				if (jids_resolus.length > 0) {
					const exclus_actuels = await charger_personnes_exlu(chemins.fichier_personne_exclu);
					let affectes = [];
						let deja_dans_etat = [];

					if (premier_argument === "exclu") {
						jids_resolus.forEach(id => {
							if (!exclus_actuels.includes(id)) {
								exclus_actuels.push(id);
								affectes.push(id);
							} else {
								deja_dans_etat.push(id);
							}
						});
					} else {
						jids_resolus.forEach(id => {
							if (exclus_actuels.includes(id)) {
								affectes.push(id);
							} else {
								deja_dans_etat.push(id);
							}
						});
						if (affectes.length > 0) {
							const nouvelle_liste = exclus_actuels.filter(id => !affectes.includes(id));
							exclus_actuels.splice(0, exclus_actuels.length, ...nouvelle_liste);
						}
					}
					if (affectes.length > 0) {
						await sauvegarder_personnes_exclu(chemins.fichier_personne_exclu, exclus_actuels, nom_session);
					}

					const verbe = await trad(`msg.${premier_argument}`) || premier_argument;
					let message_resultat = [];
					if (affectes.length > 0) {
						const noms = affectes.map(id => id.split('@')[0]).join(', ');
						const message_des_affectes = await trad('msg.message_des_affectes', {
							noms: noms,
							verbe: verbe,
							s: affectes.length > 1 ? 's' : ''
						}) || `*+${noms} ${verbe}${affectes.length > 1 ? 's' : ''}*`;
						message_resultat.push(message_des_affectes);
					}

					if (deja_dans_etat.length > 0) {
						const noms = deja_dans_etat.map(id => id.split('@')[0]).join(', ');
						const message_deja_etat = await trad('msg.message_deja_etat', {
							noms: noms,
							verbe: verbe,
							s: deja_dans_etat.length > 1 ? 's' : ''
						}) || `> +${noms} déjà ${verbe}${deja_dans_etat.length > 1 ? 's' : ''}`;

						message_resultat.push(message_deja_etat);
					}

					await connexion.sendMessage(message.key.remoteJid, { text: message_resultat.join('\n') }, { quoted: message });
				}
				break;
			}

			default: {
				//message pour montrer les sous-commandes
				const message_aide = await trad('msg.message_aide', {
					infos_etat: await trad(`msg.${configuration.etat}`) || configuration.etat,
				}) || `État de la commande: ${configuration.etat}
╭──Voici les arguments───────────────────────────
├─➩ ".statut_auto activer"
├─➩ ".statut_auto desactiver"
├─➩ ".statut_auto exclu <@utilisateur|numéro>"
├─➩ ".statut_auto inclu <@utilisateur|numéro>"
├─➩ ".statut_auto like < |emoji>"
╰──────────────────────────────────────────`;
				await connexion.sendMessage(message.key.remoteJid, { text: message_aide }, { quoted: message });
				break;
			}
		}
	},

	//le handler qui reçoit vraiment les statuts et les lus
	evenement_sans_prefixe: async ({ connexion, message, nom_session }) => {
		if (message.key.remoteJid !== 'status@broadcast') {
			return false;
		}
		//list ede statuts quon cosidere comme valides
		const contenu = message.message;
		const est_statut_valide = contenu && (contenu.imageMessage || contenu.videoMessage || contenu.extendedTextMessage || contenu.audioMessage);
		if (!est_statut_valide) {
			return false;
		}

		//si ça vient de moi on ignore
		let auteur = message.key.participant;
		if (!auteur) {
			return false;
		}

		//normalisation des identifiants avant de les utilliser
		if (auteur.endsWith('@lid')) {
			try {
				const pn = await connexion.signalRepository.lidMapping.getPNForLID(auteur);
				if (pn) auteur = pn;
			} catch (e) {}
		}
		auteur = jidNormalizedUser(auteur);
		if (auteur === jidNormalizedUser(connexion.user.id)) {
			return false;
		}

		//recherche et lecture des fichiers des personnes exclues
		const chemins = await obtenir_chemin_memoire(nom_session);
		const personnes_exclues = await charger_personnes_exlu(chemins.fichier_personne_exclu);
		if (personnes_exclues.includes(auteur)) {
			return false;
		}

		const configuration = await charger_config(chemins.fichier_de_config);
		if (configuration.etat !== "activer") {
			return false;
		}
		//fonction pour l'auto-suppressio
		const maintenant = Date.now();
		const nettoyage_disque = 24 * 60 * 60 * 1000;
		const identifiant_statut = message.key.id;
		//verification de la liste des statuts lus
		const statuts_lu = await charger_statuts_lu(chemins.fichier_statuts_lu);
		const status_recent = statuts_lu.filter(statut => (maintenant - statut.dateLecture) < nettoyage_disque);

		//si le statut nettait pas dans la liste on continu si non on l'ignore
		if (!status_recent.some(statut => statut.id === identifiant_statut)) {
			try {
				await connexion.readMessages([message.key]);
				//si l'auto j'aime est actif
				if (configuration.like.etat === "activer") {
					//on charge la reaction qu'on a dans les fichiers si non on envoi l'emoi par defaut
					const emoji_de_reaction = configuration.like.emoji || "Mugen♾️♾️";
					await connexion.sendMessage(
						'status@broadcast',
						{ react: { text: emoji_de_reaction, key: message.key } },
						{ statusJidList: [auteur] }
					);
				}
				//apres on enregistre le nouveau statut qu'on vient de lire
				status_recent.push({ id: identifiant_statut, dateLecture: maintenant });
				await sauvegarder_statuts_lu(chemins.fichier_statuts_lu, status_recent, nom_session);
			} catch(e) {
				//pour une erreur non identifie
				console.error(`[(statut_auto), "${nom_session}"]: Erreur pendant le traitement:`, e);
			}
		}
		return false;
	}
};