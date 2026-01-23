/**
 * File Tree Component for AgentAnalyzer
 * Renders the file tree navigation in the left panel
 */

let selectedPath = null;
let onFileSelectCallback = null;

/**
 * Initializes the file tree component
 * @param {Function} onFileSelect - Callback when a file is selected
 */
export function initFileTree(onFileSelect) {
    onFileSelectCallback = onFileSelect;
}

/**
 * Renders the file tree from the extracted zip structure
 * @param {Object} tree - The file tree structure
 * @param {HTMLElement} container - The container element
 */
export function renderFileTree(tree, container) {
    container.innerHTML = '';
    selectedPath = null;

    if (!tree || !tree.children) {
        container.innerHTML = '<p class="empty-message">No files to display</p>';
        return;
    }

    const treeElement = createTreeNode(tree, 0);
    container.appendChild(treeElement);
}

/**
 * Creates a tree node element
 * @param {Object} node - The tree node data
 * @param {number} depth - Current depth level
 * @returns {HTMLElement} The tree node element
 */
function createTreeNode(node, depth) {
    const fragment = document.createDocumentFragment();

    // Skip root node label, just render children
    if (depth === 0) {
        if (node.children) {
            for (const child of node.children) {
                const childElement = createTreeNode(child, depth + 1);
                fragment.appendChild(childElement);
            }
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'file-tree-root';
        wrapper.appendChild(fragment);
        return wrapper;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'file-tree-node';

    // Create the item element
    const item = document.createElement('div');
    item.className = `file-tree-item ${node.type}`;
    item.style.paddingLeft = `${(depth - 1) * 16 + 8}px`;
    item.dataset.path = node.path;
    item.dataset.type = node.type;

    // Icon
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.innerHTML = getIcon(node);
    item.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = node.name;
    item.appendChild(name);

    // Click handler
    item.addEventListener('click', (e) => handleItemClick(e, node));

    wrapper.appendChild(item);

    // Children container (for folders)
    if (node.type === 'folder' && node.children && node.children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'file-tree-children';
        childrenContainer.dataset.path = node.path;

        for (const child of node.children) {
            const childElement = createTreeNode(child, depth + 1);
            childrenContainer.appendChild(childElement);
        }

        wrapper.appendChild(childrenContainer);
    }

    return wrapper;
}

/**
 * Handles click on a tree item
 * @param {Event} e - Click event
 * @param {Object} node - The node data
 */
function handleItemClick(e, node) {
    e.stopPropagation();
    const item = e.currentTarget;

    if (node.type === 'folder') {
        // Toggle folder expansion
        const children = item.parentElement.querySelector('.file-tree-children');
        if (children) {
            children.classList.toggle('collapsed');
            item.classList.toggle('expanded');
        }
    } else {
        // Select file
        selectFile(node.path, item);
    }
}

/**
 * Selects a file in the tree
 * @param {string} path - The file path
 * @param {HTMLElement} item - The item element
 */
function selectFile(path, item) {
    // Remove previous selection
    const previousSelected = document.querySelector('.file-tree-item.selected');
    if (previousSelected) {
        previousSelected.classList.remove('selected');
    }

    // Add selection to current item
    item.classList.add('selected');
    selectedPath = path;

    // Trigger callback
    if (onFileSelectCallback) {
        onFileSelectCallback(path);
    }
}

/**
 * Gets the currently selected file path
 * @returns {string|null} The selected path or null
 */
export function getSelectedPath() {
    return selectedPath;
}

/**
 * Programmatically selects a file by path
 * @param {string} path - The file path to select
 */
export function selectByPath(path) {
    const item = document.querySelector(`.file-tree-item[data-path="${path}"]`);
    if (item) {
        // Expand parent folders
        let parent = item.parentElement;
        while (parent) {
            if (parent.classList.contains('file-tree-children')) {
                parent.classList.remove('collapsed');
                const parentItem = parent.previousElementSibling;
                if (parentItem) {
                    parentItem.classList.add('expanded');
                }
            }
            parent = parent.parentElement;
        }

        // Select the item
        selectFile(path, item);
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Clears the file selection
 */
export function clearSelection() {
    const selected = document.querySelector('.file-tree-item.selected');
    if (selected) {
        selected.classList.remove('selected');
    }
    selectedPath = null;
}

/**
 * Gets the icon SVG for a node
 * @param {Object} node - The tree node
 * @returns {string} SVG markup
 */
function getIcon(node) {
    if (node.type === 'folder') {
        return `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.764.736 1.764 1.694V4h5.472A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9z"/>
        </svg>`;
    }

    const ext = node.extension?.toLowerCase() || '';

    if (ext === '.json') {
        return `<svg width="16" height="16" viewBox="0 0 16 16" fill="#F5A623">
            <path d="M4.5 1A1.5 1.5 0 0 0 3 2.5v11A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V5.5L9 1H4.5zM9 4V1l4 4h-3a1 1 0 0 1-1-1z"/>
            <text x="5" y="12" font-size="6" fill="white">{ }</text>
        </svg>`;
    }

    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'].includes(ext)) {
        return `<svg width="16" height="16" viewBox="0 0 16 16" fill="#4CAF50">
            <path d="M4.5 1A1.5 1.5 0 0 0 3 2.5v11A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V5.5L9 1H4.5zM9 4V1l4 4h-3a1 1 0 0 1-1-1z"/>
            <circle cx="6" cy="9" r="1.5" fill="white"/>
            <path d="M4 13l2-3 1.5 2 2-3 2.5 4H4z" fill="white"/>
        </svg>`;
    }

    // Default file icon
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.5 1A1.5 1.5 0 0 0 3 2.5v11A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V5.5L9 1H4.5zM9 4V1l4 4h-3a1 1 0 0 1-1-1z"/>
    </svg>`;
}

/**
 * Expands all folders in the tree
 */
export function expandAll() {
    const children = document.querySelectorAll('.file-tree-children');
    const items = document.querySelectorAll('.file-tree-item.folder');

    children.forEach(c => c.classList.remove('collapsed'));
    items.forEach(i => i.classList.add('expanded'));
}

/**
 * Collapses all folders in the tree
 */
export function collapseAll() {
    const children = document.querySelectorAll('.file-tree-children');
    const items = document.querySelectorAll('.file-tree-item.folder');

    children.forEach(c => c.classList.add('collapsed'));
    items.forEach(i => i.classList.remove('expanded'));
}
