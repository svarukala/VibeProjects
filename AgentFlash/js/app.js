/**
 * Agent Flash - Main Application
 * Entry point and state management
 */

const App = {
    // Application State
    state: {
        currentView: 'home',
        currentSession: null,
        currentCardIndex: 0,
        isLoading: false
    },

    /**
     * Initialize the application
     */
    init() {
        // Initialize UI
        UI.init();

        // Bind event handlers
        this.bindEvents();

        // Check for API key
        if (!Storage.isApiConfigured()) {
            setTimeout(() => {
                UI.showToast('Welcome! Please configure your API key in Settings to get started.', 'warning', 6000);
            }, 500);
        }

        // Check for interrupted session
        const savedSession = Storage.getCurrentSession();
        if (savedSession && !savedSession.completed) {
            this.resumeSession(savedSession);
        }
    },

    /**
     * Bind all event handlers
     */
    bindEvents() {
        // Navigation
        UI.elements.logoHome.addEventListener('click', () => this.goHome());
        UI.elements.btnHistory.addEventListener('click', () => this.showHistory());
        UI.elements.btnSettings.addEventListener('click', () => UI.showSettingsModal());

        // Home Form
        UI.elements.topicForm.addEventListener('submit', (e) => this.handleGenerateSubmit(e));

        // Flash Card
        UI.elements.flashcard.addEventListener('click', () => this.handleCardFlip());
        UI.elements.btnCorrect.addEventListener('click', () => this.handleAnswer('correct'));
        UI.elements.btnWrong.addEventListener('click', () => this.handleAnswer('wrong'));

        // Results
        UI.elements.btnReviewCards.addEventListener('click', () => this.handleReviewCards());
        UI.elements.btnStudyAgain.addEventListener('click', () => this.handleStudyAgain());
        UI.elements.btnNewTopic.addEventListener('click', () => this.goHome());

        // History
        UI.elements.btnBackHome.addEventListener('click', () => this.goHome());
        UI.elements.btnStartFirst.addEventListener('click', () => this.goHome());
        UI.elements.btnClearHistory.addEventListener('click', () => this.handleClearHistory());
        UI.elements.historyList.addEventListener('click', (e) => this.handleHistoryAction(e));

        // Settings
        UI.elements.btnCloseSettings.addEventListener('click', () => UI.hideSettingsModal());
        UI.elements.btnSaveSettings.addEventListener('click', () => this.handleSaveSettings());
        UI.elements.btnTestConnection.addEventListener('click', () => this.handleTestConnection());

        // Confirm Modal
        UI.elements.btnConfirmCancel.addEventListener('click', () => UI.hideConfirmModal());
        UI.elements.btnConfirmOk.addEventListener('click', () => UI.executeConfirm());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    },

    /**
     * Handle generate form submission
     * @param {Event} e - Submit event
     */
    async handleGenerateSubmit(e) {
        e.preventDefault();

        const topic = UI.elements.topicInput.value.trim();
        const count = parseInt(UI.elements.cardCount.value);

        if (!topic) {
            UI.showToast('Please enter a topic', 'error');
            UI.elements.topicInput.focus();
            return;
        }

        if (!Storage.isApiConfigured()) {
            UI.showToast('Please configure your API key in Settings first', 'error');
            UI.showSettingsModal();
            return;
        }

        await this.generateFlashCards(topic, count);
    },

    /**
     * Generate flash cards for a topic
     * @param {string} topic - Topic to generate cards for
     * @param {number} count - Number of cards
     */
    async generateFlashCards(topic, count) {
        this.state.isLoading = true;
        UI.showLoading(topic);
        UI.setButtonLoading(UI.elements.btnGenerate, true);

        try {
            const data = await API.generateFlashCards(topic, count);

            // Create session
            const session = FlashCard.createSession(data.topic, data.cards);
            this.state.currentSession = session;
            this.state.currentCardIndex = 0;

            // Save to storage for recovery
            Storage.setCurrentSession(session);

            // Show study view
            UI.showStudyView(session, 0);
            UI.showToast(`Generated ${data.cards.length} flash cards!`, 'success');

        } catch (error) {
            console.error('Error generating flash cards:', error);
            UI.showToast(error.message, 'error', 6000);
            UI.showView('home');
        } finally {
            this.state.isLoading = false;
            UI.setButtonLoading(UI.elements.btnGenerate, false);
        }
    },

    /**
     * Handle card flip
     */
    handleCardFlip() {
        if (!UI.isCardFlipped()) {
            UI.flipCard();
        }
    },

    /**
     * Handle user answer
     * @param {string} answer - 'correct' or 'wrong'
     */
    handleAnswer(answer) {
        if (!this.state.currentSession) return;

        // Record the answer
        this.state.currentSession = FlashCard.recordAnswer(
            this.state.currentSession,
            this.state.currentCardIndex,
            answer
        );

        // Save progress
        Storage.setCurrentSession(this.state.currentSession);

        // Update score display
        UI.elements.currentCorrect.textContent = this.state.currentSession.score.correct;
        UI.elements.currentWrong.textContent = this.state.currentSession.score.wrong;

        // Check if session is complete
        const nextIndex = FlashCard.getNextCardIndex(
            this.state.currentSession,
            this.state.currentCardIndex
        );

        if (nextIndex === -1) {
            // Session complete
            this.completeSession();
        } else {
            // Move to next card
            this.state.currentCardIndex = nextIndex;
            setTimeout(() => {
                UI.updateStudyCard(this.state.currentSession, nextIndex);
            }, 300);
        }
    },

    /**
     * Complete the current session
     */
    completeSession() {
        this.state.currentSession = FlashCard.completeSession(this.state.currentSession);

        // Save to history
        Storage.saveSession(this.state.currentSession);
        Storage.clearCurrentSession();

        // Show results
        setTimeout(() => {
            UI.showResultsView(this.state.currentSession);
        }, 300);
    },

    /**
     * Handle review cards button
     */
    handleReviewCards() {
        if (this.state.currentSession) {
            if (UI.elements.cardReview.style.display === 'none') {
                UI.showCardReview(this.state.currentSession);
                UI.elements.btnReviewCards.querySelector('span').textContent = 'Hide Review';
            } else {
                UI.hideCardReview();
                UI.elements.btnReviewCards.querySelector('span').textContent = 'Review Cards';
            }
        }
    },

    /**
     * Handle study again button
     */
    handleStudyAgain() {
        if (this.state.currentSession) {
            // Reset session
            this.state.currentSession = FlashCard.resetSession(this.state.currentSession);
            this.state.currentCardIndex = 0;

            // Save for recovery
            Storage.setCurrentSession(this.state.currentSession);

            // Start studying
            UI.showStudyView(this.state.currentSession, 0);
        }
    },

    /**
     * Resume an interrupted session
     * @param {Object} session - Session to resume
     */
    resumeSession(session) {
        this.state.currentSession = session;

        // Find the first unanswered card
        const unansweredIndex = session.cards.findIndex(card => card.userAnswer === null);
        this.state.currentCardIndex = unansweredIndex >= 0 ? unansweredIndex : 0;

        UI.showStudyView(session, this.state.currentCardIndex);
        UI.showToast('Resuming your previous session', 'success');
    },

    /**
     * Show history view
     */
    showHistory() {
        const sessions = Storage.getSessions();
        UI.showHistoryView(sessions);
    },

    /**
     * Handle history action (study again or delete)
     * @param {Event} e - Click event
     */
    handleHistoryAction(e) {
        const studyAgainBtn = e.target.closest('.btn-study-again');
        const deleteBtn = e.target.closest('.btn-delete-session');

        if (studyAgainBtn) {
            const sessionId = studyAgainBtn.dataset.sessionId;
            const session = Storage.getSession(sessionId);
            if (session) {
                this.state.currentSession = FlashCard.resetSession(session);
                this.state.currentCardIndex = 0;
                Storage.setCurrentSession(this.state.currentSession);
                UI.showStudyView(this.state.currentSession, 0);
            }
        }

        if (deleteBtn) {
            const sessionId = deleteBtn.dataset.sessionId;
            UI.showConfirmModal(
                'Delete Session',
                'Are you sure you want to delete this study session?',
                () => {
                    Storage.deleteSession(sessionId);
                    this.showHistory();
                    UI.showToast('Session deleted', 'success');
                }
            );
        }
    },

    /**
     * Handle clear all history
     */
    handleClearHistory() {
        UI.showConfirmModal(
            'Clear All History',
            'This will permanently delete all your study sessions. Are you sure?',
            () => {
                Storage.clearAllSessions();
                this.showHistory();
                UI.showToast('All history cleared', 'success');
            }
        );
    },

    /**
     * Handle save settings
     */
    handleSaveSettings() {
        const settings = {
            provider: UI.getSelectedProvider(),
            // Claude settings
            claudeApiKey: UI.elements.claudeApiKey.value.trim(),
            claudeEndpoint: UI.elements.claudeEndpoint.value.trim() || CONFIG.claude.defaultEndpoint,
            claudeModel: UI.elements.claudeModel.value,
            // OpenAI settings
            openaiApiKey: UI.elements.openaiApiKey.value.trim(),
            openaiModel: UI.elements.openaiModel.value
        };

        Storage.saveApiSettings(settings);
        UI.hideSettingsModal();
        UI.showToast('Settings saved successfully', 'success');
    },

    /**
     * Handle test connection
     */
    async handleTestConnection() {
        const provider = UI.getSelectedProvider();

        // Build settings object for testing
        const settings = {
            provider: provider,
            claudeApiKey: UI.elements.claudeApiKey.value.trim(),
            claudeEndpoint: UI.elements.claudeEndpoint.value.trim() || CONFIG.claude.defaultEndpoint,
            claudeModel: UI.elements.claudeModel.value,
            openaiApiKey: UI.elements.openaiApiKey.value.trim(),
            openaiModel: UI.elements.openaiModel.value
        };

        // Check if the selected provider has an API key
        if (provider === 'openai' && !settings.openaiApiKey) {
            UI.showConnectionStatus(false, 'Please enter an OpenAI API key');
            return;
        }
        if (provider === 'claude' && !settings.claudeApiKey) {
            UI.showConnectionStatus(false, 'Please enter a Claude API key');
            return;
        }

        UI.setButtonLoading(UI.elements.btnTestConnection, true);

        try {
            await API.testConnection(settings);
            UI.showConnectionStatus(true, 'Connection successful!');
        } catch (error) {
            UI.showConnectionStatus(false, error.message);
        } finally {
            UI.setButtonLoading(UI.elements.btnTestConnection, false);
        }
    },

    /**
     * Go to home view
     */
    goHome() {
        this.state.currentView = 'home';
        UI.showView('home');
        UI.resetHomeForm();
    },

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyboard(e) {
        // Only handle if not in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Study view shortcuts
        if (UI.elements.viewStudy.classList.contains('active')) {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleCardFlip();
            } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                if (UI.isCardFlipped() && !UI.elements.btnWrong.disabled) {
                    this.handleAnswer('wrong');
                }
            } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                if (UI.isCardFlipped() && !UI.elements.btnCorrect.disabled) {
                    this.handleAnswer('correct');
                }
            }
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Make App available globally for debugging
window.App = App;
