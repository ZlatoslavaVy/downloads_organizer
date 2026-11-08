import path from 'path';
import { Scanner } from './lib/scanner.js';
import { DuplicateFinder } from './lib/dublicates.js'; // Зверни увагу на назву файлу, як у твоєму проєкті
import { Organizer } from './lib/organizer.js';
import { Cleanup } from './lib/cleanup.js';

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
  console.log('\n📊 Scan Results:\n' + line);
  console.log(`Total files: ${summary.totalFiles}`);
  console.log(`Total size: ${formatSize(summary.totalSize)}`);
  console.log('\nBy File Type:');
  const types = [...summary.byType.entries()].sort((a, b) => b[1].totalSize - a[1].totalSize);
  for (const [ext, data] of types) {
    console.log(`  ${ext.padEnd(14)}${String(data.count).padStart(4)} files  ${formatSize(data.totalSize).padStart(10)}`);
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
    console.log(`\nOldest file: ${summary.oldestFile.name} (modified ${Math.floor(summary.oldestFile.ageInDays)} days ago)`);
  }
  if (skipped > 0) console.log(`\n⚠️  Skipped ${skipped} item(s): no access`);
}

async function runScan(directory) {
  const scanner = new Scanner();
  let processed = 0, skipped = 0;
  scanner.on('scan-start', (data) => console.log(`📂 Scanning: ${data.directory}`));
  scanner.on('file-found', () => {
    processed++;
    process.stdout.write(`\rProcessing... ${processed} files`);
  });
  scanner.on('file-error', () => skipped++);
  scanner.on('scan-complete', (summary) => {
    process.stdout.write(`\rProcessing... ${drawProgressBar(summary.totalFiles, summary.totalFiles)}\n`);
    printReport(summary, skipped);
  });
  await scanner.scan(directory);
}

// ---------- Команда duplicates ----------
async function runDuplicates(directory) {
  const finder = new DuplicateFinder();
  finder.on('search-start', (data) => console.log(`🔍 Searching for duplicates in: ${data.directory}`));
  finder.on('file-processed', (data) => {
    process.stdout.write(`\rCalculating hashes... ${drawProgressBar(data.current, data.total)}`);
  });

  const result = await finder.find(directory);
  console.log(`\n\nFound ${result.groups.length} duplicate groups (${formatSize(result.totalWasted)} wasted):\n`);
  
  result.groups.forEach((group, i) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Group ${i + 1} (${group.copies} copies, ${formatSize(group.size)} each):`);
    console.log(`  SHA-256: ${group.hash.substring(0, 12)}...\n`);
    group.files.forEach(file => console.log(`  📄 ${file}`));
    console.log(`\n  Wasted space: ${formatSize(group.wastedSpace)}\n`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`💾 Total wasted space: ${formatSize(result.totalWasted)}`);
}

// ---------- Команда organize ----------
async function runOrganize(source, args) {
  const outIndex = args.indexOf('--output');
  if (outIndex === -1 || !args[outIndex + 1]) {
    console.error('❌ Error: Missing --output <target> argument.');
    process.exit(1);
  }
  const target = path.resolve(args[outIndex + 1]);
  const organizer = new Organizer();

  organizer.on('organize-start', (data) => {
    console.log(`📦 Organizing: ${data.source}\nTarget: ${data.target}\n\nCreating folders...`);
  });
  organizer.on('folder-created', (data) => console.log(`  ✓ ${data.name}/`));
  
  let startedCopying = false;
  organizer.on('copy-start', (data) => {
    if (!startedCopying) {
      console.log('\nCopying files...');
      startedCopying = true;
    }
    process.stdout.write(`\rCopying files... ${drawProgressBar(data.current, data.total)}`);
  });

  const result = await organizer.organize(source, target);
  console.log('\n\n✅ Organization complete!\nSummary:');
  for (const [cat, count] of Object.entries(result.counts)) {
    console.log(`  ${cat.padEnd(10)}: ${String(count).padStart(3)} files → Organized/${cat}/`);
  }
  console.log(`\nTotal copied: ${result.copied} files (${formatSize(result.totalSize)})`);
}

// ---------- Команда cleanup ----------
async function runCleanup(directory, args) {
  const daysIndex = args.indexOf('--older-than');
  if (daysIndex === -1 || !args[daysIndex + 1]) {
    console.error('❌ Error: Missing --older-than <days> argument.');
    process.exit(1);
  }
  const olderThan = parseInt(args[daysIndex + 1], 10);
  const confirm = args.includes('--confirm');
  
  const cleanup = new Cleanup();
  
  cleanup.on('cleanup-start', (data) => {
    console.log(`🧹 Cleanup: ${data.directory}\nLooking for files older than ${data.olderThan} days...\n`);
  });
  cleanup.on('search-complete', (data) => {
    console.log(`Found ${data.files.length} files to delete:\n`);
    if (data.files.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      data.files.forEach(f => {
        console.log(`${f.name}\n  Size: ${formatSize(f.size)}\n  Modified: ${Math.floor(f.daysOld)} days ago\n`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Total: ${data.files.length} files (${formatSize(data.totalSize)})\n`);
    }
  });
  cleanup.on('delete-start', (data) => {
    console.log(`⚠️  DELETING ${data.count} files (${formatSize(data.totalSize)}). This action cannot be undone!`);
  });
  cleanup.on('file-deleted', (data) => {
    process.stdout.write(`\rDeleting... ${drawProgressBar(data.current, data.total)}`);
  });

  const result = await cleanup.run(directory, { olderThan, confirm });
  
  if (result.dryRun) {
    console.log('⚠️  DRY RUN MODE: No files were deleted.');
    console.log('To actually delete these files, run with --confirm flag.');
  } else {
    console.log('\n\n✅ Cleanup complete!');
    console.log(`Deleted: ${result.deleted} files (${formatSize(result.freedBytes)} freed)`);
  }
}

// ---------- Точка входу ----------
async function main() {
  const [command, directoryArg, ...restArgs] = process.argv.slice(2);

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
        await runDuplicates(directory);
        break;
      case 'organize':
        await runOrganize(directory, restArgs);
        break;
      case 'cleanup':
        await runCleanup(directory, restArgs);
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