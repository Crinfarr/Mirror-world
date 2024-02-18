import { ActivityType, Channel, Client } from "discord.js";
import fs from 'fs';
import {open as dbOpen} from 'sqlite';
import sqlite3 from 'sqlite3';


function channelStats(serverid:string, channelid:string) {
    return new Promise<Client<true>>(async (done, errored) => {
        const bot = new Client({
            intents: [
                'GuildMessages',
                'MessageContent'
            ]
        });
        if (fs.existsSync('../wordStats.db')) {
            console.log('Overwriting existing stat file')
            fs.rmSync('../wordStats.db');
        }
        const db = await dbOpen({
            driver:sqlite3.verbose().Database,
            filename: '../wordStats.db'
        });
        await db.exec(/*sql*/`
        CREATE TABLE IF NOT EXISTS wordstats (
            word TEXT NOT NULL PRIMARY KEY,
            count INTEGER NOT NULL
        );`);
        bot.on('ready', (client) => {
            console.log(`Logged in as ${client.user.username}`);
            client.user.setActivity({
                name: 'history fly by',
                type: ActivityType.Watching
            });
            const channel = (client.guilds.cache.get(serverid)?.channels.cache.get(channelid))
            if (!channel?.isTextBased) {
                throw new Error('Cannot read messages from non text channel');
            }
            //TODO archive logic (copy)
        });
    });
}