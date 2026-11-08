import fs from 'fs/promises';
import path from 'path';

export async function collectFiles(directory, onError) {
  let relativePaths = [];
  try {
    // Збираємо всі шляхи рекурсивно
    relativePaths = await fs.readdir(directory, { recursive: true });
  } catch (error) {
    if (onError) onError(directory, error);
    return [];
  }

  const files = [];
  for (const relativePath of relativePaths) {
    const fullPath = path.join(directory, relativePath);
    try {
      const stats = await fs.stat(fullPath);
      // Пропускаємо директорії, залишаємо лише файли
      if (stats.isFile()) {
        files.push({
          name: path.basename(fullPath),
          path: fullPath,
          size: stats.size,
          mtime: stats.mtime
        });
      }
    } catch (error) {
      if (onError) onError(fullPath, error);
    }
  }
  
  return files;
}