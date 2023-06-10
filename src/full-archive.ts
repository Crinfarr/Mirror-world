import fs from 'fs';
import https from 'https';
import { attachment, sticker, user } from './types';

export async function downloadAllAttachments() {
    for (let filename of fs.readdirSync('../serverclone/userdata/attachments')) {
        let [id, _extension] = filename.split('.');
        let filepath = `../serverclone/userdata/attachments/${filename}`;
        let newpath = `../serverclone/userdata/attachments/${id}/${filename}`
        if (fs.lstatSync(filepath).isDirectory()) {
            // console.log(`Found old work for ${id}`);
            continue;
        }
        if (id == '') {
            console.log('Ignoring empty id');
            continue;
        }
        // console.log(`Creating download dir for ${id}`);
        fs.mkdirSync(`../serverclone/userdata/attachments/${id}`);
        // console.log(`Moving ${filename} to download dir`);
        fs.renameSync(filepath, newpath);
        const content: attachment = JSON.parse(fs.readFileSync(newpath).toString());
        // console.log('Creating write stream for download');
        const outfile = fs.createWriteStream(`../serverclone/userdata/attachments/${id}/${content.name}`);
        // console.log(`Downloading ${content.name} (id ${id})`);
        await new Promise((resolve, reject) => {
            https.get(content.url, (res) => {
                res.pipe(outfile);
                outfile.on('finish', () => {
                    outfile.close();
                    console.log(`${content.name} downloaded successfully`);
                    resolve(null);
                });
                outfile.on('error', () => {
                    console.log(`${content.name} download failed`);
                    reject(null);
                });
            });
        });
        process.stdout.write('🌐');
    }
    //add a note for the archiver to let it know everything is done
    fs.writeFileSync(`../serverclone/userdata/attachments/.archived`, '');
};
export async function downloadAllStickers() {
    for (let filename of fs.readdirSync('../serverclone/userdata/stickers')) {
        let [id, _extension] = filename.split('.');
        let filepath = `../serverclone/userdata/stickers/${filename}`;
        let newpath = `../serverclone/userdata/stickers/${id}/${filename}`;
        if (fs.lstatSync(filepath).isDirectory()) {
            // console.log(`Found old work for ${id}`);
            continue;
        }
        // console.log(`Creating download dir for ${id}`);
        fs.mkdirSync(`../serverclone/userdata/stickers/${id}`);
        // console.log(`Moving ${filename} to download dir`);
        fs.renameSync(filepath, newpath);
        const content: sticker = JSON.parse(fs.readFileSync(newpath).toString());
        // console.log('Creating write stream for download');
        let fname = /(?<=stickers\/).+\..+$/gm.exec(content.url);
        if (fname == null) {
            throw new Error('Could not extract filename from ' + content.url);
        }
        const outfile = fs.createWriteStream(`../serverclone/userdata/stickers/${id}/${fname}`);
        // console.log(`Downloading ${fname} (${content.name})`);
        await new Promise((resolve, reject) => {
            https.get(content.url, (res) => {
                res.pipe(outfile);
                outfile.on('finish', () => {
                    outfile.close();
                    // console.log(`${fname} (${content.name}) downloaded successfully`);
                    resolve(null);
                });
                res.on('error', () => {
                    // console.log(`${content.name} download failed`);
                    reject(null);
                });
            });
        });
        process.stdout.write('🌐');
    }
    //add a note for the archiver to let it know everything is done
    fs.writeFileSync(`../serverclone/userdata/attachments/.archived`, '');
}
export async function downloadAllUsers() {
    for (let filename of fs.readdirSync('../serverclone/userdata/users')) {
        let [id, _extension] = filename.split('.');
        let filepath = `../serverclone/userdata/users/${filename}`;
        let newpath = `../serverclone/userdata/users/${id}/${filename}`;
        if (fs.lstatSync(filepath).isDirectory()) {
            // console.log(`Found old work for ${id}`);
            continue;
        }
        // console.log(`Creating download dir for ${id}`);
        fs.mkdirSync(`../serverclone/userdata/users/${id}`);
        // console.log(`Moving ${filename} to download dir`);
        fs.renameSync(filepath, newpath);
        const content: user = JSON.parse(fs.readFileSync(newpath).toString());
        if (content.avatar == null) {
            // console.log(`User ${content.name} has no avatar`);
            continue;
        }
        // console.log('Creating write stream for download');
        let fname = new RegExp(`(?<=${id}\/).+\..+$`).exec(content.avatar);
        if (fname == null) {
            throw new Error('Could not extract filename from ' + content.avatar);
        }
        const outfile = fs.createWriteStream(`../serverclone/userdata/users/${id}/${fname}`);
        // console.log(`Downloading ${fname} (${content.name})`);
        await new Promise((resolve, reject) => {
            https.get(content.avatar, (res) => {
                res.pipe(outfile);
                outfile.on('finish', () => {
                    outfile.close();
                    // console.log(`${fname} (${content.name}) downloaded successfully`);
                    resolve(null);
                });
                res.on('error', () => {
                    // console.log(`${content.name} download failed`);
                    reject(null);
                });
            });
        });
        process.stdout.write('🌐');
    }
    //add a note for the archiver to let it know everything is done
    fs.writeFileSync(`../serverclone/userdata/attachments/.archived`, '');
}
if (require.main == module) {
    downloadAllAttachments();
    process.stdout.write('\n');
    downloadAllStickers();
    process.stdout.write('\n');
    downloadAllUsers();
    process.stdout.write('\n');
}