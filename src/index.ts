import fs from 'fs';
import discord from 'discord.js'
import { downloadAllAttachments, downloadAllStickers, downloadAllUsers } from './full-archive';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { restoreServer } from './restore';

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
    fs.mkdirSync('../serverclone/userdata/users');
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
                console.log(`Cloning category ${channel.name.replace(/[\.\?\'\"]/gm, '')}...`);
                //create a folder to hold it unless I already did
                if (fs.existsSync(`../serverclone/channels/${channel.name.replace(/[\.\?\'\"]/gm, '')}`)) {
                    console.log('Folder exists, continuing...')
                    continue;
                }
                if (!fs.existsSync(`../serverclone/channels/${channel.name.replace(/[\.\?\'\"]/gm, '')}`)) {
                    console.log(`Creating folder...`)
                    fs.mkdirSync(`../serverclone/channels/${channel.name.replace(/[\.\?\'\"]/gm, '')}`);
                }

                console.log('writing metadata...')
                //write json metadata of channel into file
                fs.writeFileSync(`../serverclone/channels/${channel.name.replace(/[\.\?\'\"]/gm, '')}/metadata`, JSON.stringify(channel.toJSON(), null, 4));
                console.log('Done');
            }
        }
        for (let [_id, channel] of channels) {
            if (channel === null) {
                throw new Error('Channel is null')
            }
            if (channel.type == discord.ChannelType.GuildText) {
                console.log(`Cloning text channel ${channel.name.replace(/[\.\?\'\"]/gm, '')}...`);
                //skip creating folder if I already made one
                if (!fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}`)) {
                    console.log(`Creating channel folder`)
                    fs.mkdirSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}`);
                    fs.writeFileSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/metadata`, JSON.stringify(channel.toJSON(), null, 4));
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
                    fs.writeFileSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/noperms`, '')
                    continue;
                }
                //otherwise:

                //preset vars to defaults
                let lastID: null | string = null;
                let incremental = false;
                let nbatch = 0;

                //enable incremental mode if there's an existing server db
                if (fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/messages.sqlite.db`)) {
                    const db = await open({
                        filename: `../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/messages.sqlite.db`,
                        driver: sqlite3.verbose().Database
                    });
                    let tID = await db.get('SELECT id FROM Messages ORDER BY created DESC LIMIT 1;');
                    if (tID == null || tID == undefined) {
                        throw new Error('DB exists but no messages were added, please delete it.');
                    }
                    lastID = tID.id;
                    incremental = true;
                    console.log(`Existing db for ${channel.name} detected`);
                }
                //don't make the db before checking if it exists, dumbass
                if (!fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/messages.sqlite.db`)) {
                    console.log('Creating message backup database...');
                    console.log(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/messages.sqlite.db`);
                    let declaredb = await open({
                        filename: `../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/messages.sqlite.db`,
                        driver: sqlite3.verbose().Database
                    });
                    console.log('executing db init');
                    await declaredb.exec(`CREATE TABLE Messages (
                        id TEXT NOT NULL PRIMARY KEY,
                        author TEXT NOT NULL,
                        content TEXT,
                        attachments TEXT,
                        created INTEGER NOT NULL,
                        edited INTEGER
                    );`);
                    console.log('committing');
                    await declaredb.close();
                }
                console.log(`Backing up ${channel.name.replace(/[\.\?\'\"]/gm, '')}`);
                const db = await open({
                    filename: `../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/messages.sqlite.db`,
                    driver: sqlite3.verbose().Database
                });
                while (true) {
                    nbatch++;
                    let fetchopts: discord.FetchMessagesOptions;
                    if (lastID == null) {
                        fetchopts = { limit: 100 }
                    }
                    else {
                        fetchopts = { limit: 100, before: lastID };
                    }
                    if (incremental && lastID !== null) {
                        console.log('Incremental backup enabled: selecting messages since ' + lastID);
                        fetchopts = { limit: 100, after: lastID };
                    }
                    const messages = await channel.messages.fetch(fetchopts);
                    if (channel == null) {
                        throw new Error('null channel');
                    }

                    let lastMSG = messages.at(-1);
                    if (lastMSG == undefined) {
                        console.error('undefined element at -1');
                        break;
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
                                author,
                                content,
                                attachments,
                                created,
                                edited
                            ) VALUES (
                                "${msg.id}",
                                "${msg.author.id}",
                                "${Buffer.from(msg.content).toString('base64')}",
                                "${Buffer.from(JSON.stringify(allAttachments)).toString('base64')}",
                                ${msg.createdTimestamp},
                                ${msg.editedTimestamp ? msg.editedTimestamp : 'null'}
                            )`).catch((_) => {
                            process.stdout.write('?');
                        })
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
                            fs.writeFileSync(`../serverclone/userdata/users/${msg.author.id}.json`, JSON.stringify({
                                name: msg.author.username,
                                id: msg.author.id,
                                tag: msg.author.toString(),
                                avatar: msg.author.avatarURL(),
                            }, null, 4));
                        }
                    }
                    process.stdout.write('\n');
                    if (messages.size < 100) {
                        console.log(`Under 100 messages (${messages.size}): ${channel.name.replace(/[\.\?\'\"]/gm, '')} fully backed up.`);
                        break;
                    }
                }
                await db.close();
            }
            //also clone vc meta
            else if (channel.type == discord.ChannelType.GuildVoice) {
                console.log('Saving voice channel metadata...');
                if (!fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}`)) {
                    fs.mkdirSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}`);
                    fs.writeFileSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name.replace(/[\.\?\'\"]/gm, '') + '/' : ''}${channel.name.replace(/[\.\?\'\"]/gm, '')}/metadata`, JSON.stringify(channel.toJSON(), null, 4));
                }
            }
        }
        await downloadAllAttachments();
        await downloadAllStickers();
        await downloadAllUsers();
        await restoreServer();
    });


})
bot.login(token);