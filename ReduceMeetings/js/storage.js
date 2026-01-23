/**
 * Storage Module
 *
 * Handles browser localStorage operations for persisting analysis results
 */

import CONFIG from './config.js';

class StorageManager {
    constructor() {
        this.prefix = CONFIG.settings.storageKeyPrefix;
        this.maxAnalyses = CONFIG.settings.maxStoredAnalyses;
    }

    /**
     * Generate storage key for an analysis
     */
    generateKey(date = new Date()) {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        return `${this.prefix}analysis_${dateStr}`;
    }

    /**
     * Save analysis results
     */
    saveAnalysis(analysisData) {
        const key = this.generateKey();

        const storageObject = {
            timestamp: new Date().toISOString(),
            dateRange: {
                start: analysisData.dateRange.startDate.toISOString(),
                end: analysisData.dateRange.endDate.toISOString()
            },
            monthsAnalyzed: analysisData.monthsAnalyzed,
            totalMeetings: analysisData.meetings.length,
            meetings: analysisData.meetings
        };

        try {
            localStorage.setItem(key, JSON.stringify(storageObject));
            this.enforceStorageLimit();
            return key;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                // Try to make room by removing oldest analyses
                this.removeOldestAnalyses(3);
                localStorage.setItem(key, JSON.stringify(storageObject));
                return key;
            }
            throw error;
        }
    }

    /**
     * Load analysis by date key
     */
    loadAnalysis(key) {
        const data = localStorage.getItem(key);
        if (!data) return null;

        try {
            const parsed = JSON.parse(data);
            // Convert date strings back to Date objects
            parsed.dateRange.start = new Date(parsed.dateRange.start);
            parsed.dateRange.end = new Date(parsed.dateRange.end);
            parsed.timestamp = new Date(parsed.timestamp);
            return parsed;
        } catch (error) {
            console.error('Error parsing stored analysis:', error);
            return null;
        }
    }

    /**
     * Get all saved analyses
     */
    getAllAnalyses() {
        const analyses = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${this.prefix}analysis_`)) {
                const data = this.loadAnalysis(key);
                if (data) {
                    analyses.push({
                        key,
                        date: key.replace(`${this.prefix}analysis_`, ''),
                        timestamp: data.timestamp,
                        totalMeetings: data.totalMeetings,
                        monthsAnalyzed: data.monthsAnalyzed
                    });
                }
            }
        }

        // Sort by date descending (newest first)
        analyses.sort((a, b) => new Date(b.date) - new Date(a.date));

        return analyses;
    }

    /**
     * Delete a specific analysis
     */
    deleteAnalysis(key) {
        localStorage.removeItem(key);
    }

    /**
     * Enforce storage limit by removing oldest analyses
     */
    enforceStorageLimit() {
        const analyses = this.getAllAnalyses();

        if (analyses.length > this.maxAnalyses) {
            // Remove oldest ones beyond the limit
            const toRemove = analyses.slice(this.maxAnalyses);
            for (const analysis of toRemove) {
                this.deleteAnalysis(analysis.key);
            }
        }
    }

    /**
     * Remove oldest analyses
     */
    removeOldestAnalyses(count) {
        const analyses = this.getAllAnalyses();
        const toRemove = analyses.slice(-count);

        for (const analysis of toRemove) {
            this.deleteAnalysis(analysis.key);
        }
    }

    /**
     * Clear all analyses
     */
    clearAllAnalyses() {
        const analyses = this.getAllAnalyses();
        for (const analysis of analyses) {
            this.deleteAnalysis(analysis.key);
        }
    }

    /**
     * Save OpenAI API key (encrypted in a simple way)
     */
    saveOpenAIKey(apiKey) {
        // Simple obfuscation - in production, consider more secure storage
        const obfuscated = btoa(apiKey);
        localStorage.setItem(`${this.prefix}openai_key`, obfuscated);
    }

    /**
     * Load OpenAI API key
     */
    loadOpenAIKey() {
        const obfuscated = localStorage.getItem(`${this.prefix}openai_key`);
        if (!obfuscated) return null;

        try {
            return atob(obfuscated);
        } catch {
            return null;
        }
    }

    /**
     * Clear OpenAI API key
     */
    clearOpenAIKey() {
        localStorage.removeItem(`${this.prefix}openai_key`);
    }

    /**
     * Save user settings
     */
    saveSettings(settings) {
        localStorage.setItem(`${this.prefix}settings`, JSON.stringify(settings));
    }

    /**
     * Load user settings
     */
    loadSettings() {
        const data = localStorage.getItem(`${this.prefix}settings`);
        if (!data) return null;

        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    /**
     * Get storage usage info
     */
    getStorageInfo() {
        let totalSize = 0;
        let analysisCount = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                const value = localStorage.getItem(key);
                totalSize += (key.length + (value?.length || 0)) * 2; // UTF-16

                if (key.includes('analysis_')) {
                    analysisCount++;
                }
            }
        }

        return {
            usedBytes: totalSize,
            usedKB: (totalSize / 1024).toFixed(2),
            analysisCount,
            maxAnalyses: this.maxAnalyses
        };
    }
}

// Export singleton instance
const storageManager = new StorageManager();
export default storageManager;
