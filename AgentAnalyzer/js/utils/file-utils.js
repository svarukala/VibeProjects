/**
 * File Utilities for AgentAnalyzer
 * Common file operations and helpers
 */

/**
 * File type categories
 */
export const FileCategory = {
    JSON: 'json',
    IMAGE: 'image',
    DOCUMENT: 'document',
    CODE: 'code',
    OTHER: 'other'
};

/**
 * MIME type mappings
 */
const MIME_TYPES = {
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.yaml': 'application/x-yaml',
    '.yml': 'application/x-yaml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript'
};

/**
 * Gets the file extension from a filename
 * @param {string} filename - The filename
 * @returns {string} The extension including the dot
 */
export function getExtension(filename) {
    if (!filename) return '';
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
}

/**
 * Gets the filename without extension
 * @param {string} filename - The filename
 * @returns {string} Filename without extension
 */
export function getBasename(filename) {
    if (!filename) return '';
    const lastDot = filename.lastIndexOf('.');
    const lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
    const start = lastSlash >= 0 ? lastSlash + 1 : 0;
    const end = lastDot > start ? lastDot : filename.length;
    return filename.substring(start, end);
}

/**
 * Gets the MIME type for a file
 * @param {string} filename - The filename
 * @returns {string} MIME type
 */
export function getMimeType(filename) {
    const ext = getExtension(filename);
    return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Determines the file category
 * @param {string} filename - The filename
 * @returns {string} File category
 */
export function getFileCategory(filename) {
    const ext = getExtension(filename);

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp'];
    const jsonExtensions = ['.json'];
    const codeExtensions = ['.js', '.ts', '.html', '.css', '.xml', '.yaml', '.yml'];
    const documentExtensions = ['.md', '.txt', '.pdf', '.doc', '.docx'];

    if (imageExtensions.includes(ext)) return FileCategory.IMAGE;
    if (jsonExtensions.includes(ext)) return FileCategory.JSON;
    if (codeExtensions.includes(ext)) return FileCategory.CODE;
    if (documentExtensions.includes(ext)) return FileCategory.DOCUMENT;

    return FileCategory.OTHER;
}

/**
 * Formats file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return 'Unknown';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Parses file size string to bytes
 * @param {string} sizeStr - Size string like "10 MB"
 * @returns {number} Size in bytes
 */
export function parseFileSize(sizeStr) {
    if (!sizeStr) return 0;

    const match = sizeStr.match(/^([\d.]+)\s*(bytes?|kb|mb|gb|tb)?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'bytes').toLowerCase();

    const multipliers = {
        'byte': 1,
        'bytes': 1,
        'kb': 1024,
        'mb': 1024 * 1024,
        'gb': 1024 * 1024 * 1024,
        'tb': 1024 * 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || 1);
}

/**
 * Validates a filename
 * @param {string} filename - The filename to validate
 * @returns {Object} Validation result with isValid and error
 */
export function validateFilename(filename) {
    if (!filename) {
        return { isValid: false, error: 'Filename is required' };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(filename)) {
        return { isValid: false, error: 'Filename contains invalid characters' };
    }

    // Check length
    if (filename.length > 255) {
        return { isValid: false, error: 'Filename is too long (max 255 characters)' };
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    const basename = getBasename(filename);
    if (reservedNames.test(basename)) {
        return { isValid: false, error: 'Filename is a reserved system name' };
    }

    return { isValid: true, error: null };
}

/**
 * Sanitizes a filename by removing invalid characters
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
    if (!filename) return 'unnamed';

    return filename
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/^\.+/, '')
        .replace(/\.+$/, '')
        .substring(0, 255);
}

/**
 * Creates a data URL from content
 * @param {string} content - The content
 * @param {string} mimeType - The MIME type
 * @returns {string} Data URL
 */
export function createDataUrl(content, mimeType) {
    const base64 = btoa(unescape(encodeURIComponent(content)));
    return `data:${mimeType};base64,${base64}`;
}

/**
 * Downloads content as a file
 * @param {string} content - The content to download
 * @param {string} filename - The filename
 * @param {string} mimeType - The MIME type
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

/**
 * Reads a file as text
 * @param {File} file - The file to read
 * @returns {Promise<string>} File content
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * Reads a file as base64
 * @param {File} file - The file to read
 * @returns {Promise<string>} Base64 content
 */
export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Compares two file paths for equality
 * @param {string} path1 - First path
 * @param {string} path2 - Second path
 * @returns {boolean} True if paths are equal
 */
export function pathsEqual(path1, path2) {
    if (!path1 || !path2) return false;
    const normalize = p => p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    return normalize(path1) === normalize(path2);
}

/**
 * Joins path segments
 * @param  {...string} segments - Path segments
 * @returns {string} Joined path
 */
export function joinPath(...segments) {
    return segments
        .filter(s => s)
        .join('/')
        .replace(/\/+/g, '/');
}
