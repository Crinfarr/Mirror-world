import fs from 'fs';
import discord from 'discord.js';

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
        let categories: Map<string, discord.CategoryChannel> = new Map<string, discord.CategoryChannel>();
        let hooks: Map<discord.GuildTextBasedChannel, discord.Webhook> = new Map<discord.GuildTextBasedChannel, discord.Webhook>();
        let channels: Map<string, discord.GuildTextBasedChannel> = new Map<string, discord.GuildTextBasedChannel>();

        for (let folderName of fs.readdirSync('../serverclone/channels')) {
            console.log(`Creating channel category ${folderName}`);
            let category = await ClonePod.channels.create({
                name: folderName,
                type: discord.ChannelType.GuildCategory,
                // topic: JSON.parse(fs.readFileSync(`../serverclone/channels/${folder}/metadata`).toString())
            })
            categories.set(`../serverclone/channels/${folderName}`, category);
        }
        for (let [folderPath, channel] of categories) {
            for (let subItem of fs.readdirSync(folderPath)) {
                if (!fs.lstatSync(`${folderPath}/${subItem}`).isDirectory()) {
                    console.log(`${folderPath}/${subItem} is not a channel folder`);
                    continue;
                }
                console.log(`Creating channel #${subItem}`)
                let textChannel = await ClonePod.channels.create({
                    name: subItem,
                    type: discord.ChannelType.GuildText,
                    parent: channel
                })
                console.log(`Creating webhook in ${subItem}`);
                let hook = await textChannel.createWebhook({ name: 'Mirror world' });
                hooks.set(textChannel, hook);
                channels.set(`${folderPath}/${subItem}`, textChannel);
            }
        }

        //HACK REMOVE THIS
        console.log('CLEANING UP ATTEMPT...');
        for (let [_, hook] of hooks) {
            hook.delete('Cleanup');
        }
        for (let [_, channel] of channels) {
            await channel.delete('Cleanup');
        }
        for (let [_, channel] of categories) {
            await channel.delete('Cleanup');
        }
        bot.destroy();
        console.log('Done restoring!');
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