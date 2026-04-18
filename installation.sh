#!/data/data/com.termux/files/usr/bin/bash
version_node="v24.14.1"

# 1. Mise à jour du système et installation des outils nécessaires
echo "Étape 1 : Installation des dépendances système..."
pkg update -y && pkg upgrade -y
pkg install -y libvips build-essential python binutils nodejs git

# 2. Préparation de la version de node
echo "Étape 2 : Verification et installation de la bonne version de node"
	# On récupère la version actuelle si elle existe
	node_actuel=$(node -v 2>/dev/null)
if [ "$node_actuel" = "$version_node" ]; then
	echo "Version node correcte($node_actuel)."
else 
	echo "Version de node actuelle($node_actuel)"
	echo "Installation de la v$version_node"
	# Désinstallation du node actuel 
	pkg uninstall nodejs nodejs-lts -y
	# Installation de la v requise
	pkg install nodejs-lts -y
	# Vérification après l'installation
	node_nouveau=$(node -v)
	echo "Nouvelle version de node installé($node_nouveau)"
	if [ "$node_nouveau" != "$version_node" ]; then
		echo "Node differe toujours de la version requise. Si le binaire pré-compilé echoue veillez installer la bonne version($version_node) peut-être avec 'nvm'."
	fi
fi

# 3. Installation des modules Node.js
# On ignore les scripts pour éviter que l'installation ne plante sur Sharp
echo "Étape 2 : Installation des modules npm (mode sécurisé)..."
npm install --ignore-scripts

# 4. Teléchargement de mugen_sharp pré-compilé
echo "Téléchargement de mugen_sharp pré-compilé..."
destination="node_modules/sharp/src/build/Release"
mkdir -p "$destination"

if curl -L "https://github.com/moneythemoney999/mugen_sharp/raw/main/mugen-sharp-android-arm64.node" -o "$destination/sharp-android-arm64.node"; then
	echo "Téléchargement réussi"
else 
	echo "Téléchargement non-réussi"
fi

# 5. Application du correctif dans wa-sticker-formatter
echo "Étape 4 : Application du correctif pour wa-sticker-formatter..."
INTERNAL_SHARP="node_modules/wa-sticker-formatter/node_modules/sharp"

if [ -d "node_modules/wa-sticker-formatter" ]; then
    # On supprime la version interne si elle existe
    rm -rf "$INTERNAL_SHARP"
    
    # On crée le lien symbolique vers la version pré-compilé qu'on vient de téléchargé
    ln -s ../../../sharp "$INTERNAL_SHARP"
    echo "Correctif appliqué (Lien symbolique créé)."
else
    echo "Une erreur s'est produite"
fi
