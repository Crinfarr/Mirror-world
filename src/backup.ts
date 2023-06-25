import { ChannelType, Client, FetchMessagesOptions } from 'discord.js';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import https from 'https';

export function backupServer(serverid: string) {
    return new Promise<Client<true>>(async (backupComplete, backupErrored) => {
        const bot = new Client({
            intents: [
                'GuildMessages',
                'MessageContent'
            ]
        });
        if (!fs.existsSync('../serverclone')) fs.mkdirSync('../serverclone');
        const db = await open({
            driver: sqlite3.verbose().Database,
            filename: '../serverclone/server.db'
        });
        await db.exec(`
        CREATE TABLE IF NOT EXISTS Messages (
            id TEXT NOT NULL PRIMARY KEY,
            channelid TEXT NOT NULL,
            authorid TEXT NOT NULL,
            content TEXT,
            attachments TEXT,
            created INTEGER NOT NULL,
            edited INTEGER
        );
        `);
        await db.exec(`
        CREATE TABLE IF NOT EXISTS Channels (
            id TEXT NOT NULL PRIMARY KEY,
            name TEXT NOT NULL,
            channeltype INTEGER,
            metadata TEXT NOT NULL
        );
        `);
        await db.exec(`
        CREATE TABLE IF NOT EXISTS Webhooks (
            originalChannel TEXT NOT NULL UNIQUE,
            hookURL TEXT NOT NULL
        );
        `);
        await db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            uid TEXT NOT NULL PRIMARY KEY,
            avatar BLOB,
            username TEXT NOT NULL
        );
        `);
        bot.on('ready', (client) => {
            console.log(`Logged in as ${client.user.username}`);
            client.user.setStatus('invisible');
            process.stdout.write('👁');
            client.guilds.cache.get(serverid)?.channels.fetch().then(async (channels) => {
                for (let [id, channel] of channels) {
                    if (channel === null) {
                        throw new Error('Channel is null');
                    }
                    db.exec(`
                    INSERT INTO Channels (
                        id,
                        name,
                        channeltype,
                        metadata
                    ) VALUES (
                        "${id}",
                        "${channel.name}",
                        ${channel.type},
                        "${Buffer.from(JSON.stringify(channel.toJSON())).toString('base64')}"
                    );
                    `);
                    if (channel.type == ChannelType.GuildCategory) {
                        process.stdout.write(`📁Creating category ${channel.name}                                        \n`);
                    }
                    else if (channel.type == ChannelType.GuildText) {
                        process.stdout.write(`❔Trying fetch operation on ${channel.name}                                        \n`);
                        try {
                            await channel.messages.fetch({
                                limit: 1
                            });
                            process.stdout.write(`✔Fetch succeeded on ${channel.name}                                        \n`);
                        }
                        catch (error) {
                            console.error(error);
                            process.stdout.write(`❌Fetch failed on ${channel.name}; Not backing up                                        \n`);
                            continue;
                        }

                        let lastid: null | string = null;
                        while (true) {
                            let fetchopts: FetchMessagesOptions;
                            if (lastid == null) fetchopts = { limit: 100 }
                            else fetchopts = { limit: 100, before: lastid };

                            const messages = await channel.messages.fetch(fetchopts);
                            let lastmsg = messages.at(-1);
                            if (lastmsg == undefined) {
                                console.error('UNDEFINED ELEMENT AT -1');
                                break;
                            }
                            lastid = lastmsg.id;
                            for (let [_id, msg] of messages) {
                                let attachments = [];
                                for (let [_id, attachment] of msg.attachments) {
                                    const afile = fs.createWriteStream('tmp.bin');
                                    let downloadFailed = false;
                                    process.stdout.write(`🗋Downloading file ${attachment.name}                                       \n`);
                                    await new Promise((res, rej) => {
                                        https.get(attachment.proxyURL, (response) => {
                                            response.on('error', (e) => {
                                                process.stdout.write(`💥Download failed for ${attachment.name}`);
                                                downloadFailed = true;
                                                //FwCOooAWYAEH9c9.jpg makes this break
                                                res(null);
                                            })
                                            afile.on('finish', () => {
                                                afile.close();
                                                res(null);
                                            });
                                            afile.on('error', () => {
                                                rej(null);
                                            });
                                            response.pipe(afile);
                                        })
                                    });
                                    if (downloadFailed) continue;
                                    process.stdout.write(`✔File ${attachment.name} downloaded                                        \n`);
                                    attachments.push(
                                        {
                                            type: 'attachment',
                                            filename: attachment.name,
                                            content: fs.readFileSync('tmp.bin').toString('base64')
                                        }
                                    );
                                    fs.rmSync('tmp.bin');
                                    process.stdout.write(`🔒File ${attachment.name} saved                                        \n`);
                                }
                                for (let [_id, sticker] of msg.stickers) {
                                    const afile = fs.createWriteStream('tmp.bin');
                                    process.stdout.write(`🗖Downloading sticker ${sticker.name}                                        \n`);
                                    await new Promise((res, rej) => {
                                        https.get(sticker.url, (response) => {

                                            response.on('error', () => {
                                                res(null);
                                            })
                                            afile.on('finish', () => {
                                                afile.close();
                                                res(null);
                                            });
                                            afile.on('error', () => {
                                                rej(null);
                                            });
                                            response.pipe(afile);
                                        })
                                    });
                                    process.stdout.write(`✔Sticker ${sticker.name} downloaded                                        \n`);
                                    attachments.push(
                                        {
                                            type: 'sticker',
                                            filename: /(?<=stickers\/).+\..+$/gm.exec(sticker.url),
                                            content: fs.readFileSync('tmp.bin').toString('base64')
                                        }
                                    );
                                    fs.rmSync('tmp.bin');
                                    process.stdout.write(`🔒Sticker ${sticker.name} saved                                        \n`);
                                }
                                for (let embed of msg.embeds) {
                                    process.stdout.write(`🗔Downloading embed                                        \n`);
                                    attachments.push({
                                        type: 'embed',
                                        content: embed
                                    });
                                    process.stdout.write('🔒');
                                }
                                await new Promise(async (resolve, _reject) => {
                                    // process.stdout.write('❔');
                                    //insert user into db if they don't exist in it already
                                    if (!await db.get(`SELECT * FROM Users WHERE uid IS "${msg.author.id}";`)) {
                                        const afile = fs.createWriteStream('tmp.bin');
                                        let NOAVATAR = false;
                                        await new Promise((resolve2, reject2) => {
                                            process.stdout.write(`👤Downloading user ${msg.author.username} avatar                                        \n`);
                                            if (typeof msg.author.avatarURL({ forceStatic: true }) !== 'string' || msg.author.avatarURL({ forceStatic: true }) == 'null') {
                                                afile.close();
                                                process.stdout.write(`✖User ${msg.author.username} has no avatar                                        \n`);
                                                NOAVATAR = true;
                                                resolve2(null);
                                                return;
                                            }
                                            https.get(msg.author.avatarURL({ forceStatic: true })!, (response) => {

                                                response.on('error', (e) => {
                                                    process.stdout.write(`💥Error downloading avatar from user ${msg.author.username}                                   \n`);
                                                    NOAVATAR = true;
                                                    resolve2(null);
                                                });
                                                afile.on('finish', () => {
                                                    afile.close();
                                                    process.stdout.write('✔');
                                                    resolve2(null);
                                                });
                                                afile.on('error', () => {
                                                    reject2(null);
                                                });
                                                response.pipe(afile);
                                            });
                                        })
                                        process.stdout.write('🔒Avatar downloaded successfully');
                                        await db.exec(`
                                        INSERT INTO Users (
                                            uid,
                                            avatar,
                                            username
                                        ) VALUES (
                                            "${msg.author.id}",
                                            "${(NOAVATAR) ? null : fs.readFileSync('tmp.bin').toString('base64')}",
                                            "${msg.author.username}"
                                        )
                                        `);
                                        fs.rmSync('tmp.bin');
                                        resolve(null);
                                    }
                                    else {
                                        resolve(null);
                                    }
                                });
                                await db.exec(`
                                INSERT INTO Messages (
                                    id,
                                    channelid,
                                    authorid,
                                    content,
                                    attachments,
                                    created,
                                    edited
                                ) VALUES (
                                    "${msg.id}",
                                    "${msg.channelId}",
                                    "${msg.author.id}",
                                    "${Buffer.from(msg.content).toString('base64')}",
                                    "${Buffer.from(JSON.stringify(attachments)).toString('base64')}",
                                    ${msg.createdTimestamp},
                                    ${msg.editedTimestamp}
                                )
                                `);
                                process.stdout.write(`🗪Message ${msg.id} logged                                        \n`);
                            }
                            if (messages.size < 100) {
                                process.stdout.write(`🗍All messages backed up from ${channel.name}                                        \n\n`);
                                break;
                            }
                        }
                    }
                }
                backupComplete(client);
            })
        })
        bot.on('messageCreate', async (msg) => {
            let attachments = [];
            for (let [_id, attachment] of msg.attachments) {
                const afile = fs.createWriteStream('tmp.bin');
                process.stdout.write(`🗋Downloading file ${attachment.name}                                       \n`);
                await new Promise((res, rej) => {
                    https.get(attachment.proxyURL, (response) => {
                        afile.on('finish', () => {
                            afile.close();
                            res(null);
                        });
                        afile.on('error', () => {
                            rej(null);
                        })
                        response.pipe(afile);
                    });
                });
                process.stdout.write(`✔File ${attachment.name} downloaded                                        \n`);
                attachments.push(
                    {
                        type: 'attachment',
                        filename: attachment.name,
                        content: fs.readFileSync('tmp.bin').toString('base64')
                    }
                );
                fs.rmSync('tmp.bin');
                process.stdout.write(`🔒File ${attachment.name} saved                                        \n`);
            }
            for (let [_id, sticker] of msg.stickers) {
                const afile = fs.createWriteStream('tmp.bin');
                process.stdout.write(`🗖Downloading sticker ${sticker.name}                                        \n`);
                await new Promise((res, rej) => {
                    https.get(sticker.url, (response) => {
                        response.on('error', () => {
                            res(null);
                        });
                        afile.on('finish', () => {
                            afile.close();
                            res(null);
                        });
                        afile.on('error', () => {
                            rej(null);
                        });
                        response.pipe(afile);
                    })
                });
                process.stdout.write(`✔Sticker ${sticker.name} downloaded                                        \n`);
                attachments.push(
                    {
                        type: 'sticker',
                        filename: /(?<=stickers\/).+\..+$/gm.exec(sticker.url),
                        content: fs.readFileSync('tmp.bin').toString('base64')
                    }
                );
                fs.rmSync('tmp.bin');
                process.stdout.write(`🔒Sticker ${sticker.name} saved                                        \n`);
            }
            for (let embed of msg.embeds) {
                process.stdout.write(`🗔Downloading embed                                        \n`);
                attachments.push({
                    type: embed,
                    content: embed
                });
                process.stdout.write('🔒');
            }
            await new Promise(async (resolve, _reject) => {
                // process.stdout.write('❔');
                //insert user into db if they don't exist in it already
                if (!await db.get(`SELECT * FROM Users WHERE uid IS "${msg.author.id}";`)) {
                    const afile = fs.createWriteStream('tmp.bin');
                    let NOAVATAR = false;
                    await new Promise((resolve2, reject2) => {
                        process.stdout.write(`👤Downloading user ${msg.author.username} avatar                                        \n`);
                        if (typeof msg.author.avatarURL({ forceStatic: true }) !== 'string' || msg.author.avatarURL({ forceStatic: true }) == 'null') {
                            afile.close();
                            process.stdout.write(`✖User ${msg.author.username} has no avatar                                        \n`);
                            NOAVATAR = true;
                            resolve2(null);
                            return;
                        }
                        https.get(msg.author.avatarURL({ forceStatic: true })!, (response) => {

                            response.on('error', (e) => {
                                process.stdout.write(`💥Error downloading avatar from user ${msg.author.username}                                   \n`);
                                NOAVATAR = true;
                                resolve2(null);
                            });
                            afile.on('finish', () => {
                                afile.close();
                                process.stdout.write('✔');
                                resolve2(null);
                            });
                            afile.on('error', () => {
                                reject2(null);
                            });
                            response.pipe(afile);
                        });
                    })
                    process.stdout.write('🔒Avatar downloaded successfully');
                    await db.exec(`
                    INSERT INTO Users (
                        uid,
                        avatar,
                        username
                    ) VALUES (
                        "${msg.author.id}",
                        "${(NOAVATAR) ? null : fs.readFileSync('tmp.bin').toString('base64')}",
                        "${msg.author.username}"
                    )
                    `);
                    fs.rmSync('tmp.bin');
                    resolve(null);
                }
                else {
                    resolve(null);
                }
            });
            await db.exec(`
            INSERT INTO Messages (
                id,
                channelid,
                authorid,
                content,
                attachments,
                created,
                edited
            ) VALUES (
                "${msg.id}",
                "${msg.channelId}",
                "${msg.author.id}",
                "${Buffer.from(msg.content).toString('base64')}",
                "${Buffer.from(JSON.stringify(attachments)).toString('base64')}",
                ${msg.createdTimestamp},
                ${msg.editedTimestamp}
            )
            `);
            process.stdout.write(`New message ${msg.id} logged                                   \n`)
        });
        bot.login(JSON.parse(fs.readFileSync('../.creds.json').toString()).archiver.token);
    });
}
if (require.main == module) {
    backupServer(JSON.parse(fs.readFileSync('../.creds.json').toString()).archiver.guildid).then((client) => {
        console.log(`\nDestroying ${client.user.id}`);
        client.destroy()
    });
}