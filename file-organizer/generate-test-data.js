import fs from 'fs/promises';
import path from 'path';

const testDir = path.resolve('test-data');

async function createTestData() {
  try {
    // 1. Створюємо цільову папку
    await fs.mkdir(testDir, { recursive: true });
    console.log(`📁 Директорію створено: ${testDir}`);

    // 2. Файли різних категорій
    await fs.writeFile(path.join(testDir, 'notes.txt'), 'Звичайний текстовий файл');
    await fs.writeFile(path.join(testDir, 'image.png'), 'імітація даних картинки');
    await fs.writeFile(path.join(testDir, 'archive.zip'), 'імітація архіву');

    // 3. Дублікати (файли з абсолютно однаковим вмістом для перевірки SHA-256)
    const duplicateContent = 'Цей текст абсолютно однаковий у двох файлах.';
    await fs.writeFile(path.join(testDir, 'duplicate_A.md'), duplicateContent);
    await fs.writeFile(path.join(testDir, 'duplicate_B.md'), duplicateContent);
    console.log('👯 Дублікати створено.');

    // 4. Великий файл (12 МБ) для перевірки потоків (streams)
    const largeFilePath = path.join(testDir, 'large-video.mp4');
    const largeBuffer = Buffer.alloc(12 * 1024 * 1024, 0); // 12 MB нулів
    await fs.writeFile(largeFilePath, largeBuffer);
    console.log('🐘 Великий файл створено (12 MB).');

    // 5. "Старий" файл для перевірки команди cleanup
    const oldFilePath = path.join(testDir, 'old-report.pdf');
    await fs.writeFile(oldFilePath, 'Цей файл буде зімітовано як дуже старий.');
    
    // Штучно змінюємо дату модифікації файлу на 100 днів тому
    const pastDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFilePath, pastDate, pastDate);
    console.log('🕰️ Старий файл створено (вік 100 днів).');

    console.log('\n✅ Усі тестові дані успішно згенеровано! Можна тестувати.');
  } catch (error) {
    console.error('❌ Помилка:', error);
  }
}

createTestData();