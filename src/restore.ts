import fs from 'fs';
import discord from 'discord.js';

type categorymeta = {
    type: 4,
    guild: string,
    guildid: string,
    permissionOverrides: Array<any>,
    flags: number,
    id: string,
    name: string,
    rawPosition: number,
    parentId: null|string,
    createdTimestamp: number
}

const { token, guildid } = JSON.parse(fs.readFileSync('../.creds.json').toString()).restorer

function restoreServer() {
    const bot = new discord.Client({
        intents: [
            'GuildWebhooks',
        ]
    });

    bot.on('ready', async (client) => {
        console.log(`Logged in as ${client.user.username}`);

        const ClonePod = await new Promise<discord.Guild>((resolve, reject) => {
            client.guilds.fetch().then((guilds) => {
                let guild = guilds.get(guildid);
                if (guild == undefined) {
                    reject(null);
                    throw new Error('Could not fetch guild by id, is this bot invited?');
                }
                guild.fetch().then((pod) => {
                    resolve(pod);
                })
            });
        });
        for (let folder of fs.readdirSync('../serverclone/channels')) {
            let ccat:categorymeta = JSON.parse(fs.readFileSync(`../serverclone/channels/${folder}`).toString());
            //TODO the rest of this bc downloading a ton of stuff is lagging my IDE
        }
    });

    bot.rest.on('rateLimited', (info) => {
        console.log('Rate limited!');
        console.log(JSON.stringify(info, null, 4));
    });

    //HACK ALL OF THESE THINGS HAVE TO HAPPEN LAST
    bot.login(token);
}

if (require.main == module) {
    restoreServer()
}