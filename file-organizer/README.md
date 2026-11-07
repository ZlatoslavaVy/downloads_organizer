# 📂 Node.js CLI: File Organizer

**`file-organizer`** — це консольний інструмент на Node.js для автоматизації наведення порядку в директоріях (наприклад, у папці `Downloads`). Інструмент дозволяє аналізувати вміст папок, знаходити дублікати за допомогою SHA-256 хешування, сортувати файли по категоріях та безпечно видаляти застарілі дані.

---

## 🛠️ Вимоги та встановлення

* **Node.js**: версія `v18.17.0` або новіша (підтримка ES Modules та `fs.readdir` з `{ recursive: true }`).
* **Залежності**: зовнішні npm-пакети не потрібні (використовуються лише вбудовані модулі Node.js: `fs`, `path`, `events`, `crypto`, `stream`).

### Встановлення
1. Склонуйте репозиторій:
   ```bash
   git clone <repository-url>
   cd file-organizer
   ```
2. Переконайтеся, що файл `package.json` містить `"type": "module"`.

---

## 🚀 Використання команд

Ви можете запускати програму напряму через `node` або за допомогою `npm scripts`.

> 💡 **Примітка**: Під час запуску через `npm run` обов'язково використовуйте подвійний дефіс `--`, щоб аргументи передавалися скрипту Node.js:
> `npm run scan -- /path/to/dir`

---

### 1. `scan` — Аналіз директорії
Рекурсивно обходить вказану директорію та всі піддиректорії, виводячи статистику про кількість файлів, сумарний розмір, розподіл за типами і віком, а також Топ-3 найбільших та найстаріший файл.

* **Запуск**:
  ```bash
  node file-organizer.js scan /path/to/directory
  # або
  npm run scan -- /path/to/directory
  ```
* **Приклад виводу**:
  ```text
  📂 Scanning: /Users/student/Downloads
  Processing... ████████████████████ 247/247 files

  📊 Scan Results:
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total files: 247
  Total size: 1.2 GB

  By File Type:
    .pdf           89 files     456 MB
    .zip           23 files     234 MB
    .png           67 files     187 MB
    .docx          45 files     123 MB
    .js            12 files      15 MB
    (other)        11 files      50 MB

  File Age:
    Last 7 days:    45 files
    Last 30 days:   89 files
    Older than 90:  56 files

  Largest files:
    1. video_lecture.mp4             450 MB
    2. archive_backup.zip            156 MB
    3. presentation.pptx              89 MB

  Oldest file: old_report.pdf (modified 365 days ago)
  ```

---

### 2. `duplicates` — Пошук дублікатів
Знаходить файли з однаковим вмістом незалежно від їхніх назв шляхом обчислення SHA-256 хешів та розраховує марно витрачене місце на диску.

* **Запуск**:
  ```bash
  node file-organizer.js duplicates /path/to/directory
  # або
  npm run duplicates -- /path/to/directory
  ```
* **Особливість**: Для читання файлів використовуються **Streams** (`fs.createReadStream`), що запобігає переповненню оперативної пам'яті на великих файлах.

---

### 3. `organize` — Сортування за категоріями
Копіює файли з вихідної директорії у цільову, розпускуючи їх по папках: `Documents`, `Images`, `Archives`, `Code`, `Videos` та `Other`.

* **Аргументи**:
  * `--output <target>` — (обов'язковий) шлях до цільової директорії.
* **Запуск**:
  ```bash
  node file-organizer.js organize /source/directory --output /target/directory
  # або
  npm run organize -- /source/directory --output /target/directory
  ```
* **Особливості**:
  * Оригінальні файли **не видаляються**.
  * Для малих файлів (< 10 MB) використовується `fs.copyFile()`.
  * Для великих файлів (≥ 10 MB) використовується `stream/promises` `pipeline()`.
  * При збігу імен створюється унікальне ім'я за шаблоном `file(1).pdf`.

---

### 4. `cleanup` — Очищення застарілих файлів
Знаходить файли, які не змінювалися понад `N` днів.

* **Аргументи та прапорці**:
  * `--older-than <days>` — (обов'язковий) поріг віку файлу в днях.
  * `--confirm` — (опціональний) підтвердження видалення. Без цього прапорця команда працює у режимі **Dry Run** (лише показує список без видалення).
* **Запуск**:
  ```bash
  # Режим попереднього перегляду (Dry Run):
  node file-organizer.js cleanup /path/to/directory --older-than 90

  # Фактичне видалення файлів:
  node file-organizer.js cleanup /path/to/directory --older-than 90 --confirm
  ```

---

## 🏗️ Структура проєкту

```text
file-organizer/
├── package.json          # Конфігурація проєкту ("type": "module", npm scripts)
├── .gitignore            # Виключення для Git (node_modules, логи)
├── README.md             # Документація проєкту
├── file-organizer.js     # Точка входу: розбір process.argv, CLI-вивід, прогрес-бар
└── lib/
    ├── scanner.js        # Клас Scanner (обхід директорій, статистика)
    ├── duplicates.js     # Клас DuplicateFinder (SHA-256 хешування через streams)
    ├── organizer.js      # Клас Organizer (сортування, copyFile vs pipeline)
    ├── cleanup.js        # Клас Cleanup (пошук та видалення за віком)
    └── utils.js          # Допоміжні функції (formatSize, drawProgressBar)
```

---

## 🏛️ Архітектура та технічні рішення

1. **EventEmitter (Подієва архітектура)**:
   * Кожна команда реалізована як клас-емітер (`Scanner`, `DuplicateFinder`, `Organizer`, `Cleanup`).
   * Бізнес-логіка повністю відокремлена від консольного виводу: класи генерують події (`file-found`, `scan-complete` тощо), а `file-organizer.js` підписується на них та малює прогрес-бар.

2. **Node.js Streams**:
   * Для хешування та копіювання великих файлів (≥10 MB) використовуються потоки читання та запису (`createReadStream`, `pipeline`), що гарантує низьке споживання оперативної пам'яті та керування backpressure.

3. **Надійна обробка помилок**:
   * Усі файлові операції обгорнуті в `try...catch` з точним розпізнаванням системних кодів помилок (`ENOENT`, `EACCES`, `ENOTDIR`) та коректним завершенням програми з кодом виходу `process.exit(1)`.
