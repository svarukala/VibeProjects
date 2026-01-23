/**
 * Agent Flash - Storage Module
 * Handles all LocalStorage operations
 */

const Storage = {
    /**
     * Get a value from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Parsed value or default
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (error) {
            console.error(`Error reading from storage (${key}):`, error);
            return defaultValue;
        }
    },

    /**
     * Set a value in localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} Success status
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to storage (${key}):`, error);
            if (error.name === 'QuotaExceededError') {
                // Storage is full
                return false;
            }
            return false;
        }
    },

    /**
     * Remove a value from localStorage
     * @param {string} key - Storage key
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`Error removing from storage (${key}):`, error);
        }
    },

    /**
     * Get API Provider
     * @returns {string} 'claude' or 'openai'
     */
    getApiProvider() {
        return this.get(CONFIG.storageKeys.apiProvider, CONFIG.defaultProvider);
    },

    /**
     * Set API Provider
     * @param {string} provider
     */
    setApiProvider(provider) {
        this.set(CONFIG.storageKeys.apiProvider, provider);
    },

    /**
     * Get Claude API Key
     * @returns {string}
     */
    getClaudeApiKey() {
        // Check for legacy key first (backwards compatibility)
        const legacyKey = this.get('agentflash_api_key', '');
        if (legacyKey) {
            // Migrate to new key
            this.set(CONFIG.storageKeys.claudeApiKey, legacyKey);
            this.remove('agentflash_api_key');
            return legacyKey;
        }
        return this.get(CONFIG.storageKeys.claudeApiKey, '');
    },

    /**
     * Set Claude API Key
     * @param {string} key
     */
    setClaudeApiKey(key) {
        this.set(CONFIG.storageKeys.claudeApiKey, key);
    },

    /**
     * Get Claude API Endpoint
     * @returns {string}
     */
    getClaudeEndpoint() {
        // Check for legacy endpoint first (backwards compatibility)
        const legacyEndpoint = this.get('agentflash_api_endpoint', null);
        if (legacyEndpoint) {
            this.set(CONFIG.storageKeys.claudeEndpoint, legacyEndpoint);
            this.remove('agentflash_api_endpoint');
            return legacyEndpoint;
        }
        return this.get(CONFIG.storageKeys.claudeEndpoint, CONFIG.claude.defaultEndpoint);
    },

    /**
     * Set Claude API Endpoint
     * @param {string} endpoint
     */
    setClaudeEndpoint(endpoint) {
        this.set(CONFIG.storageKeys.claudeEndpoint, endpoint);
    },

    /**
     * Get Claude Model
     * @returns {string}
     */
    getClaudeModel() {
        // Check for legacy model first (backwards compatibility)
        const legacyModel = this.get('agentflash_api_model', null);
        if (legacyModel) {
            this.set(CONFIG.storageKeys.claudeModel, legacyModel);
            this.remove('agentflash_api_model');
            return legacyModel;
        }
        return this.get(CONFIG.storageKeys.claudeModel, CONFIG.claude.defaultModel);
    },

    /**
     * Set Claude Model
     * @param {string} model
     */
    setClaudeModel(model) {
        this.set(CONFIG.storageKeys.claudeModel, model);
    },

    /**
     * Get OpenAI API Key
     * @returns {string}
     */
    getOpenAIApiKey() {
        return this.get(CONFIG.storageKeys.openaiApiKey, '');
    },

    /**
     * Set OpenAI API Key
     * @param {string} key
     */
    setOpenAIApiKey(key) {
        this.set(CONFIG.storageKeys.openaiApiKey, key);
    },

    /**
     * Get OpenAI Model
     * @returns {string}
     */
    getOpenAIModel() {
        return this.get(CONFIG.storageKeys.openaiModel, CONFIG.openai.defaultModel);
    },

    /**
     * Set OpenAI Model
     * @param {string} model
     */
    setOpenAIModel(model) {
        this.set(CONFIG.storageKeys.openaiModel, model);
    },

    /**
     * Get all sessions
     * @returns {Array} Array of session objects
     */
    getSessions() {
        return this.get(CONFIG.storageKeys.sessions, []);
    },

    /**
     * Save a session
     * @param {Object} session - Session object
     */
    saveSession(session) {
        const sessions = this.getSessions();
        const existingIndex = sessions.findIndex(s => s.id === session.id);

        if (existingIndex >= 0) {
            sessions[existingIndex] = session;
        } else {
            sessions.unshift(session); // Add to beginning (newest first)
        }

        // Keep only last 50 sessions to prevent storage overflow
        const trimmedSessions = sessions.slice(0, 50);
        this.set(CONFIG.storageKeys.sessions, trimmedSessions);
    },

    /**
     * Get a session by ID
     * @param {string} id - Session ID
     * @returns {Object|null}
     */
    getSession(id) {
        const sessions = this.getSessions();
        return sessions.find(s => s.id === id) || null;
    },

    /**
     * Delete a session by ID
     * @param {string} id - Session ID
     */
    deleteSession(id) {
        const sessions = this.getSessions();
        const filtered = sessions.filter(s => s.id !== id);
        this.set(CONFIG.storageKeys.sessions, filtered);
    },

    /**
     * Clear all sessions
     */
    clearAllSessions() {
        this.set(CONFIG.storageKeys.sessions, []);
    },

    /**
     * Save current session (for recovery)
     * @param {Object} session
     */
    setCurrentSession(session) {
        this.set(CONFIG.storageKeys.currentSession, session);
    },

    /**
     * Get current session
     * @returns {Object|null}
     */
    getCurrentSession() {
        return this.get(CONFIG.storageKeys.currentSession, null);
    },

    /**
     * Clear current session
     */
    clearCurrentSession() {
        this.remove(CONFIG.storageKeys.currentSession);
    },

    /**
     * Check if API is configured for the current provider
     * @returns {boolean}
     */
    isApiConfigured() {
        const provider = this.getApiProvider();
        if (provider === 'openai') {
            const apiKey = this.getOpenAIApiKey();
            return apiKey && apiKey.trim().length > 0;
        } else {
            const apiKey = this.getClaudeApiKey();
            return apiKey && apiKey.trim().length > 0;
        }
    },

    /**
     * Get all API settings
     * @returns {Object}
     */
    getApiSettings() {
        const provider = this.getApiProvider();
        return {
            provider: provider,
            // Claude settings
            claudeApiKey: this.getClaudeApiKey(),
            claudeEndpoint: this.getClaudeEndpoint(),
            claudeModel: this.getClaudeModel(),
            // OpenAI settings
            openaiApiKey: this.getOpenAIApiKey(),
            openaiModel: this.getOpenAIModel()
        };
    },

    /**
     * Save all API settings
     * @param {Object} settings
     */
    saveApiSettings(settings) {
        if (settings.provider !== undefined) {
            this.setApiProvider(settings.provider);
        }
        // Claude settings
        if (settings.claudeApiKey !== undefined) {
            this.setClaudeApiKey(settings.claudeApiKey);
        }
        if (settings.claudeEndpoint !== undefined) {
            this.setClaudeEndpoint(settings.claudeEndpoint);
        }
        if (settings.claudeModel !== undefined) {
            this.setClaudeModel(settings.claudeModel);
        }
        // OpenAI settings
        if (settings.openaiApiKey !== undefined) {
            this.setOpenAIApiKey(settings.openaiApiKey);
        }
        if (settings.openaiModel !== undefined) {
            this.setOpenAIModel(settings.openaiModel);
        }
    }
};

// Make Storage available globally
window.Storage = Storage;
