/**
 * File Viewer Component for AgentAnalyzer
 * Handles file viewing and editing with Monaco editor
 */

import { getFileContent, updateFileContent, revertFileContent } from '../services/zip-service.js';
import { isEditable, isImage, getEditorLanguage, validateJson, getExtension } from '../services/file-service.js';
import { getUIConfig } from '../config.js';

let monacoEditor = null;
let currentFilePath = null;
let originalContent = null;
let isModified = false;
let onModifiedCallback = null;

// DOM Elements
let fileViewerCard = null;
let fileNameElement = null;
let editorContainer = null;
let imagePreview = null;
let previewImage = null;
let editorPlaceholder = null;
let undoBtn = null;
let saveBtn = null;
let cancelBtn = null;
let editorActions = null;

/**
 * Initializes the file viewer component
 * @param {Object} elements - Object containing DOM element references
 * @param {Function} onModified - Callback when content is modified
 */
export async function initFileViewer(elements, onModified) {
    fileViewerCard = elements.fileViewerCard;
    fileNameElement = elements.fileName;
    editorContainer = elements.editorContainer;
    imagePreview = elements.imagePreview;
    previewImage = elements.previewImage;
    editorPlaceholder = elements.editorPlaceholder;
    undoBtn = elements.undoBtn;
    saveBtn = elements.saveBtn;
    cancelBtn = elements.cancelBtn;
    editorActions = elements.editorActions;
    onModifiedCallback = onModified;

    // Initialize Monaco editor
    await initMonacoEditor();

    // Setup event listeners
    setupEventListeners();
}

/**
 * Initializes the Monaco editor
 */
async function initMonacoEditor() {
    return new Promise((resolve) => {
        require.config({
            paths: {
                'vs': 'https://unpkg.com/monaco-editor@0.45.0/min/vs'
            }
        });

        require(['vs/editor/editor.main'], function() {
            const config = getUIConfig();

            monacoEditor = monaco.editor.create(editorContainer, {
                value: '',
                language: 'json',
                theme: config.editorTheme || 'vs-light',
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                fontSize: 13,
                tabSize: 2,
                renderWhitespace: 'selection',
                folding: true,
                readOnly: false
            });

            // Listen for content changes
            monacoEditor.onDidChangeModelContent(() => {
                handleContentChange();
            });

            resolve();
        });
    });
}

/**
 * Sets up event listeners for buttons
 */
function setupEventListeners() {
    if (undoBtn) {
        undoBtn.addEventListener('click', handleUndo);
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSave);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }
}

/**
 * Opens a file in the viewer
 * @param {string} path - The file path to open
 */
export function openFile(path) {
    const fileData = getFileContent(path);
    if (!fileData) {
        console.error('File not found:', path);
        return;
    }

    currentFilePath = path;
    const fileName = path.split('/').pop();
    fileNameElement.textContent = fileName;

    // Hide the placeholder
    if (editorPlaceholder) {
        editorPlaceholder.classList.add('hidden');
    }

    // Show the viewer card (no longer uses hidden class in new tabbed layout)
    if (fileViewerCard) {
        fileViewerCard.classList.remove('hidden');
    }

    if (fileData.isImage) {
        // Show image preview
        showImagePreview(fileData.content, fileName);
    } else {
        // Show in editor
        showInEditor(fileData.content, path);
    }

    // Update button states
    updateButtonStates();
}

/**
 * Shows an image in the preview pane
 * @param {string} base64Content - Base64 encoded image content
 * @param {string} fileName - The file name for determining MIME type
 */
function showImagePreview(base64Content, fileName) {
    // Hide editor, show image preview
    editorContainer.style.display = 'none';
    imagePreview.classList.remove('hidden');
    editorActions.style.display = 'none';

    // Determine MIME type
    const ext = getExtension(fileName).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp'
    };
    const mimeType = mimeTypes[ext] || 'image/png';

    previewImage.src = `data:${mimeType};base64,${base64Content}`;
}

/**
 * Shows content in the Monaco editor
 * @param {string} content - The file content
 * @param {string} path - The file path
 */
function showInEditor(content, path) {
    // Hide image preview, show editor
    imagePreview.classList.add('hidden');
    editorContainer.style.display = 'block';
    editorActions.style.display = 'flex';

    // Auto-format JSON files for better readability
    let displayContent = content;
    const ext = getExtension(path).toLowerCase();
    if (ext === '.json') {
        displayContent = formatJson(content);
    }

    // Store original content (formatted version for JSON)
    originalContent = displayContent;
    isModified = false;

    // Set editor content and language
    const language = getEditorLanguage(path);
    const model = monacoEditor.getModel();

    monaco.editor.setModelLanguage(model, language);
    monacoEditor.setValue(displayContent);

    // Set read-only based on file type
    const editable = isEditable(path);
    monacoEditor.updateOptions({ readOnly: !editable });
}

/**
 * Formats JSON content with proper indentation
 * @param {string} content - JSON string to format
 * @returns {string} Formatted JSON or original if invalid
 */
function formatJson(content) {
    try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
    } catch (e) {
        // If JSON is invalid, return original content
        return content;
    }
}

/**
 * Handles content changes in the editor
 */
function handleContentChange() {
    if (!currentFilePath) return;

    const currentContent = monacoEditor.getValue();
    isModified = currentContent !== originalContent;

    updateButtonStates();

    if (onModifiedCallback) {
        onModifiedCallback(currentFilePath, isModified);
    }
}

/**
 * Updates button states based on current state
 */
function updateButtonStates() {
    const fileData = getFileContent(currentFilePath);
    const editable = currentFilePath && !fileData?.isImage && isEditable(currentFilePath);

    if (undoBtn) {
        undoBtn.disabled = !isModified;
    }
    if (saveBtn) {
        saveBtn.disabled = !isModified;
    }
    if (cancelBtn) {
        cancelBtn.disabled = !isModified;
    }

    // Hide actions for non-editable files
    if (editorActions) {
        editorActions.style.display = editable ? 'flex' : 'none';
    }
}

/**
 * Handles undo action
 */
function handleUndo() {
    if (monacoEditor) {
        monacoEditor.trigger('keyboard', 'undo', null);
    }
}

/**
 * Handles save action
 */
function handleSave() {
    if (!currentFilePath || !monacoEditor) return;

    const content = monacoEditor.getValue();
    const ext = getExtension(currentFilePath).toLowerCase();

    // Validate JSON files
    if (ext === '.json') {
        const validation = validateJson(content);
        if (!validation.isValid) {
            showError(`Invalid JSON: ${validation.error}`);
            return;
        }
    }

    // Update the file content
    updateFileContent(currentFilePath, content);
    originalContent = content;
    isModified = false;

    updateButtonStates();
    showSuccess('File saved successfully');

    if (onModifiedCallback) {
        onModifiedCallback(currentFilePath, false);
    }
}

/**
 * Handles cancel action
 */
function handleCancel() {
    if (!currentFilePath || !monacoEditor) return;

    // Revert to original content
    monacoEditor.setValue(originalContent);
    isModified = false;

    updateButtonStates();

    if (onModifiedCallback) {
        onModifiedCallback(currentFilePath, false);
    }
}

/**
 * Closes the file viewer
 */
export function closeViewer() {
    currentFilePath = null;
    originalContent = null;
    isModified = false;

    if (monacoEditor) {
        monacoEditor.setValue('');
    }

    // Hide editor and image preview
    if (editorContainer) {
        editorContainer.style.display = 'none';
    }
    if (imagePreview) {
        imagePreview.classList.add('hidden');
    }
    if (editorActions) {
        editorActions.style.display = 'none';
    }

    // Show placeholder
    if (editorPlaceholder) {
        editorPlaceholder.classList.remove('hidden');
    }

    // Reset file name
    if (fileNameElement) {
        fileNameElement.textContent = 'Select a file to view';
    }
}

/**
 * Gets the current file path
 * @returns {string|null} Current file path
 */
export function getCurrentFilePath() {
    return currentFilePath;
}

/**
 * Checks if the current file has unsaved changes
 * @returns {boolean} True if modified
 */
export function hasUnsavedChanges() {
    return isModified;
}

/**
 * Shows an error message (simple implementation)
 * @param {string} message - Error message
 */
function showError(message) {
    // Could be enhanced with a toast notification
    console.error(message);
    alert(message);
}

/**
 * Shows a success message (simple implementation)
 * @param {string} message - Success message
 */
function showSuccess(message) {
    // Could be enhanced with a toast notification
    console.log(message);
}

/**
 * Refreshes the editor content from the current file
 */
export function refreshContent() {
    if (currentFilePath) {
        const fileData = getFileContent(currentFilePath);
        if (fileData && !fileData.isImage) {
            originalContent = fileData.content;
            monacoEditor.setValue(fileData.content);
            isModified = false;
            updateButtonStates();
        }
    }
}

/**
 * Gets the Monaco editor instance
 * @returns {Object|null} Monaco editor instance
 */
export function getEditor() {
    return monacoEditor;
}
