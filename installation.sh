set -e

echo "Vérification de l'environnement..."
if [ -d "/data/data/com.termux" ] || [ -n "$TERMUX_VERSION" ] || command -v pkg >/dev/null 2>&1; then
	est_termux="vrai"
else
	echo "C'est pas un environnement Termux."
	est_termux="faux"
fi

if [ "$est_termux" = "vrai" ]; then
	node_requis="v24.14.1"
	echo "Début de l'installation des dépendances"

	echo "Étape 1 :Mise à jour et installation des dépendances système..."
	pkg update -y && pkg upgrade -y
	pkg install -y libvips build-essential python binutils nodejs git

	echo "Étape 2 : Vérification et installation de la version de Node.js..."
	node_actuel=$(node -v 2>/dev/null || echo "inconnu")

	if [ "$node_actuel" = "$node_requis" ]; then
		echo "Version de Node.js correcte ($node_actuel)."
	else
		echo "Version de Node.js actuelle : $node_actuel (Version requise : $node_requis)"
		echo "Installation de la version requise..."
		pkg uninstall nodejs nodejs-lts -y || true
		pkg install nodejs-lts -y

		nouveau_node=$(node -v)
		echo "Nouvelle version de Node.js installée : $nouveau_node"
		if [ "$nouveau_node" != "$node_requis" ]; then
			echo "Attention : La version installée diffère de la version requise ($node_requis)."
			echo "Si le binaire pré-compilé échoue, veuillez installer la bonne version manuellement (par exemple via nvm)."
		fi
	fi

	echo "Étape 3 : Installation des modules npm (avec --ignore-scripts)..."
	npm install --ignore-scripts

	echo "Étape 4 : Téléchargement de mugen_sharp pré-compilé..."
	dossier_destination="node_modules/sharp/src/build/Release"
	mkdir -p "$dossier_destination"

	if curl -L "https://github.com/moneythemoney999/mugen_sharp/raw/main/mugen-sharp-android-arm64.node" -o "$dossier_destination/sharp-android-arm64.node"; then
		echo "Téléchargement réussi."
	else
		echo "Échec de téléchargement."
		exit 1
	fi

	echo "Étape 5 : Application du correctif pour wa-sticker-formatter..."
	sharp_interne="node_modules/wa-sticker-formatter/node_modules/sharp"

	if [ -d "node_modules/wa-sticker-formatter" ]; then
		rm -rf "$sharp_interne"

		ln -s ../../../sharp "$sharp_interne"
		echo "Correctif appliqué avec succès (lien symbolique créé)."
	else
		echo "Erreur : Le répertoire wa-sticker-formatter est introuvable."
		exit 1
	fi

	echo "Installation terminée avec succès"
else
	echo "Début de l'installation des dépendances"
	echo "Exécution de 'npm install'..."
	npm install
	echo "Installation terminée avec succès"
fi
