/**
 * Agent History Component for AgentAnalyzer
 * Displays list of previously processed agents
 */

import { getStoredAgents, deleteStoredAgent, getStorageStats } from '../services/storage-service.js';
import { AgentType } from '../services/agent-parser.js';

let historyContainer = null;
let historyList = null;
let onLoadAgentCallback = null;
let onDeleteAgentCallback = null;

/**
 * Initializes the agent history component
 * @param {Object} elements - DOM element references
 * @param {Function} onLoadAgent - Callback when agent is selected to load
 * @param {Function} onDeleteAgent - Callback when agent is deleted
 */
export function initAgentHistory(elements, onLoadAgent, onDeleteAgent) {
    historyContainer = elements.historyContainer;
    historyList = elements.historyList;
    onLoadAgentCallback = onLoadAgent;
    onDeleteAgentCallback = onDeleteAgent;

    // Initial render
    renderHistory();
}

/**
 * Renders the agent history list
 */
export function renderHistory() {
    if (!historyList) return;

    const agents = getStoredAgents();
    const stats = getStorageStats();

    historyList.innerHTML = '';

    if (agents.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                <p>No previously processed agents</p>
                <p class="hint">Upload a zip file to get started</p>
            </div>
        `;
        updateHistoryVisibility(false);
        return;
    }

    // Render header with stats
    const header = document.createElement('div');
    header.className = 'history-header';
    header.innerHTML = `
        <span class="history-count">${agents.length} agent(s)</span>
        <span class="history-size">${stats.dataSizeFormatted}</span>
    `;
    historyList.appendChild(header);

    // Render each agent
    for (const agent of agents) {
        const item = createAgentHistoryItem(agent);
        historyList.appendChild(item);
    }

    updateHistoryVisibility(true);
}

/**
 * Creates a history item element for an agent
 * @param {Object} agent - Stored agent data
 * @returns {HTMLElement} History item element
 */
function createAgentHistoryItem(agent) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.id = agent.id;

    const agentTypeClass = agent.agentType === AgentType.DECLARATIVE ? 'da' : 'ca';
    const agentTypeLabel = agent.agentType === AgentType.DECLARATIVE ? 'DA' : 'CA';

    const uploadDate = formatDate(agent.uploadedAt);
    const hasBasicAnalysis = !!agent.basicAnalysis;
    const hasDeepAnalysis = !!agent.deepAnalysis;

    item.innerHTML = `
        <div class="history-item-main" title="Click to load">
            <div class="history-item-header">
                <span class="agent-type-badge-small ${agentTypeClass}">${agentTypeLabel}</span>
                <span class="history-item-name">${escapeHtml(agent.agentName)}</span>
            </div>
            <div class="history-item-meta">
                <span class="history-item-file">${escapeHtml(agent.fileName)}</span>
                <span class="history-item-date">${uploadDate}</span>
            </div>
            <div class="history-item-status">
                ${hasBasicAnalysis ? '<span class="status-badge analyzed">Analyzed</span>' : ''}
                ${hasDeepAnalysis ? '<span class="status-badge deep">Deep</span>' : ''}
                ${!hasBasicAnalysis && !hasDeepAnalysis ? '<span class="status-badge pending">Not analyzed</span>' : ''}
            </div>
        </div>
        <div class="history-item-actions">
            <button class="history-btn load-btn" title="Load Agent">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                    <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/>
                </svg>
            </button>
            <button class="history-btn delete-btn" title="Delete">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
            </button>
        </div>
    `;

    // Event listeners
    const mainArea = item.querySelector('.history-item-main');
    const loadBtn = item.querySelector('.load-btn');
    const deleteBtn = item.querySelector('.delete-btn');

    mainArea.addEventListener('click', () => handleLoadAgent(agent.id));
    loadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleLoadAgent(agent.id);
    });
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteAgent(agent.id, agent.agentName);
    });

    return item;
}

/**
 * Handles loading an agent from history
 * @param {string} id - Agent ID
 */
function handleLoadAgent(id) {
    if (onLoadAgentCallback) {
        onLoadAgentCallback(id);
    }
}

/**
 * Handles deleting an agent from history
 * @param {string} id - Agent ID
 * @param {string} name - Agent name for confirmation
 */
function handleDeleteAgent(id, name) {
    if (confirm(`Delete "${name}" from history? This cannot be undone.`)) {
        const deleted = deleteStoredAgent(id);
        if (deleted) {
            renderHistory();
            if (onDeleteAgentCallback) {
                onDeleteAgentCallback(id);
            }
        }
    }
}

/**
 * Updates history container visibility
 * @param {boolean} show - Whether to show the history
 */
function updateHistoryVisibility(show) {
    if (historyContainer) {
        if (show) {
            historyContainer.classList.remove('hidden');
        } else {
            historyContainer.classList.add('hidden');
        }
    }
}

/**
 * Shows the history panel
 */
export function showHistory() {
    renderHistory();
    if (historyContainer) {
        historyContainer.classList.remove('hidden');
    }
}

/**
 * Hides the history panel
 */
export function hideHistory() {
    if (historyContainer) {
        historyContainer.classList.add('hidden');
    }
}

/**
 * Highlights a specific agent in the history
 * @param {string} id - Agent ID to highlight
 */
export function highlightAgent(id) {
    // Remove existing highlight
    const existing = historyList?.querySelector('.history-item.active');
    if (existing) {
        existing.classList.remove('active');
    }

    // Add new highlight
    const item = historyList?.querySelector(`.history-item[data-id="${id}"]`);
    if (item) {
        item.classList.add('active');
    }
}

/**
 * Formats a timestamp to readable date
 * @param {number} timestamp - Timestamp
 * @returns {string} Formatted date
 */
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 24 hours ago
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) {
            const minutes = Math.floor(diff / 60000);
            return minutes < 1 ? 'Just now' : `${minutes}m ago`;
        }
        return `${hours}h ago`;
    }

    // Less than 7 days ago
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    }

    // Older
    return date.toLocaleDateString();
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
