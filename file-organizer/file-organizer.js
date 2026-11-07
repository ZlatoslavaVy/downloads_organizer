import path from 'path';
import { Scanner } from './lib/scanner.js';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}




function drawProgressBar(current, total, width = 20) {
  const percentage = total === 0 ? 1 : current / total;
  const filled = Math.round(percentage * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `${bar} ${current}/${total}`;
}

function printUsage() {
  console.log('Usage:');
  console.log('  node file-organizer.js scan <directory>');
  console.log('  node file-organizer.js duplicates <directory>');
  console.log('  node file-organizer.js organize <directory> --output <target>');
  console.log('  node file-organizer.js cleanup <directory> --older-than <days> [--confirm]');
}

function handleError(error, directory) {
  if (error.code === 'ENOENT') {
    console.error(`\n❌ Error: Directory not found: ${directory}`);
  } else if (error.code === 'EACCES') {
    console.error(`\n❌ Error: Permission denied: ${directory}`);
  } else if (error.code === 'ENOTDIR') {
    console.error(`\n❌ Error: Not a directory: ${directory}`);
  } else {
    console.error(`\n❌ Unexpected error: ${error.message}`);
  }
  process.exit(1);
}

// ---------- Команда scan ----------

function printReport(summary, skipped) {
  const line = '━'.repeat(34);

  console.log('\n📊 Scan Results:');
  console.log(line);
  console.log(`Total files: ${summary.totalFiles}`);
  console.log(`Total size: ${formatSize(summary.totalSize)}`);

  console.log('\nBy File Type:');
  const types = [...summary.byType.entries()].sort(
    (a, b) => b[1].totalSize - a[1].totalSize
  );
  for (const [ext, data] of types) {
    console.log(
      `  ${ext.padEnd(14)}${String(data.count).padStart(4)} files  ${formatSize(data.totalSize).padStart(10)}`
    );
  }

  console.log('\nFile Age:');
  console.log(`  Last 7 days:    ${summary.ageStats.last7Days} files`);
  console.log(`  Last 30 days:   ${summary.ageStats.last30Days} files`);
  console.log(`  Older than 90:  ${summary.ageStats.olderThan90Days} files`);

  console.log('\nLargest files:');
  summary.largestFiles.forEach((file, i) => {
    console.log(`  ${i + 1}. ${file.name.padEnd(30)} ${formatSize(file.size)}`);
  });

  if (summary.oldestFile) {
    const days = Math.floor(summary.oldestFile.ageInDays);
    console.log(`\nOldest file: ${summary.oldestFile.name} (modified ${days} days ago)`);
  }

  if (skipped > 0) {
    console.log(`\n⚠️  Skipped ${skipped} item(s): no access`);
  }
}

async function runScan(directory) {
  const scanner = new Scanner();
  let processed = 0;
  let skipped = 0;

  scanner.on('scan-start', (data) => {
    console.log(`📂 Scanning: ${data.directory}`);
  });

  scanner.on('file-found', () => {
    processed++;
    process.stdout.write(`\rProcessing... ${processed} files`);
  });

  scanner.on('file-error', () => {
    skipped++;
  });

  scanner.on('scan-complete', (summary) => {
    process.stdout.write(
      `\rProcessing... ${drawProgressBar(summary.totalFiles, summary.totalFiles)}\n`
    );
    printReport(summary, skipped);
  });

  await scanner.scan(directory);
}

// ---------- Точка входу ----------

async function main() {
  const [command, directoryArg] = process.argv.slice(2);

  if (!command || !directoryArg) {
    printUsage();
    process.exit(1);
  }

  const directory = path.resolve(directoryArg);

  try {
    switch (command) {
      case 'scan':
        await runScan(directory);
        break;
      case 'duplicates':
      case 'organize':
      case 'cleanup':
        console.error(`❌ Command "${command}" is not implemented yet.`);
        process.exit(1);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    handleError(error, directory);
  }
}

main();