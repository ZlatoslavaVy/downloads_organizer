import fs from 'fs/promises';
import path from 'path';

export async function collectFiles(directory, onError) {
  // Помилку читання головної директорії НЕ ховаємо:
  // її спіймає try...catch у file-organizer.js
  const relativePaths = await fs.readdir(directory, { recursive: true });

  const files = [];
  for (const relativePath of relativePaths) {
    const fullPath = path.join(directory, relativePath);
    try {
      const stats = await fs.stat(fullPath);
      if (stats.isFile()) {
        files.push({
          name: path.basename(fullPath),
          path: fullPath,
          relativePath,
          size: stats.size,
          mtime: stats.mtime
        });
      }
    } catch (error) {
      // Помилка на одному файлі не зупиняє решту
      if (onError) onError(fullPath, error);
    }
  }

  return files;
}