import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { createReadStream, createWriteStream, constants } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { collectFiles } from './utils.js';

export const categories = {
  Documents: ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.pptx'],
  Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
  Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
  Code: ['.js', '.py', '.java', '.cpp', '.html', '.css', '.json'],
  Videos: ['.mp4', '.avi', '.mkv', '.mov', '.webm'],
  Other: []
};

// Файли від 10 MB копіюємо через streams, менші через copyFile
export const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;

export function getCategory(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  for (const [name, extensions] of Object.entries(categories)) {
    if (extensions.includes(ext)) return name;
  }
  return 'Other';
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false; // ENOENT означає, що файлу немає, тобто ім'я вільне
  }
}

// file.pdf -> file(1).pdf -> file(2).pdf ...
async function getUniquePath(directory, fileName) {
  const { name, ext } = path.parse(fileName);
  let candidate = path.join(directory, fileName);
  let counter = 1;

  while (await exists(candidate)) {
    candidate = path.join(directory, `${name}(${counter})${ext}`);
    counter++;
  }
  return candidate;
}

async function copyOne(sourcePath, targetPath, size) {
  if (size >= LARGE_FILE_THRESHOLD) {
    try {
      // flags 'wx': помилка, якщо файл уже існує (нічого не перезаписуємо)
      await pipeline(createReadStream(sourcePath), createWriteStream(targetPath, { flags: 'wx' }));
    } catch (error) {
      await fs.unlink(targetPath).catch(() => {}); // прибираємо недокопійований файл
      throw error;
    }
  } else {
    // COPYFILE_EXCL: помилка, якщо файл уже існує
    await fs.copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
  }
}

export class Organizer extends EventEmitter {
  async organize(source, target) {
    this.emit('organize-start', { source, target });

    for (const name of Object.keys(categories)) {
      await fs.mkdir(path.join(target, name), { recursive: true });
      this.emit('folder-created', { name });
    }

    const targetResolved = path.resolve(target);
    const allFiles = await collectFiles(source, (fullPath, error) => {
      this.emit('copy-error', { source: fullPath, error: error.message, code: error.code });
    });
    // Якщо цільова папка лежить усередині вихідної, не копіюємо її вміст
    const files = allFiles.filter(
      (file) => !path.resolve(file.path).startsWith(targetResolved + path.sep)
    );

    const counts = Object.fromEntries(Object.keys(categories).map((name) => [name, 0]));
    const errors = [];
    let copied = 0;
    let totalSize = 0;
    let processed = 0;

    for (const file of files) {
      const category = getCategory(file.name);
      const categoryDir = path.join(target, category);
      processed++;

      this.emit('copy-start', { source: file.path, category, current: processed, total: files.length });

      try {
        const targetPath = await getUniquePath(categoryDir, file.name);
        await copyOne(file.path, targetPath, file.size);

        counts[category]++;
        copied++;
        totalSize += file.size;
        this.emit('copy-complete', {
          source: file.path,
          target: targetPath,
          size: file.size,
          category,
          current: processed,
          total: files.length
        });
      } catch (error) {
        errors.push({ source: file.path, code: error.code, error: error.message });
        this.emit('copy-error', {
          source: file.path,
          error: error.message,
          code: error.code,
          current: processed,
          total: files.length
        });
      }
    }

    const result = { counts, copied, totalSize, errors, totalFiles: files.length };
    this.emit('organize-complete', result);
    return result;
  }
}