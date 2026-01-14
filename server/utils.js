import fs from 'fs';

/**
 * Generate a unique log file path by appending a counter if the file already exists.
 * @param {string} baseFilePath - The base file path (e.g., './logs/can-2026-01-13.log')
 * @returns {string} - A unique file path that doesn't exist yet
 */
function getUniqueLogFile(baseFilePath) {
    if (!fs.existsSync(baseFilePath)) {
        return baseFilePath;
    }

    let count = 1;
    const extIndex = baseFilePath.lastIndexOf('.');
    
    while (true) {
        let candidatePath;
        if (extIndex !== -1) {
            candidatePath = `${baseFilePath.slice(0, extIndex)}_${count}${baseFilePath.slice(extIndex)}`;
        } else {
            candidatePath = `${baseFilePath}_${count}`;
        }
        
        if (!fs.existsSync(candidatePath)) {
            return candidatePath;
        }
        count++;
    }
}

/**
 * Generate a timestamped log file path.
 * @param {string} prefix - Prefix for the log file (e.g., './can' or './logs/can')
 * @param {string} extension - File extension (default: 'log')
 * @returns {string} - A unique timestamped file path
 */
function generateLogFilePath(prefix = '.', extension = 'log') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilePath = `${prefix}-${timestamp}.${extension}`;
    return getUniqueLogFile(baseFilePath);
}

export { getUniqueLogFile, generateLogFilePath };
