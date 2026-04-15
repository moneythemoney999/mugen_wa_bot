/* */

//les imports dont on a besoin
import { jidNormalizedUser } from '@whiskeysockets/baileys';

//exporte et logique
export default {
    nom: "xprofil",
    description: "Piquer la tof profil des gens",
    categorie: "Groupes && Privé",
    infos: `Récupérer la photo profil de plusieurs personnes.
\`\`\`Utilisation : .xprofil @tag1 569... @tag2\`\`\`
Envoie un album groupé si plusieurs cibles sont trouvées.`,

    execute: async ({ sock, message, args, nomSession }) => {
        const jid = message.key.remoteJid;
        const estGroupe = jid.endsWith('@g.us');

        let ciblesSujets = new Set();
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;

        //1. recuperation de cibles (temporaire)
        if (contextInfo?.mentionedJid) {
            contextInfo.mentionedJid.forEach(j => ciblesSujets.add(jidNormalizedUser(j)));
        }
        if (contextInfo?.participant) {
            ciblesSujets.add(jidNormalizedUser(contextInfo.participant));
        }
        args?.forEach(arg => {
            const num = arg.replace(/\D/g, '');
            if (num.length >= 8) {
                ciblesSujets.add(jidNormalizedUser(num + '@s.whatsapp.net'));
            }
        });

        let listeCibles = Array.from(ciblesSujets);
        if (listeCibles.length === 0) {
            listeCibles.push(jid);
        }

        let reussis = []; //stockage temporaire des images
        let echoues = [];

        //2. traitement et recuperation
        for (const cible of listeCibles) {
            const estCibleGroupe = cible.endsWith('@g.us');
            const nom = estCibleGroupe ? "du groupe" : `@${cible.split('@')[0]}`;

            try {
                const url = await sock.profilePictureUrl(cible, 'image');
                reussis.push({ url, nom, jid: cible });
            } catch (e) {
                echoues.push({ nom });
            }
        }

        //3. construction de la legende final
        let legendeFinale = "";
        if (reussis.length > 0) {
            const nomsReussis = reussis.map(r => r.nom).join(', ');
            legendeFinale += `Voici la photo de profil de ${nomsReussis}`; //legende pour les photos qu'on a reussi a recuperer
        }

        if (echoues.length > 0) {
            const nomsEchoues = echoues.map(e => e.nom).join(', ');
            if (legendeFinale) legendeFinale += "\n\n";
	    //puis ceux qui ont echoue
            legendeFinale += `> Impossible de récupérer la photo de profil de ${nomsEchoues}. Il peut ne pas en avoir ou l'a protégé.`;
        }

        const toutesMentions = [...reussis.map(r => r.jid), ...listeCibles];

        //4. envoi en forme d'album (bloc de fin)
        if (reussis.length > 0) {
            for (let i = 0; i < reussis.length; i++) {
                const estDernier = (i === reussis.length - 1);
                await sock.sendMessage(
                    jid,
                    {
                        image: { url: reussis[i].url },
                        caption: estDernier ? legendeFinale : "",
                        mentions: estDernier ? toutesMentions : []
                    },
                    { quoted: message }
                );

                //ajout d'un délai entre chaque envoi
                if (!estDernier) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        } else if (echoues.length > 0) {
            //uniquement des échecs : un seul message textuel
            await sock.sendMessage(jid, { text: legendeFinale, mentions: toutesMentions }, { quoted: message });
        }
    }
};
