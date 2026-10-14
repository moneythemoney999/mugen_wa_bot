[Español](lis_moi/lis_moi_es.md) [Kreyòl](lis_moi/lis_moi_ht.md)

# Mugen WA Bot ♾️♾️
| Mugen | Menu |
|-------|------|
| <img src="lis_moi/image_mugen.jpg" width="875"> | <img src="lis_moi/image_menu.jpg" width="250"> <img src="lis_moi/image_menu1.jpg" width="250"> |

[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/fr)
[![Baileys](https://img.shields.io/badge/Library-Baileys-blue?logo=github)](https://github.com/WhiskeySockets/Baileys)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Multi--Device-green?logo=whatsapp)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/moneythemoney999/mugen_wa_bot?tab=MIT-1-ov-file)

* Un bot WhatsApp puissant et modulaire, très flexible et multilingüe.

## ~Table des matières~

- [À propos](#à-propos)
- [Fonctionnalités](#fonctionnalités)
- [Technologies Utilisées](#technologies-utilisées)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Utilisation](#utilisation)
	- [Démarrage du bot](#démarrage-du-bot)
	- [Authentification](#authentification)
	- [Commandes](#commandes)
	- [Outils](#outils)
- [Structure du Projet](#structure-du-projet)
- [Contribuer](#contribuer)
- [Licence](#licence)
- [Auteur](#auteur)

## ~À propos~

Mugen WA Bot♾️♾️ est un bot WhatsApp polyvalent et extensible, créer par un petits devs independants, construit avec Node.js et utilisant la bibliothèque Baileys pour interagir avec l'API WhatsApp Multi-Device. Sa conception modulaire permet d'ajouter facilement de nouvelles commandes, outils et fonctionnalités en tout genre. Il est capable de gérer plusieurs sessions simultanément.

## ~Fonctionnalités~

🧩 **Modulaire et Extensible** : Ajoutez facilement de nouvelles fonctionnalités, commandes et outils personnalisés.
💬 **Interactions WhatsApp** : Gère les messages, les groupes, les participants et les identifiants LID,PN,JID.
♾️ **Gestion Multi-Sessions** : Exécute plusieurs instances du bot simultanément avec des sessions et numéro distinctes.
🔌 **Authentification Flexible** : Supporte l'authentification par QR Code ou code de pairage.
🌐 **Multilingüe** : Prend en charge plusieurs et différentes langue.

## ~Technologies Utilisées~

*	**Node.js** 24(Exécuteur de JavaScript hors navigateur)
*	**Whiskeysockets Baileys** 7.0.0-rc.14(API WhatsApp Multi-Device)
*	**qrcode-terminal** (Génération de QR codes dans le terminal)
*	**npm** (Gestionnaire de packages JavaScript)
*	Et d'autres modules Node.js standards comme `fs`, `path`, `readline`, `util`.

## ~Prérequis~

Avant de commencer, assure vous d'avoir les éléments suivants installés :

*	**Node.js** (Version 20 mais la version 24 est fortement recommandée dans Termux)
*	**npm** ou **yarn** (Gestionnaire de paquets)

## ~Installation~

Suivez ces étapes pour configurer et exécuter le bot :

1.	**Clonez le dépôt :**
	```bash
	git clone https://github.com/moneythemoney999/mugen_wa_bot.git
	cd mugen_wa_bot
	```

2.	**Installation des dépendances :**
	### **linux,windows,macOS et environement linux dans Termux(proot/chroot):**
	```bash
	npm install
	```
	ou
	```bash
	yarn install
	```

	### **Termux sans environement linux proot ou chroot installer:**
	**Pour les utilisateur de Termux (simple sans environement linux installer dessus) il faut pas lancer utiliser `npm/yarn install` puisque l'un des paquets nécessaire n'et pas pré-compilé pour Termux.*

	- Alors moi j'ai je l'ai fait pour vous mais il faut utiliser specifiquements node v24
	- Pour en beneficié il faut lancé deux commandes:
		```bash
		chmod +x installation.sh && ./installation.sh #l'une permet de donnr les autorisation d'exécution au fichier et l'autre l'exécuter
		```
	- Ça va faire le nécessaire pour télécharger et installer la dépendance ainsi que les autres.

3.	**Configuration des sessions (Optionnel, mais recommandé pour plusieurs sessions) :**
	- Créez le fichier `session.js` à la racine du projet (au même niveau que `mugen_wa_bot.js`) s'il n'existe pas. Dans ce fichier, vous pouvez définir les sessions que vous souhaites lancer. Chaque appel à `demarer_bot("session")` lancera une nouvelle session. Et il supporte les commentaires multi-lignes ou non.
	- Exemple de `session.js` :
		```javascript
		demarer_bot("mugen");

		// Lance une autre session nommée "session1"
		/*
		demarer_bot("session1");
		*/

		// Commentez/décommentez les lignes selon les sessions que vous voulez activer.
		// Les sessions non commentées seront démarrées au lancement du bot.
		```
	- Si `session.js` n'existe pas ou est vide, une session par défaut nommée "mugen" sera lancée.

## ~Utilisation~

### Démarrage du bot
* Pour démarrer le bot, exécute le fichier principal `mugen_wa_bot.js` :

```bash
node mugen_wa_bot.js
```

### Authentification

- Lors du premier démarrage d'une nouvelle session, le bot vous demandera de choisir une méthode d'authentification :

1.  **QR Code** : Un QR code s'affichera dans le terminal. Scannez-le avec votre tél : WhatsApp > Appareils connectés > Connecter un appareil. Puis vous scannez.
2.  **Code de pairage** : Vous devez entrer votre numéro de téléphone sans espace ni le plus(+) ou parenthèses. Un code vous sera fourni, que vous devez aller tapper dans : WhatsApp > Appareils connectés > Connecter un appareil > Connecté plutôt avec un numéro de téléphone. Puis vous le raper.

- Les fichier d'auth seront sauvegardées dans le dossier `.secret/.auth/<nom_de_session>` pour les redémarrages futurs.
- Donc n'y touchez pas sans une bonnes raison ou que vous ne soyez pas sûr de ce vous faites.

### Commandes

* Le bot écoute les evenements de Baileys, pour les transfèrer à toutes les commandes et outils pour s'il rn on besoin. Epuis il filtrera aussi les messages commençant par le préfixe pour appeler cette commande ou cet outil. S'il n'en trouve pa sil enverra un message pour le dire.
* _Pour le chargement automatique et recherche des commandes et outils il ya certaine case à respecter_
* **Voilà un exemple :**
```javascript
export defaut {
	nom : "nom de la commande",
	description : "description de la commande",
	categorie : "catégorie de la commande",
	infos : "Plus d'info sur la la commnde que le bloc 'description'", //pas obligatoire
	execute : "c'est là la vrai logique de la commande qui sera exécuté à l'appelle {s'il y'a des argument que vous voulez importer depuis le fichier principal c'est ici}"
}
```

### Outils

- Le bot utilise un système d'outils modulaires qui peuvent réagir à différents événements. Ces outils sont chargés dynamiquement depuis le dossier `outils`.
- Eux qui peuvent travailler en arrière-plan sans avoir besoin de déclanchement par le préfixe, et peuvent affecter le comportement du reste du bot.
- De même que pour les commandes il y'a certaines cases à respecter.
- __Exemple__ :
```javascript
export defaut {
	nom : "nom de l'outil",
	evenement : "l'evenement que veut ecouter cet outils", //peut prende un ou plusieurs
	desciption : "descrption de l'outil",
	categorie : "...",
	infos : "...",
	affiche_menu : "{vrai/faux}", ce champ permet de ne pas ajouter l'outils dans le menu du bot si c'est destiné à travailler en arrière plan. S'il n'est pas dans le fichier ou defini sur `faux` le menu ne l'affichera pas.
	execute : "de même pour les commandes c'est là que se trouvera la logique à executé"
}
```

## Structure du Projet

```
.
├── commandes/					# Les commandes
├── outils/					# Les outils
├── langues/{la_langue}/		# Dossiers/fichiers des diferentes langues
│						└── {la_langue}.json # Informations sur la langue (nom, code)
│						└── commandes/
│						└── outils/
├── memoires/					# Dossier pour les données persistantes
│	├── memoires_commandes/	# Commandes
│	├── memoires_sessions/		# Sessions
│	└── memoires_outils/		# Outils
├── stockage					# ...
├── lis_moi/					# Dossier qui contient les images et fichiers readme traduit en diferentes langues
├── .secret/					# Dossier qui contenant les informations sensibles
│	└── .auth/					# Données d'authentification whatsapp
│	└── .cles_ia/				# Clés API d'IA
├── mugen_wa_bot.js			# Fichier principal du bot
├── installation.sh			# Exécutable d'installation des dépendances sur Termux simple
├── package.json				# Informations sur le projet et les dépendances
├── package-lock.json			# Verrouillage des versions des dépendances
├── session.js					# Fichier pour configurer et lancer plusieurs sessions
└── README.md					# Ce fichier
```

## Contribuer

Comme j'ai dis c'est projet où je bosse solo, mais s'il y'a des gens qui souhaite contribuer chuis pas contre😅(→⁠_⁠→)(←⁠_⁠←).
Allez je vous attend.

# Licence

Ce projet est sous licence MIT, et libre d'accès alors je ne suis pas responsable de toute mal utilisations.
[Licence](LICENCE)

# Auteur
[Money Mugen♾️♾️](https://github.com/moneythemoney999)