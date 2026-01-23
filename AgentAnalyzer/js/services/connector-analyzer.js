/**
 * Connector Analyzer Service for AgentAnalyzer
 * Analyzes Copilot Connectors and API Connectors
 */

import { getAnalysisConfig } from '../config.js';
import { Severity } from './analysis-service.js';
import { getAllFiles, getFileContent } from './zip-service.js';
import { parseJsonFile, findAllFiles } from './file-service.js';

/**
 * Analyzes Copilot (Graph) Connectors
 * @param {Array} connectors - Array of connector configurations
 * @returns {Object} Analysis results
 */
export function analyzeCopilotConnectors(connectors) {
    const results = {
        connectors: [],
        recommendations: [],
        summary: {
            totalConnectors: connectors.length,
            withDescriptions: 0,
            withoutDescriptions: 0,
            issues: 0
        }
    };

    const config = getAnalysisConfig();

    for (const connector of connectors) {
        const connectorResult = analyzeConnector(connector, config);
        results.connectors.push(connectorResult);

        if (connectorResult.hasDescription) {
            results.summary.withDescriptions++;
        } else {
            results.summary.withoutDescriptions++;
        }

        if (connectorResult.issues.length > 0) {
            results.summary.issues += connectorResult.issues.length;
        }
    }

    // Generate recommendations
    results.recommendations = generateConnectorRecommendations(results, config);

    return results;
}

/**
 * Analyzes a single connector
 * @param {Object} connector - The connector configuration
 * @param {Object} config - Analysis configuration
 * @returns {Object} Connector analysis result
 */
function analyzeConnector(connector, config) {
    const result = {
        connectionId: connector.connectionId,
        description: connector.description || '',
        hasDescription: !!connector.description,
        issues: []
    };

    const minLength = config.connectors.minDescriptionLength;
    const maxLength = config.connectors.maxDescriptionLength;

    // Check for missing description
    if (!connector.description) {
        result.issues.push({
            type: 'missing_description',
            message: 'Connector is missing a description'
        });
    } else {
        const descLength = connector.description.length;

        // Check description length
        if (descLength < minLength) {
            result.issues.push({
                type: 'short_description',
                message: `Description is too short (${descLength} chars, minimum ${minLength})`
            });
        } else if (descLength > maxLength) {
            result.issues.push({
                type: 'long_description',
                message: `Description is too long (${descLength} chars, maximum ${maxLength})`
            });
        }

        // Check for vague descriptions
        const vaguePatterns = [
            /^data$/i,
            /^connector$/i,
            /^connection$/i,
            /^source$/i,
            /^content$/i
        ];

        if (vaguePatterns.some(p => p.test(connector.description.trim()))) {
            result.issues.push({
                type: 'vague_description',
                message: 'Description is too generic or vague'
            });
        }
    }

    return result;
}

/**
 * Generates recommendations for connectors
 * @param {Object} results - Analysis results
 * @param {Object} config - Analysis configuration
 * @returns {Array} Array of recommendations
 */
function generateConnectorRecommendations(results, config) {
    const recommendations = [];
    const { totalConnectors, withoutDescriptions } = results.summary;
    const maxRecommended = config.connectors.maxRecommendedCount;

    // Too many connectors
    if (totalConnectors > maxRecommended) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'Copilot Connectors',
            title: 'Too Many Connectors',
            description: `Your agent uses ${totalConnectors} connectors (recommended maximum: ${maxRecommended}).`,
            suggestion: 'Consider reducing the number of connectors or splitting functionality into child agents for better performance and accuracy.'
        });
    }

    // Missing descriptions
    if (withoutDescriptions > 0) {
        const connectorsWithoutDesc = results.connectors
            .filter(c => !c.hasDescription)
            .map(c => c.connectionId);

        recommendations.push({
            severity: Severity.WARNING,
            category: 'Copilot Connectors',
            title: 'Missing Connector Descriptions',
            description: `${withoutDescriptions} connector(s) are missing descriptions: ${connectorsWithoutDesc.join(', ')}`,
            suggestion: 'Add clear descriptions to help Copilot understand when to use each connector.'
        });
    }

    // Short descriptions
    const shortDescConnectors = results.connectors.filter(c =>
        c.issues.some(i => i.type === 'short_description')
    );

    if (shortDescConnectors.length > 0) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Copilot Connectors',
            title: 'Improve Connector Descriptions',
            description: `${shortDescConnectors.length} connector(s) have brief descriptions that could be expanded.`,
            suggestion: 'Expand descriptions to clearly explain what data each connector provides and when it should be used.'
        });
    }

    // Success message
    if (recommendations.length === 0) {
        recommendations.push({
            severity: Severity.SUCCESS,
            category: 'Copilot Connectors',
            title: 'Connectors Look Good',
            description: `All ${totalConnectors} connector(s) are properly configured with descriptions.`
        });
    }

    return recommendations;
}

/**
 * Analyzes API Connectors (OpenAPI/Plugin files)
 * @param {Array} apiFiles - Array of API file paths
 * @returns {Object} Analysis results
 */
export function analyzeApiConnectors(apiFiles) {
    const results = {
        files: [],
        recommendations: [],
        summary: {
            totalFiles: apiFiles.length,
            validFiles: 0,
            invalidFiles: 0,
            totalOperations: 0,
            operationsWithoutDescription: 0
        }
    };

    for (const apiFile of apiFiles) {
        const fileResult = analyzeApiFile(apiFile.path);
        results.files.push(fileResult);

        if (fileResult.isValid) {
            results.summary.validFiles++;
            results.summary.totalOperations += fileResult.operations.length;
            results.summary.operationsWithoutDescription += fileResult.operations
                .filter(op => !op.hasDescription).length;
        } else {
            results.summary.invalidFiles++;
        }
    }

    // Generate recommendations
    results.recommendations = generateApiRecommendations(results);

    return results;
}

/**
 * Analyzes a single API file
 * @param {string} path - The file path
 * @returns {Object} File analysis result
 */
function analyzeApiFile(path) {
    const result = {
        path: path,
        fileName: path.split('/').pop(),
        isValid: false,
        type: null,
        version: null,
        operations: [],
        issues: []
    };

    const content = getFileContent(path);
    if (!content) {
        result.issues.push({
            type: 'file_not_found',
            message: 'File could not be read'
        });
        return result;
    }

    // Try to parse JSON
    let parsed;
    try {
        parsed = JSON.parse(content.content);
        result.isValid = true;
    } catch (error) {
        result.issues.push({
            type: 'invalid_json',
            message: `Invalid JSON: ${error.message}`,
            line: extractLineNumber(error.message)
        });
        return result;
    }

    // Determine API type
    if (parsed.openapi) {
        result.type = 'OpenAPI';
        result.version = parsed.openapi;
        analyzeOpenApiSpec(parsed, result);
    } else if (parsed.swagger) {
        result.type = 'Swagger';
        result.version = parsed.swagger;
        analyzeOpenApiSpec(parsed, result);
    } else if (parsed.schema_version || parsed.functions) {
        result.type = 'Plugin';
        result.version = parsed.schema_version || 'unknown';
        analyzePluginManifest(parsed, result);
    } else {
        result.type = 'Unknown';
        result.issues.push({
            type: 'unknown_format',
            message: 'File is valid JSON but not a recognized API format'
        });
    }

    return result;
}

/**
 * Analyzes an OpenAPI specification
 * @param {Object} spec - The OpenAPI specification
 * @param {Object} result - The result object to update
 */
function analyzeOpenApiSpec(spec, result) {
    // Check for info section
    if (!spec.info) {
        result.issues.push({
            type: 'missing_info',
            message: 'Missing info section'
        });
    } else {
        if (!spec.info.description) {
            result.issues.push({
                type: 'missing_api_description',
                message: 'API is missing a description in the info section'
            });
        }
    }

    // Check servers
    if (!spec.servers || spec.servers.length === 0) {
        result.issues.push({
            type: 'missing_servers',
            message: 'No server URLs defined'
        });
    }

    // Analyze paths/operations
    if (spec.paths) {
        for (const [path, methods] of Object.entries(spec.paths)) {
            for (const [method, operation] of Object.entries(methods)) {
                if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
                    const opResult = analyzeOperation(path, method, operation);
                    result.operations.push(opResult);
                }
            }
        }
    }
}

/**
 * Analyzes an API operation
 * @param {string} path - The endpoint path
 * @param {string} method - The HTTP method
 * @param {Object} operation - The operation definition
 * @returns {Object} Operation analysis result
 */
function analyzeOperation(path, method, operation) {
    const result = {
        path: path,
        method: method.toUpperCase(),
        operationId: operation.operationId || `${method}_${path}`,
        hasDescription: !!operation.description || !!operation.summary,
        description: operation.description || operation.summary || '',
        issues: [],
        parameters: []
    };

    // Check for description
    if (!operation.description && !operation.summary) {
        result.issues.push({
            type: 'missing_description',
            message: 'Operation is missing a description'
        });
    }

    // Check operationId
    if (!operation.operationId) {
        result.issues.push({
            type: 'missing_operation_id',
            message: 'Operation is missing an operationId'
        });
    }

    // Analyze parameters
    if (operation.parameters) {
        for (const param of operation.parameters) {
            const paramResult = {
                name: param.name,
                in: param.in,
                hasDescription: !!param.description,
                required: param.required || false
            };

            if (!param.description) {
                result.issues.push({
                    type: 'missing_param_description',
                    message: `Parameter "${param.name}" is missing a description`
                });
            }

            result.parameters.push(paramResult);
        }
    }

    // Check request body
    if (operation.requestBody && !operation.requestBody.description) {
        result.issues.push({
            type: 'missing_body_description',
            message: 'Request body is missing a description'
        });
    }

    return result;
}

/**
 * Analyzes a plugin manifest
 * @param {Object} manifest - The plugin manifest
 * @param {Object} result - The result object to update
 */
function analyzePluginManifest(manifest, result) {
    // Check for functions
    if (manifest.functions) {
        for (const func of manifest.functions) {
            const funcResult = {
                path: func.name || 'unknown',
                method: 'FUNCTION',
                operationId: func.name || 'unknown',
                hasDescription: !!func.description,
                description: func.description || '',
                issues: [],
                parameters: []
            };

            if (!func.description) {
                funcResult.issues.push({
                    type: 'missing_description',
                    message: 'Function is missing a description'
                });
            }

            // Check parameters
            if (func.parameters?.properties) {
                for (const [name, param] of Object.entries(func.parameters.properties)) {
                    const paramResult = {
                        name: name,
                        hasDescription: !!param.description,
                        required: func.parameters.required?.includes(name) || false
                    };

                    if (!param.description) {
                        funcResult.issues.push({
                            type: 'missing_param_description',
                            message: `Parameter "${name}" is missing a description`
                        });
                    }

                    funcResult.parameters.push(paramResult);
                }
            }

            result.operations.push(funcResult);
        }
    }
}

/**
 * Generates recommendations for API connectors
 * @param {Object} results - Analysis results
 * @returns {Array} Array of recommendations
 */
function generateApiRecommendations(results) {
    const recommendations = [];
    const { invalidFiles, operationsWithoutDescription, totalOperations } = results.summary;

    // Invalid files
    if (invalidFiles > 0) {
        const invalidFileNames = results.files
            .filter(f => !f.isValid)
            .map(f => f.fileName);

        recommendations.push({
            severity: Severity.CRITICAL,
            category: 'API Connectors',
            title: 'Invalid API Files',
            description: `${invalidFiles} file(s) contain invalid JSON: ${invalidFileNames.join(', ')}`,
            suggestion: 'Fix JSON syntax errors before deployment.'
        });
    }

    // Missing operation descriptions
    if (operationsWithoutDescription > 0) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'API Connectors',
            title: 'Operations Missing Descriptions',
            description: `${operationsWithoutDescription} out of ${totalOperations} operations are missing descriptions.`,
            suggestion: 'Add descriptions to all operations to help Copilot understand when to call each endpoint.'
        });
    }

    // Parameter descriptions
    let totalParamsWithoutDesc = 0;
    for (const file of results.files) {
        for (const op of file.operations) {
            totalParamsWithoutDesc += op.parameters.filter(p => !p.hasDescription).length;
        }
    }

    if (totalParamsWithoutDesc > 0) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'API Connectors',
            title: 'Document Parameters',
            description: `${totalParamsWithoutDesc} parameter(s) are missing descriptions.`,
            suggestion: 'Add descriptions to all parameters to improve Copilot\'s understanding of expected inputs.'
        });
    }

    // Check for examples
    recommendations.push({
        severity: Severity.SUGGESTION,
        category: 'API Connectors',
        title: 'Consider Adding Examples',
        description: 'Adding example values for parameters and responses can improve Copilot accuracy.',
        suggestion: 'Include example values in your OpenAPI specification for better AI comprehension.'
    });

    // Success message
    if (invalidFiles === 0 && operationsWithoutDescription === 0) {
        recommendations.push({
            severity: Severity.SUCCESS,
            category: 'API Connectors',
            title: 'API Files Well Documented',
            description: `All ${totalOperations} operations have descriptions.`
        });
    }

    return recommendations;
}

/**
 * Extracts line number from error message
 * @param {string} message - Error message
 * @returns {number|null} Line number
 */
function extractLineNumber(message) {
    const match = message.match(/line (\d+)/i);
    return match ? parseInt(match[1], 10) : null;
}
