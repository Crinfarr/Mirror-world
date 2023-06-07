import fs from 'fs';
import discord from 'discord.js'

const { token, guildid } = JSON.parse(fs.readFileSync('../.creds.json').toString());
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
                //make a csv for all messages unless it exists
                //also check that parent folders exist first
                if (!fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}`)) {
                    fs.mkdirSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}`);
                }
                if (!fs.existsSync(`../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}/messages.csv`)) {
                    console.log('Creating message backup csv...');
                    fs.writeFileSync(
                        `../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}/messages.csv`,
                        'user,content,attachments,stickers,createdTimestamp,editedTimestamp\n'
                    );
                }

                let last: string = 'null';
                //loop batch message requests (should auto delay itself)
                console.log('Backing up ' + channel.name);
                let nbatch = 0;
                while (true) {
                    nbatch++;
                    const fetchopts = (last == 'null') ? { limit: 100 } : { limit: 100, before: last }
                    let msgs = await channel.messages.fetch(fetchopts);
                    if (msgs === undefined) {
                        throw new Error('Message object undefined');
                    }

                    console.log(`Backing up ${msgs.size} messages... (batch ${nbatch}: ${msgs.at(-1)?.createdAt.toDateString()} thru ${msgs.at(0)?.createdAt.toDateString()})`);
                    for (let [_id, msg] of msgs) {
                        //backup attachment by id
                        if (msg.attachments.size > 0) {
                            msg.attachments.each((attachment, _key, _) => {
                                //ignore if it exists
                                if (!fs.existsSync(`../serverclone/userdata/attachments/${attachment.id}.json`)) {
                                    // console.log(`Backing up attachment ${attachment.id}`);
                                    process.stdout.write('🗋');
                                    fs.writeFileSync(`../serverclone/userdata/attachments/${attachment.id}.json`, JSON.stringify(attachment, null, 4))
                                }
                            });
                        }

                        //backup sticker by id
                        if (msg.stickers?.size > 0) {
                            msg.stickers.each((sticker, _key, _) => {
                                //ignore if exists
                                if (!fs.existsSync(`../serverclone/userdata/stickers/${sticker.id}.json`)) {
                                    // console.log(`Backing up sticker ${sticker.id}`);
                                    process.stdout.write('𓉡');
                                    fs.writeFileSync(`../serverclone/userdata/stickers/${sticker.id}.json`, JSON.stringify({
                                        description: sticker.description,
                                        format: sticker.format,
                                        id: sticker.id,
                                        name: sticker.name,
                                        tags: sticker.tags,
                                        url: sticker.url
                                    }, null, 4));
                                }
                            });
                        }

                        // Write user data if it does not exist
                        if (!fs.existsSync(`../serverclone/userdata/${msg.author?.id}.json`)) {
                            // console.log(`\nBacking up user ${msg.author.username}`);
                            process.stdout.write('𓀀');
                            fs.writeFileSync(`../serverclone/userdata/${msg.author.id}.json`, JSON.stringify({
                                name: msg.author.username,
                                id: msg.author.id,
                                tag: msg.author.toString(),
                                avatar: msg.author.avatarURL(),
                            }, null, 4));
                        }

                        //create attachment id reference string
                        let attachids = '';
                        if (msg.attachments.size > 0) {
                            msg.attachments.each((attachment, _key, _) => {
                                attachids += ':' + attachment.id
                            });
                        }
                        //create sticker id reference string
                        let stickerids = '';
                        if (msg.stickers.size > 0) {
                            msg.stickers.each((sticker, _key, _) => {
                                stickerids += ':' + sticker.id
                            });
                        }

                        //write message data to csv
                        if (channel === null) {
                            throw new Error('Channel is null');
                        }
                        fs.appendFileSync(
                            `../serverclone/channels/${(channel.parent) ? channel.parent.name + '/' : ''}${channel.name}/messages.csv`,
                            `${msg.author.id},${encodeURIComponent(msg.content)},${attachids},${stickerids},${msg.createdTimestamp},${msg.editedTimestamp}\n`
                        );
                        process.stdout.write('🗩');
                    }
                    process.stdout.write('\n');
                    if ((msgs.size < 100) || last == msgs.at(-1)?.id) {
                        console.log(`Under 100 messages (${msgs.size}): ${channel.name} fully backed up`);
                        break;
                    }
                    let id = msgs.at(-1)?.id
                    if (id !== undefined) {
                        last = id;
                    }
                }
            }
        }
    })
})
bot.login(token);