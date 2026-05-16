#!/usr/bin/env node

/**
 * File Collector Script
 * Recursively collects all files from a given folder and combines them into one output file
 * with file paths as headers, excluding specified directories.
 * 
 * Usage: node fileCollector.js <folder-path> [output-file] [--ignore=patterns]
 * Example: node fileCollector.js ./my-project combined-output.txt
 * Example: node fileCollector.js ./my-project combined-output.txt --ignore=node_modules,dist,.git
 */

const fs = require('fs');
const path = require('path');

// Default folders and patterns to ignore
const DEFAULT_IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    'tmp',
    'temp',
    '__pycache__',
    '.DS_Store',
    'Thumbs.db'
];

// Default file extensions to ignore (binary files, etc.)
const IGNORE_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
    '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.wmv',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.pdf', '.doc', '.docx', '.ppt', '.pptx',
    '.ttf', '.woff', '.woff2', '.eot',
    '.bin', '.dat'
];

// File size limit (skip files larger than 10MB by default)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    let folderPath = null;
    let outputFile = 'collected_files.txt';
    let customIgnorePatterns = [];
    let maxFileSize = MAX_FILE_SIZE;
    let includeBinary = false;
    let verbose = false;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
                break;
            case '--ignore':
            case '-i':
                if (args[i + 1]) {
                    customIgnorePatterns = args[i + 1].split(',').map(p => p.trim());
                    i++;
                }
                break;
            case '--output':
            case '-o':
                if (args[i + 1]) {
                    outputFile = args[i + 1];
                    i++;
                }
                break;
            case '--max-size':
                if (args[i + 1]) {
                    maxFileSize = parseInt(args[i + 1]) * 1024 * 1024; // Convert MB to bytes
                    i++;
                }
                break;
            case '--include-binary':
                includeBinary = true;
                break;
            case '--verbose':
            case '-v':
                verbose = true;
                break;
            default:
                if (!folderPath) {
                    folderPath = args[i];
                }
        }
    }

    return {
        folderPath,
        outputFile,
        customIgnorePatterns,
        maxFileSize,
        includeBinary,
        verbose
    };
}

/**
 * Print help information
 */
function printHelp() {
    console.log(`
File Collector Script
=====================
Recursively collects all files from a given folder and combines them into one output file.

Usage: node fileCollector.js <folder-path> [options]

Options:
  --output, -o <file>         Output file name (default: collected_files.txt)
  --ignore, -i <patterns>     Comma-separated list of additional folders/files to ignore
  --max-size <size-in-MB>     Maximum file size to include in MB (default: 10)
  --include-binary            Include binary files (by default they are excluded)
  --verbose, -v               Show detailed progress information
  --help, -h                  Show this help message

Examples:
  node fileCollector.js ./my-project
  node fileCollector.js ./my-project -o output.txt
  node fileCollector.js ./my-project --ignore=logs,temp,custom_folder
  node fileCollector.js ./my-project --max-size=5 --verbose
    `);
}

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath, rootPath, ignorePatterns, ignoreExtensions, includeBinary) {
    const relativePath = path.relative(rootPath, filePath);
    const parts = relativePath.split(path.sep);
    
    // Check if any part of the path matches ignore patterns
    for (const part of parts) {
        for (const pattern of ignorePatterns) {
            if (part === pattern || part.match(new RegExp(pattern))) {
                return true;
            }
        }
    }
    
    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext && !includeBinary && ignoreExtensions.includes(ext)) {
        return true;
    }
    
    return false;
}

/**
 * Check if file is binary (simple heuristic)
 */
function isBinaryFile(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        const sampleSize = Math.min(buffer.length, 1000);
        
        for (let i = 0; i < sampleSize; i++) {
            const byte = buffer[i];
            if (byte === 0) return true; // Null byte indicates binary
        }
        return false;
    } catch {
        return true; // If can't read, consider binary to skip
    }
}

/**
 * Recursively get all files in directory
 */
function getAllFiles(dirPath, rootPath, ignorePatterns, ignoreExtensions, includeBinary, maxFileSize, verbose, stats = { files: 0, skipped: 0, errors: 0 }) {
    let results = [];
    
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            // Check if should ignore
            if (shouldIgnore(fullPath, rootPath, ignorePatterns, ignoreExtensions, includeBinary)) {
                if (verbose) {
                    console.log(`  Skipping: ${path.relative(rootPath, fullPath)}`);
                }
                stats.skipped++;
                continue;
            }
            
            if (entry.isDirectory()) {
                // Recursively get files from subdirectory
                const subDirFiles = getAllFiles(fullPath, rootPath, ignorePatterns, ignoreExtensions, includeBinary, maxFileSize, verbose, stats);
                results = results.concat(subDirFiles);
            } else if (entry.isFile()) {
                try {
                    const fileStats = fs.statSync(fullPath);
                    
                    // Check file size
                    if (fileStats.size > maxFileSize) {
                        if (verbose) {
                            console.log(`  Skipping large file (${(fileStats.size / 1024 / 1024).toFixed(2)}MB): ${path.relative(rootPath, fullPath)}`);
                        }
                        stats.skipped++;
                        continue;
                    }
                    
                    // Check if binary
                    if (!includeBinary && isBinaryFile(fullPath)) {
                        if (verbose) {
                            console.log(`  Skipping binary file: ${path.relative(rootPath, fullPath)}`);
                        }
                        stats.skipped++;
                        continue;
                    }
                    
                    results.push({
                        fullPath,
                        relativePath: path.relative(rootPath, fullPath),
                        size: fileStats.size
                    });
                    
                    stats.files++;
                    
                    if (verbose) {
                        console.log(`  Adding file: ${path.relative(rootPath, fullPath)}`);
                    }
                } catch (error) {
                    if (verbose) {
                        console.error(`  Error reading file ${fullPath}: ${error.message}`);
                    }
                    stats.errors++;
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}: ${error.message}`);
        stats.errors++;
    }
    
    return results;
}

/**
 * Write all files to output file
 */
function writeToOutput(files, outputPath, rootPath) {
    try {
        const outputStream = fs.createWriteStream(outputPath);
        let totalSize = 0;
        
        // Write header
        outputStream.write(`=================================================================
COLLECTED FILES FROM: ${rootPath}
Generated on: ${new Date().toISOString()}
Total files collected: ${files.length}
=================================================================\n\n`);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Write file separator and header
            outputStream.write(`\n${'='.repeat(80)}\n`);
            outputStream.write(`FILE ${i + 1} of ${files.length}\n`);
            outputStream.write(`PATH: ${file.relativePath}\n`);
            outputStream.write(`SIZE: ${(file.size / 1024).toFixed(2)} KB\n`);
            outputStream.write(`${'='.repeat(80)}\n\n`);
            
            try {
                // Read and write file content
                const content = fs.readFileSync(file.fullPath, 'utf8');
                outputStream.write(content);
                outputStream.write('\n');
                totalSize += content.length;
            } catch (error) {
                outputStream.write(`[ERROR: Could not read file - ${error.message}]\n`);
            }
        }
        
        // Write footer
        outputStream.write(`\n\n${'='.repeat(80)}\n`);
        outputStream.write(`END OF COLLECTED FILES\n`);
        outputStream.write(`Total files: ${files.length}\n`);
        outputStream.write(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);
        outputStream.write(`${'='.repeat(80)}\n`);
        
        outputStream.end();
        
        console.log(`\n✓ Successfully wrote ${files.length} files to: ${outputPath}`);
        console.log(`  Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        
    } catch (error) {
        console.error(`Error writing to output file: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Main function
 */
function main() {
    const {
        folderPath,
        outputFile,
        customIgnorePatterns,
        maxFileSize,
        includeBinary,
        verbose
    } = parseArguments();
    
    // Validate folder path
    if (!folderPath) {
        console.error('Error: Please provide a folder path.');
        console.log('Use --help for usage information.');
        process.exit(1);
    }
    
    const absoluteFolderPath = path.resolve(folderPath);
    
    // Check if folder exists
    if (!fs.existsSync(absoluteFolderPath)) {
        console.error(`Error: Folder "${absoluteFolderPath}" does not exist.`);
        process.exit(1);
    }
    
    if (!fs.statSync(absoluteFolderPath).isDirectory()) {
        console.error(`Error: "${absoluteFolderPath}" is not a directory.`);
        process.exit(1);
    }
    
    // Combine ignore patterns
    const allIgnorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...customIgnorePatterns];
    
    console.log(`\n📁 Scanning folder: ${absoluteFolderPath}`);
    console.log(`📄 Output file: ${outputFile}`);
    console.log(`🚫 Ignoring: ${allIgnorePatterns.join(', ')}`);
    console.log(`📏 Max file size: ${(maxFileSize / 1024 / 1024).toFixed(0)}MB`);
    console.log(`🔧 Include binary files: ${includeBinary ? 'Yes' : 'No'}`);
    console.log(`\nScanning...`);
    
    const stats = { files: 0, skipped: 0, errors: 0 };
    
    // Collect all files
    const files = getAllFiles(
        absoluteFolderPath,
        absoluteFolderPath,
        allIgnorePatterns,
        IGNORE_EXTENSIONS,
        includeBinary,
        maxFileSize,
        verbose,
        stats
    );
    
    console.log(`\n📊 Scan complete:`);
    console.log(`   ✓ Files found: ${stats.files}`);
    console.log(`   ✗ Files skipped: ${stats.skipped}`);
    if (stats.errors > 0) {
        console.log(`   ⚠ Errors: ${stats.errors}`);
    }
    
    if (files.length === 0) {
        console.log('\n⚠ No files to collect. Exiting.');
        process.exit(0);
    }
    
    // Write files to output
    console.log('\n📝 Writing files to output...');
    writeToOutput(files, outputFile, absoluteFolderPath);
    
    console.log('\n✅ Done!');
}

// Run the script
if (require.main === module) {
    main();
}

// Export functions for use as module
module.exports = {
    getAllFiles,
    shouldIgnore,
    isBinaryFile,
    writeToOutput,
    DEFAULT_IGNORE_PATTERNS,
    IGNORE_EXTENSIONS
};