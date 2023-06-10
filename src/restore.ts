import fs from 'fs';
import { Attachment, AttachmentBuilder, AttachmentPayload, BufferResolvable, ChannelType, Client, Embed, Guild, GuildChannelCreateOptions, } from 'discord.js';
import { open } from 'sqlite';
import { Database } from 'sqlite3';
import { attachment, sticker, user } from './types';

const { token, guildid } = JSON.parse(fs.readFileSync('../.creds.json').toString()).restorer

export function restoreServer() {
    const bot = new Client({
        intents: [
            'GuildWebhooks',
        ]
    });

    bot.on('ready', async (client) => {
        // console.log(`Logged in as ${client.user.username}`);

        // console.log('Creating clone pod');
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
        process.stdout.write('🌐');
        for (let folder of fs.readdirSync('../serverclone/channels')) {
            const oldcategorymeta: GuildChannelCreateOptions & { type: ChannelType.GuildCategory } = JSON.parse(fs.readFileSync(`../serverclone/channels/${folder}/metadata`).toString());
            // console.log(`Cloning category ${oldcategorymeta.name}`);
            const categorymeta: GuildChannelCreateOptions & { type: ChannelType.GuildCategory } = {
                name: oldcategorymeta.name,
                position: oldcategorymeta.position,
                type: ChannelType.GuildCategory
            }
            const category = await ClonePod.channels.create(categorymeta);
            process.stdout.write('📂');
            // console.log(`Created category ${category.name}`);
            for (let subfolder of fs.readdirSync(`../serverclone/channels/${folder}`)) {
                if (subfolder == 'metadata') {
                    //ignore metadata
                    process.stdout.write('❔');
                    continue;
                }
                const oldchannelmeta: GuildChannelCreateOptions & { type: ChannelType.GuildText | ChannelType.GuildVoice } = JSON.parse(fs.readFileSync(`../serverclone/channels/${folder}/${subfolder}/metadata`).toString());
                // console.log(`Creating ${(oldchannelmeta.type == ChannelType.GuildText) ? 'Text' : 'Voice'} Channel ${oldchannelmeta.name}`);
                const channelmeta: GuildChannelCreateOptions & { type: ChannelType.GuildText | ChannelType.GuildVoice } = {
                    name: oldchannelmeta.name,
                    type: oldchannelmeta.type,
                    position: oldchannelmeta.position,
                    parent: category.id
                }
                const channel = await ClonePod.channels.create(channelmeta);
                if (channel.type == ChannelType.GuildText) {
                    // console.log('Creating restore hook...');
                    const hook = await channel.createWebhook({
                        name: 'Mirror World'
                    });
                    // console.log('Restoring messages...');
                    // console.log('Opening db');
                    const db = await open({
                        driver: Database,
                        filename: `../serverclone/channels/${folder}/${subfolder}/messages.sqlite.db`
                    });
                    process.stdout.write('👁‍🗨');
                    // console.log('Creating query');
                    let messages = await db.all(`SELECT * FROM Messages ORDER BY created ASC`);
                    db.close();
                    // console.log(messages);
                    if (!messages) {
                        continue; //if there are no messages in the db it returns a non iterable, I'm assuming it's falsy
                    }
                    for (let { _id, author, content, attachments, created, edited } of messages) {
                        //metadata of all attachments
                        const attachmentmeta: Array<{ type: "attachment" | "embed" | "sticker", id?: string, content?: Embed }> = JSON.parse(Buffer.from(attachments, 'base64').toString('utf-8'));
                        let messageEmbeds: Array<Embed> = [];

                        //exactly the type used by webhook files parameter
                        let messageAttachments: Array<(AttachmentBuilder | Attachment | AttachmentPayload | BufferResolvable)> = [];
                        //check if full archive mode is enabled (if it is, upload files instead of urls)
                        let fullArchiveMode = {
                            attachments: fs.existsSync(`../serverclone/userdata/attachments/.archived`),
                            stickers: fs.existsSync(`../serverclone/userdata/stickers/.archived`),
                            users: fs.existsSync(`../serverclone/userdata/users/.archived`)
                        }

                        //metadata of author
                        const authormeta: user = JSON.parse(fs.readFileSync(`../serverclone/userdata/users/${(fullArchiveMode.users) ? author + '/' : ''}${author}.json`).toString());

                        for (let { type, id, content } of attachmentmeta) {
                            switch (type) {
                                case "attachment":
                                    if (fullArchiveMode.attachments) {
                                        const ameta: attachment = JSON.parse(fs.readFileSync(`../serverclone/userdata/attachments/${id}/${id}.json`).toString());
                                        messageAttachments.push(`../serverclone/userdata/attachments/${id}/${ameta.name}`);
                                    }
                                    else {
                                        //try to resolve from url if attachment is not downloaded
                                        const ameta: attachment = JSON.parse(fs.readFileSync(`../serverclone/userdata/attachments/${id}.json`).toString());
                                        messageAttachments.push(ameta.url);
                                    }
                                    break;
                                case "embed":
                                    if (!content) {
                                        throw new Error('Undefined embed content');
                                    }
                                    messageEmbeds.push(content);
                                    break;
                                case "sticker":
                                    if (fullArchiveMode.stickers) {
                                        const smeta: sticker = JSON.parse(fs.readFileSync(`../serverclone/userdata/stickers/${id}/${id}.json`).toString());
                                        //weird regex bullshit way to extract filename from url
                                        messageAttachments.push(`../serverclone/userdata/stickers/${id}/${/(?<=stickers\/).+\..+$/gm.exec(smeta.url)}`);
                                    }
                                    else {
                                        //try to resolve from url if sticker is not downloaded
                                        const smeta: sticker = JSON.parse(fs.readFileSync(`../serverclone/userdata/stickers/${id}.json`).toString());
                                        messageAttachments.push(smeta.url);
                                    }
                                    break;
                                default:
                                    throw new Error('Unexpected attachment type ' + type);
                            }
                        }
                        await hook.send({
                            avatarURL: authormeta.avatar,
                            username: authormeta.name,
                            content: Buffer.from(content, 'base64').toString('utf-8'),
                            files: messageAttachments,
                            embeds: messageEmbeds
                        });
                        process.stdout.write('💬');
                    }
                }
            }
        }
    });

    bot.rest.on('rateLimited', (_) => {
        process.stdout.write('⏸️');
    });

    //HEY ALL OF THESE THINGS HAVE TO HAPPEN LAST
    bot.login(token);
}

if (require.main == module) {
    restoreServer()
}