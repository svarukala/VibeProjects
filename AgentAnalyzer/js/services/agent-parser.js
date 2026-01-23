/**
 * Agent Parser Service for AgentAnalyzer
 * Parses and extracts information from Copilot agent packages
 */

import { getFileContent, getAllFiles } from './zip-service.js';
import { parseJsonFile, findFile, findAllFiles } from './file-service.js';

/**
 * Agent types enumeration
 */
export const AgentType = {
    DECLARATIVE: 'DA',
    CUSTOM: 'CA',
    UNKNOWN: 'UNKNOWN'
};

/**
 * Parses the agent package and extracts all relevant information
 * @returns {Object} Parsed agent information
 */
export function parseAgentPackage() {
    const files = getAllFiles();
    const manifestPath = findFile(files, 'manifest.json');

    if (!manifestPath) {
        return {
            type: AgentType.UNKNOWN,
            error: 'No manifest.json found in the package'
        };
    }

    const manifest = parseJsonFile(manifestPath);
    if (!manifest) {
        return {
            type: AgentType.UNKNOWN,
            error: 'Failed to parse manifest.json'
        };
    }

    // Determine agent type
    const agentType = determineAgentType(manifest);

    if (agentType === AgentType.DECLARATIVE) {
        return parseDeclarativeAgent(manifest, files);
    } else if (agentType === AgentType.CUSTOM) {
        return parseCustomAgent(manifest, files);
    }

    return {
        type: AgentType.UNKNOWN,
        manifest: manifest,
        error: 'Unable to determine agent type'
    };
}

/**
 * Determines the agent type from the manifest
 * @param {Object} manifest - The parsed manifest.json
 * @returns {string} The agent type
 */
function determineAgentType(manifest) {
    if (manifest.copilotAgents && manifest.copilotAgents.declarativeAgents) {
        return AgentType.DECLARATIVE;
    }
    // Add more detection logic for custom agents as needed
    return AgentType.CUSTOM;
}

/**
 * Parses a Declarative Agent package
 * @param {Object} manifest - The parsed manifest.json
 * @param {Map} files - Map of extracted files
 * @returns {Object} Parsed declarative agent information
 */
function parseDeclarativeAgent(manifest, files) {
    const result = {
        type: AgentType.DECLARATIVE,
        manifest: manifest,
        name: manifest.name?.short || manifest.name?.full || 'Unnamed Agent',
        description: manifest.description?.short || manifest.description?.full || '',
        version: manifest.version || '1.0.0',
        declarativeAgents: []
    };

    const declarativeAgents = manifest.copilotAgents?.declarativeAgents || [];

    for (const daRef of declarativeAgents) {
        const daFile = daRef.file;
        if (!daFile) continue;

        // Find the declarative agent JSON file
        const daPath = findFile(files, daFile);
        if (!daPath) {
            result.declarativeAgents.push({
                file: daFile,
                error: 'File not found'
            });
            continue;
        }

        const daContent = parseJsonFile(daPath);
        if (!daContent) {
            result.declarativeAgents.push({
                file: daFile,
                path: daPath,
                error: 'Failed to parse JSON'
            });
            continue;
        }

        // Parse the declarative agent content
        const parsedDA = parseDeclarativeAgentContent(daContent, daPath);
        result.declarativeAgents.push(parsedDA);
    }

    // Set primary agent details from the first declarative agent
    if (result.declarativeAgents.length > 0 && !result.declarativeAgents[0].error) {
        const primaryDA = result.declarativeAgents[0];
        result.agentName = primaryDA.name || result.name;
        result.agentDescription = primaryDA.description || result.description;
        result.instructions = primaryDA.instructions;
        result.capabilities = primaryDA.capabilities;
        result.conversationStarters = primaryDA.conversationStarters;
        result.schemaVersion = primaryDA.schemaVersion;
    }

    return result;
}

/**
 * Parses the content of a declarative agent JSON file
 * @param {Object} content - The parsed JSON content
 * @param {string} path - The file path
 * @returns {Object} Parsed declarative agent details
 */
function parseDeclarativeAgentContent(content, path) {
    const result = {
        path: path,
        schemaVersion: content.$schema ? extractSchemaVersion(content.$schema) : null,
        version: content.version || '1.0',
        name: content.name || '',
        description: content.description || '',
        instructions: content.instructions || '',
        capabilities: [],
        conversationStarters: [],
        actions: [],
        properties: {}
    };

    // Parse capabilities
    if (content.capabilities) {
        result.capabilities = parseCapabilities(content.capabilities);
    }

    // Parse conversation starters (starter prompts)
    if (content.conversation_starters || content.conversationStarters) {
        const starters = content.conversation_starters || content.conversationStarters;
        result.conversationStarters = starters.map(s => ({
            title: s.title || s.text || '',
            text: s.text || s.title || ''
        }));
    }

    // Parse actions
    if (content.actions) {
        result.actions = content.actions;
    }

    // Extract boolean and enumerated properties
    result.properties = extractProperties(content);

    return result;
}

/**
 * Parses capabilities from the declarative agent
 * @param {Array} capabilities - The capabilities array
 * @returns {Array} Parsed capabilities
 */
function parseCapabilities(capabilities) {
    const parsed = [];

    for (const cap of capabilities) {
        const capabilityInfo = {
            name: cap.name || 'Unknown',
            type: determineCapabilityType(cap),
            enabled: true,
            raw: cap
        };

        // Parse specific capability types
        if (cap.name === 'OneDriveAndSharePoint' || cap.items_by_sharepoint_ids || cap.items_by_url) {
            capabilityInfo.type = 'SharePoint';
            capabilityInfo.sources = parseSharePointSources(cap);
        } else if (cap.name === 'GraphConnectors' || cap.connections) {
            capabilityInfo.type = 'GraphConnectors';
            capabilityInfo.connectors = parseGraphConnectors(cap);
        } else if (cap.name === 'WebSearch') {
            capabilityInfo.type = 'WebSearch';
        } else if (cap.name === 'CodeInterpreter') {
            capabilityInfo.type = 'CodeInterpreter';
        } else if (cap.name === 'ImageGenerator') {
            capabilityInfo.type = 'ImageGenerator';
        }

        parsed.push(capabilityInfo);
    }

    return parsed;
}

/**
 * Determines the capability type
 * @param {Object} cap - The capability object
 * @returns {string} The capability type
 */
function determineCapabilityType(cap) {
    if (cap.name) return cap.name;
    if (cap.items_by_sharepoint_ids || cap.items_by_url) return 'SharePoint';
    if (cap.connections) return 'GraphConnectors';
    return 'Unknown';
}

/**
 * Parses SharePoint knowledge sources from a capability
 * @param {Object} cap - The capability object
 * @returns {Array} Array of SharePoint sources
 */
function parseSharePointSources(cap) {
    const sources = [];

    // Parse items_by_sharepoint_ids
    if (cap.items_by_sharepoint_ids) {
        for (const item of cap.items_by_sharepoint_ids) {
            sources.push({
                type: 'sharepoint_id',
                siteId: item.site_id,
                webId: item.web_id,
                listId: item.list_id,
                uniqueId: item.unique_id
            });
        }
    }

    // Parse items_by_url
    if (cap.items_by_url) {
        for (const item of cap.items_by_url) {
            sources.push({
                type: 'url',
                url: item.url || item
            });
        }
    }

    return sources;
}

/**
 * Parses Graph Connectors from a capability
 * @param {Object} cap - The capability object
 * @returns {Array} Array of connector information
 */
function parseGraphConnectors(cap) {
    const connectors = [];

    if (cap.connections) {
        for (const conn of cap.connections) {
            connectors.push({
                connectionId: conn.connection_id || conn.connectionId,
                description: conn.description || ''
            });
        }
    }

    return connectors;
}

/**
 * Extracts schema version from schema URL
 * @param {string} schemaUrl - The schema URL
 * @returns {string|null} The version string
 */
function extractSchemaVersion(schemaUrl) {
    // Match patterns like "v1.5" or "1.5" in the URL
    const match = schemaUrl.match(/v?(\d+\.\d+)/);
    return match ? match[1] : null;
}

/**
 * Extracts boolean and enumerated properties from the agent content
 * @param {Object} content - The agent content
 * @returns {Object} Extracted properties
 */
function extractProperties(content) {
    const properties = {};
    const booleanProps = ['allow_web_search', 'allowWebSearch', 'code_interpreter', 'codeInterpreter'];
    const enumProps = ['response_style', 'responseStyle', 'tone'];

    for (const prop of booleanProps) {
        if (content[prop] !== undefined) {
            properties[prop] = {
                type: 'boolean',
                value: content[prop]
            };
        }
    }

    for (const prop of enumProps) {
        if (content[prop] !== undefined) {
            properties[prop] = {
                type: 'enum',
                value: content[prop]
            };
        }
    }

    return properties;
}

/**
 * Parses a Custom Agent package
 * @param {Object} manifest - The parsed manifest.json
 * @param {Map} files - Map of extracted files
 * @returns {Object} Parsed custom agent information
 */
function parseCustomAgent(manifest, files) {
    return {
        type: AgentType.CUSTOM,
        manifest: manifest,
        name: manifest.name?.short || manifest.name?.full || 'Custom Agent',
        description: manifest.description?.short || manifest.description?.full || '',
        version: manifest.version || '1.0.0',
        message: 'Custom Agent analysis is not yet implemented (TBD)',
        // Placeholder for future implementation
        components: []
    };
}

/**
 * Finds all API/plugin definition files in the package
 * @returns {Array} Array of API definition file paths
 */
export function findApiDefinitions() {
    const files = getAllFiles();
    const apiFiles = [];

    // Look for OpenAPI/Swagger files
    const jsonFiles = findAllFiles(files, /\.(json|yaml|yml)$/i);

    for (const path of jsonFiles) {
        const content = parseJsonFile(path);
        if (content) {
            // Check if it's an OpenAPI file
            if (content.openapi || content.swagger || content.paths) {
                apiFiles.push({
                    path: path,
                    type: 'openapi',
                    version: content.openapi || content.swagger || 'unknown'
                });
            }
            // Check if it's a plugin manifest
            else if (content.schema_version || content.functions || content.runtimes) {
                apiFiles.push({
                    path: path,
                    type: 'plugin',
                    version: content.schema_version || 'unknown'
                });
            }
        }
    }

    return apiFiles;
}

/**
 * Gets the SharePoint sources from the parsed agent
 * @param {Object} agentInfo - The parsed agent information
 * @returns {Array} Array of SharePoint sources
 */
export function getSharePointSources(agentInfo) {
    const sources = [];

    if (agentInfo.capabilities) {
        for (const cap of agentInfo.capabilities) {
            if (cap.type === 'SharePoint' && cap.sources) {
                sources.push(...cap.sources);
            }
        }
    }

    return sources;
}

/**
 * Gets the Graph Connectors from the parsed agent
 * @param {Object} agentInfo - The parsed agent information
 * @returns {Array} Array of connector information
 */
export function getGraphConnectors(agentInfo) {
    const connectors = [];

    if (agentInfo.capabilities) {
        for (const cap of agentInfo.capabilities) {
            if (cap.type === 'GraphConnectors' && cap.connectors) {
                connectors.push(...cap.connectors);
            }
        }
    }

    return connectors;
}

/**
 * Checks if the agent has a specific capability
 * @param {Object} agentInfo - The parsed agent information
 * @param {string} capabilityType - The capability type to check
 * @returns {boolean} True if the capability exists
 */
export function hasCapability(agentInfo, capabilityType) {
    if (!agentInfo.capabilities) return false;
    return agentInfo.capabilities.some(cap => cap.type === capabilityType);
}
