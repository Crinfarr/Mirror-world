import { downloadAllAttachments, downloadAllStickers, downloadAllUsers } from "./full-archive";
import { restoreServer } from "./restore";
import { backupServer } from "./backup";

async function main() {
    await backupServer();
    await downloadAllAttachments();
    await downloadAllStickers();
    await downloadAllUsers();
    await restoreServer();
}
