export default {
    nom: "appel",

    async execute({ connexion, message, args }) {

        if (!args[0]) {
            await connexion.sendMessage(message.key.remoteJid, {
                text: "Utilisation : .appel 56912345678"
            }, { quoted: message });
            return;
        }

        const jid = `${args[0]}@s.whatsapp.net`;

        try {
            const resultat = await connexion.offerCall(jid, false); // false = audio, true = vidéo

            console.log("Appel lancé :", resultat);

            await connexion.sendMessage(message.key.remoteJid, {
                text: `Appel envoyé vers ${args[0]}`
            }, { quoted: message });

        } catch (e) {
            console.error(e);

            await connexion.sendMessage(message.key.remoteJid, {
                text: "Impossible de lancer l'appel."
            }, { quoted: message });
        }
    }
}
