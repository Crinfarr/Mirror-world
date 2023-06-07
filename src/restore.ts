import fs from 'fs';
import discord from 'discord.js';

const {token, guildid} = JSON.parse(fs.readFileSync('../.creds.json').toString()).restorer

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
        let categories:Map<string, discord.CategoryChannel> = new Map<string, discord.CategoryChannel>();
        for (let folder of fs.readdirSync('../serverclone/channels')) {
            categories.set(folder, await ClonePod.channels.create({
                name: folder,
                type: discord.ChannelType.GuildCategory,
                // topic: JSON.parse(fs.readFileSync(`../serverclone/channels/${folder}/metadata`).toString())
            }));
        }
        for (let [categoryName, channel] of categories) {
            for (let subItem of fs.readdirSync(`../serverclone/channels/${categoryName}`)) {
                ;
            }
        }

        //HACK REMOVE THIS
        console.log('CLEANING UP ATTEMPT...');
        for (let [_, channel] of categories) {
            await channel.delete('Cleanup');
        }
        bot.destroy();
        console.log('Done restoring!');
    });

    //HACK ALL OF THESE THINGS HAVE TO HAPPEN LAST
    bot.login(token);
}

if (require.main == module) {
    restoreServer()
}