/**
 * Deep Analysis Service for AgentAnalyzer
 * Orchestrates deep analysis features for SharePoint, Copilot Connectors, and API Connectors
 */

import { analyzeSharePointSources } from './sharepoint-analyzer.js';
import { analyzeCopilotConnectors, analyzeApiConnectors } from './connector-analyzer.js';
import { getSharePointSources, getGraphConnectors, findApiDefinitions } from './agent-parser.js';
import { isSignedIn } from '../auth/msal-auth.js';

/**
 * Deep analysis options
 */
export const DeepAnalysisOptions = {
    SHAREPOINT: 'sharepoint',
    COPILOT_CONNECTORS: 'copilotConnectors',
    API_CONNECTORS: 'apiConnectors'
};

/**
 * Runs deep analysis based on selected options
 * @param {Object} agentInfo - The parsed agent information
 * @param {Object} options - Object with boolean flags for each analysis type
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<Object>} Deep analysis results
 */
export async function runDeepAnalysis(agentInfo, options, progressCallback = null) {
    const results = {
        timestamp: new Date().toISOString(),
        options: options,
        sharepoint: null,
        copilotConnectors: null,
        apiConnectors: null,
        errors: [],
        summary: {
            totalRecommendations: 0,
            critical: 0,
            warnings: 0,
            suggestions: 0
        }
    };

    // Check if user is signed in for SharePoint and Copilot Connectors analysis
    if ((options.sharepoint || options.copilotConnectors) && !isSignedIn()) {
        results.errors.push({
            type: 'auth_required',
            message: 'Sign-in is required for SharePoint and Copilot Connectors analysis.'
        });
        return results;
    }

    const totalSteps = Object.values(options).filter(v => v).length;
    let currentStep = 0;

    // SharePoint Analysis
    if (options.sharepoint) {
        currentStep++;
        if (progressCallback) {
            progressCallback({
                step: currentStep,
                total: totalSteps,
                message: 'Analyzing SharePoint knowledge sources...'
            });
        }

        try {
            const sources = getSharePointSources(agentInfo);
            if (sources.length > 0) {
                results.sharepoint = await analyzeSharePointSources(sources);
                countRecommendations(results.sharepoint.recommendations, results.summary);
            } else {
                results.sharepoint = {
                    sources: [],
                    recommendations: [{
                        severity: 'suggestion',
                        category: 'SharePoint',
                        title: 'No SharePoint Sources',
                        description: 'No SharePoint knowledge sources configured for this agent.'
                    }],
                    summary: { totalSources: 0 }
                };
            }
        } catch (error) {
            console.error('SharePoint analysis error:', error);
            results.errors.push({
                type: 'sharepoint_error',
                message: error.message || 'Failed to analyze SharePoint sources'
            });
        }
    }

    // Copilot Connectors Analysis
    if (options.copilotConnectors) {
        currentStep++;
        if (progressCallback) {
            progressCallback({
                step: currentStep,
                total: totalSteps,
                message: 'Analyzing Copilot connectors...'
            });
        }

        try {
            const connectors = getGraphConnectors(agentInfo);
            if (connectors.length > 0) {
                results.copilotConnectors = analyzeCopilotConnectors(connectors);
                countRecommendations(results.copilotConnectors.recommendations, results.summary);
            } else {
                results.copilotConnectors = {
                    connectors: [],
                    recommendations: [{
                        severity: 'suggestion',
                        category: 'Copilot Connectors',
                        title: 'No Copilot Connectors',
                        description: 'No Copilot (Graph) connectors configured for this agent.'
                    }],
                    summary: { totalConnectors: 0 }
                };
            }
        } catch (error) {
            console.error('Copilot connectors analysis error:', error);
            results.errors.push({
                type: 'connectors_error',
                message: error.message || 'Failed to analyze Copilot connectors'
            });
        }
    }

    // API Connectors Analysis
    if (options.apiConnectors) {
        currentStep++;
        if (progressCallback) {
            progressCallback({
                step: currentStep,
                total: totalSteps,
                message: 'Analyzing API connectors...'
            });
        }

        try {
            const apiFiles = findApiDefinitions();
            if (apiFiles.length > 0) {
                results.apiConnectors = analyzeApiConnectors(apiFiles);
                countRecommendations(results.apiConnectors.recommendations, results.summary);
            } else {
                results.apiConnectors = {
                    files: [],
                    recommendations: [{
                        severity: 'suggestion',
                        category: 'API Connectors',
                        title: 'No API Definitions',
                        description: 'No OpenAPI or plugin definition files found in the package.'
                    }],
                    summary: { totalFiles: 0 }
                };
            }
        } catch (error) {
            console.error('API connectors analysis error:', error);
            results.errors.push({
                type: 'api_error',
                message: error.message || 'Failed to analyze API connectors'
            });
        }
    }

    // Final progress update
    if (progressCallback) {
        progressCallback({
            step: totalSteps,
            total: totalSteps,
            message: 'Deep analysis complete',
            complete: true
        });
    }

    return results;
}

/**
 * Counts recommendations by severity
 * @param {Array} recommendations - Array of recommendations
 * @param {Object} summary - Summary object to update
 */
function countRecommendations(recommendations, summary) {
    for (const rec of recommendations) {
        summary.totalRecommendations++;
        switch (rec.severity) {
            case 'critical':
                summary.critical++;
                break;
            case 'warning':
                summary.warnings++;
                break;
            case 'suggestion':
                summary.suggestions++;
                break;
        }
    }
}

/**
 * Checks if deep analysis is available for the given agent
 * @param {Object} agentInfo - The parsed agent information
 * @returns {Object} Availability status for each analysis type
 */
export function checkDeepAnalysisAvailability(agentInfo) {
    const availability = {
        sharepoint: {
            available: false,
            reason: null,
            count: 0
        },
        copilotConnectors: {
            available: false,
            reason: null,
            count: 0
        },
        apiConnectors: {
            available: false,
            reason: null,
            count: 0
        }
    };

    // Check SharePoint
    const spSources = getSharePointSources(agentInfo);
    if (spSources.length > 0) {
        availability.sharepoint.available = true;
        availability.sharepoint.count = spSources.length;
    } else {
        availability.sharepoint.reason = 'No SharePoint knowledge sources configured';
    }

    // Check Copilot Connectors
    const connectors = getGraphConnectors(agentInfo);
    if (connectors.length > 0) {
        availability.copilotConnectors.available = true;
        availability.copilotConnectors.count = connectors.length;
    } else {
        availability.copilotConnectors.reason = 'No Copilot connectors configured';
    }

    // Check API Connectors
    const apiFiles = findApiDefinitions();
    if (apiFiles.length > 0) {
        availability.apiConnectors.available = true;
        availability.apiConnectors.count = apiFiles.length;
    } else {
        availability.apiConnectors.reason = 'No API definition files found';
    }

    return availability;
}

/**
 * Gets a summary message for deep analysis results
 * @param {Object} results - Deep analysis results
 * @returns {string} Summary message
 */
export function getDeepAnalysisSummary(results) {
    const { summary, errors } = results;

    if (errors.length > 0) {
        return `Deep analysis completed with ${errors.length} error(s). Found ${summary.totalRecommendations} recommendation(s).`;
    }

    if (summary.critical > 0) {
        return `Found ${summary.critical} critical issue(s) that need immediate attention.`;
    }

    if (summary.warnings > 0) {
        return `Found ${summary.warnings} warning(s) to review.`;
    }

    if (summary.suggestions > 0) {
        return `Found ${summary.suggestions} suggestion(s) for improvement.`;
    }

    return 'Deep analysis complete. No issues found.';
}
