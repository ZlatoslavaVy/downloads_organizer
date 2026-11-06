import {EventEmitter} from 'events';
import fs from 'fs/promises';
import path from 'path';

export class Scanner extends EventEmitter {
    async scan(directory) {
        this.emit('scan-start', {directory});
        const reletivePaths = await fs.readdir(directory, {recursive: true});

        const filesData = [];
        const byType = new Map();

        let totalSize = 0;
        let last7Days = 0;
        let last30Days = 0;
        let olderThan90Days = 0;

        for (const relativePath of relativePaths) {
            const fullPath = path.join(directory, relativePath);

            let stats;
            try {
                stats = await fs.stats(fullPath);
            } catch (err) {
                this.emit('file-error', {fullPath, error: err.message});
                continue;
            }
        }
    }
}