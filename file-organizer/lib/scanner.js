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
                stats = await fs.stat(fullPath);
            } catch (err) {
                this.emit('file-error', {fullPath, error: err.message});
                continue;
            }

            if (!stats.isFile()) continue;

            const {size, mtime} = stats;
            const extension = path.extname(relativePath).toLowerCase() || '(no extension)';

            const ageInDays = (Date.now() - mtime.getTime()) / (1000 * 60 * 60 * 24);
            
            if (ageInDays <= 7) last7Days++;
            if(ageInDays <=30) last30Days++;
            if(ageInDays > 90) olderThan90Days++;

            totalSize += size;

        }
    }
}