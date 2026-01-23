/**
 * File Service for AgentAnalyzer
 * Handles file parsing, formatting, and manipulation
 */

import { getFileContent, updateFileContent } from './zip-service.js';

/**
 * File type definitions with associated properties
 */
const FILE_TYPES = {
    json: {
        extensions: ['.json'],
        language: 'json',
        editable: true,
        icon: 'json'
    },
    image: {
        extensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp'],
        language: null,
        editable: false,
        icon: 'image'
    },
    markdown: {
        extensions: ['.md', '.markdown'],
        language: 'markdown',
        editable: true,
        icon: 'markdown'
    },
    yaml: {
        extensions: ['.yaml', '.yml'],
        language: 'yaml',
        editable: true,
        icon: 'yaml'
    },
    text: {
        extensions: ['.txt', '.log'],
        language: 'plaintext',
        editable: true,
        icon: 'text'
    }
};

/**
 * Gets the file type information for a given filename
 * @param {string} filename - The filename to analyze
 * @returns {Object} File type information
 */
export function getFileType(filename) {
    const ext = getExtension(filename).toLowerCase();

    for (const [type, config] of Object.entries(FILE_TYPES)) {
        if (config.extensions.includes(ext)) {
            return { type, ...config };
        }
    }

    // Default to text
    return {
        type: 'unknown',
        language: 'plaintext',
        editable: true,
        icon: 'file'
    };
}

/**
 * Gets the file extension from a filename
 * @param {string} filename - The filename
 * @returns {string} The extension including the dot
 */
export function getExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
}

/**
 * Checks if a file is editable
 * @param {string} filename - The filename to check
 * @returns {boolean} True if the file can be edited
 */
export function isEditable(filename) {
    const fileType = getFileType(filename);
    return fileType.editable;
}

/**
 * Checks if a file is an image
 * @param {string} filename - The filename to check
 * @returns {boolean} True if the file is an image
 */
export function isImage(filename) {
    const fileType = getFileType(filename);
    return fileType.type === 'image';
}

/**
 * Parses a JSON file and returns the parsed object
 * @param {string} path - The file path
 * @returns {Object|null} Parsed JSON or null if invalid
 */
export function parseJsonFile(path) {
    const fileData = getFileContent(path);
    if (!fileData) {
        return null;
    }

    try {
        return JSON.parse(fileData.content);
    } catch (error) {
        console.error(`Error parsing JSON file ${path}:`, error);
        return null;
    }
}

/**
 * Formats JSON content with proper indentation
 * @param {string} content - The JSON string to format
 * @returns {string} Formatted JSON string
 */
export function formatJson(content) {
    try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
    } catch (error) {
        return content; // Return original if parsing fails
    }
}

/**
 * Validates JSON content
 * @param {string} content - The JSON string to validate
 * @returns {Object} Validation result with isValid and error properties
 */
export function validateJson(content) {
    try {
        JSON.parse(content);
        return { isValid: true, error: null };
    } catch (error) {
        return {
            isValid: false,
            error: error.message,
            line: extractLineNumber(error.message)
        };
    }
}

/**
 * Extracts line number from JSON parse error message
 * @param {string} errorMessage - The error message
 * @returns {number|null} Line number or null
 */
function extractLineNumber(errorMessage) {
    const match = errorMessage.match(/line (\d+)/i);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Finds a file by name pattern in the extracted files
 * @param {Map} files - Map of extracted files
 * @param {string|RegExp} pattern - Pattern to match
 * @returns {string|null} The file path or null if not found
 */
export function findFile(files, pattern) {
    for (const [path] of files) {
        if (typeof pattern === 'string') {
            if (path.endsWith(pattern) || path.includes(pattern)) {
                return path;
            }
        } else if (pattern instanceof RegExp) {
            if (pattern.test(path)) {
                return path;
            }
        }
    }
    return null;
}

/**
 * Finds all files matching a pattern
 * @param {Map} files - Map of extracted files
 * @param {string|RegExp} pattern - Pattern to match
 * @returns {string[]} Array of matching file paths
 */
export function findAllFiles(files, pattern) {
    const matches = [];
    for (const [path] of files) {
        if (typeof pattern === 'string') {
            if (path.endsWith(pattern) || path.includes(pattern)) {
                matches.push(path);
            }
        } else if (pattern instanceof RegExp) {
            if (pattern.test(path)) {
                matches.push(path);
            }
        }
    }
    return matches;
}

/**
 * Gets the manifest.json file path from the extracted files
 * @param {Map} files - Map of extracted files
 * @returns {string|null} The manifest.json path or null
 */
export function findManifestFile(files) {
    return findFile(files, 'manifest.json');
}

/**
 * Formats file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Gets the icon name for a file based on its type
 * @param {string} filename - The filename
 * @returns {string} Icon identifier
 */
export function getFileIcon(filename) {
    const fileType = getFileType(filename);
    return fileType.icon;
}

/**
 * Gets the Monaco editor language for a file
 * @param {string} filename - The filename
 * @returns {string} Monaco language identifier
 */
export function getEditorLanguage(filename) {
    const fileType = getFileType(filename);
    return fileType.language || 'plaintext';
}

/**
 * Saves content to a file (updates in-memory)
 * @param {string} path - The file path
 * @param {string} content - The new content
 * @returns {Object} Result object with success status
 */
export function saveFile(path, content) {
    const ext = getExtension(path).toLowerCase();

    // Validate JSON files before saving
    if (ext === '.json') {
        const validation = validateJson(content);
        if (!validation.isValid) {
            return {
                success: false,
                error: `Invalid JSON: ${validation.error}`
            };
        }
    }

    updateFileContent(path, content);
    return { success: true };
}

/**
 * Gets a display-friendly name for a file path
 * @param {string} path - The full file path
 * @returns {string} The display name
 */
export function getDisplayName(path) {
    const parts = path.split('/');
    return parts[parts.length - 1];
}

/**
 * Extracts the directory path from a file path
 * @param {string} path - The full file path
 * @returns {string} The directory path
 */
export function getDirectory(path) {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash >= 0 ? path.substring(0, lastSlash) : '';
}
