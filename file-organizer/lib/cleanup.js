import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { collectFiles } from './utils.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export class Cleanup extends EventEmitter {
  async run(directory, { olderThan, confirm = false }) {
    this.emit('cleanup-start', { directory, olderThan, confirm });

    const allFiles = await collectFiles(directory, (fullPath, error) => {
      this.emit('file-error', { path: fullPath, error: error.message, code: error.code });
    });

    const oldFiles = [];
    for (const file of allFiles) {
      const daysOld = (Date.now() - file.mtime.getTime()) / MS_PER_DAY;
      if (daysOld > olderThan) {
        const item = { ...file, daysOld };
        oldFiles.push(item);
        this.emit('file-found', item);
      }
    }

    const totalSize = oldFiles.reduce((sum, file) => sum + file.size, 0);
    this.emit('search-complete', { files: oldFiles, totalSize });

    let deleted = 0;
    let freedBytes = 0;
    const failed = [];

    // Без --confirm це dry run: файли не чіпаємо
    if (confirm && oldFiles.length > 0) {
      this.emit('delete-start', { count: oldFiles.length, totalSize });

      for (const file of oldFiles) {
        try {
          await fs.unlink(file.path);
          deleted++;
          freedBytes += file.size;
          this.emit('file-deleted', {
            path: file.path,
            size: file.size,
            current: deleted + failed.length,
            total: oldFiles.length
          });
        } catch (error) {
          failed.push({ path: file.path, code: error.code, error: error.message });
          this.emit('delete-error', {
            path: file.path,
            code: error.code,
            error: error.message,
            current: deleted + failed.length,
            total: oldFiles.length
          });
        }
      }
    }

    const summary = {
      dryRun: !confirm,
      found: oldFiles.length,
      totalSize,
      deleted,
      freedBytes,
      failed
    };
    this.emit('cleanup-complete', summary);
    return summary;
  }
}