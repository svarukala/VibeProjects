/**
 * Agent Flash - FlashCard Module
 * Handles flash card logic and session management
 */

const FlashCard = {
    /**
     * Create a new study session
     * @param {string} topic - Topic name
     * @param {Array} cards - Array of card objects
     * @returns {Object} Session object
     */
    createSession(topic, cards) {
        return {
            id: this.generateId(),
            topic: topic,
            createdAt: new Date().toISOString(),
            cardCount: cards.length,
            cards: cards.map((card, index) => ({
                id: index + 1,
                question: card.question,
                answer: card.answer,
                userAnswer: null
            })),
            score: {
                correct: 0,
                wrong: 0,
                percentage: 0
            },
            completed: false
        };
    },

    /**
     * Generate a unique ID
     * @returns {string} UUID-like string
     */
    generateId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Record user's answer for a card
     * @param {Object} session - Current session
     * @param {number} cardIndex - Index of the card
     * @param {string} answer - 'correct' or 'wrong'
     * @returns {Object} Updated session
     */
    recordAnswer(session, cardIndex, answer) {
        if (cardIndex < 0 || cardIndex >= session.cards.length) {
            return session;
        }

        const updatedSession = { ...session };
        updatedSession.cards = [...session.cards];
        updatedSession.cards[cardIndex] = {
            ...session.cards[cardIndex],
            userAnswer: answer
        };

        // Update score
        updatedSession.score = this.calculateScore(updatedSession.cards);

        return updatedSession;
    },

    /**
     * Calculate score from cards
     * @param {Array} cards - Array of cards with userAnswer
     * @returns {Object} Score object
     */
    calculateScore(cards) {
        const answered = cards.filter(card => card.userAnswer !== null);
        const correct = cards.filter(card => card.userAnswer === 'correct').length;
        const wrong = cards.filter(card => card.userAnswer === 'wrong').length;
        const total = cards.length;
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

        return {
            correct,
            wrong,
            total,
            answered: answered.length,
            percentage
        };
    },

    /**
     * Mark session as completed
     * @param {Object} session - Current session
     * @returns {Object} Updated session
     */
    completeSession(session) {
        return {
            ...session,
            completed: true,
            completedAt: new Date().toISOString(),
            score: this.calculateScore(session.cards)
        };
    },

    /**
     * Reset session for studying again
     * @param {Object} session - Session to reset
     * @returns {Object} Reset session
     */
    resetSession(session) {
        return {
            ...session,
            id: this.generateId(), // New ID for new attempt
            createdAt: new Date().toISOString(),
            cards: session.cards.map(card => ({
                ...card,
                userAnswer: null
            })),
            score: {
                correct: 0,
                wrong: 0,
                percentage: 0
            },
            completed: false
        };
    },

    /**
     * Get score message based on percentage
     * @param {number} percentage - Score percentage
     * @returns {string} Appropriate message
     */
    getScoreMessage(percentage) {
        if (percentage >= CONFIG.scoreMessages.excellent.min) {
            return CONFIG.scoreMessages.excellent.message;
        } else if (percentage >= CONFIG.scoreMessages.great.min) {
            return CONFIG.scoreMessages.great.message;
        } else if (percentage >= CONFIG.scoreMessages.good.min) {
            return CONFIG.scoreMessages.good.message;
        } else {
            return CONFIG.scoreMessages.keepTrying.message;
        }
    },

    /**
     * Format date for display
     * @param {string} isoDate - ISO date string
     * @returns {string} Formatted date
     */
    formatDate(isoDate) {
        const date = new Date(isoDate);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    },

    /**
     * Get the next card index
     * @param {Object} session - Current session
     * @param {number} currentIndex - Current card index
     * @returns {number} Next index or -1 if done
     */
    getNextCardIndex(session, currentIndex) {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= session.cards.length) {
            return -1; // Session complete
        }
        return nextIndex;
    },

    /**
     * Check if all cards have been answered
     * @param {Object} session - Current session
     * @returns {boolean}
     */
    isSessionComplete(session) {
        return session.cards.every(card => card.userAnswer !== null);
    },

    /**
     * Get unanswered cards
     * @param {Object} session - Current session
     * @returns {Array} Array of unanswered cards
     */
    getUnansweredCards(session) {
        return session.cards.filter(card => card.userAnswer === null);
    },

    /**
     * Get wrong answers for review
     * @param {Object} session - Current session
     * @returns {Array} Array of wrong cards
     */
    getWrongCards(session) {
        return session.cards.filter(card => card.userAnswer === 'wrong');
    }
};

// Make FlashCard available globally
window.FlashCard = FlashCard;
