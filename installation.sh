#!/data/data/com.termux/files/usr/bin/bash

# ====================================================
# 🚀 MUGEN BOT - INSTALLATEUR AUTOMATIQUE POUR TERMUX
# ====================================================

echo "-------------------------------------------------------"
echo "  Bienvenue dans l'installation de Mugen Bot !"
echo "-------------------------------------------------------"

# 1. Mise à jour du système et installation des outils nécessaires
echo "📦 Étape 1 : Installation des dépendances système..."
pkg update -y
pkg install -y libvips build-essential python binutils nodejs git

# 2. Installation des modules Node.js
# On ignore les scripts pour éviter que l'installation ne plante sur Sharp
echo "📦 Étape 2 : Installation des modules npm (mode sécurisé)..."
npm install --ignore-scripts

# 3. Compilation de Sharp
# C'est l'étape cruciale pour que le traitement d'image fonctionne sur Android
echo "🛠️ Étape 3 : Compilation de Sharp pour ARM64..."
if [ -d "node_modules/sharp" ]; then
    cd node_modules/sharp
    npm install --android_ndk_path=""
    cd ../..
    echo "✅ Sharp a été compilé avec succès."
else
    echo "❌ Erreur : Le module Sharp est introuvable."
    exit 1
fi

# 4. Application du correctif pour les stickers (Le Hack Mugen)
echo "🩹 Étape 4 : Application du correctif pour wa-sticker-formatter..."
INTERNAL_SHARP="node_modules/wa-sticker-formatter/node_modules/sharp"

if [ -d "node_modules/wa-sticker-formatter" ]; then
    # On supprime la version interne si elle existe
    rm -rf "$INTERNAL_SHARP"
    
    # On crée le lien symbolique vers la version qu'on vient de compiler
    ln -s ../../../sharp "$INTERNAL_SHARP"
    echo "✅ Correctif appliqué (Lien symbolique créé)."
else
    echo "ℹ️ wa-sticker-formatter n'est pas utilisé dans cette version."
fi

echo "-------------------------------------------------------"
echo "✅ INSTALLATION TERMINÉE !"
echo "👉 Pour lancer le bot, tape : npm test"
echo "-------------------------------------------------------"
