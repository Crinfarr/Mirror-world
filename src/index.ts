import fs from 'fs';
import discord from 'discord.js'
import { downloadAllAttachments, downloadAllStickers, downloadAllUsers } from './full-archive';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const { token, guildid } = JSON.parse(fs.readFileSync('../.creds.json').toString()).archiver;
const bot = new discord.Client({
    intents: [
        'GuildMessages',
        'MessageContent'
    ]
});

if (!fs.existsSync('../serverclone')) {
    fs.mkdirSync('../serverclone');
    fs.mkdirSync('../serverclone/userdata');
    fs.mkdirSync('../serverclone/channels');
    fs.mkdirSync('../serverclone/userdata/attachments');
    fs.mkdirSync('../serverclone/userdata/stickers');
}

bot.on('ready', (client) => {
    console.log(`Logged in as ${client.user.username}`);
    client.user.setStatus('invisible');
    console.log(`Status set to invis`);

    //fetch all channels in hccu
    client.guilds.cache.get(guildid)?.channels.fetch().then(async (channels) => {
        //iterate over channels
        for (let [_id, channel] of channels) {
            if (channel === null) {
                throw new Error('Channel is null')
            }
            if (channel.type == discord.ChannelType.GuildCategory) {
                console.log(`Cloning category ${channel.name}...`);
                //create a folder to hold it unless I already did
                if (fs.existsSync(`../serverclone/channels/${channel.name}`)) {
                    console.log('Folder exists, continuing...')
                    continue;
                }
                if (!fs.existsSync(`../serverclone/channels/${channel.name}`)) {
                    console.log(`Creating folder...`)
                    fs.mkdirSync(`../serverclone/channels/${channel.name}`);
                }

                console.log('writing metadata...')
                //write json metadata of channel into file
                fs.writeFileSync(`../serverclone/channels/${channel.name}/metadata`, JSON.stringify(channel.toJSON(), null, 4));
                console.log('Done');
            }
        }
        for (let [_id, channel] of channels) {
            if (channel === null) {
                throw new Error('Channel is null')
            }
            if (channel.type == discord.ChannelType.GuildText) {
                console.log(`Cloning text channel ${channel.name}...`);
                //skip creating folder if I already made one
                if (!fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}`)) {
                    console.log(`Creating channel folder`)
                    fs.mkdirSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}`);
                    fs.writeFileSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}/metadata`, JSON.stringify(channel.toJSON(), null, 4));
                }
                try {
                    console.log("Trying 1 fetch operation...");
                    //see if I can fetch 1 message
                    await channel.messages.fetch({ limit: 1 });
                }
                catch (error) {
                    //if I can't don't bother doing any more
                    console.log('No permissions available');
                    //and add a tag marking this as unusable
                    fs.writeFileSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}/noperms`, '')
                    continue;
                }
                //otherwise:
                //make a db for all messages unless it exists
                if (!fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}/messages.sqlite.db`)) {
                    console.log('Creating message backup database...');
                    let declaredb = await open({
                        filename: `../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}/messages.sqlite.db`,
                        driver: sqlite3.verbose().Database
                    });
                    await declaredb.exec(`CREATE TABLE Messages (
                        id INTEGER NOT NULL PRIMARY KEY,
                        content TEXT,
                        attachments TEXT,
                        created INTEGER NOT NULL,
                        edited INTEGER
                    );`);
                    await declaredb.close();
                }
                let lastID: null | string = null;
                let nbatch = 0;
                const db = await open({
                    filename: `../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}/messages.sqlite.db`,
                    driver: sqlite3.verbose().Database
                });
                console.log(`Backing up ${channel.name}`);
                while (true) {
                    nbatch++;
                    const fetchopts: discord.FetchMessagesOptions = (lastID == null) ? { limit: 100 } : { limit: 100, before: lastID };
                    const messages = await channel.messages.fetch(fetchopts);
                    if (channel == null) {
                        throw new Error('null channel');
                    }

                    let lastMSG = messages.at(-1);
                    if (lastMSG == undefined) {
                        throw new Error('undefined element at -1');
                    }
                    lastID = lastMSG.id;
                    console.log(`Backing up ${messages.size} messages... (batch ${nbatch}, ${messages.at(-1)?.createdAt.toDateString()} thru ${messages.at(0)?.createdAt.toDateString()})`)
                    for (let [_id, msg] of messages) {
                        //create array of all attachment and embed ids
                        let allAttachments = [];
                        for (let [_id, attachment] of msg.attachments) {
                            allAttachments.push({ type: 'attachment', id: attachment.id });
                        }
                        for (let [_id, sticker] of msg.stickers) {
                            allAttachments.push({ type: 'sticker', id: sticker.id });
                        }
                        for (let embed of msg.embeds) {
                            allAttachments.push({ type: 'embed', content: embed });
                        }
                        //db insert query
                        await db.exec(`INSERT INTO Messages (
                                id,
                                content,
                                attachments,
                                created,
                                edited
                            ) VALUES (
                                ${msg.id},
                                "${Buffer.from(msg.content).toString('base64')}",
                                "${Buffer.from(JSON.stringify(allAttachments)).toString('base64')}",
                                ${msg.createdTimestamp},
                                ${msg.editedTimestamp ? msg.editedTimestamp : 'null'}
                            )`);
                        process.stdout.write('🗩');

                        //archive attachments
                        if (msg.attachments.size > 0) {
                            msg.attachments.each((attachment, _key, _) => {
                                if (
                                    !fs.existsSync(`../serverclone/userdata/attachments/${attachment.id}`) &&
                                    !fs.existsSync(`../serverclone/userdata/attachments/${attachment.id}.json`)
                                ) {
                                    fs.writeFileSync(`../serverclone/userdata/attachments/${attachment.id}.json`, JSON.stringify(attachment, null, 4));
                                    process.stdout.write('🗋');
                                }
                            });
                        }

                        //archive stickers
                        if (msg.stickers.size > 0) {
                            msg.stickers.each((sticker, _key, _) => {
                                if (
                                    !fs.existsSync(`../serverclone/userdata/stickers/${sticker.id}`) &&
                                    !fs.existsSync(`../serverclone/userdata/stickers/${sticker.id}.json`)
                                ) {
                                    fs.writeFileSync(`../serverclone/userdata/stickers/${sticker.id}.json`, JSON.stringify({
                                        description: sticker.description,
                                        format: sticker.format,
                                        id: sticker.id,
                                        name: sticker.name,
                                        tags: sticker.tags,
                                        url: sticker.url
                                    }, null, 4));
                                    process.stdout.write('𓉡');
                                }
                            })
                        }

                        //archive users
                        if (
                            !fs.existsSync(`../serverclone/userdata/users/${msg.author.id}`) &&
                            !fs.existsSync(`../serverclone/userdata/users/${msg.author.id}.json`)
                        ) {
                            fs.writeFileSync(`../serverclone/userdata/${msg.author.id}.json`, JSON.stringify({
                                name: msg.author.username,
                                id: msg.author.id,
                                tag: msg.author.toString(),
                                avatar: msg.author.avatarURL(),
                            }, null, 4));
                        }
                    }
                    process.stdout.write('\n');
                    if (messages.size < 100) {
                        console.log(`Under 100 messages (${messages.size}): ${channel.name} fully backed up.`);
                        break;
                    }
                }
                await db.close();
            }
            //also clone vc meta
            else if (channel.type == discord.ChannelType.GuildVoice) {
                console.log('Saving voice channel metadata...');
                if (!fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}`)) {
                    console.log(`Creating channel folder`)
                    fs.mkdirSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name.replace(/\?/gm, '')}`);
                    fs.writeFileSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name.replace(/\?/gm, '')}/metadata`, JSON.stringify(channel.toJSON(), null, 4));
                }
            }
        }
    })

    downloadAllAttachments();
    downloadAllStickers();
    downloadAllUsers();
})
bot.login(token);