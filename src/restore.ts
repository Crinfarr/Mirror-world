import fs from 'fs';
import { ChannelType, Client, Guild, GuildChannelCreateOptions } from 'discord.js';

const { token, guildid } = JSON.parse(fs.readFileSync('../.creds.json').toString()).restorer

function restoreServer() {
    const bot = new Client({
        intents: [
            'GuildWebhooks',
        ]
    });

    bot.on('ready', async (client) => {
        console.log(`Logged in as ${client.user.username}`);

        const ClonePod = await new Promise<Guild>((resolve, reject) => {
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
            let ccat:GuildChannelCreateOptions & {type: ChannelType.GuildCategory} = JSON.parse(fs.readFileSync(`../serverclone/channels/${folder}/metadata`).toString());
            let category = await ClonePod.channels.create(ccat);
            for (let subfolder of fs.readdirSync(`../serverclone/channels/${folder}`)) {
                if (subfolder == 'metadata') {
                    //ignore metadata
                    continue;
                }
            }
        }
    });

    bot.rest.on('rateLimited', (info) => {
        console.log('Rate limited!');
        console.log(JSON.stringify(info, null, 4));
    });

    //HEY ALL OF THESE THINGS HAVE TO HAPPEN LAST
    bot.login(token);
}

if (require.main == module) {
    restoreServer()
}