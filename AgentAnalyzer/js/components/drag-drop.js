/**
 * Drag and Drop Component for AgentAnalyzer
 * Handles file drag and drop functionality
 */

let dropZone = null;
let fileInput = null;
let browseBtn = null;
let onFileDropCallback = null;

/**
 * Initializes the drag and drop component
 * @param {Object} elements - Object containing DOM element references
 * @param {Function} onFileDrop - Callback when a file is dropped or selected
 */
export function initDragDrop(elements, onFileDrop) {
    dropZone = elements.dropZone;
    fileInput = elements.fileInput;
    browseBtn = elements.browseBtn;
    onFileDropCallback = onFileDrop;

    setupEventListeners();
}

/**
 * Sets up all event listeners for drag and drop
 */
function setupEventListeners() {
    // Drag and drop events
    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Click to browse
    dropZone.addEventListener('click', handleClick);

    // Browse button click
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Prevent default drag behavior on document
    document.addEventListener('dragover', preventDefaults);
    document.addEventListener('drop', preventDefaults);
}

/**
 * Prevents default event behavior
 * @param {Event} e - The event
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * Handles drag enter event
 * @param {DragEvent} e - The drag event
 */
function handleDragEnter(e) {
    preventDefaults(e);
    dropZone.classList.add('drag-over');
}

/**
 * Handles drag over event
 * @param {DragEvent} e - The drag event
 */
function handleDragOver(e) {
    preventDefaults(e);
    dropZone.classList.add('drag-over');
}

/**
 * Handles drag leave event
 * @param {DragEvent} e - The drag event
 */
function handleDragLeave(e) {
    preventDefaults(e);
    // Only remove class if leaving the drop zone entirely
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
    }
}

/**
 * Handles drop event
 * @param {DragEvent} e - The drag event
 */
function handleDrop(e) {
    preventDefaults(e);
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

/**
 * Handles click on drop zone
 * @param {MouseEvent} e - The click event
 */
function handleClick(e) {
    // Don't trigger if clicking on the browse button
    if (e.target === browseBtn || browseBtn?.contains(e.target)) {
        return;
    }
    fileInput.click();
}

/**
 * Handles file selection from input
 * @param {Event} e - The change event
 */
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
    // Reset input so same file can be selected again
    fileInput.value = '';
}

/**
 * Processes the selected/dropped file
 * @param {File} file - The file to process
 */
function processFile(file) {
    // Validate file type
    if (!isValidZipFile(file)) {
        showError('Please select a valid ZIP file.');
        return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
        showError('File is too large. Maximum size is 100MB.');
        return;
    }

    // Trigger callback
    if (onFileDropCallback) {
        onFileDropCallback(file);
    }
}

/**
 * Validates if the file is a ZIP file
 * @param {File} file - The file to validate
 * @returns {boolean} True if valid ZIP file
 */
function isValidZipFile(file) {
    // Check file extension
    const name = file.name.toLowerCase();
    if (!name.endsWith('.zip')) {
        return false;
    }

    // Check MIME type (may not always be reliable)
    const validMimeTypes = [
        'application/zip',
        'application/x-zip-compressed',
        'application/x-zip',
        'application/octet-stream'
    ];

    return validMimeTypes.includes(file.type) || file.type === '';
}

/**
 * Shows an error message
 * @param {string} message - Error message
 */
function showError(message) {
    // Could be enhanced with toast notification
    alert(message);
}

/**
 * Resets the drag and drop state
 */
export function resetDragDrop() {
    dropZone.classList.remove('drag-over');
    fileInput.value = '';
}

/**
 * Disables the drag and drop functionality
 */
export function disableDragDrop() {
    dropZone.style.pointerEvents = 'none';
    dropZone.style.opacity = '0.5';
}

/**
 * Enables the drag and drop functionality
 */
export function enableDragDrop() {
    dropZone.style.pointerEvents = 'auto';
    dropZone.style.opacity = '1';
}
