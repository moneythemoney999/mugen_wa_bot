# Commande `statut_auto`

## Description
La commande `statut_auto` gère la lecture automatique des statuts WhatsApp (`status@broadcast`) et l'envoi optionnel d'une réaction sous forme d'émoji (auto-like).

---

## Sous-commandes disponibles
> *Accessible uniquement par le propriétaire du bot / le compte du bot.*

- **`.statut_auto activer`** : Active la lecture automatique des statuts.
- **`.statut_auto desactiver`** : Désactive la lecture automatique des statuts.
- **`.statut_auto like`** : Active ou désactive l'auto-j'aime des statuts.
- **`.statut_auto like <émoji>`** : Modifie l'émoji envoyé lors du like (ex: `.statut_auto like ♾️`).
- **`.statut_auto exclu <@contact|numéro>`** : Exclut une personne pour ne plus jamais lire ses statuts.
- **`.statut_auto inclu <@contact|numéro>`** : Réintègre une personne exclue dans la liste des statuts lus.

---

## Fichiers de mémoire persistante
Les paramètres et l'historique sont enregistrés par session sous :
`memoires/memoires_commandes/statut_auto/<nom_session>/`

- **`config.json`** : Configuration globale (`etat`, `like.etat`, `like.emoji`).
- **`statuts_lus.json`** : Enregistrement des statuts déjà lus (nettoyage automatique des statuts de plus de 24 heures).
- **`personne_exclu.json`** : Liste des identifiants (JIDs) exclus.

---

## Fonctionnement interne
- **Gestionnaire sans préfixe** : Exporté sous le nom `evenements_sans_prefixe` pour être appelé par [`mugen_wa_bot.js`](../../mugen_wa_bot.js).
- **Traitement complet des lots** : Le fichier principal traite chaque message reçu dans le tableau `messages` de Baileys.
- **Compatibilité LID** : Résolution automatique des identifiants LID en numéros de téléphone normalisés et sécurisation des destinataires dans `statusJidList`.


# Problèmes

## 1.
- 
- 