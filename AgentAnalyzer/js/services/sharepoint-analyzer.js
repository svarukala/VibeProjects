/**
 * SharePoint Analyzer Service for AgentAnalyzer
 * Analyzes SharePoint knowledge sources for best practices
 */

import {
    initializeGraphClient,
    getSiteInfo,
    getDrive,
    getAllFilesRecursive,
    getFileByUrl,
    parseSharePointUrl
} from './graph-service.js';
import { getAnalysisConfig } from '../config.js';
import { Severity } from './analysis-service.js';

/**
 * Analyzes SharePoint knowledge sources
 * @param {Array} sources - Array of SharePoint sources from the agent
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeSharePointSources(sources) {
    const results = {
        sources: [],
        recommendations: [],
        summary: {
            totalSources: sources.length,
            totalFiles: 0,
            totalSize: 0,
            analyzedSources: 0,
            errors: 0
        }
    };

    // Initialize Graph client
    const initialized = await initializeGraphClient();
    if (!initialized) {
        results.error = 'Failed to initialize Microsoft Graph client. Please ensure you are signed in.';
        return results;
    }

    const config = getAnalysisConfig();

    for (const source of sources) {
        const sourceResult = await analyzeSource(source, config);
        results.sources.push(sourceResult);

        if (sourceResult.error) {
            results.summary.errors++;
        } else {
            results.summary.analyzedSources++;
            results.summary.totalFiles += sourceResult.stats.totalFiles;
            results.summary.totalSize += sourceResult.stats.totalSize;
        }

        // Generate recommendations for this source
        const recommendations = generateSourceRecommendations(sourceResult, config);
        results.recommendations.push(...recommendations);
    }

    // Generate overall recommendations
    const overallRecommendations = generateOverallRecommendations(results, config);
    results.recommendations.push(...overallRecommendations);

    return results;
}

/**
 * Analyzes a single SharePoint source
 * @param {Object} source - The source configuration
 * @param {Object} config - Analysis configuration
 * @returns {Promise<Object>} Source analysis result
 */
async function analyzeSource(source, config) {
    const result = {
        source: source,
        type: source.type,
        stats: {
            totalFiles: 0,
            totalSize: 0,
            averageSize: 0,
            largeFiles: [],
            excelFiles: [],
            sensitivityLabeledFiles: [],
            fileTypes: {}
        },
        error: null
    };

    try {
        if (source.type === 'url') {
            await analyzeUrlSource(source, result, config);
        } else if (source.type === 'sharepoint_id') {
            await analyzeIdSource(source, result, config);
        }
    } catch (error) {
        console.error('Error analyzing source:', error);
        result.error = error.message || 'Failed to analyze source';
    }

    return result;
}

/**
 * Analyzes a URL-based SharePoint source
 * @param {Object} source - The source configuration
 * @param {Object} result - The result object to populate
 * @param {Object} config - Analysis configuration
 */
async function analyzeUrlSource(source, result, config) {
    const parsedUrl = parseSharePointUrl(source.url);
    if (!parsedUrl || !parsedUrl.siteUrl) {
        result.error = 'Invalid SharePoint URL';
        return;
    }

    result.parsedUrl = parsedUrl;

    // Check if it's a direct file link
    if (parsedUrl.isFile) {
        const fileInfo = await getFileByUrl(source.url);
        if (fileInfo) {
            analyzeFile(fileInfo, result, config);
            result.stats.totalFiles = 1;
            result.stats.totalSize = fileInfo.size;
            result.stats.averageSize = fileInfo.size;
        } else {
            result.error = 'Unable to access file';
        }
        return;
    }

    // It's a library or folder
    const siteInfo = await getSiteInfo(parsedUrl.siteUrl);
    if (!siteInfo) {
        result.error = 'Unable to access SharePoint site';
        return;
    }

    result.siteInfo = {
        id: siteInfo.id,
        name: siteInfo.displayName,
        webUrl: siteInfo.webUrl
    };

    // Get the drive (document library)
    const drive = await getDrive(siteInfo.id);
    if (!drive) {
        result.error = 'Unable to access document library';
        return;
    }

    result.driveInfo = {
        id: drive.id,
        name: drive.name
    };

    // Get all files recursively
    const files = await getAllFilesRecursive(drive.id);

    for (const file of files) {
        analyzeFile(file, result, config);
    }

    // Calculate stats
    result.stats.totalFiles = files.length;
    if (files.length > 0) {
        result.stats.averageSize = result.stats.totalSize / files.length;
    }
}

/**
 * Analyzes an ID-based SharePoint source
 * @param {Object} source - The source configuration
 * @param {Object} result - The result object to populate
 * @param {Object} config - Analysis configuration
 */
async function analyzeIdSource(source, result, config) {
    // For ID-based sources, we would need to use the specific IDs
    // This is a simplified implementation
    result.error = 'ID-based source analysis requires additional implementation';
}

/**
 * Analyzes a single file and updates the result
 * @param {Object} file - The file information
 * @param {Object} result - The result object to update
 * @param {Object} config - Analysis configuration
 */
function analyzeFile(file, result, config) {
    result.stats.totalSize += file.size || 0;

    // Track file types
    const extension = getFileExtension(file.name).toLowerCase();
    result.stats.fileTypes[extension] = (result.stats.fileTypes[extension] || 0) + 1;

    // Check for large files (>80MB)
    const threshold = config.sharepoint.largeFileSizeThreshold;
    if (file.size > threshold) {
        result.stats.largeFiles.push({
            name: file.name,
            size: file.size,
            webUrl: file.webUrl
        });
    }

    // Check for Excel files
    if (isExcelFile(file.name)) {
        result.stats.excelFiles.push({
            name: file.name,
            size: file.size,
            webUrl: file.webUrl
        });
    }

    // Check for sensitivity labels
    if (file.sensitivityLabel) {
        result.stats.sensitivityLabeledFiles.push({
            name: file.name,
            label: file.sensitivityLabel,
            webUrl: file.webUrl
        });
    }
}

/**
 * Generates recommendations for a single source
 * @param {Object} sourceResult - The source analysis result
 * @param {Object} config - Analysis configuration
 * @returns {Array} Array of recommendations
 */
function generateSourceRecommendations(sourceResult, config) {
    const recommendations = [];
    const stats = sourceResult.stats;
    const sourceName = sourceResult.parsedUrl?.siteUrl || 'SharePoint Source';

    // Large files warning
    if (stats.largeFiles.length > 0) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'SharePoint',
            title: 'Large Files Detected',
            description: `Found ${stats.largeFiles.length} file(s) exceeding 80MB in "${sourceName}":
${stats.largeFiles.map(f => `- ${f.name} (${formatSize(f.size)})`).join('\n')}`,
            suggestion: 'Large files may cause performance issues or timeouts. Consider breaking them into smaller sections or removing from the knowledge source.'
        });
    }

    // Excel files recommendation
    if (stats.excelFiles.length > 0) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'SharePoint',
            title: 'Excel Files Found',
            description: `Found ${stats.excelFiles.length} Excel document(s) in the knowledge source.`,
            suggestion: 'Enable Code Interpreter capability in your agent to allow data analysis and calculations on Excel files.'
        });
    }

    // Sensitivity labels warning
    if (stats.sensitivityLabeledFiles.length > 0) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'SharePoint',
            title: 'Sensitivity Labeled Files',
            description: `Found ${stats.sensitivityLabeledFiles.length} file(s) with sensitivity labels. These may have access restrictions.`,
            suggestion: 'Verify that the agent\'s service principal has appropriate permissions to access labeled content.'
        });
    }

    return recommendations;
}

/**
 * Generates overall recommendations for all sources
 * @param {Object} results - The complete analysis results
 * @param {Object} config - Analysis configuration
 * @returns {Array} Array of recommendations
 */
function generateOverallRecommendations(results, config) {
    const recommendations = [];
    const summary = results.summary;

    // High file count warning
    if (summary.totalFiles > config.sharepoint.highFileCountThreshold) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'SharePoint',
            title: 'High File Count',
            description: `Total of ${summary.totalFiles} files across all knowledge sources. This may impact performance.`,
            suggestion: 'Consider using more specific folder paths or file filters to reduce the number of files.'
        });
    }

    // Check for Excel files across all sources needing Code Interpreter
    const totalExcelFiles = results.sources.reduce(
        (sum, s) => sum + (s.stats.excelFiles?.length || 0), 0
    );

    if (totalExcelFiles > 0) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'SharePoint',
            title: 'Enable Code Interpreter',
            description: `Your knowledge sources contain ${totalExcelFiles} Excel document(s).`,
            suggestion: 'Enable the Code Interpreter capability to allow data analysis and calculations on Excel files.'
        });
    }

    // Error summary
    if (summary.errors > 0) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'SharePoint',
            title: 'Source Access Issues',
            description: `Unable to analyze ${summary.errors} out of ${summary.totalSources} sources.`,
            suggestion: 'Check permissions and ensure all SharePoint URLs are accessible.'
        });
    }

    // Success message if everything looks good
    if (summary.errors === 0 && recommendations.length === 0) {
        recommendations.push({
            severity: Severity.SUCCESS,
            category: 'SharePoint',
            title: 'SharePoint Sources Look Good',
            description: `Successfully analyzed ${summary.totalSources} source(s) with ${summary.totalFiles} files.`
        });
    }

    return recommendations;
}

/**
 * Checks if a filename is an Excel file
 * @param {string} filename - The filename to check
 * @returns {boolean} True if Excel file
 */
function isExcelFile(filename) {
    const excelExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb'];
    const ext = getFileExtension(filename).toLowerCase();
    return excelExtensions.includes(ext);
}

/**
 * Gets the file extension from a filename
 * @param {string} filename - The filename
 * @returns {string} The extension
 */
function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
}

/**
 * Formats file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
