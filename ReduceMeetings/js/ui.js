/**
 * UI Module
 *
 * Handles all UI rendering and user interactions
 */

import CONFIG from './config.js';
import storageManager from './storage.js';

class UIManager {
    constructor() {
        this.selectedMeetings = new Set();
        this.currentFilter = 'all';
        this.meetings = [];
        this.comparisonData = null;
        this.onMeetingSelect = null;
        this.onBulkAction = null;
        this.onSingleAction = null;
        this.onAnalyze = null;
        this.onLoadAnalysis = null;
        this.onExport = null;
    }

    /**
     * Initialize UI event listeners
     */
    initialize() {
        // Tab click handlers
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleTabClick(e.target.dataset.filter);
            });
        });

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
        }

        // Bulk action buttons
        const bulkRemoveBtn = document.getElementById('bulk-remove-btn');
        if (bulkRemoveBtn) {
            bulkRemoveBtn.addEventListener('click', () => {
                this.handleBulkRemove();
            });
        }

        // Analysis controls
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                if (this.onAnalyze) {
                    const months = parseInt(document.getElementById('months-select').value);
                    this.onAnalyze(months);
                }
            });
        }

        // Previous analyses dropdown
        const analysisSelect = document.getElementById('analysis-select');
        if (analysisSelect) {
            analysisSelect.addEventListener('change', (e) => {
                if (this.onLoadAnalysis && e.target.value) {
                    this.onLoadAnalysis(e.target.value);
                }
            });
        }
    }

    /**
     * Update UI for signed-in state
     */
    showSignedInState(user, photoUrl = null) {
        const authSection = document.getElementById('auth-section');
        const appSection = document.getElementById('app-section');
        const userName = document.getElementById('user-name');
        const userPhoto = document.getElementById('user-photo');
        const signOutBtn = document.getElementById('sign-out-btn');

        if (authSection) authSection.classList.add('hidden');
        if (appSection) appSection.classList.remove('hidden');

        if (userName) userName.textContent = user.name || user.username;

        if (userPhoto && photoUrl) {
            userPhoto.src = photoUrl;
            userPhoto.classList.remove('hidden');
        }

        if (signOutBtn) signOutBtn.classList.remove('hidden');
    }

    /**
     * Update UI for signed-out state
     */
    showSignedOutState() {
        const authSection = document.getElementById('auth-section');
        const appSection = document.getElementById('app-section');
        const signOutBtn = document.getElementById('sign-out-btn');
        const userPhoto = document.getElementById('user-photo');

        if (authSection) authSection.classList.remove('hidden');
        if (appSection) appSection.classList.add('hidden');
        if (signOutBtn) signOutBtn.classList.add('hidden');
        if (userPhoto) userPhoto.classList.add('hidden');

        // Clear meetings display
        this.clearMeetings();
    }

    /**
     * Show loading state
     */
    showLoading(message = 'Loading...') {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingMessage = document.getElementById('loading-message');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        if (loadingMessage) loadingMessage.textContent = message;
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '';
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    /**
     * Update progress during analysis
     */
    updateProgress(progress) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        if (progressText) progressText.textContent = progress.message;

        if (progressBar && progress.total) {
            const percent = (progress.current / progress.total) * 100;
            progressBar.style.width = `${percent}%`;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorContainer = document.getElementById('error-container');
        const errorMessage = document.getElementById('error-message');

        if (errorMessage) errorMessage.textContent = message;
        if (errorContainer) errorContainer.classList.remove('hidden');

        // Auto-hide after 8 seconds for longer messages
        const timeout = message.length > 100 ? 8000 : 5000;
        setTimeout(() => this.hideError(), timeout);
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) errorContainer.classList.add('hidden');
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const successContainer = document.getElementById('success-container');
        const successMessage = document.getElementById('success-message');

        if (successMessage) successMessage.textContent = message;
        if (successContainer) successContainer.classList.remove('hidden');

        // Auto-hide after 3 seconds
        setTimeout(() => this.hideSuccess(), 3000);
    }

    /**
     * Hide success message
     */
    hideSuccess() {
        const successContainer = document.getElementById('success-container');
        if (successContainer) successContainer.classList.add('hidden');
    }

    /**
     * Populate the analysis history dropdown
     */
    populateAnalysisHistory() {
        const select = document.getElementById('analysis-select');
        if (!select) return;

        const analyses = storageManager.getAllAnalyses();

        // Clear existing options except the first one
        select.innerHTML = '<option value="">-- Select Previous Analysis --</option>';

        for (const analysis of analyses) {
            const option = document.createElement('option');
            option.value = analysis.key;
            option.textContent = `${analysis.date} (${analysis.totalMeetings} meetings, ${analysis.monthsAnalyzed} months)`;
            select.appendChild(option);
        }
    }

    /**
     * Render meetings list with optional comparison
     */
    renderMeetings(meetings, comparisonAnalysis = null) {
        this.meetings = meetings;
        this.comparisonData = comparisonAnalysis;
        this.selectedMeetings.clear();

        const container = document.getElementById('meetings-container');
        if (!container) return;

        container.innerHTML = '';

        // Add comparison legend if comparing
        if (comparisonAnalysis) {
            container.appendChild(this.createComparisonLegend());
        }

        const filteredMeetings = this.getFilteredMeetings();

        if (filteredMeetings.length === 0) {
            container.innerHTML += `
                <div class="empty-state">
                    <p>No meetings found${this.currentFilter !== 'all' ? ` with "${this.currentFilter}" recommendation` : ''}.</p>
                </div>
            `;
            return;
        }

        for (const meeting of filteredMeetings) {
            const card = this.createMeetingCard(meeting);
            container.appendChild(card);
        }

        this.updateTabCounts();
        this.updateBulkActionState();
    }

    /**
     * Create comparison legend
     */
    createComparisonLegend() {
        const legend = document.createElement('div');
        legend.className = 'comparison-legend';
        legend.innerHTML = `
            <span class="comparison-legend-item">
                <span class="comparison-badge new">NEW</span> New meeting
            </span>
            <span class="comparison-legend-item">
                <span class="comparison-badge improved">IMPROVED</span> Better engagement
            </span>
            <span class="comparison-legend-item">
                <span class="comparison-badge declined">DECLINED</span> Worse engagement
            </span>
            <span class="comparison-legend-item">
                <span class="comparison-badge changed">CHANGED</span> Recommendation changed
            </span>
        `;
        return legend;
    }

    /**
     * Get comparison status for a meeting
     */
    getComparisonStatus(meeting) {
        if (!this.comparisonData) return null;

        const previousMeeting = this.comparisonData.meetings.find(
            m => m.seriesMasterId === meeting.seriesMasterId || m.subject === meeting.subject
        );

        if (!previousMeeting) {
            return { type: 'new', label: 'NEW' };
        }

        const currentRate = meeting.engagement.attendanceRate;
        const previousRate = previousMeeting.engagement.attendanceRate;
        const rateChange = currentRate - previousRate;

        if (Math.abs(rateChange) > 0.1) {
            if (rateChange > 0) {
                return { type: 'improved', label: 'IMPROVED', detail: `+${Math.round(rateChange * 100)}%` };
            } else {
                return { type: 'declined', label: 'DECLINED', detail: `${Math.round(rateChange * 100)}%` };
            }
        }

        const currentAction = meeting.recommendation?.action?.toLowerCase();
        const previousAction = previousMeeting.recommendation?.action?.toLowerCase();

        if (currentAction !== previousAction) {
            return { type: 'changed', label: 'CHANGED', detail: `${previousAction} → ${currentAction}` };
        }

        return null;
    }

    /**
     * Create a meeting card element
     */
    createMeetingCard(meeting) {
        const card = document.createElement('div');
        card.className = 'meeting-card';
        card.dataset.id = meeting.id;

        const recommendation = meeting.recommendation?.action?.toLowerCase() || 'pending';
        const confidence = meeting.recommendation?.confidence
            ? `${Math.round(meeting.recommendation.confidence * 100)}%`
            : '';

        const attendanceRate = Math.round(meeting.engagement.attendanceRate * 100);

        // Get comparison status
        const comparisonStatus = this.getComparisonStatus(meeting);
        const comparisonBadge = comparisonStatus
            ? `<span class="comparison-badge ${comparisonStatus.type}" title="${comparisonStatus.detail || ''}">${comparisonStatus.label}</span>`
            : '';

        card.innerHTML = `
            <div class="meeting-card-header">
                <label class="checkbox-container">
                    <input type="checkbox" class="meeting-checkbox" data-id="${meeting.id}">
                    <span class="checkmark"></span>
                </label>
                <div class="meeting-info">
                    <h3 class="meeting-subject">${this.escapeHtml(meeting.subject)}${comparisonBadge}</h3>
                    <p class="meeting-organizer">Organizer: ${this.escapeHtml(meeting.organizer.name)}</p>
                </div>
                <span class="recommendation-badge ${recommendation}" title="${confidence ? `Confidence: ${confidence}` : ''}">
                    ${recommendation.toUpperCase()}
                </span>
            </div>
            <div class="meeting-stats">
                <span class="stat">
                    <span class="stat-label">Attendance:</span>
                    <span class="stat-value ${attendanceRate < 50 ? 'low' : attendanceRate > 75 ? 'high' : ''}">${attendanceRate}%</span>
                    <span class="stat-detail">(${meeting.engagement.timesAttended}/${meeting.totalInstances})</span>
                </span>
                <span class="stat">
                    <span class="stat-label">Pattern:</span>
                    <span class="stat-value">${meeting.recurrencePattern}</span>
                </span>
                <span class="stat">
                    <span class="stat-label">Chat:</span>
                    <span class="stat-value">${meeting.engagement.chatMessagesCount > 0 ? 'Active' : 'None'}</span>
                </span>
            </div>
            ${meeting.recommendation?.reasoning ? `
            <div class="meeting-reasoning collapsed">
                <button class="reasoning-toggle" data-id="${meeting.id}">
                    Show Reasoning
                </button>
                <div class="reasoning-content hidden">
                    <p>${this.escapeHtml(meeting.recommendation.reasoning)}</p>
                    ${meeting.recommendation.factors?.length ? `
                    <ul class="reasoning-factors">
                        ${meeting.recommendation.factors.map(f => `<li>${this.escapeHtml(f)}</li>`).join('')}
                    </ul>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            <div class="meeting-actions">
                <button class="btn btn-outline btn-remove-single" data-id="${meeting.id}">
                    Remove This Meeting
                </button>
            </div>
        `;

        // Add event listeners
        const checkbox = card.querySelector('.meeting-checkbox');
        checkbox.addEventListener('change', (e) => {
            this.handleMeetingSelect(meeting.id, e.target.checked);
        });

        const reasoningToggle = card.querySelector('.reasoning-toggle');
        if (reasoningToggle) {
            reasoningToggle.addEventListener('click', () => {
                this.toggleReasoning(meeting.id);
            });
        }

        const removeBtn = card.querySelector('.btn-remove-single');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                if (this.onSingleAction) {
                    this.onSingleAction('remove', meeting.id);
                }
            });
        }

        return card;
    }

    /**
     * Get filtered meetings based on current filter
     */
    getFilteredMeetings() {
        if (this.currentFilter === 'all') {
            return this.meetings;
        }

        return this.meetings.filter(
            m => m.recommendation?.action?.toLowerCase() === this.currentFilter
        );
    }

    /**
     * Handle tab click
     */
    handleTabClick(filter) {
        this.currentFilter = filter;

        // Update tab styles
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // Re-render with new filter
        this.renderMeetings(this.meetings, this.comparisonData);
    }

    /**
     * Update tab counts
     */
    updateTabCounts() {
        const counts = {
            all: this.meetings.length,
            keep: 0,
            remove: 0,
            follow: 0
        };

        for (const meeting of this.meetings) {
            const action = meeting.recommendation?.action?.toLowerCase();
            if (action && counts.hasOwnProperty(action)) {
                counts[action]++;
            }
        }

        // Update tab labels
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const filter = btn.dataset.filter;
            const count = counts[filter] || 0;
            const label = filter.charAt(0).toUpperCase() + filter.slice(1);
            btn.textContent = `${label} (${count})`;
        });
    }

    /**
     * Handle meeting selection
     */
    handleMeetingSelect(meetingId, selected) {
        if (selected) {
            this.selectedMeetings.add(meetingId);
        } else {
            this.selectedMeetings.delete(meetingId);
        }

        this.updateBulkActionState();

        if (this.onMeetingSelect) {
            this.onMeetingSelect(meetingId, selected);
        }
    }

    /**
     * Handle select all
     */
    handleSelectAll(selected) {
        const checkboxes = document.querySelectorAll('.meeting-checkbox');

        checkboxes.forEach(cb => {
            cb.checked = selected;
            const meetingId = cb.dataset.id;

            if (selected) {
                this.selectedMeetings.add(meetingId);
            } else {
                this.selectedMeetings.delete(meetingId);
            }
        });

        this.updateBulkActionState();
    }

    /**
     * Update bulk action button state
     */
    updateBulkActionState() {
        const bulkRemoveBtn = document.getElementById('bulk-remove-btn');
        const selectedCount = document.getElementById('selected-count');

        if (bulkRemoveBtn) {
            bulkRemoveBtn.disabled = this.selectedMeetings.size === 0;
        }

        if (selectedCount) {
            selectedCount.textContent = `${this.selectedMeetings.size} selected`;
        }
    }

    /**
     * Handle bulk remove
     */
    handleBulkRemove() {
        if (this.selectedMeetings.size === 0) return;

        if (this.onBulkAction) {
            this.onBulkAction('remove', Array.from(this.selectedMeetings));
        }
    }

    /**
     * Toggle reasoning visibility
     */
    toggleReasoning(meetingId) {
        const card = document.querySelector(`.meeting-card[data-id="${meetingId}"]`);
        if (!card) return;

        const reasoning = card.querySelector('.meeting-reasoning');
        const content = card.querySelector('.reasoning-content');
        const toggle = card.querySelector('.reasoning-toggle');

        if (reasoning && content && toggle) {
            const isCollapsed = reasoning.classList.contains('collapsed');

            reasoning.classList.toggle('collapsed', !isCollapsed);
            content.classList.toggle('hidden', !isCollapsed);
            toggle.textContent = isCollapsed ? 'Hide Reasoning' : 'Show Reasoning';
        }
    }

    /**
     * Clear meetings display
     */
    clearMeetings() {
        this.meetings = [];
        this.selectedMeetings.clear();
        this.comparisonData = null;

        const container = document.getElementById('meetings-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No analysis loaded. Click "Start Analysis" to analyze your calendar.</p>
                </div>
            `;
        }

        this.updateTabCounts();
        this.updateBulkActionState();
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show configuration modal
     */
    showConfigModal() {
        const modal = document.getElementById('config-modal');
        if (modal) modal.classList.remove('hidden');
    }

    /**
     * Hide configuration modal
     */
    hideConfigModal() {
        const modal = document.getElementById('config-modal');
        if (modal) modal.classList.add('hidden');
    }

    /**
     * Show connection test result
     */
    showConnectionTestResult(result) {
        const testResult = document.getElementById('test-result');
        if (!testResult) return;

        testResult.classList.remove('hidden', 'success', 'error');

        if (result.success) {
            testResult.classList.add('success');
            testResult.innerHTML = `
                <strong>Connection Successful!</strong><br>
                Logged in as: ${result.user.displayName}<br>
                Email: ${result.user.mail || result.user.userPrincipalName}
            `;
        } else {
            testResult.classList.add('error');
            testResult.innerHTML = `
                <strong>Connection Failed</strong><br>
                Error: ${result.error}
            `;
        }
    }
}

// Export singleton instance
const uiManager = new UIManager();
export default uiManager;
