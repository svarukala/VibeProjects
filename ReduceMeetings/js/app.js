/**
 * Main Application Module
 *
 * Orchestrates all modules and handles the main application flow
 */

import CONFIG from './config.js';
import authManager from './auth.js';
import graphClient from './graph.js';
import calendarAnalyzer from './calendar.js';
import storageManager from './storage.js';
import uiManager from './ui.js';
import openaiClient, { OpenAIError } from './openai.js';

class App {
    constructor() {
        this.isInitialized = false;
        this.useAI = true; // Default to using AI if available
        this.pendingUndoData = null;
        this.undoTimeout = null;
        this.undoTimeoutDuration = 10000; // 10 seconds to undo
        this.currentAnalysis = null;
        this.comparisonAnalysis = null;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('Initializing ReduceMeetings app...');

        try {
            // Validate configuration
            this.validateConfig();

            // Initialize MSAL
            await authManager.initialize();

            // Initialize OpenAI (load saved key if any)
            openaiClient.initialize();

            // Initialize UI
            uiManager.initialize();
            this.setupUICallbacks();

            // Check if user is already signed in
            if (authManager.isSignedIn()) {
                await this.handleSignedIn();
            } else {
                uiManager.showSignedOutState();
            }

            // Setup event listeners
            this.setupEventListeners();

            // Populate analysis history
            uiManager.populateAnalysisHistory();
            this.populateCompareDropdown();

            this.isInitialized = true;
            console.log('App initialized successfully');
        } catch (error) {
            console.error('App initialization error:', error);
            uiManager.showError(`Initialization failed: ${error.message}`);
        }
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        if (!CONFIG.auth.clientId || CONFIG.auth.clientId === 'YOUR_CLIENT_ID_HERE') {
            throw new Error('Please configure your Entra ID Client ID in js/config.js');
        }
    }

    /**
     * Setup UI callbacks
     */
    setupUICallbacks() {
        uiManager.onAnalyze = (months) => this.startAnalysis(months);
        uiManager.onLoadAnalysis = (key) => this.loadSavedAnalysis(key);
        uiManager.onBulkAction = (action, meetingIds) => this.handleBulkAction(action, meetingIds);
        uiManager.onSingleAction = (action, meetingId) => this.handleSingleAction(action, meetingId);
        uiManager.onExport = () => this.exportToCSV();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Sign in button
        const signInBtn = document.getElementById('sign-in-btn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => this.signIn());
        }

        // Sign out button
        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.signOut());
        }

        // Test connection button
        const testConnectionBtn = document.getElementById('test-connection-btn');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', () => this.testConnection());
        }

        // OpenAI settings button
        const openaiSettingsBtn = document.getElementById('openai-settings-btn');
        if (openaiSettingsBtn) {
            openaiSettingsBtn.addEventListener('click', () => this.showOpenAIModal());
        }

        // OpenAI modal events
        this.setupOpenAIModalEvents();

        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToCSV());
        }

        // Compare dropdown
        const compareSelect = document.getElementById('compare-select');
        if (compareSelect) {
            compareSelect.addEventListener('change', (e) => {
                this.loadComparisonAnalysis(e.target.value);
            });
        }

        // Undo button
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undoDelete());
        }
    }

    /**
     * Setup OpenAI modal event listeners
     */
    setupOpenAIModalEvents() {
        const modal = document.getElementById('openai-modal');
        const closeBtn = document.getElementById('openai-modal-close');
        const backdrop = modal?.querySelector('.modal-backdrop');
        const testBtn = document.getElementById('test-openai-btn');
        const saveBtn = document.getElementById('save-openai-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideOpenAIModal());
        }

        if (backdrop) {
            backdrop.addEventListener('click', () => this.hideOpenAIModal());
        }

        if (testBtn) {
            testBtn.addEventListener('click', () => this.testOpenAIConnection());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveOpenAIKey());
        }

        // Setup confirmation modal events
        this.setupConfirmModalEvents();
    }

    /**
     * Setup confirmation modal events
     */
    setupConfirmModalEvents() {
        const modal = document.getElementById('confirm-modal');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const backdrop = modal?.querySelector('.modal-backdrop');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideConfirmModal());
        }

        if (backdrop) {
            backdrop.addEventListener('click', () => this.hideConfirmModal());
        }
    }

    /**
     * Show OpenAI API key modal
     */
    showOpenAIModal() {
        const modal = document.getElementById('openai-modal');
        const input = document.getElementById('openai-key-input');
        const status = document.getElementById('openai-key-status');

        if (modal) {
            modal.classList.remove('hidden');
        }

        // Pre-fill if key exists
        if (input && openaiClient.hasApiKey()) {
            input.value = '••••••••••••••••'; // Show placeholder for existing key
            input.dataset.hasKey = 'true';
        }

        if (status) {
            status.classList.add('hidden');
        }
    }

    /**
     * Hide OpenAI modal
     */
    hideOpenAIModal() {
        const modal = document.getElementById('openai-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Test OpenAI connection
     */
    async testOpenAIConnection() {
        const input = document.getElementById('openai-key-input');
        const status = document.getElementById('openai-key-status');
        const testBtn = document.getElementById('test-openai-btn');

        if (!input || !status) return;

        const apiKey = input.dataset.hasKey === 'true' && input.value.startsWith('••')
            ? null // Use existing key
            : input.value.trim();

        if (apiKey) {
            openaiClient.setApiKey(apiKey, false); // Don't save yet
        }

        if (!openaiClient.hasApiKey()) {
            status.classList.remove('hidden', 'success');
            status.classList.add('error');
            status.textContent = 'Please enter an API key';
            return;
        }

        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';

        try {
            const result = await openaiClient.testConnection();

            status.classList.remove('hidden');

            if (result.success) {
                status.classList.remove('error');
                status.classList.add('success');
                status.textContent = 'Connection successful! API key is valid.';
            } else {
                status.classList.remove('success');
                status.classList.add('error');
                status.textContent = `Connection failed: ${result.error}`;
            }
        } catch (error) {
            status.classList.remove('hidden', 'success');
            status.classList.add('error');
            status.textContent = `Error: ${error.message}`;
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test Connection';
        }
    }

    /**
     * Save OpenAI API key
     */
    saveOpenAIKey() {
        const input = document.getElementById('openai-key-input');
        const saveCheckbox = document.getElementById('save-key-checkbox');

        if (!input) return;

        const apiKey = input.dataset.hasKey === 'true' && input.value.startsWith('••')
            ? null // Keep existing key
            : input.value.trim();

        if (apiKey) {
            const shouldSave = saveCheckbox?.checked ?? true;
            openaiClient.setApiKey(apiKey, shouldSave);
        }

        this.useAI = openaiClient.hasApiKey();
        this.hideOpenAIModal();

        if (this.useAI) {
            uiManager.showSuccess('OpenAI API key saved. AI recommendations enabled.');
        }
    }

    /**
     * Handle sign in
     */
    async signIn() {
        try {
            uiManager.showLoading('Signing in...');
            await authManager.signIn();
            await this.handleSignedIn();
        } catch (error) {
            console.error('Sign in error:', error);
            uiManager.showError(`Sign in failed: ${error.message}`);
        } finally {
            uiManager.hideLoading();
        }
    }

    /**
     * Handle signed in state
     */
    async handleSignedIn() {
        const account = authManager.getAccount();

        // Get user photo
        let photoUrl = null;
        try {
            photoUrl = await graphClient.getPhoto();
        } catch (error) {
            console.warn('Could not load user photo:', error);
        }

        uiManager.showSignedInState(account, photoUrl);
        uiManager.populateAnalysisHistory();
        this.populateCompareDropdown();

        // Check if OpenAI key is configured
        if (!openaiClient.hasApiKey()) {
            // Show modal to configure OpenAI
            setTimeout(() => this.showOpenAIModal(), 500);
        }
    }

    /**
     * Handle sign out
     */
    async signOut() {
        try {
            uiManager.showLoading('Signing out...');
            await authManager.signOut();
            uiManager.showSignedOutState();
        } catch (error) {
            console.error('Sign out error:', error);
            uiManager.showError(`Sign out failed: ${error.message}`);
        } finally {
            uiManager.hideLoading();
        }
    }

    /**
     * Test Graph API connection
     */
    async testConnection() {
        try {
            uiManager.showLoading('Testing connection...');
            const result = await graphClient.testConnection();
            uiManager.showConnectionTestResult(result);

            if (result.success) {
                console.log('Connection test successful:', result.user);
            }
        } catch (error) {
            console.error('Connection test error:', error);
            uiManager.showConnectionTestResult({
                success: false,
                error: error.message
            });
        } finally {
            uiManager.hideLoading();
        }
    }

    /**
     * Start calendar analysis
     */
    async startAnalysis(months) {
        if (!authManager.isSignedIn()) {
            uiManager.showError('Please sign in first');
            return;
        }

        try {
            uiManager.showLoading('Analyzing calendar...');

            // Analyze recurring meetings
            const result = await calendarAnalyzer.analyzeRecurringMeetings(
                months,
                (progress) => uiManager.updateProgress(progress)
            );

            // Generate recommendations
            let meetingsWithRecommendations;

            if (this.useAI && openaiClient.hasApiKey()) {
                uiManager.updateProgress({
                    message: 'Generating AI recommendations...',
                    current: 0,
                    total: result.meetings.length
                });

                try {
                    const recommendations = await openaiClient.analyzeMeetingsBatch(
                        result.meetings,
                        (progress) => uiManager.updateProgress(progress)
                    );

                    meetingsWithRecommendations = result.meetings.map((meeting, index) => ({
                        ...meeting,
                        recommendation: recommendations[index] || this.generateBasicRecommendation(meeting)
                    }));
                } catch (aiError) {
                    console.error('AI recommendation error:', aiError);
                    uiManager.showError(`AI recommendations failed: ${aiError.message}. Using basic recommendations.`);

                    // Fallback to basic recommendations
                    meetingsWithRecommendations = result.meetings.map(meeting => ({
                        ...meeting,
                        recommendation: this.generateBasicRecommendation(meeting)
                    }));
                }
            } else {
                // Use basic heuristic recommendations
                meetingsWithRecommendations = result.meetings.map(meeting => ({
                    ...meeting,
                    recommendation: this.generateBasicRecommendation(meeting)
                }));
            }

            result.meetings = meetingsWithRecommendations;
            this.currentAnalysis = result;

            // Save to storage
            const storageKey = storageManager.saveAnalysis(result);
            console.log('Analysis saved with key:', storageKey);

            // Update UI
            uiManager.renderMeetings(result.meetings, this.comparisonAnalysis);
            uiManager.populateAnalysisHistory();
            this.populateCompareDropdown();
            this.enableExportButton();

            const aiStatus = this.useAI && openaiClient.hasApiKey() ? ' with AI' : '';
            uiManager.showSuccess(`Analysis complete${aiStatus}! Found ${result.meetings.length} recurring meetings.`);

        } catch (error) {
            console.error('Analysis error:', error);
            uiManager.showError(`Analysis failed: ${error.message}`);
        } finally {
            uiManager.hideLoading();
        }
    }

    /**
     * Generate basic recommendation based on engagement metrics
     * (Fallback when OpenAI is not available)
     */
    generateBasicRecommendation(meeting) {
        const { engagement } = meeting;
        const attendanceRate = engagement.attendanceRate;

        let action = 'keep';
        let confidence = 0.5;
        let reasoning = '';
        const factors = [];

        // Simple heuristic based on attendance
        if (attendanceRate < 0.25) {
            action = 'remove';
            confidence = 0.8;
            reasoning = 'Very low attendance rate suggests this meeting may not be valuable to you.';
            factors.push(`Attendance rate: ${Math.round(attendanceRate * 100)}%`);
            factors.push(`Attended only ${engagement.timesAttended} out of ${meeting.totalInstances} instances`);
        } else if (attendanceRate < 0.5) {
            action = 'follow';
            confidence = 0.6;
            reasoning = 'Moderate attendance rate. Consider discussing with organizer about necessity.';
            factors.push(`Attendance rate: ${Math.round(attendanceRate * 100)}%`);
            factors.push('You miss more than half of the meetings');
        } else if (attendanceRate >= 0.75) {
            action = 'keep';
            confidence = 0.8;
            reasoning = 'High attendance rate indicates this meeting is important to you.';
            factors.push(`Attendance rate: ${Math.round(attendanceRate * 100)}%`);
            if (engagement.chatMessagesCount > 0) {
                factors.push('Active in meeting chat');
            }
        } else {
            action = 'keep';
            confidence = 0.5;
            reasoning = 'Moderate engagement with this meeting.';
            factors.push(`Attendance rate: ${Math.round(attendanceRate * 100)}%`);
        }

        // Adjust based on chat activity
        if (engagement.chatMessagesCount > 5) {
            if (action === 'remove') {
                action = 'follow';
                reasoning += ' However, you are active in chat which may indicate some value.';
            }
            factors.push(`${engagement.chatMessagesCount} chat messages`);
        }

        return {
            action,
            confidence,
            reasoning,
            factors
        };
    }

    /**
     * Load a saved analysis
     */
    async loadSavedAnalysis(key) {
        try {
            uiManager.showLoading('Loading analysis...');

            const analysis = storageManager.loadAnalysis(key);

            if (!analysis) {
                uiManager.showError('Could not load analysis');
                return;
            }

            this.currentAnalysis = analysis;
            uiManager.renderMeetings(analysis.meetings, this.comparisonAnalysis);
            this.enableExportButton();
            uiManager.showSuccess(`Loaded analysis from ${analysis.timestamp.toLocaleDateString()}`);

        } catch (error) {
            console.error('Load analysis error:', error);
            uiManager.showError(`Failed to load analysis: ${error.message}`);
        } finally {
            uiManager.hideLoading();
        }
    }

    /**
     * Populate comparison dropdown
     */
    populateCompareDropdown() {
        const select = document.getElementById('compare-select');
        if (!select) return;

        const analyses = storageManager.getAllAnalyses();

        select.innerHTML = '<option value="">-- No Comparison --</option>';

        for (const analysis of analyses) {
            const option = document.createElement('option');
            option.value = analysis.key;
            option.textContent = `${analysis.date} (${analysis.totalMeetings} meetings)`;
            select.appendChild(option);
        }

        select.disabled = analyses.length === 0;
    }

    /**
     * Load comparison analysis
     */
    loadComparisonAnalysis(key) {
        if (!key) {
            this.comparisonAnalysis = null;
            if (this.currentAnalysis) {
                uiManager.renderMeetings(this.currentAnalysis.meetings, null);
            }
            return;
        }

        this.comparisonAnalysis = storageManager.loadAnalysis(key);

        if (this.currentAnalysis) {
            uiManager.renderMeetings(this.currentAnalysis.meetings, this.comparisonAnalysis);
        }
    }

    /**
     * Enable export button
     */
    enableExportButton() {
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.disabled = false;
        }
    }

    /**
     * Export current analysis to CSV
     */
    exportToCSV() {
        if (!this.currentAnalysis || !this.currentAnalysis.meetings.length) {
            uiManager.showError('No analysis data to export');
            return;
        }

        const meetings = this.currentAnalysis.meetings;
        const headers = [
            'Subject',
            'Organizer',
            'Organizer Email',
            'Recurrence Pattern',
            'Total Instances',
            'Times Attended',
            'Times Skipped',
            'Attendance Rate',
            'Chat Messages',
            'Mentions',
            'Recommendation',
            'Confidence',
            'Reasoning'
        ];

        const rows = meetings.map(m => [
            this.escapeCSV(m.subject),
            this.escapeCSV(m.organizer.name),
            this.escapeCSV(m.organizer.email),
            m.recurrencePattern,
            m.totalInstances,
            m.engagement.timesAttended,
            m.engagement.timesSkipped,
            `${Math.round(m.engagement.attendanceRate * 100)}%`,
            m.engagement.chatMessagesCount,
            m.engagement.mentionsCount,
            m.recommendation?.action?.toUpperCase() || 'PENDING',
            m.recommendation?.confidence ? `${Math.round(m.recommendation.confidence * 100)}%` : '',
            this.escapeCSV(m.recommendation?.reasoning || '')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `meeting-analysis-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        uiManager.showSuccess('Analysis exported to CSV');
    }

    /**
     * Escape value for CSV
     */
    escapeCSV(value) {
        if (!value) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * Handle bulk actions
     */
    async handleBulkAction(action, meetingIds) {
        if (action !== 'remove') return;

        // Show confirmation modal
        this.showConfirmModal(
            'Remove Meetings',
            `Are you sure you want to remove ${meetingIds.length} meeting${meetingIds.length > 1 ? 's' : ''} from your calendar?`,
            async () => {
                await this.performBulkRemove(meetingIds);
            }
        );
    }

    /**
     * Show confirmation modal
     */
    showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const messageEl = document.getElementById('confirm-modal-message');
        const okBtn = document.getElementById('confirm-ok-btn');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;

        // Remove old listener and add new one
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);

        newOkBtn.addEventListener('click', async () => {
            this.hideConfirmModal();
            await onConfirm();
        });

        if (modal) modal.classList.remove('hidden');
    }

    /**
     * Hide confirmation modal
     */
    hideConfirmModal() {
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.add('hidden');
    }

    /**
     * Perform bulk remove with undo capability
     */
    async performBulkRemove(meetingIds) {
        try {
            uiManager.showLoading(`Removing ${meetingIds.length} meetings...`);

            // Store data for undo
            const meetingsToRemove = this.currentAnalysis.meetings.filter(
                m => meetingIds.includes(m.id)
            );

            this.pendingUndoData = {
                meetings: meetingsToRemove,
                meetingIds: meetingIds
            };

            let successCount = 0;
            let failCount = 0;

            for (const meetingId of meetingIds) {
                try {
                    await graphClient.deleteRecurringSeries(meetingId);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to remove meeting ${meetingId}:`, error);
                    failCount++;
                }
            }

            if (failCount === 0) {
                // Show undo toast
                this.showUndoToast(`Removed ${successCount} meetings`);
            } else {
                uiManager.showError(`Removed ${successCount} meetings, ${failCount} failed`);
                this.pendingUndoData = null;
            }

            // Refresh the analysis
            const months = parseInt(document.getElementById('months-select')?.value || '2');
            await this.startAnalysis(months);

        } catch (error) {
            console.error('Bulk action error:', error);
            uiManager.showError(`Bulk action failed: ${error.message}`);
            this.pendingUndoData = null;
        } finally {
            uiManager.hideLoading();
        }
    }

    /**
     * Handle single meeting action
     */
    async handleSingleAction(action, meetingId) {
        if (action === 'remove') {
            this.showConfirmModal(
                'Remove Meeting',
                'Are you sure you want to remove this recurring meeting from your calendar?',
                async () => {
                    await this.performSingleRemove(meetingId);
                }
            );
        }
    }

    /**
     * Perform single meeting removal
     */
    async performSingleRemove(meetingId) {
        try {
            uiManager.showLoading('Removing meeting...');

            // Store for undo
            const meetingToRemove = this.currentAnalysis.meetings.find(m => m.id === meetingId);
            if (meetingToRemove) {
                this.pendingUndoData = {
                    meetings: [meetingToRemove],
                    meetingIds: [meetingId]
                };
            }

            await graphClient.deleteRecurringSeries(meetingId);

            this.showUndoToast('Meeting removed');

            // Refresh
            const months = parseInt(document.getElementById('months-select')?.value || '2');
            await this.startAnalysis(months);

        } catch (error) {
            console.error('Remove meeting error:', error);
            uiManager.showError(`Failed to remove meeting: ${error.message}`);
            this.pendingUndoData = null;
        } finally {
            uiManager.hideLoading();
        }
    }

    /**
     * Show undo toast
     */
    showUndoToast(message) {
        const toast = document.getElementById('undo-toast');
        const messageEl = document.getElementById('undo-message');
        const progressBar = document.getElementById('undo-progress-bar');

        if (!toast) return;

        if (messageEl) messageEl.textContent = message;

        toast.classList.remove('hidden');

        // Animate progress bar
        if (progressBar) {
            progressBar.style.transition = 'none';
            progressBar.style.width = '100%';

            // Force reflow
            progressBar.offsetHeight;

            progressBar.style.transition = `width ${this.undoTimeoutDuration}ms linear`;
            progressBar.style.width = '0%';
        }

        // Clear existing timeout
        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
        }

        // Set new timeout
        this.undoTimeout = setTimeout(() => {
            this.hideUndoToast();
            this.pendingUndoData = null;
        }, this.undoTimeoutDuration);
    }

    /**
     * Hide undo toast
     */
    hideUndoToast() {
        const toast = document.getElementById('undo-toast');
        if (toast) {
            toast.classList.add('hidden');
        }

        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
            this.undoTimeout = null;
        }
    }

    /**
     * Undo delete action
     * Note: This is limited because Graph API doesn't support restoring deleted events
     * We can only inform the user about what was deleted
     */
    undoDelete() {
        this.hideUndoToast();

        if (!this.pendingUndoData) {
            uiManager.showError('Nothing to undo');
            return;
        }

        const meetings = this.pendingUndoData.meetings;

        // Since we can't actually restore deleted events via Graph API,
        // we show the user what was deleted so they can recreate manually
        const meetingNames = meetings.map(m => m.subject).join(', ');

        uiManager.showError(
            `Cannot restore deleted meetings via API. Deleted: ${meetingNames}. ` +
            `Please recreate these meetings manually if needed.`
        );

        this.pendingUndoData = null;
    }
}

// Create and export app instance
const app = new App();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
});

export default app;
