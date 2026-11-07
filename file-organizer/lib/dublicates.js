import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs';
import { collectFiles } from './utils.js';

// Хеш рахується через stream: файл читається невеликими порціями (chunks),
// тому навіть дуже великі файли не займають багато оперативної пам'яті.
export function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export class DuplicateFinder extends EventEmitter {
  async find(directory) {
    this.emit('search-start', { directory });

    const allFiles = await collectFiles(directory, (fullPath, error) => {
      this.emit('file-error', { path: fullPath, error: error.message, code: error.code });
    });

    // Порожні файли пропускаємо: вони однакові, але місця не займають
    const files = allFiles.filter((file) => file.size > 0);

    const byHash = new Map(); // hash -> масив файлів
    let processed = 0;

    for (const file of files) {
      try {
        const hash = await calculateHash(file.path);
        const list = byHash.get(hash) ?? [];
        list.push(file);
        byHash.set(hash, list);
      } catch (error) {
        this.emit('file-error', { path: file.path, error: error.message, code: error.code });
      }

      processed++;
      this.emit('file-processed', { current: processed, total: files.length, path: file.path });
    }

    const groups = [];
    for (const [hash, list] of byHash) {
      if (list.length > 1) {
        const size = list[0].size;
        groups.push({
          hash,
          size,
          copies: list.length,
          files: list.map((file) => file.path),
          wastedSpace: size * (list.length - 1)
        });
      }
    }

    groups.sort((a, b) => b.wastedSpace - a.wastedSpace);
    const totalWasted = groups.reduce((sum, group) => sum + group.wastedSpace, 0);

    const result = { groups, totalWasted, totalFiles: files.length };
    this.emit('duplicates-found', result);
    return result;
  }
}