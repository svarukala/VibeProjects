/**
 * Storage Service for AgentAnalyzer
 * Handles localStorage persistence for agents and analysis results
 */

const STORAGE_KEY = 'agentAnalyzer_agents';
const MAX_STORED_AGENTS = 20; // Limit to prevent localStorage overflow

/**
 * Agent storage record structure
 * @typedef {Object} StoredAgent
 * @property {string} id - Unique identifier
 * @property {string} fileName - Original zip file name
 * @property {string} agentName - Agent display name
 * @property {string} agentType - 'DA' or 'CA'
 * @property {string} description - Agent description
 * @property {number} uploadedAt - Timestamp of upload
 * @property {number} lastAnalyzedAt - Timestamp of last analysis
 * @property {Object} agentInfo - Parsed agent information
 * @property {Object} files - Stored file contents (base64 for images, string for text)
 * @property {Object} basicAnalysis - Basic analysis results
 * @property {Object} deepAnalysis - Deep analysis results
 */

/**
 * Generates a unique ID for an agent
 * @param {string} fileName - The file name
 * @returns {string} Unique ID
 */
function generateId(fileName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${random}`;
}

/**
 * Gets all stored agents from localStorage
 * @returns {StoredAgent[]} Array of stored agents
 */
export function getStoredAgents() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];

        const agents = JSON.parse(data);
        // Sort by most recent first
        return agents.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
    } catch (error) {
        console.error('Error reading stored agents:', error);
        return [];
    }
}

/**
 * Gets a single stored agent by ID
 * @param {string} id - Agent ID
 * @returns {StoredAgent|null} Stored agent or null
 */
export function getStoredAgent(id) {
    const agents = getStoredAgents();
    return agents.find(a => a.id === id) || null;
}

/**
 * Saves a new agent to localStorage
 * @param {Object} params - Agent parameters
 * @param {string} params.fileName - Original file name
 * @param {Object} params.agentInfo - Parsed agent information
 * @param {Map} params.files - Extracted files map
 * @returns {string} The saved agent ID
 */
export function saveAgent({ fileName, agentInfo, files }) {
    const agents = getStoredAgents();

    // Check if agent with same name already exists
    const existingIndex = agents.findIndex(a => a.fileName === fileName);

    const id = existingIndex >= 0 ? agents[existingIndex].id : generateId(fileName);

    // Convert files Map to object for storage
    const filesObject = {};
    if (files instanceof Map) {
        for (const [path, fileData] of files) {
            filesObject[path] = {
                content: fileData.content,
                isImage: fileData.isImage,
                modified: fileData.modified
            };
        }
    }

    const agentRecord = {
        id,
        fileName,
        agentName: agentInfo.agentName || agentInfo.name || 'Unknown Agent',
        agentType: agentInfo.type || 'UNKNOWN',
        description: agentInfo.agentDescription || agentInfo.description || '',
        uploadedAt: existingIndex >= 0 ? agents[existingIndex].uploadedAt : Date.now(),
        lastModifiedAt: Date.now(),
        agentInfo: sanitizeAgentInfo(agentInfo),
        files: filesObject,
        basicAnalysis: existingIndex >= 0 ? agents[existingIndex].basicAnalysis : null,
        deepAnalysis: existingIndex >= 0 ? agents[existingIndex].deepAnalysis : null
    };

    if (existingIndex >= 0) {
        agents[existingIndex] = agentRecord;
    } else {
        agents.unshift(agentRecord);
    }

    // Limit storage size
    const trimmedAgents = agents.slice(0, MAX_STORED_AGENTS);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedAgents));
        return id;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            // Try to save without files to save space
            agentRecord.files = null;
            const minimalAgents = trimmedAgents.map(a => ({ ...a, files: null }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalAgents));
            console.warn('Storage quota exceeded. Saved without file contents.');
        } else {
            console.error('Error saving agent:', error);
        }
        return id;
    }
}

/**
 * Updates analysis results for a stored agent
 * @param {string} id - Agent ID
 * @param {string} type - 'basic' or 'deep'
 * @param {Object} results - Analysis results
 */
export function updateAnalysisResults(id, type, results) {
    const agents = getStoredAgents();
    const agentIndex = agents.findIndex(a => a.id === id);

    if (agentIndex < 0) {
        console.error('Agent not found:', id);
        return;
    }

    if (type === 'basic') {
        agents[agentIndex].basicAnalysis = results;
    } else if (type === 'deep') {
        agents[agentIndex].deepAnalysis = results;
    }

    agents[agentIndex].lastAnalyzedAt = Date.now();

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    } catch (error) {
        console.error('Error updating analysis results:', error);
    }
}

/**
 * Updates file contents for a stored agent
 * @param {string} id - Agent ID
 * @param {Map} files - Updated files map
 */
export function updateStoredFiles(id, files) {
    const agents = getStoredAgents();
    const agentIndex = agents.findIndex(a => a.id === id);

    if (agentIndex < 0) return;

    const filesObject = {};
    if (files instanceof Map) {
        for (const [path, fileData] of files) {
            filesObject[path] = {
                content: fileData.content,
                isImage: fileData.isImage,
                modified: fileData.modified
            };
        }
    }

    agents[agentIndex].files = filesObject;
    agents[agentIndex].lastModifiedAt = Date.now();

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    } catch (error) {
        console.error('Error updating stored files:', error);
    }
}

/**
 * Deletes a stored agent
 * @param {string} id - Agent ID to delete
 * @returns {boolean} True if deleted successfully
 */
export function deleteStoredAgent(id) {
    try {
        const agents = getStoredAgents();
        const filtered = agents.filter(a => a.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error deleting agent:', error);
        return false;
    }
}

/**
 * Clears all stored agents
 */
export function clearAllStoredAgents() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing storage:', error);
    }
}

/**
 * Gets storage usage statistics
 * @returns {Object} Storage stats
 */
export function getStorageStats() {
    const agents = getStoredAgents();
    const dataSize = localStorage.getItem(STORAGE_KEY)?.length || 0;

    return {
        agentCount: agents.length,
        dataSize: dataSize,
        dataSizeFormatted: formatBytes(dataSize),
        maxAgents: MAX_STORED_AGENTS
    };
}

/**
 * Sanitizes agent info for storage (removes circular refs, large data)
 * @param {Object} agentInfo - Agent info object
 * @returns {Object} Sanitized agent info
 */
function sanitizeAgentInfo(agentInfo) {
    // Create a clean copy without potential circular references
    return {
        type: agentInfo.type,
        name: agentInfo.name,
        agentName: agentInfo.agentName,
        description: agentInfo.description,
        agentDescription: agentInfo.agentDescription,
        version: agentInfo.version,
        schemaVersion: agentInfo.schemaVersion,
        instructions: agentInfo.instructions,
        capabilities: agentInfo.capabilities,
        conversationStarters: agentInfo.conversationStarters,
        properties: agentInfo.properties
    };
}

/**
 * Formats bytes to human readable string
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Checks if there's stored data for quick restore
 * @returns {boolean} True if stored agents exist
 */
export function hasStoredAgents() {
    return getStoredAgents().length > 0;
}

/**
 * Exports all stored data as JSON
 * @returns {string} JSON string of all data
 */
export function exportStoredData() {
    const agents = getStoredAgents();
    return JSON.stringify(agents, null, 2);
}

/**
 * Imports stored data from JSON
 * @param {string} jsonData - JSON string to import
 * @returns {boolean} True if import successful
 */
export function importStoredData(jsonData) {
    try {
        const agents = JSON.parse(jsonData);
        if (!Array.isArray(agents)) {
            throw new Error('Invalid data format');
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
        return true;
    } catch (error) {
        console.error('Error importing data:', error);
        return false;
    }
}
