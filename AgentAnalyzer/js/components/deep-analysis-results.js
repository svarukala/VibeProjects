/**
 * Deep Analysis Results Component for AgentAnalyzer
 * Displays deep analysis results in the analysis panel
 */

import {
    renderSharePointResults,
    renderConnectorsResults,
    renderApiResults,
    showResults
} from './analysis-panel.js';
import { getDeepAnalysisSummary } from '../services/deep-analysis-service.js';

/**
 * Renders all deep analysis results
 * @param {Object} results - Deep analysis results object
 */
export function renderDeepAnalysisResults(results) {
    if (!results) return;

    // Render SharePoint results if available
    if (results.sharepoint) {
        renderSharePointResults(results.sharepoint);
    }

    // Render Copilot Connectors results if available
    if (results.copilotConnectors) {
        renderConnectorsResults(results.copilotConnectors);
    }

    // Render API Connectors results if available
    if (results.apiConnectors) {
        renderApiResults(results.apiConnectors);
    }

    // Show the results panel
    showResults();

    // Return summary for status display
    return getDeepAnalysisSummary(results);
}

/**
 * Creates a progress indicator element
 * @returns {HTMLElement} Progress indicator element
 */
export function createProgressIndicator() {
    const container = document.createElement('div');
    container.className = 'analysis-progress';
    container.innerHTML = `
        <fluent-progress-ring></fluent-progress-ring>
        <p class="progress-message">Preparing analysis...</p>
        <div class="progress-steps"></div>
    `;
    return container;
}

/**
 * Updates the progress indicator
 * @param {HTMLElement} container - The progress container element
 * @param {Object} progress - Progress object with step, total, and message
 */
export function updateProgressIndicator(container, progress) {
    if (!container) return;

    const messageEl = container.querySelector('.progress-message');
    const stepsEl = container.querySelector('.progress-steps');

    if (messageEl) {
        messageEl.textContent = progress.message;
    }

    if (stepsEl && progress.total > 0) {
        stepsEl.textContent = `Step ${progress.step} of ${progress.total}`;
    }

    if (progress.complete) {
        const ring = container.querySelector('fluent-progress-ring');
        if (ring) {
            ring.style.display = 'none';
        }
    }
}

/**
 * Creates a summary card for deep analysis results
 * @param {Object} results - Deep analysis results
 * @returns {HTMLElement} Summary card element
 */
export function createSummaryCard(results) {
    const card = document.createElement('div');
    card.className = 'deep-analysis-summary-card';

    const summary = results.summary;
    const hasErrors = results.errors && results.errors.length > 0;

    let statusClass = 'success';
    if (summary.critical > 0) {
        statusClass = 'critical';
    } else if (summary.warnings > 0) {
        statusClass = 'warning';
    } else if (hasErrors) {
        statusClass = 'error';
    }

    card.innerHTML = `
        <div class="summary-header ${statusClass}">
            <h4>Deep Analysis Complete</h4>
            <span class="summary-badge">${summary.totalRecommendations} Recommendations</span>
        </div>
        <div class="summary-body">
            <div class="summary-stats">
                ${summary.critical > 0 ? `<span class="stat critical">${summary.critical} Critical</span>` : ''}
                ${summary.warnings > 0 ? `<span class="stat warning">${summary.warnings} Warnings</span>` : ''}
                ${summary.suggestions > 0 ? `<span class="stat suggestion">${summary.suggestions} Suggestions</span>` : ''}
            </div>
            ${hasErrors ? `
                <div class="summary-errors">
                    <p class="error-title">Errors encountered:</p>
                    <ul>
                        ${results.errors.map(e => `<li>${escapeHtml(e.message)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;

    return card;
}

/**
 * Formats the deep analysis results for export
 * @param {Object} results - Deep analysis results
 * @returns {string} Formatted text output
 */
export function formatResultsForExport(results) {
    let output = 'DEEP ANALYSIS RESULTS\n';
    output += '=' .repeat(50) + '\n\n';
    output += `Generated: ${results.timestamp}\n\n`;

    // Summary
    output += 'SUMMARY\n';
    output += '-'.repeat(30) + '\n';
    output += `Total Recommendations: ${results.summary.totalRecommendations}\n`;
    output += `Critical: ${results.summary.critical}\n`;
    output += `Warnings: ${results.summary.warnings}\n`;
    output += `Suggestions: ${results.summary.suggestions}\n\n`;

    // SharePoint Results
    if (results.sharepoint) {
        output += 'SHAREPOINT ANALYSIS\n';
        output += '-'.repeat(30) + '\n';
        output += `Sources Analyzed: ${results.sharepoint.summary.analyzedSources}\n`;
        output += `Total Files: ${results.sharepoint.summary.totalFiles}\n`;
        output += formatRecommendations(results.sharepoint.recommendations);
        output += '\n';
    }

    // Copilot Connectors Results
    if (results.copilotConnectors) {
        output += 'COPILOT CONNECTORS ANALYSIS\n';
        output += '-'.repeat(30) + '\n';
        output += `Total Connectors: ${results.copilotConnectors.summary.totalConnectors}\n`;
        output += formatRecommendations(results.copilotConnectors.recommendations);
        output += '\n';
    }

    // API Connectors Results
    if (results.apiConnectors) {
        output += 'API CONNECTORS ANALYSIS\n';
        output += '-'.repeat(30) + '\n';
        output += `Files Analyzed: ${results.apiConnectors.summary.totalFiles}\n`;
        output += `Operations: ${results.apiConnectors.summary.totalOperations}\n`;
        output += formatRecommendations(results.apiConnectors.recommendations);
        output += '\n';
    }

    // Errors
    if (results.errors && results.errors.length > 0) {
        output += 'ERRORS\n';
        output += '-'.repeat(30) + '\n';
        for (const error of results.errors) {
            output += `- ${error.message}\n`;
        }
    }

    return output;
}

/**
 * Formats recommendations for text export
 * @param {Array} recommendations - Array of recommendations
 * @returns {string} Formatted text
 */
function formatRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
        return 'No recommendations.\n';
    }

    let output = '\nRecommendations:\n';
    for (const rec of recommendations) {
        const severity = rec.severity.toUpperCase();
        output += `\n[${severity}] ${rec.title}\n`;
        output += `  ${rec.description}\n`;
        if (rec.suggestion) {
            output += `  Suggestion: ${rec.suggestion}\n`;
        }
    }
    return output;
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
