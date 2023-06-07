import fs from 'fs';
import https from 'https';

type attachment = {
    attachment: string,
    name: string,
    id: string,
    size: number,
    url: string,
    proxyUrl: string,
    height: number | null,
    width: number | null,
    contentType: any,
    description: any,
    ephemeral: any,
    duration: any,
    waveform: any
}

async function downloadAll() {
    for (let filename of fs.readdirSync('../serverclone/userdata/attachments')) {
        let [id, _extension] = filename.split('.');
        let filepath = `../serverclone/userdata/attachments/${filename}`;
        let newpath = `../serverclone/userdata/attachments/${id}/${filename}`
        if (fs.lstatSync(filepath).isDirectory()) {
            console.log(`undoing old work for ${id}`);
            fs.renameSync(`${filepath}/${id}.json`, `../serverclone/userdata/attachments/${id}.json`);
            fs.rmSync(filepath, { recursive: true, force: true });
            continue;
        }
        console.log(`Creating download dir for ${id}`);
        fs.mkdirSync(`../serverclone/userdata/attachments/${id}`);
        console.log(`Moving ${filename} to download dir`);
        fs.renameSync(filepath, newpath);
        const content: attachment = JSON.parse(fs.readFileSync(newpath).toString());
        console.log('Creating write stream for download');
        const outfile = fs.createWriteStream(`../serverclone/userdata/attachments/${id}/${content.name}`);
        console.log(`Downloading ${content.name} (id ${id})`);
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
    }
};
downloadAll();