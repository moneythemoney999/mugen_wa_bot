// Commande `mugen` : Lance le bot (message d'accueil)
module.exports = {
    name: 'mugen',
    description: "Lancé le bot",
    categorie: 'Partout',
    execute: async ({ sock, message, args }) => {
        // Message d'accueil tel que demandé
        const texte = `╔❀══◄••❀••►══❀══❀══◄••❀••►══❀╗
 ⫸ Yoo, salut ça dit quoi vieux
━━━━━ • ✧ • ⚝ • ✧ • ━━━━━
⫸ Ici:
 > ⟁⟁♱ Mugen♾♾ Bot version 1.0.0 ⟁⃤ ♱
⫸ Creer par:
Money Mugen♾♾ 
••═╬ロ☬╬═••••═╬ロ☬╬═••••═╬ロ☬╬═••
—͟͟͞͞Tappe .menu pour voir la liste des commandes彡

╚❀══◄••❀••►══❀══❀══◄••❀••►══❀╝`;

        await sock.sendMessage(message.key.remoteJid, { text: texte }, { quoted: message });
    }
};
