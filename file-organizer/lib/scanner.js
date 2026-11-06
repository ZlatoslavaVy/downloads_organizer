import {EventEmitter} from 'events';
import fs from 'fs/promises';
import path from 'path';

export class Scanner extends EventEmitter {
    async scan(directory) {
        this.emit('scan-start', {directory});
        const reletivePaths = await fs.readdir(directory, {recursive: true});

        try {
          stats = fs.stat(fullPath);  
        } catch (err) {
            this.emit('file-error', {fullPath, error: err.message})
        }
        
    }
}