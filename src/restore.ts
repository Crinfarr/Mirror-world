import fs from 'fs';
import discord from 'discord.js';

type categorymeta = channelmeta & {
    type: discord.ChannelType.GuildCategory, //4
}
type textmeta = channelmeta & {
    type: discord.ChannelType.GuildText, //0
    messages: Array<string>,
    threads: Array<string>,
    nsfw: boolean,
    topic: string,
    lastMessageId: string,
    lastPinTimestamp: number,
    rateLimitPerUser: number
}
type voicemeta = channelmeta & {
    type: discord.ChannelType.GuildVoice, //2
    messages:Array<string>,
    nsfw: boolean,
    rtcregion:null|string,
    bitrate:number,
    userlimit:number,
    videoQualityMode:null|string,
    lastMessageId:null|string,
    rateLimitPerUser:number
}
type channelmeta = {
    type:number|discord.ChannelType,
    guild:string,
    guildid:string,
    permissionOverwrites:Array<string>,
    flags:number,
    id:string,
    name:string,
    rawPosition:number,
    parentId: null|string,
    createdTimestamp:number
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
            let ccat:categorymeta = JSON.parse(fs.readFileSync(`../serverclone/channels/${folder}/metadata`).toString());
            let category = await ClonePod.channels.create(ccat);
            for (let subfolder of fs.readdirSync(`../serverclone/channels/${folder}`)) {
                if (subfolder == 'metadata') {
                    //ignore metadata
                    continue;
                }
                let cchannel:
            }
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