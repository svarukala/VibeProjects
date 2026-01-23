/**
 * AgentAnalyzer - Main Application Module
 * Orchestrates all components and manages application state
 */

import { loadConfig, isConfigured } from './config.js';
import { initializeMsal, signIn, signOut, isSignedIn, getUserDisplayName } from './auth/msal-auth.js';
import { extractZip, clearZip, downloadZip, hasModifiedFiles, getAllFiles } from './services/zip-service.js';
import { parseAgentPackage, AgentType } from './services/agent-parser.js';
import { analyzeAgent } from './services/analysis-service.js';
import { runDeepAnalysis } from './services/deep-analysis-service.js';
import {
    saveAgent,
    getStoredAgent,
    updateAnalysisResults,
    updateStoredFiles,
    deleteStoredAgent
} from './services/storage-service.js';
import { initFileTree, renderFileTree, clearSelection } from './components/file-tree.js';
import { initFileViewer, openFile, closeViewer, hasUnsavedChanges } from './components/file-viewer.js';
import { initAgentDetails, renderAgentDetails, clearAgentDetails } from './components/agent-details.js';
import { initDragDrop, resetDragDrop } from './components/drag-drop.js';
import { initAnalysisPanel, renderBasicResults, renderSharePointResults, renderConnectorsResults, renderApiResults, clearResults, showResults } from './components/analysis-panel.js';
import { initDeepAnalysisOptions, updateDeepAnalysisState, resetOptions, disableControls, enableControls } from './components/deep-analysis-options.js';
import { renderDeepAnalysisResults } from './components/deep-analysis-results.js';
import { initAgentHistory, renderHistory, highlightAgent } from './components/agent-history.js';

// Application State
let currentAgentInfo = null;
let currentAgentId = null;
let packageFileName = '';

// File tabs state
let openFileTabs = []; // Array of { path, name, isModified }
let activeFileTabPath = null;

// DOM Elements
const elements = {
    // Header
    signInBtn: null,
    signOutBtn: null,
    userInfo: null,
    userName: null,

    // Upload Area
    uploadArea: null,
    dropZone: null,
    fileInput: null,
    browseBtn: null,

    // History
    historyContainer: null,
    historyList: null,

    // Workspace
    workspace: null,
    closePackageBtn: null,

    // Workspace Tabs
    workspaceTabs: null,
    fixedTabs: null,
    fileTabs: null,
    tabDetails: null,
    tabAnalyzer: null,
    tabFileEditor: null,
    analysisBadge: null,

    // File Tree
    fileTree: null,

    // Agent Details
    agentTypeBadge: null,
    agentName: null,
    agentDescription: null,
    instructionsToggle: null,
    instructionsContent: null,
    agentInstructions: null,
    agentProperties: null,
    starterPromptsSection: null,
    starterPrompts: null,

    // Analysis Options
    analyzeBtn: null,
    chkSharepoint: null,
    chkCopilotConnectors: null,
    chkApiConnectors: null,
    deepAnalyzeBtn: null,
    signInRequired: null,

    // File Viewer (in file-editor tab)
    fileViewerPanel: null,
    fileName: null,
    editorContainer: null,
    imagePreview: null,
    previewImage: null,
    undoBtn: null,
    saveBtn: null,
    cancelBtn: null,
    editorActions: null,

    // Analysis Results
    analysisResultsPanel: null,
    resultsSummary: null,
    resultsTabBar: null,
    basicResultsPanel: null,
    sharepointResultsPanel: null,
    connectorsResultsPanel: null,
    apiResultsPanel: null,

    // Footer
    downloadBtn: null,
    statusText: null,

    // Loading
    loadingOverlay: null,
    loadingText: null
};

/**
 * Initializes the application
 */
async function init() {
    // Get DOM elements
    initElements();

    // Load configuration
    await loadConfig();

    // Initialize MSAL
    await initializeMsal();

    // Initialize components
    initComponents();

    // Setup event listeners
    setupEventListeners();

    // Update auth UI
    updateAuthUI();

    // Set initial status
    setStatus('Ready');
}

/**
 * Initializes DOM element references
 */
function initElements() {
    // Header
    elements.signInBtn = document.getElementById('sign-in-btn');
    elements.signOutBtn = document.getElementById('sign-out-btn');
    elements.userInfo = document.getElementById('user-info');
    elements.userName = document.getElementById('user-name');

    // Upload Area
    elements.uploadArea = document.getElementById('upload-area');
    elements.dropZone = document.getElementById('drop-zone');
    elements.fileInput = document.getElementById('file-input');
    elements.browseBtn = document.getElementById('browse-btn');

    // History
    elements.historyContainer = document.getElementById('history-container');
    elements.historyList = document.getElementById('history-list');

    // Workspace
    elements.workspace = document.getElementById('workspace');
    elements.closePackageBtn = document.getElementById('close-package-btn');

    // Workspace Tabs
    elements.workspaceTabs = document.querySelectorAll('.fixed-tabs .workspace-tab');
    elements.fixedTabs = document.querySelector('.fixed-tabs');
    elements.fileTabs = document.getElementById('file-tabs');
    elements.tabDetails = document.getElementById('tab-details');
    elements.tabAnalyzer = document.getElementById('tab-analyzer');
    elements.tabFileEditor = document.getElementById('tab-file-editor');
    elements.analysisBadge = document.getElementById('analysis-badge');

    // File Tree
    elements.fileTree = document.getElementById('file-tree');

    // Agent Details
    elements.agentTypeBadge = document.getElementById('agent-type-badge');
    elements.agentName = document.getElementById('agent-name');
    elements.agentDescription = document.getElementById('agent-description');
    elements.instructionsToggle = document.getElementById('instructions-toggle');
    elements.instructionsContent = document.getElementById('instructions-content');
    elements.agentInstructions = document.getElementById('agent-instructions');
    elements.agentProperties = document.getElementById('agent-properties');
    elements.starterPromptsSection = document.getElementById('starter-prompts-section');
    elements.starterPrompts = document.getElementById('starter-prompts');

    // Analysis Options
    elements.analyzeBtn = document.getElementById('analyze-btn');
    elements.chkSharepoint = document.getElementById('chk-sharepoint');
    elements.chkCopilotConnectors = document.getElementById('chk-copilot-connectors');
    elements.chkApiConnectors = document.getElementById('chk-api-connectors');
    elements.deepAnalyzeBtn = document.getElementById('deep-analyze-btn');
    elements.signInRequired = document.getElementById('sign-in-required');

    // File Viewer
    elements.fileViewerPanel = document.getElementById('file-viewer');
    elements.fileName = document.getElementById('current-file-name');
    elements.editorContainer = document.getElementById('editor-container');
    elements.imagePreview = document.getElementById('image-preview');
    elements.previewImage = document.getElementById('preview-image');
    elements.editorPlaceholder = null; // No longer used - file tabs handle empty state
    elements.undoBtn = document.getElementById('undo-btn');
    elements.saveBtn = document.getElementById('save-btn');
    elements.cancelBtn = document.getElementById('cancel-btn');
    elements.editorActions = document.querySelector('.viewer-actions');

    // Analysis Results
    elements.analysisResultsPanel = document.getElementById('analysis-results');
    elements.resultsSummary = document.getElementById('results-summary');
    elements.resultsTabBar = document.querySelector('.results-tab-bar');
    elements.basicResultsPanel = document.getElementById('basic-results');
    elements.sharepointResultsPanel = document.getElementById('sharepoint-results');
    elements.connectorsResultsPanel = document.getElementById('connectors-results');
    elements.apiResultsPanel = document.getElementById('api-results');

    // Footer
    elements.downloadBtn = document.getElementById('download-btn');
    elements.statusText = document.getElementById('status-text');

    // Loading
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.loadingText = document.getElementById('loading-text');
}

/**
 * Initializes all components
 */
function initComponents() {
    // Drag and drop
    initDragDrop({
        dropZone: elements.dropZone,
        fileInput: elements.fileInput,
        browseBtn: elements.browseBtn
    }, handleFileDrop);

    // File tree
    initFileTree(handleFileSelect);

    // File viewer
    initFileViewer({
        fileViewerCard: elements.fileViewerPanel,
        fileName: elements.fileName,
        editorContainer: elements.editorContainer,
        imagePreview: elements.imagePreview,
        previewImage: elements.previewImage,
        editorPlaceholder: null, // Not used - file tabs handle empty state
        undoBtn: elements.undoBtn,
        saveBtn: elements.saveBtn,
        cancelBtn: elements.cancelBtn,
        editorActions: elements.editorActions
    }, handleFileModified);

    // Agent details
    initAgentDetails({
        agentTypeBadge: elements.agentTypeBadge,
        agentName: elements.agentName,
        agentDescription: elements.agentDescription,
        instructionsToggle: elements.instructionsToggle,
        instructionsContent: elements.instructionsContent,
        agentInstructions: elements.agentInstructions,
        agentProperties: elements.agentProperties,
        starterPromptsSection: elements.starterPromptsSection,
        starterPrompts: elements.starterPrompts
    });

    // Analysis panel
    initAnalysisPanel({
        analysisResultsCard: elements.analysisResultsPanel,
        resultsSummary: elements.resultsSummary,
        resultsTabBar: elements.resultsTabBar,
        basicResultsPanel: elements.basicResultsPanel,
        sharepointResultsPanel: elements.sharepointResultsPanel,
        connectorsResultsPanel: elements.connectorsResultsPanel,
        apiResultsPanel: elements.apiResultsPanel
    });

    // Deep analysis options
    initDeepAnalysisOptions({
        chkSharepoint: elements.chkSharepoint,
        chkCopilotConnectors: elements.chkCopilotConnectors,
        chkApiConnectors: elements.chkApiConnectors,
        deepAnalyzeBtn: elements.deepAnalyzeBtn,
        signInRequired: elements.signInRequired
    }, handleDeepAnalysis);

    // Agent history
    initAgentHistory({
        historyContainer: elements.historyContainer,
        historyList: elements.historyList
    }, handleLoadFromHistory, handleDeleteFromHistory);
}

/**
 * Sets up event listeners
 */
function setupEventListeners() {
    // Auth buttons
    elements.signInBtn?.addEventListener('click', handleSignIn);
    elements.signOutBtn?.addEventListener('click', handleSignOut);

    // Close package
    elements.closePackageBtn?.addEventListener('click', handleClosePackage);

    // Analyze button
    elements.analyzeBtn?.addEventListener('click', handleAnalyze);

    // Download button
    elements.downloadBtn?.addEventListener('click', handleDownload);

    // Workspace tab switching
    elements.workspaceTabs?.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchWorkspaceTab(tabName);
        });
    });

    // Results tab switching
    elements.resultsTabBar?.addEventListener('click', (e) => {
        const tab = e.target.closest('.results-tab');
        if (tab) {
            const panelId = tab.dataset.panel;
            switchResultsTab(panelId);
        }
    });
}

/**
 * Switches the active workspace tab
 * @param {string} tabName - 'details', 'analyzer', or 'file-editor'
 */
function switchWorkspaceTab(tabName) {
    // Update fixed tab buttons
    elements.workspaceTabs?.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update file tab buttons
    const fileTabs = elements.fileTabs?.querySelectorAll('.file-tab');
    fileTabs?.forEach(tab => {
        tab.classList.remove('active');
    });

    // Update tab content
    elements.tabDetails?.classList.remove('active');
    elements.tabAnalyzer?.classList.remove('active');
    elements.tabFileEditor?.classList.remove('active');

    if (tabName === 'details') {
        elements.tabDetails?.classList.add('active');
        activeFileTabPath = null;
    } else if (tabName === 'analyzer') {
        elements.tabAnalyzer?.classList.add('active');
        activeFileTabPath = null;
    } else if (tabName === 'file-editor') {
        elements.tabFileEditor?.classList.add('active');
    }
}

/**
 * Creates or activates a file tab
 * @param {string} path - File path
 */
function createFileTab(path) {
    const fileName = path.split('/').pop();

    // Check if tab already exists
    const existingTab = openFileTabs.find(t => t.path === path);
    if (existingTab) {
        switchToFileTab(path);
        return;
    }

    // Add to open tabs array
    openFileTabs.push({
        path,
        name: fileName,
        isModified: false
    });

    // Create tab element
    const tabEl = document.createElement('button');
    tabEl.className = 'file-tab';
    tabEl.dataset.path = path;
    tabEl.innerHTML = `
        <svg class="file-tab-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
        </svg>
        <span class="file-tab-name" title="${path}">${fileName}</span>
        <button class="file-tab-close" title="Close">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
        </button>
    `;

    // Tab click handler (not on close button)
    tabEl.addEventListener('click', (e) => {
        if (!e.target.closest('.file-tab-close')) {
            switchToFileTab(path);
        }
    });

    // Close button handler
    const closeBtn = tabEl.querySelector('.file-tab-close');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFileTab(path);
    });

    elements.fileTabs?.appendChild(tabEl);

    // Switch to this tab
    switchToFileTab(path);
}

/**
 * Switches to a file tab
 * @param {string} path - File path
 */
function switchToFileTab(path) {
    activeFileTabPath = path;

    // Update fixed tabs - deactivate all
    elements.workspaceTabs?.forEach(tab => {
        tab.classList.remove('active');
    });

    // Update file tabs - activate the correct one
    const fileTabs = elements.fileTabs?.querySelectorAll('.file-tab');
    fileTabs?.forEach(tab => {
        if (tab.dataset.path === path) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Show file editor tab content
    elements.tabDetails?.classList.remove('active');
    elements.tabAnalyzer?.classList.remove('active');
    elements.tabFileEditor?.classList.add('active');

    // Open the file in the editor
    openFile(path);
}

/**
 * Closes a file tab
 * @param {string} path - File path
 */
function closeFileTab(path) {
    // Check for unsaved changes
    const tab = openFileTabs.find(t => t.path === path);
    if (tab?.isModified) {
        if (!confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) {
            return;
        }
    }

    // Remove from array
    const index = openFileTabs.findIndex(t => t.path === path);
    if (index > -1) {
        openFileTabs.splice(index, 1);
    }

    // Remove DOM element
    const tabEl = elements.fileTabs?.querySelector(`[data-path="${CSS.escape(path)}"]`);
    tabEl?.remove();

    // If this was the active tab, switch to another
    if (activeFileTabPath === path) {
        if (openFileTabs.length > 0) {
            // Switch to the last tab or the one before
            const newIndex = Math.min(index, openFileTabs.length - 1);
            switchToFileTab(openFileTabs[newIndex].path);
        } else {
            // No more file tabs, switch to details
            switchWorkspaceTab('details');
            closeViewer();
        }
    }
}

/**
 * Updates a file tab's modified state
 * @param {string} path - File path
 * @param {boolean} isModified - Whether file is modified
 */
function updateFileTabModified(path, isModified) {
    // Update in array
    const tab = openFileTabs.find(t => t.path === path);
    if (tab) {
        tab.isModified = isModified;
    }

    // Update DOM element
    const tabEl = elements.fileTabs?.querySelector(`[data-path="${CSS.escape(path)}"]`);
    if (tabEl) {
        if (isModified) {
            tabEl.classList.add('modified');
        } else {
            tabEl.classList.remove('modified');
        }
    }
}

/**
 * Closes all file tabs
 */
function closeAllFileTabs() {
    openFileTabs = [];
    activeFileTabPath = null;
    if (elements.fileTabs) {
        elements.fileTabs.innerHTML = '';
    }
}

/**
 * Switches the active results tab
 * @param {string} panelId - Panel ID to show
 */
function switchResultsTab(panelId) {
    // Update tab buttons
    const tabs = elements.resultsTabBar?.querySelectorAll('.results-tab');
    tabs?.forEach(tab => {
        if (tab.dataset.panel === panelId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update panels
    const panels = document.querySelectorAll('.results-panel');
    panels?.forEach(panel => {
        if (panel.id === panelId) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
}

/**
 * Updates the authentication UI
 */
function updateAuthUI() {
    const signedIn = isSignedIn();

    if (signedIn) {
        elements.signInBtn.classList.add('hidden');
        elements.userInfo.classList.remove('hidden');
        elements.userName.textContent = getUserDisplayName() || 'User';
    } else {
        elements.signInBtn.classList.remove('hidden');
        elements.userInfo.classList.add('hidden');
    }

    // Update deep analysis options if agent is loaded
    if (currentAgentInfo) {
        updateDeepAnalysisState(currentAgentInfo);
    }
}

/**
 * Handles sign in button click
 */
async function handleSignIn() {
    showLoading('Signing in...');
    try {
        await signIn();
        updateAuthUI();
        setStatus('Signed in successfully');
    } catch (error) {
        console.error('Sign in error:', error);
        setStatus('Sign in failed');
        alert(error.message || 'Sign in failed. Please check the console for details.');
    } finally {
        hideLoading();
    }
}

/**
 * Handles sign out button click
 */
async function handleSignOut() {
    showLoading('Signing out...');
    try {
        await signOut();
        updateAuthUI();
        setStatus('Signed out');
    } catch (error) {
        console.error('Sign out error:', error);
    } finally {
        hideLoading();
    }
}

/**
 * Handles file drop/selection
 * @param {File} file - The dropped/selected file
 */
async function handleFileDrop(file) {
    showLoading('Extracting package...');
    setStatus('Loading package...');

    try {
        // Close any open file tabs from previous package
        closeAllFileTabs();

        // Extract the zip file
        const { tree } = await extractZip(file);
        packageFileName = file.name;

        // Parse the agent
        currentAgentInfo = parseAgentPackage();

        // Save to localStorage
        const files = getAllFiles();
        currentAgentId = saveAgent({
            fileName: packageFileName,
            agentInfo: currentAgentInfo,
            files: files
        });

        // Update history panel
        renderHistory();

        // Show workspace
        showWorkspace(tree);

        setStatus(`Loaded: ${packageFileName}`);
    } catch (error) {
        console.error('Error loading package:', error);
        setStatus('Error loading package');
        alert(error.message || 'Failed to load package');
    } finally {
        hideLoading();
    }
}

/**
 * Handles loading an agent from history
 * @param {string} id - Agent ID to load
 */
async function handleLoadFromHistory(id) {
    showLoading('Loading from history...');
    setStatus('Loading saved agent...');

    try {
        const storedAgent = getStoredAgent(id);
        if (!storedAgent) {
            throw new Error('Agent not found in storage');
        }

        // Check if we have stored files
        if (!storedAgent.files) {
            throw new Error('File contents not available. Please re-upload the zip file.');
        }

        // Close any open file tabs
        closeAllFileTabs();

        // Clear current state
        clearZip();

        // Reconstruct the files Map from stored data
        const filesMap = new Map();
        for (const [path, fileData] of Object.entries(storedAgent.files)) {
            filesMap.set(path, {
                content: fileData.content,
                originalContent: fileData.content,
                isImage: fileData.isImage,
                modified: false
            });
        }

        // Manually set the extracted files in zip-service
        // We need to rebuild the file tree structure
        const tree = buildFileTreeFromMap(filesMap, storedAgent.fileName.replace('.zip', ''));

        // Set application state
        currentAgentId = storedAgent.id;
        currentAgentInfo = storedAgent.agentInfo;
        packageFileName = storedAgent.fileName;

        // Import files into zip-service
        await importFilesToZipService(filesMap);

        // Show workspace
        showWorkspace(tree);

        // Highlight in history
        highlightAgent(id);

        // Restore analysis results if available
        if (storedAgent.basicAnalysis) {
            renderBasicResults(storedAgent.basicAnalysis);
        }
        if (storedAgent.deepAnalysis) {
            if (storedAgent.deepAnalysis.sharepoint) {
                renderSharePointResults(storedAgent.deepAnalysis.sharepoint);
            }
            if (storedAgent.deepAnalysis.copilotConnectors) {
                renderConnectorsResults(storedAgent.deepAnalysis.copilotConnectors);
            }
            if (storedAgent.deepAnalysis.apiConnectors) {
                renderApiResults(storedAgent.deepAnalysis.apiConnectors);
            }
            showResults();
        }

        setStatus(`Loaded: ${packageFileName} (from history)`);
    } catch (error) {
        console.error('Error loading from history:', error);
        setStatus('Error loading from history');
        alert(error.message || 'Failed to load agent from history');
    } finally {
        hideLoading();
    }
}

/**
 * Builds a file tree structure from a files Map
 * @param {Map} filesMap - Map of file paths to file data
 * @param {string} rootName - Root folder name
 * @returns {Object} File tree structure
 */
function buildFileTreeFromMap(filesMap, rootName) {
    const tree = {
        name: rootName,
        type: 'folder',
        path: '',
        children: []
    };

    const paths = Array.from(filesMap.keys()).sort();

    for (const path of paths) {
        addPathToTree(tree, path);
    }

    return tree;
}

/**
 * Adds a file path to the tree structure
 * @param {Object} tree - The tree object
 * @param {string} path - File path to add
 */
function addPathToTree(tree, path) {
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
                const lastDot = part.lastIndexOf('.');
                child.extension = lastDot >= 0 ? part.substring(lastDot) : '';
            }

            current.children.push(child);
            current.children.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        }

        current = child;
    }
}

/**
 * Imports files into the zip service (for history restore)
 * @param {Map} filesMap - Map of files to import
 */
async function importFilesToZipService(filesMap) {
    // This is a workaround - we directly set the extractedFiles in zip-service
    // by re-importing through a dynamic import hack
    const zipService = await import('./services/zip-service.js');

    // Clear existing
    zipService.clearZip();

    // The extractedFiles map is internal, so we need to use the module's functions
    // We'll manually populate by iterating and using internal state
    // Since we can't directly access extractedFiles, we need a different approach

    // Create a fake zip blob and extract it
    const JSZip = window.JSZip;
    const zip = new JSZip();

    for (const [path, fileData] of filesMap) {
        if (fileData.isImage) {
            zip.file(path, fileData.content, { base64: true });
        } else {
            zip.file(path, fileData.content);
        }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'restored.zip', { type: 'application/zip' });

    // Re-extract using the normal flow
    await zipService.extractZip(file);
}

/**
 * Handles deleting an agent from history
 * @param {string} id - Agent ID that was deleted
 */
function handleDeleteFromHistory(id) {
    // If this is the currently loaded agent, close it
    if (id === currentAgentId) {
        handleClosePackage();
    }
    setStatus('Agent deleted from history');
}

/**
 * Shows the workspace with the given file tree
 * @param {Object} tree - File tree structure
 */
function showWorkspace(tree) {
    elements.uploadArea.classList.add('hidden');
    elements.workspace.classList.remove('hidden');

    // Render file tree
    renderFileTree(tree, elements.fileTree);

    // Render agent details
    renderAgentDetails(currentAgentInfo);

    // Enable analyze button
    elements.analyzeBtn.disabled = false;

    // Update deep analysis options
    updateDeepAnalysisState(currentAgentInfo);

    // Enable download button
    elements.downloadBtn.disabled = false;

    // Ensure Details tab is shown by default
    switchWorkspaceTab('details');
}

/**
 * Handles file selection in the tree
 * @param {string} path - Selected file path
 */
function handleFileSelect(path) {
    createFileTab(path);
}

/**
 * Handles file modification
 * @param {string} path - Modified file path
 * @param {boolean} isModified - Whether file is modified
 */
function handleFileModified(path, isModified) {
    // Update file tab modified indicator
    updateFileTabModified(path, isModified);

    // Update status
    if (isModified) {
        setStatus(`Editing: ${path.split('/').pop()} (modified)`);
    } else {
        setStatus(`Viewing: ${path.split('/').pop()}`);
    }

    // Update stored files if we have an agent ID
    if (currentAgentId && isModified) {
        const files = getAllFiles();
        updateStoredFiles(currentAgentId, files);
    }
}

/**
 * Handles close package button
 */
function handleClosePackage() {
    // Check if any file tabs have unsaved changes
    const unsavedTabs = openFileTabs.filter(t => t.isModified);
    if (unsavedTabs.length > 0) {
        const fileNames = unsavedTabs.map(t => t.name).join(', ');
        if (!confirm(`You have unsaved changes in: ${fileNames}\n\nAre you sure you want to close?`)) {
            return;
        }
    }

    // Clear everything
    clearZip();
    currentAgentInfo = null;
    currentAgentId = null;
    packageFileName = '';

    // Close all file tabs
    closeAllFileTabs();

    // Hide workspace, show upload
    elements.workspace.classList.add('hidden');
    elements.uploadArea.classList.remove('hidden');

    // Clear components
    closeViewer();
    clearSelection();
    clearAgentDetails();
    clearResults();
    resetOptions();

    // Disable buttons
    elements.analyzeBtn.disabled = true;
    elements.downloadBtn.disabled = true;

    // Reset drag drop
    resetDragDrop();

    // Refresh history
    renderHistory();

    // Switch to details tab (reset tab state)
    switchWorkspaceTab('details');

    setStatus('Ready');
}

/**
 * Handles analyze button click
 */
async function handleAnalyze() {
    if (!currentAgentInfo) return;

    showLoading('Analyzing agent...');
    setStatus('Running analysis...');

    try {
        const results = await analyzeAgent(currentAgentInfo);
        renderBasicResults(results);

        // Save analysis results to storage
        if (currentAgentId) {
            updateAnalysisResults(currentAgentId, 'basic', results);
            renderHistory(); // Refresh history to show analysis status
        }

        setStatus('Analysis complete');
    } catch (error) {
        console.error('Analysis error:', error);
        setStatus('Analysis failed');
        alert('Analysis failed: ' + (error.message || 'Unknown error'));
    } finally {
        hideLoading();
    }
}

/**
 * Handles deep analysis
 * @param {Object} options - Selected deep analysis options
 */
async function handleDeepAnalysis(options) {
    if (!currentAgentInfo) return;

    showLoading('Running deep analysis...');
    setStatus('Running deep analysis...');
    disableControls();

    try {
        const results = await runDeepAnalysis(currentAgentInfo, options, (progress) => {
            elements.loadingText.textContent = progress.message;
        });

        const summary = renderDeepAnalysisResults(results);

        // Save deep analysis results to storage
        if (currentAgentId) {
            updateAnalysisResults(currentAgentId, 'deep', results);
            renderHistory(); // Refresh history to show analysis status
        }

        setStatus(summary || 'Deep analysis complete');
    } catch (error) {
        console.error('Deep analysis error:', error);
        setStatus('Deep analysis failed');
        alert('Deep analysis failed: ' + (error.message || 'Unknown error'));
    } finally {
        hideLoading();
        enableControls(currentAgentInfo);
    }
}

/**
 * Handles download button click
 */
async function handleDownload() {
    if (!packageFileName) return;

    showLoading('Creating package...');
    setStatus('Creating download...');

    try {
        const downloadName = packageFileName.replace('.zip', '_modified.zip');
        await downloadZip(downloadName);

        // Update stored files after download (in case of modifications)
        if (currentAgentId) {
            const files = getAllFiles();
            updateStoredFiles(currentAgentId, files);
        }

        setStatus('Download complete');
    } catch (error) {
        console.error('Download error:', error);
        setStatus('Download failed');
        alert('Download failed: ' + (error.message || 'Unknown error'));
    } finally {
        hideLoading();
    }
}

/**
 * Shows the loading overlay
 * @param {string} message - Loading message
 */
function showLoading(message = 'Loading...') {
    elements.loadingText.textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
}

/**
 * Hides the loading overlay
 */
function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

/**
 * Sets the status text
 * @param {string} text - Status text
 */
function setStatus(text) {
    elements.statusText.textContent = text;
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
