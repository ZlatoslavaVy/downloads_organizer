import {EventEmitter} from 'events';
import fs from 'fs/promises';
import path from 'path';

export class Scanner extends EventEmitter {
    async scan(directory) {
        this.emit('scan-start', {directory});
        const relativePaths = await fs.readdir(directory, {recursive: true});

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
            const typeEntry = byType.get(extension) ?? { count: 0, totalSize: 0};
            typeEntry.count += 1;
            typeEntry.totalSize += size;
            byType.set(extension, typeEntry);

            const fileItem = { 
                name: path.basename(relativePath), 
                path: fullPath, 
                relativePath, 
                size, 
                mtime, 
                ageInDays, 
                extension
            };
           filesData.push(fileItem);
           this.emit('file-found', fileItem);
        }
           let oldestFile = null;
           if (filesData.length > 0) {
            oldestFile = filesData.reduce((oldest, current) =>
            current.mtime < oldest.mtime ? current: oldest
            );
           }
           const largestFiles = [...filesData]
           .sort((a, b) => b.size - a.size)
           .slice(0, 3);

           const summary = {
            totalFiles: filesData.length,
            totalSize,
            byType,
            ageStats: {
                last7Days,
                last30Days,
                olderThan90Days
            },
            largestFiles,
            oldestFile
           };
           this.emit('scan-complete', summary);
           return summary;
        }
    }
