/**
 * Agent Flash - UI Module
 * Handles all DOM manipulation and rendering
 */

const UI = {
    // DOM Element Cache
    elements: {},

    /**
     * Initialize UI and cache DOM elements
     */
    init() {
        this.cacheElements();
        this.bindEvents();
    },

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Views
            viewHome: document.getElementById('view-home'),
            viewLoading: document.getElementById('view-loading'),
            viewStudy: document.getElementById('view-study'),
            viewResults: document.getElementById('view-results'),
            viewHistory: document.getElementById('view-history'),

            // Header
            logoHome: document.getElementById('logo-home'),
            btnHistory: document.getElementById('btn-history'),
            btnSettings: document.getElementById('btn-settings'),

            // Home Form
            topicForm: document.getElementById('topic-form'),
            topicInput: document.getElementById('topic-input'),
            cardCount: document.getElementById('card-count'),
            btnGenerate: document.getElementById('btn-generate'),

            // Loading
            loadingTopic: document.getElementById('loading-topic'),

            // Study View
            studyTopic: document.getElementById('study-topic'),
            cardCurrent: document.getElementById('card-current'),
            cardTotal: document.getElementById('card-total'),
            studyProgressBar: document.getElementById('study-progress-bar'),
            flashcard: document.getElementById('flashcard'),
            cardQuestion: document.getElementById('card-question'),
            cardAnswer: document.getElementById('card-answer'),
            answerButtons: document.getElementById('answer-buttons'),
            btnWrong: document.getElementById('btn-wrong'),
            btnCorrect: document.getElementById('btn-correct'),
            currentCorrect: document.getElementById('current-correct'),
            currentWrong: document.getElementById('current-wrong'),

            // Results View
            resultsTopic: document.getElementById('results-topic'),
            scoreRingProgress: document.getElementById('score-ring-progress'),
            scorePercentage: document.getElementById('score-percentage'),
            finalCorrect: document.getElementById('final-correct'),
            finalWrong: document.getElementById('final-wrong'),
            resultsMessage: document.getElementById('results-message'),
            btnReviewCards: document.getElementById('btn-review-cards'),
            btnStudyAgain: document.getElementById('btn-study-again'),
            btnNewTopic: document.getElementById('btn-new-topic'),
            cardReview: document.getElementById('card-review'),
            reviewList: document.getElementById('review-list'),

            // History View
            historyList: document.getElementById('history-list'),
            historyEmpty: document.getElementById('history-empty'),
            btnClearHistory: document.getElementById('btn-clear-history'),
            btnBackHome: document.getElementById('btn-back-home'),
            btnStartFirst: document.getElementById('btn-start-first'),

            // Settings Modal
            settingsModal: document.getElementById('settings-modal'),
            btnCloseSettings: document.getElementById('btn-close-settings'),
            // Provider selection
            providerClaude: document.getElementById('provider-claude'),
            providerOpenai: document.getElementById('provider-openai'),
            // Claude settings
            claudeSettings: document.getElementById('claude-settings'),
            claudeApiKey: document.getElementById('claude-api-key'),
            toggleClaudeKey: document.getElementById('toggle-claude-key'),
            claudeEndpoint: document.getElementById('claude-endpoint'),
            claudeModel: document.getElementById('claude-model'),
            // OpenAI settings
            openaiSettings: document.getElementById('openai-settings'),
            openaiApiKey: document.getElementById('openai-api-key'),
            toggleOpenaiKey: document.getElementById('toggle-openai-key'),
            openaiModel: document.getElementById('openai-model'),
            // Action buttons
            btnTestConnection: document.getElementById('btn-test-connection'),
            btnSaveSettings: document.getElementById('btn-save-settings'),
            connectionStatus: document.getElementById('connection-status'),

            // Confirm Modal
            confirmModal: document.getElementById('confirm-modal'),
            confirmTitle: document.getElementById('confirm-title'),
            confirmMessage: document.getElementById('confirm-message'),
            btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
            btnConfirmOk: document.getElementById('btn-confirm-ok'),

            // Toast
            toastContainer: document.getElementById('toast-container')
        };
    },

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Quick topic chips
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.elements.topicInput.value = chip.dataset.topic;
                this.elements.topicInput.focus();
            });
        });

        // Toggle Claude API key visibility
        this.elements.toggleClaudeKey.addEventListener('click', () => {
            this.toggleKeyVisibility(this.elements.claudeApiKey, this.elements.toggleClaudeKey);
        });

        // Toggle OpenAI API key visibility
        this.elements.toggleOpenaiKey.addEventListener('click', () => {
            this.toggleKeyVisibility(this.elements.openaiApiKey, this.elements.toggleOpenaiKey);
        });

        // Provider selection change
        this.elements.providerClaude.addEventListener('change', () => this.toggleProviderSettings());
        this.elements.providerOpenai.addEventListener('change', () => this.toggleProviderSettings());

        // Modal close on overlay click
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.hideSettingsModal();
            }
        });

        this.elements.confirmModal.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmModal) {
                this.hideConfirmModal();
            }
        });

        // Keyboard support for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.settingsModal.classList.contains('active')) {
                    this.hideSettingsModal();
                }
                if (this.elements.confirmModal.classList.contains('active')) {
                    this.hideConfirmModal();
                }
            }
        });
    },

    /**
     * Show a specific view
     * @param {string} viewName - Name of the view to show
     */
    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show requested view
        const view = document.getElementById(`view-${viewName}`);
        if (view) {
            view.classList.add('active');
        }
    },

    /**
     * Show loading view with topic
     * @param {string} topic - Topic being loaded
     */
    showLoading(topic) {
        this.elements.loadingTopic.textContent = `Creating flash cards for "${topic}"...`;
        this.showView('loading');
    },

    /**
     * Show study view with session data
     * @param {Object} session - Current session
     * @param {number} cardIndex - Current card index
     */
    showStudyView(session, cardIndex) {
        this.elements.studyTopic.textContent = session.topic;
        this.showView('study');
        this.updateStudyCard(session, cardIndex);
    },

    /**
     * Update study card display
     * @param {Object} session - Current session
     * @param {number} cardIndex - Current card index
     */
    updateStudyCard(session, cardIndex) {
        const card = session.cards[cardIndex];
        const total = session.cards.length;
        const progress = ((cardIndex) / total) * 100;

        // Update progress
        this.elements.cardCurrent.textContent = cardIndex + 1;
        this.elements.cardTotal.textContent = total;
        this.elements.studyProgressBar.style.width = `${progress}%`;

        // Disable answer buttons until card is flipped
        this.elements.btnCorrect.disabled = true;
        this.elements.btnWrong.disabled = true;

        // Update score display
        this.elements.currentCorrect.textContent = session.score.correct;
        this.elements.currentWrong.textContent = session.score.wrong;

        // If card is flipped, first flip it back, then update content
        if (this.elements.flashcard.classList.contains('flipped')) {
            this.elements.flashcard.classList.remove('flipped');
            // Wait for flip animation to complete before updating content
            setTimeout(() => {
                this.elements.cardQuestion.textContent = card.question;
                this.elements.cardAnswer.textContent = card.answer;
            }, 300); // Half of the flip animation duration
        } else {
            // Card not flipped, update content immediately
            this.elements.cardQuestion.textContent = card.question;
            this.elements.cardAnswer.textContent = card.answer;
        }
    },

    /**
     * Flip the flash card
     */
    flipCard() {
        this.elements.flashcard.classList.add('flipped');
        // Enable answer buttons
        this.elements.btnCorrect.disabled = false;
        this.elements.btnWrong.disabled = false;
    },

    /**
     * Check if card is flipped
     * @returns {boolean}
     */
    isCardFlipped() {
        return this.elements.flashcard.classList.contains('flipped');
    },

    /**
     * Show results view
     * @param {Object} session - Completed session
     */
    showResultsView(session) {
        const score = session.score;

        this.elements.resultsTopic.textContent = session.topic;
        this.elements.finalCorrect.textContent = score.correct;
        this.elements.finalWrong.textContent = score.wrong;
        this.elements.resultsMessage.textContent = FlashCard.getScoreMessage(score.percentage);

        // Hide review section initially
        this.elements.cardReview.style.display = 'none';

        this.showView('results');

        // Animate score ring
        setTimeout(() => {
            this.animateScoreRing(score.percentage);
        }, 100);
    },

    /**
     * Animate the score ring
     * @param {number} percentage - Score percentage
     */
    animateScoreRing(percentage) {
        const ring = this.elements.scoreRingProgress;
        const circumference = 2 * Math.PI * 54; // r = 54
        const offset = circumference - (percentage / 100) * circumference;

        // Set gradient based on score
        let color = '#10b981'; // Green for good
        if (percentage < 50) {
            color = '#ef4444'; // Red for low
        } else if (percentage < 70) {
            color = '#f59e0b'; // Orange for medium
        }

        ring.style.stroke = color;
        ring.style.strokeDasharray = circumference;
        ring.style.strokeDashoffset = offset;

        // Animate percentage number
        this.animateNumber(this.elements.scorePercentage, 0, percentage, 1000);
    },

    /**
     * Animate a number counting up
     * @param {HTMLElement} element - Element to update
     * @param {number} start - Starting value
     * @param {number} end - Ending value
     * @param {number} duration - Animation duration in ms
     */
    animateNumber(element, start, end, duration) {
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out quad
            const easeProgress = 1 - (1 - progress) * (1 - progress);
            const current = Math.round(start + (end - start) * easeProgress);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    },

    /**
     * Show card review section
     * @param {Object} session - Session with cards
     */
    showCardReview(session) {
        this.elements.cardReview.style.display = 'block';
        this.elements.reviewList.innerHTML = '';

        session.cards.forEach((card, index) => {
            const item = document.createElement('div');
            item.className = `review-item ${card.userAnswer}`;
            item.innerHTML = `
                <p class="review-question">${index + 1}. ${this.escapeHtml(card.question)}</p>
                <p class="review-answer">${this.escapeHtml(card.answer)}</p>
                <div class="review-status ${card.userAnswer}">
                    ${card.userAnswer === 'correct'
                        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Correct</span>'
                        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span>Wrong</span>'
                    }
                </div>
            `;
            this.elements.reviewList.appendChild(item);
        });

        // Scroll to review section
        this.elements.cardReview.scrollIntoView({ behavior: 'smooth' });
    },

    /**
     * Hide card review section
     */
    hideCardReview() {
        this.elements.cardReview.style.display = 'none';
    },

    /**
     * Show history view
     * @param {Array} sessions - Array of session objects
     */
    showHistoryView(sessions) {
        this.showView('history');
        this.renderHistoryList(sessions);
    },

    /**
     * Render the history list
     * @param {Array} sessions - Array of session objects
     */
    renderHistoryList(sessions) {
        this.elements.historyList.innerHTML = '';

        if (sessions.length === 0) {
            this.elements.historyList.style.display = 'none';
            this.elements.historyEmpty.style.display = 'flex';
            this.elements.btnClearHistory.style.display = 'none';
            return;
        }

        this.elements.historyList.style.display = 'flex';
        this.elements.historyEmpty.style.display = 'none';
        this.elements.btnClearHistory.style.display = 'flex';

        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-topic">${this.escapeHtml(session.topic)}</span>
                    <span class="history-item-score">${session.score.percentage}%</span>
                </div>
                <div class="history-item-meta">
                    <span>${session.cardCount} cards</span>
                    <span>${FlashCard.formatDate(session.createdAt)}</span>
                    <span>${session.score.correct}/${session.cardCount} correct</span>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-secondary btn-study-again" data-session-id="${session.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        <span>Study Again</span>
                    </button>
                    <button class="btn btn-text btn-delete-session" data-session-id="${session.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Delete</span>
                    </button>
                </div>
            `;
            this.elements.historyList.appendChild(item);
        });
    },

    /**
     * Toggle API key visibility
     * @param {HTMLElement} input - The input element
     * @param {HTMLElement} button - The toggle button
     */
    toggleKeyVisibility(input, button) {
        const showIcon = button.querySelector('.icon-show');
        const hideIcon = button.querySelector('.icon-hide');

        if (input.type === 'password') {
            input.type = 'text';
            showIcon.style.display = 'none';
            hideIcon.style.display = 'block';
        } else {
            input.type = 'password';
            showIcon.style.display = 'block';
            hideIcon.style.display = 'none';
        }
    },

    /**
     * Toggle provider settings visibility based on selected provider
     */
    toggleProviderSettings() {
        const isClaude = this.elements.providerClaude.checked;

        if (isClaude) {
            this.elements.claudeSettings.style.display = 'block';
            this.elements.openaiSettings.style.display = 'none';
        } else {
            this.elements.claudeSettings.style.display = 'none';
            this.elements.openaiSettings.style.display = 'block';
        }

        // Reset connection status when switching providers
        this.elements.connectionStatus.style.display = 'none';
    },

    /**
     * Get currently selected provider
     * @returns {string} 'claude' or 'openai'
     */
    getSelectedProvider() {
        return this.elements.providerClaude.checked ? 'claude' : 'openai';
    },

    /**
     * Show settings modal
     */
    showSettingsModal() {
        // Load current settings
        const settings = Storage.getApiSettings();

        // Set provider selection
        if (settings.provider === 'openai') {
            this.elements.providerOpenai.checked = true;
        } else {
            this.elements.providerClaude.checked = true;
        }

        // Load Claude settings
        this.elements.claudeApiKey.value = settings.claudeApiKey || '';
        this.elements.claudeEndpoint.value = settings.claudeEndpoint || CONFIG.claude.defaultEndpoint;
        this.elements.claudeModel.value = settings.claudeModel || CONFIG.claude.defaultModel;

        // Load OpenAI settings
        this.elements.openaiApiKey.value = settings.openaiApiKey || '';
        this.elements.openaiModel.value = settings.openaiModel || CONFIG.openai.defaultModel;

        // Show correct provider settings
        this.toggleProviderSettings();

        // Reset connection status
        this.elements.connectionStatus.style.display = 'none';

        this.elements.settingsModal.classList.add('active');
    },

    /**
     * Hide settings modal
     */
    hideSettingsModal() {
        this.elements.settingsModal.classList.remove('active');
    },

    /**
     * Show connection status
     * @param {boolean} success - Whether connection was successful
     * @param {string} message - Status message
     */
    showConnectionStatus(success, message) {
        this.elements.connectionStatus.style.display = 'flex';
        this.elements.connectionStatus.className = `connection-status ${success ? 'success' : 'error'}`;
        this.elements.connectionStatus.querySelector('.status-message').textContent = message;
    },

    /**
     * Show confirm modal
     * @param {string} title - Modal title
     * @param {string} message - Confirmation message
     * @param {Function} onConfirm - Callback on confirm
     */
    showConfirmModal(title, message, onConfirm) {
        this.elements.confirmTitle.textContent = title;
        this.elements.confirmMessage.textContent = message;

        // Store callback
        this._confirmCallback = onConfirm;

        this.elements.confirmModal.classList.add('active');
    },

    /**
     * Hide confirm modal
     */
    hideConfirmModal() {
        this.elements.confirmModal.classList.remove('active');
        this._confirmCallback = null;
    },

    /**
     * Execute confirm callback
     */
    executeConfirm() {
        if (this._confirmCallback) {
            this._confirmCallback();
        }
        this.hideConfirmModal();
    },

    /**
     * Show a toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning)
     * @param {number} duration - Duration in ms
     */
    showToast(message, type = 'success', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<polyline points="20 6 9 17 4 12"></polyline>',
            error: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
            warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
        };

        toast.innerHTML = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${icons[type] || icons.success}
            </svg>
            <span class="toast-message">${this.escapeHtml(message)}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'fadeIn var(--transition-slow) reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    },

    /**
     * Set loading state on a button
     * @param {HTMLElement} button - Button element
     * @param {boolean} loading - Loading state
     */
    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `
                <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20">
                        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                    </circle>
                </svg>
                <span>Loading...</span>
            `;
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Reset the home form
     */
    resetHomeForm() {
        this.elements.topicInput.value = '';
        this.elements.cardCount.value = CONFIG.flashCards.defaultCount.toString();
    }
};

// Make UI available globally
window.UI = UI;
