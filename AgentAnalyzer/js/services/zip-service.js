/**
 * Zip Service for AgentAnalyzer
 * Handles zip/unzip operations using JSZip
 */

let currentZip = null;
let extractedFiles = new Map();

/**
 * Extracts a zip file and returns its contents
 * @param {File} file - The zip file to extract
 * @returns {Promise<Object>} Object containing file tree and file map
 */
export async function extractZip(file) {
    try {
        const zip = new JSZip();
        currentZip = await zip.loadAsync(file);
        extractedFiles.clear();

        const fileTree = {
            name: file.name.replace('.zip', ''),
            type: 'folder',
            path: '',
            children: []
        };

        const paths = Object.keys(currentZip.files).sort();

        for (const path of paths) {
            const zipEntry = currentZip.files[path];

            // Skip directories that are just folder entries
            if (zipEntry.dir) {
                continue;
            }

            // Get file content based on type
            const isImage = isImageFile(path);
            let content;

            if (isImage) {
                content = await zipEntry.async('base64');
            } else {
                content = await zipEntry.async('string');
            }

            // Store in extracted files map
            extractedFiles.set(path, {
                content: content,
                originalContent: content,
                isImage: isImage,
                modified: false
            });

            // Add to file tree
            addToFileTree(fileTree, path, zipEntry);
        }

        return {
            tree: fileTree,
            files: extractedFiles
        };
    } catch (error) {
        console.error('Error extracting zip:', error);
        throw new Error('Failed to extract zip file. Please ensure it is a valid zip archive.');
    }
}

/**
 * Adds a file path to the file tree structure
 * @param {Object} tree - The file tree object
 * @param {string} path - The file path
 * @param {Object} zipEntry - The JSZip entry
 */
function addToFileTree(tree, path, zipEntry) {
    const parts = path.split('/').filter(p => p);
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        let child = current.children.find(c => c.name === part);

        if (!child) {
            child = {
                name: part,
                type: isFile ? 'file' : 'folder',
                path: currentPath,
                children: isFile ? undefined : []
            };

            if (isFile) {
                child.extension = getFileExtension(part);
                child.size = zipEntry._data ? zipEntry._data.uncompressedSize : 0;
            }

            current.children.push(child);

            // Sort children: folders first, then files alphabetically
            current.children.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
        }

        current = child;
    }
}

/**
 * Gets the content of a file from the extracted zip
 * @param {string} path - The file path
 * @returns {Object|null} File data object or null if not found
 */
export function getFileContent(path) {
    return extractedFiles.get(path) || null;
}

/**
 * Updates the content of a file
 * @param {string} path - The file path
 * @param {string} content - The new content
 */
export function updateFileContent(path, content) {
    const fileData = extractedFiles.get(path);
    if (fileData) {
        fileData.content = content;
        fileData.modified = fileData.content !== fileData.originalContent;
    }
}

/**
 * Reverts a file to its original content
 * @param {string} path - The file path
 */
export function revertFileContent(path) {
    const fileData = extractedFiles.get(path);
    if (fileData) {
        fileData.content = fileData.originalContent;
        fileData.modified = false;
    }
}

/**
 * Checks if any files have been modified
 * @returns {boolean} True if any files are modified
 */
export function hasModifiedFiles() {
    for (const [, fileData] of extractedFiles) {
        if (fileData.modified) {
            return true;
        }
    }
    return false;
}

/**
 * Gets a list of modified files
 * @returns {string[]} Array of modified file paths
 */
export function getModifiedFiles() {
    const modified = [];
    for (const [path, fileData] of extractedFiles) {
        if (fileData.modified) {
            modified.push(path);
        }
    }
    return modified;
}

/**
 * Creates a new zip file with all files (including modifications)
 * @param {string} filename - The name for the new zip file
 * @returns {Promise<Blob>} The zip file as a Blob
 */
export async function createZip(filename) {
    const zip = new JSZip();

    for (const [path, fileData] of extractedFiles) {
        if (fileData.isImage) {
            zip.file(path, fileData.content, { base64: true });
        } else {
            zip.file(path, fileData.content);
        }
    }

    return await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });
}

/**
 * Downloads the current package as a zip file
 * @param {string} filename - The filename for download
 */
export async function downloadZip(filename) {
    try {
        const blob = await createZip(filename);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error creating zip:', error);
        throw new Error('Failed to create zip file for download.');
    }
}

/**
 * Clears the current zip data
 */
export function clearZip() {
    currentZip = null;
    extractedFiles.clear();
}

/**
 * Gets all extracted files as a Map
 * @returns {Map} Map of file paths to file data
 */
export function getAllFiles() {
    return extractedFiles;
}

/**
 * Checks if a file is an image based on extension
 * @param {string} filename - The filename to check
 * @returns {boolean} True if the file is an image
 */
function isImageFile(filename) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp'];
    const ext = getFileExtension(filename).toLowerCase();
    return imageExtensions.includes(ext);
}

/**
 * Gets the file extension from a filename
 * @param {string} filename - The filename
 * @returns {string} The file extension including the dot
 */
function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
}

/**
 * Gets file statistics for the current package
 * @returns {Object} Statistics object
 */
export function getPackageStats() {
    let totalFiles = 0;
    let jsonFiles = 0;
    let imageFiles = 0;
    let otherFiles = 0;
    let totalSize = 0;

    for (const [path, fileData] of extractedFiles) {
        totalFiles++;
        const ext = getFileExtension(path).toLowerCase();

        if (fileData.isImage) {
            imageFiles++;
        } else if (ext === '.json') {
            jsonFiles++;
        } else {
            otherFiles++;
        }

        // Estimate size
        if (fileData.isImage) {
            totalSize += (fileData.content.length * 3) / 4; // Base64 to bytes
        } else {
            totalSize += new Blob([fileData.content]).size;
        }
    }

    return {
        totalFiles,
        jsonFiles,
        imageFiles,
        otherFiles,
        totalSize,
        modifiedCount: getModifiedFiles().length
    };
}
