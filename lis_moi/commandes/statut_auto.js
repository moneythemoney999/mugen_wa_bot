/**
 * @fichier lis_moi/commandes/statut_auto.js
 * @description Documentation technique et guide d'utilisation de la commande statut_auto.
 *
 * 1. RÔLE ET FONCTIONNEMENT GÉNÉRAL
 * ---------------------------------
 * La commande `statut_auto` assure la lecture automatique des statuts WhatsApp diffusés
 * par les contacts (via l'identifiant 'status@broadcast') et permet l'envoi optionnel
 * d'une réaction (auto-like) sous forme d'émoji personnalisé.
 *
 * 2. SOUS-COMMANDES DISPONIBLES (Réservées à l'administrateur / bot lui-même)
 * -------------------------------------------------------------------------
 * - `.statut_auto activer`
 *   Active la surveillance et la lecture automatique des nouveaux statuts.
 *
 * - `.statut_auto desactiver`
 *   Désactive la lecture automatique des statuts.
 *
 * - `.statut_auto like`
 *   Bascule l'état de l'auto-like (activation / désactivation de la réaction automatique).
 *
 * - `.statut_auto like <émoji>`
 *   Définit un nouvel émoji pour la réaction automatique (ex: `.statut_auto like ♾️`).
 *
 * - `.statut_auto exclu <@utilisateur | numéro>`
 *   Ajoute un utilisateur à la liste d'exclusion pour ne plus lire ses statuts.
 *
 * - `.statut_auto inclu <@utilisateur | numéro>`
 *   Retire un utilisateur de la liste d'exclusion (réactive la lecture de ses statuts).
 *
 * 3. STRUCTURE DES FICHIERS EN MÉMOIRE
 * -----------------------------------
 * Les données de persistance sont stockées par session sous :
 * `memoires/memoires_commandes/statut_auto/<nom_session>/`
 *
 * - `config.json` :
 *   Stocke la configuration globale (état de la commande, état de l'auto-like, émoji).
 *   Format :
 *   {
 *     "etat": "activer" | "desactiver",
 *     "like": {
 *       "etat": "activer" | "desactiver",
 *       "emoji": "♾️"
 *     }
 *   }
 *
 * - `statuts_lus.json` :
 *   Historique des identifiants de statuts déjà consultés avec leur horodatage de lecture.
 *   Les entrées de plus de 24 heures sont automatiquement purgées pour préserver l'espace disque.
 *
 * - `personne_exclu.json` :
 *   Tableau des identifiants JID (format @s.whatsapp.net) exclus de la lecture automatique.
 *
 * 4. ARCHITECTURE D'ÉCOUTE ET CORRECTIFS TECHNIQUES
 * -------------------------------------------------
 * - Point d'entrée sans préfixe :
 *   La méthode exportée est `evenements_sans_prefixe` (au pluriel), appelée par
 *   la boucle de traitement des messages sans préfixe du fichier principal `mugen_wa_bot.js`.
 *
 * - Gestion du lot de messages :
 *   Le récepteur d'événements `messages.upsert` parcourt l'ensemble des messages reçus
 *   dans le lot (`for (const message of messages)`) au lieu de limiter le traitement au premier.
 *
 * - Transmission des réactions :
 *   Pour garantir la réception de la réaction par WhatsApp (notamment lors de l'usage
 *   d'identifiants LID), la liste `statusJidList` inclut l'auteur normalisé ainsi que
 *   le participant d'origine.
 */

export default {
	nom: "statut_auto_documentation",
	version: "1.4.1",
	cible: "commandes/statut_auto.js"
};
