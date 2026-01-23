/**
 * Analysis Panel Component for AgentAnalyzer
 * Displays analysis results and recommendations
 */

import { Severity } from '../services/analysis-service.js';

// DOM Elements
let analysisResultsCard = null;
let resultsSummary = null;
let resultsTabBar = null;
let basicResultsPanel = null;
let sharepointResultsPanel = null;
let connectorsResultsPanel = null;
let apiResultsPanel = null;

/**
 * Initializes the analysis panel component
 * @param {Object} elements - Object containing DOM element references
 */
export function initAnalysisPanel(elements) {
    analysisResultsCard = elements.analysisResultsCard;
    resultsSummary = elements.resultsSummary;
    resultsTabBar = elements.resultsTabBar;
    basicResultsPanel = elements.basicResultsPanel;
    sharepointResultsPanel = elements.sharepointResultsPanel;
    connectorsResultsPanel = elements.connectorsResultsPanel;
    apiResultsPanel = elements.apiResultsPanel;
}

/**
 * Shows the analysis results panel (now a no-op as results are always visible in Analyzer tab)
 */
export function showResults() {
    // Results are always visible in the Analyzer tab
}

/**
 * Hides the analysis results panel (now a no-op as results are always visible in Analyzer tab)
 */
export function hideResults() {
    // Results are always visible in the Analyzer tab
}

/**
 * Updates the results summary in the header
 * @param {Object} summary - Summary object
 */
function updateResultsSummary(summary) {
    if (!resultsSummary) return;

    if (!summary) {
        resultsSummary.innerHTML = '';
        return;
    }

    resultsSummary.innerHTML = `
        <span class="summary-item critical">${summary.counts.critical} Critical</span>
        <span class="summary-item warning">${summary.counts.warning} Warnings</span>
        <span class="summary-item success">${summary.counts.suggestion} Suggestions</span>
    `;
}

/**
 * Renders basic analysis results
 * @param {Object} results - Analysis results from analyzeAgent
 */
export function renderBasicResults(results) {
    if (!basicResultsPanel) return;

    // Clear placeholder
    const placeholder = basicResultsPanel.querySelector('.results-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    basicResultsPanel.innerHTML = '';

    // Update header summary
    if (results.summary) {
        updateResultsSummary(results.summary);
        const summarySection = createSummarySection(results.summary);
        basicResultsPanel.appendChild(summarySection);
    }

    // Group recommendations by category
    const grouped = groupByCategory(results.recommendations);

    for (const [category, recs] of Object.entries(grouped)) {
        const section = createResultSection(category, recs);
        basicResultsPanel.appendChild(section);
    }
}

/**
 * Renders SharePoint analysis results
 * @param {Object} results - SharePoint analysis results
 */
export function renderSharePointResults(results) {
    if (!sharepointResultsPanel) return;

    sharepointResultsPanel.innerHTML = '';

    if (!results) {
        sharepointResultsPanel.innerHTML = '<p class="no-results">No SharePoint analysis performed</p>';
        return;
    }

    // Render summary stats
    if (results.summary) {
        const statsGrid = createStatsGrid([
            { label: 'Sources', value: results.summary.totalSources },
            { label: 'Files', value: results.summary.totalFiles },
            { label: 'Total Size', value: formatSize(results.summary.totalSize) },
            { label: 'Analyzed', value: results.summary.analyzedSources }
        ]);
        sharepointResultsPanel.appendChild(statsGrid);
    }

    // Render source details
    if (results.sources && results.sources.length > 0) {
        for (const source of results.sources) {
            const sourceSection = createSourceSection(source);
            sharepointResultsPanel.appendChild(sourceSection);
        }
    }

    // Render recommendations
    if (results.recommendations && results.recommendations.length > 0) {
        const recsSection = createResultSection('Recommendations', results.recommendations);
        sharepointResultsPanel.appendChild(recsSection);
    }
}

/**
 * Renders Copilot Connectors analysis results
 * @param {Object} results - Connectors analysis results
 */
export function renderConnectorsResults(results) {
    if (!connectorsResultsPanel) return;

    connectorsResultsPanel.innerHTML = '';

    if (!results) {
        connectorsResultsPanel.innerHTML = '<p class="no-results">No connector analysis performed</p>';
        return;
    }

    // Render summary stats
    if (results.summary) {
        const statsGrid = createStatsGrid([
            { label: 'Total', value: results.summary.totalConnectors },
            { label: 'With Description', value: results.summary.withDescriptions },
            { label: 'Without Description', value: results.summary.withoutDescriptions },
            { label: 'Issues', value: results.summary.issues }
        ]);
        connectorsResultsPanel.appendChild(statsGrid);
    }

    // Render connector details
    if (results.connectors && results.connectors.length > 0) {
        const connectorsList = document.createElement('div');
        connectorsList.className = 'connectors-list';

        for (const connector of results.connectors) {
            const connectorItem = createConnectorItem(connector);
            connectorsList.appendChild(connectorItem);
        }

        connectorsResultsPanel.appendChild(connectorsList);
    }

    // Render recommendations
    if (results.recommendations && results.recommendations.length > 0) {
        const recsSection = createResultSection('Recommendations', results.recommendations);
        connectorsResultsPanel.appendChild(recsSection);
    }
}

/**
 * Renders API Connectors analysis results
 * @param {Object} results - API analysis results
 */
export function renderApiResults(results) {
    if (!apiResultsPanel) return;

    apiResultsPanel.innerHTML = '';

    if (!results) {
        apiResultsPanel.innerHTML = '<p class="no-results">No API analysis performed</p>';
        return;
    }

    // Render summary stats
    if (results.summary) {
        const statsGrid = createStatsGrid([
            { label: 'Files', value: results.summary.totalFiles },
            { label: 'Valid', value: results.summary.validFiles },
            { label: 'Invalid', value: results.summary.invalidFiles },
            { label: 'Operations', value: results.summary.totalOperations }
        ]);
        apiResultsPanel.appendChild(statsGrid);
    }

    // Render file details
    if (results.files && results.files.length > 0) {
        for (const file of results.files) {
            const fileSection = createApiFileSection(file);
            apiResultsPanel.appendChild(fileSection);
        }
    }

    // Render recommendations
    if (results.recommendations && results.recommendations.length > 0) {
        const recsSection = createResultSection('Recommendations', results.recommendations);
        apiResultsPanel.appendChild(recsSection);
    }
}

/**
 * Creates a summary section
 * @param {Object} summary - Summary object
 * @returns {HTMLElement} Summary section element
 */
function createSummarySection(summary) {
    const section = document.createElement('div');
    section.className = 'result-summary';

    const statusClass = summary.status === 'good' ? 'success' :
        summary.status === 'critical' ? 'critical' : 'warning';

    section.innerHTML = `
        <div class="summary-status ${statusClass}">
            ${getSeverityIcon(statusClass)}
            <span>${summary.message}</span>
        </div>
        <div class="summary-counts">
            <span class="count critical">${summary.counts.critical} Critical</span>
            <span class="count warning">${summary.counts.warning} Warnings</span>
            <span class="count suggestion">${summary.counts.suggestion} Suggestions</span>
        </div>
    `;

    return section;
}

/**
 * Creates a result section for a category
 * @param {string} category - Category name
 * @param {Array} recommendations - Array of recommendations
 * @returns {HTMLElement} Result section element
 */
function createResultSection(category, recommendations) {
    const section = document.createElement('div');
    section.className = 'result-section';

    const header = document.createElement('h4');
    header.textContent = category;
    section.appendChild(header);

    for (const rec of recommendations) {
        const item = createResultItem(rec);
        section.appendChild(item);
    }

    return section;
}

/**
 * Creates a result item element
 * @param {Object} rec - Recommendation object
 * @returns {HTMLElement} Result item element
 */
function createResultItem(rec) {
    const item = document.createElement('div');
    item.className = `result-item ${rec.severity}`;

    item.innerHTML = `
        <div class="result-item-header">
            ${getSeverityIcon(rec.severity)}
            <span class="result-item-title">${escapeHtml(rec.title)}</span>
        </div>
        <p class="result-item-description">${escapeHtml(rec.description)}</p>
        ${rec.suggestion ? `<p class="result-item-suggestion"><strong>Suggestion:</strong> ${escapeHtml(rec.suggestion)}</p>` : ''}
    `;

    return item;
}

/**
 * Creates a stats grid
 * @param {Array} stats - Array of stat objects with label and value
 * @returns {HTMLElement} Stats grid element
 */
function createStatsGrid(stats) {
    const grid = document.createElement('div');
    grid.className = 'stats-grid';

    for (const stat of stats) {
        const item = document.createElement('div');
        item.className = 'stat-item';
        item.innerHTML = `
            <div class="stat-value">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
        `;
        grid.appendChild(item);
    }

    return grid;
}

/**
 * Creates a SharePoint source section
 * @param {Object} source - Source analysis result
 * @returns {HTMLElement} Source section element
 */
function createSourceSection(source) {
    const section = document.createElement('div');
    section.className = 'source-section';

    const url = source.parsedUrl?.siteUrl || source.source?.url || 'Unknown Source';

    section.innerHTML = `
        <h5>${escapeHtml(url)}</h5>
        ${source.error ? `<p class="error-message">${escapeHtml(source.error)}</p>` : ''}
        ${!source.error ? createSourceStats(source.stats) : ''}
    `;

    return section;
}

/**
 * Creates source statistics HTML
 * @param {Object} stats - Source statistics
 * @returns {string} HTML string
 */
function createSourceStats(stats) {
    if (!stats) return '';

    let html = '<div class="source-stats">';
    html += `<p>Files: ${stats.totalFiles} | Size: ${formatSize(stats.totalSize)}</p>`;

    if (stats.largeFiles?.length > 0) {
        html += `<p class="warning">Large files (>80MB): ${stats.largeFiles.length}</p>`;
    }

    if (stats.excelFiles?.length > 0) {
        html += `<p class="info">Excel files: ${stats.excelFiles.length}</p>`;
    }

    if (stats.sensitivityLabeledFiles?.length > 0) {
        html += `<p class="warning">Sensitivity labeled: ${stats.sensitivityLabeledFiles.length}</p>`;
    }

    html += '</div>';
    return html;
}

/**
 * Creates a connector item element
 * @param {Object} connector - Connector data
 * @returns {HTMLElement} Connector item element
 */
function createConnectorItem(connector) {
    const item = document.createElement('div');
    item.className = 'connector-item';

    const hasIssues = connector.issues && connector.issues.length > 0;

    item.innerHTML = `
        <div class="connector-header">
            <strong>${escapeHtml(connector.connectionId)}</strong>
            ${hasIssues ? '<span class="issue-badge">Issues</span>' : '<span class="ok-badge">OK</span>'}
        </div>
        <p class="connector-description">${connector.description || '<em>No description</em>'}</p>
        ${hasIssues ? `<ul class="connector-issues">${connector.issues.map(i => `<li>${escapeHtml(i.message)}</li>`).join('')}</ul>` : ''}
    `;

    return item;
}

/**
 * Creates an API file section
 * @param {Object} file - File analysis result
 * @returns {HTMLElement} File section element
 */
function createApiFileSection(file) {
    const section = document.createElement('div');
    section.className = 'api-file-section';

    const statusIcon = file.isValid ? '&#10004;' : '&#10008;';
    const statusClass = file.isValid ? 'valid' : 'invalid';

    section.innerHTML = `
        <h5>
            <span class="status-icon ${statusClass}">${statusIcon}</span>
            ${escapeHtml(file.fileName)}
        </h5>
        <p>Type: ${file.type || 'Unknown'} | Version: ${file.version || 'Unknown'}</p>
        ${file.operations?.length > 0 ? `<p>Operations: ${file.operations.length}</p>` : ''}
        ${file.issues?.length > 0 ? `<ul class="file-issues">${file.issues.map(i => `<li class="issue">${escapeHtml(i.message)}</li>`).join('')}</ul>` : ''}
    `;

    return section;
}

/**
 * Groups recommendations by category
 * @param {Array} recommendations - Array of recommendations
 * @returns {Object} Grouped recommendations
 */
function groupByCategory(recommendations) {
    const grouped = {};

    for (const rec of recommendations) {
        const category = rec.category || 'General';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(rec);
    }

    return grouped;
}

/**
 * Gets the severity icon SVG
 * @param {string} severity - Severity level
 * @returns {string} SVG markup
 */
function getSeverityIcon(severity) {
    switch (severity) {
        case Severity.CRITICAL:
        case 'critical':
            return '<svg class="severity-icon critical" width="16" height="16" viewBox="0 0 16 16" fill="#D13438"><circle cx="8" cy="8" r="8"/><path d="M8 4v5" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11.5" r="1" fill="white"/></svg>';
        case Severity.WARNING:
        case 'warning':
            return '<svg class="severity-icon warning" width="16" height="16" viewBox="0 0 16 16" fill="#FFB900"><path d="M8 1l7 14H1L8 1z"/><path d="M8 5v4" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11.5" r="1" fill="white"/></svg>';
        case Severity.SUGGESTION:
        case 'suggestion':
            return '<svg class="severity-icon suggestion" width="16" height="16" viewBox="0 0 16 16" fill="#0078D4"><circle cx="8" cy="8" r="8"/><path d="M8 4v4" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="11" r="1" fill="white"/></svg>';
        case Severity.SUCCESS:
        case 'success':
            return '<svg class="severity-icon success" width="16" height="16" viewBox="0 0 16 16" fill="#107C10"><circle cx="8" cy="8" r="8"/><path d="M5 8l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
        default:
            return '';
    }
}

/**
 * Formats file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

/**
 * Clears all results panels
 */
export function clearResults() {
    if (basicResultsPanel) basicResultsPanel.innerHTML = '';
    if (sharepointResultsPanel) sharepointResultsPanel.innerHTML = '';
    if (connectorsResultsPanel) connectorsResultsPanel.innerHTML = '';
    if (apiResultsPanel) apiResultsPanel.innerHTML = '';
    hideResults();
}
