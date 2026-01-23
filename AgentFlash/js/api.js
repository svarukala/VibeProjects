/**
 * Agent Flash - API Module
 * Handles Claude and OpenAI API integration
 */

const API = {
    /**
     * Generate flash cards for a topic (routes to appropriate provider)
     * @param {string} topic - The topic to generate cards for
     * @param {number} count - Number of cards to generate
     * @returns {Promise<Object>} Generated cards data
     */
    async generateFlashCards(topic, count) {
        const settings = Storage.getApiSettings();

        if (settings.provider === 'openai') {
            return this.generateFlashCardsOpenAI(topic, count, settings);
        } else {
            return this.generateFlashCardsClaude(topic, count, settings);
        }
    },

    /**
     * Generate flash cards using Claude API
     * @param {string} topic - The topic to generate cards for
     * @param {number} count - Number of cards to generate
     * @param {Object} settings - API settings
     * @returns {Promise<Object>} Generated cards data
     */
    async generateFlashCardsClaude(topic, count, settings) {
        if (!settings.claudeApiKey) {
            throw new Error('Claude API key not configured. Please add your API key in Settings.');
        }

        const prompt = CONFIG.getClaudePrompt(topic, count);

        const requestBody = {
            model: settings.claudeModel || CONFIG.claude.defaultModel,
            max_tokens: CONFIG.claude.maxTokens,
            tools: [
                {
                    type: "web_search_20250305",
                    name: "web_search",
                    max_uses: 5
                }
            ],
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        };

        try {
            const response = await fetch(settings.claudeEndpoint || CONFIG.claude.defaultEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': settings.claudeApiKey,
                    'anthropic-version': CONFIG.claude.anthropicVersion,
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
            }

            const data = await response.json();
            return this.parseClaudeResponse(data, topic);
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error. Please check your internet connection.');
            }
            throw error;
        }
    },

    /**
     * Generate flash cards using OpenAI API
     * @param {string} topic - The topic to generate cards for
     * @param {number} count - Number of cards to generate
     * @param {Object} settings - API settings
     * @returns {Promise<Object>} Generated cards data
     */
    async generateFlashCardsOpenAI(topic, count, settings) {
        if (!settings.openaiApiKey) {
            throw new Error('OpenAI API key not configured. Please add your API key in Settings.');
        }

        const prompt = CONFIG.getOpenAIPrompt(topic, count);

        const requestBody = {
            model: settings.openaiModel || CONFIG.openai.defaultModel,
            max_tokens: CONFIG.openai.maxTokens,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        };

        try {
            const response = await fetch(CONFIG.openai.defaultEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.openaiApiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
            }

            const data = await response.json();
            return this.parseOpenAIResponse(data, topic);
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error. Please check your internet connection.');
            }
            throw error;
        }
    },

    /**
     * Parse Claude API response and extract flash cards
     * @param {Object} response - Claude API response
     * @param {string} topic - Original topic
     * @returns {Object} Parsed flash cards data
     */
    parseClaudeResponse(response, topic) {
        if (!response.content || !Array.isArray(response.content)) {
            throw new Error('Invalid API response format');
        }

        // Find the text content block with JSON
        let jsonContent = null;
        for (const block of response.content) {
            if (block.type === 'text' && block.text) {
                // Try to extract JSON from the text
                const text = block.text.trim();
                // Look for JSON object in the response
                const jsonMatch = text.match(/\{[\s\S]*"cards"[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        jsonContent = JSON.parse(jsonMatch[0]);
                        break;
                    } catch (e) {
                        // Continue looking
                    }
                }
            }
        }

        if (!jsonContent) {
            throw new Error('Could not parse flash cards from API response. Please try again.');
        }

        return this.validateAndFormatCards(jsonContent, topic);
    },

    /**
     * Parse OpenAI API response and extract flash cards
     * @param {Object} response - OpenAI API response
     * @param {string} topic - Original topic
     * @returns {Object} Parsed flash cards data
     */
    parseOpenAIResponse(response, topic) {
        if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
            throw new Error('Invalid API response format');
        }

        const content = response.choices[0].message?.content;
        if (!content) {
            throw new Error('No content in API response');
        }

        let jsonContent;
        try {
            jsonContent = JSON.parse(content);
        } catch (e) {
            // Try to extract JSON from the text
            const jsonMatch = content.match(/\{[\s\S]*"cards"[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    jsonContent = JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    throw new Error('Could not parse flash cards from API response. Please try again.');
                }
            } else {
                throw new Error('Could not parse flash cards from API response. Please try again.');
            }
        }

        return this.validateAndFormatCards(jsonContent, topic);
    },

    /**
     * Validate and format cards from parsed JSON
     * @param {Object} jsonContent - Parsed JSON content
     * @param {string} topic - Original topic
     * @returns {Object} Validated flash cards data
     */
    validateAndFormatCards(jsonContent, topic) {
        // Validate the structure
        if (!jsonContent.cards || !Array.isArray(jsonContent.cards)) {
            throw new Error('Invalid flash cards data structure');
        }

        // Ensure all cards have required fields
        const validCards = jsonContent.cards.filter(card =>
            card &&
            typeof card.question === 'string' &&
            typeof card.answer === 'string' &&
            card.question.trim() &&
            card.answer.trim()
        ).map((card, index) => ({
            id: index + 1,
            question: card.question.trim(),
            answer: card.answer.trim(),
            userAnswer: null
        }));

        if (validCards.length === 0) {
            throw new Error('No valid flash cards were generated. Please try again.');
        }

        return {
            topic: jsonContent.topic || topic,
            cards: validCards
        };
    },

    /**
     * Test API connection (routes to appropriate provider)
     * @param {Object} settings - Optional settings to test (uses stored settings if not provided)
     * @returns {Promise<boolean>} Connection status
     */
    async testConnection(settings = null) {
        settings = settings || Storage.getApiSettings();

        if (settings.provider === 'openai') {
            return this.testConnectionOpenAI(settings);
        } else {
            return this.testConnectionClaude(settings);
        }
    },

    /**
     * Test Claude API connection
     * @param {Object} settings - API settings
     * @returns {Promise<boolean>} Connection status
     */
    async testConnectionClaude(settings) {
        if (!settings.claudeApiKey) {
            throw new Error('Claude API key not configured');
        }

        const requestBody = {
            model: settings.claudeModel || CONFIG.claude.defaultModel,
            max_tokens: 50,
            messages: [
                {
                    role: "user",
                    content: "Reply with just the word 'connected' to confirm the API is working."
                }
            ]
        };

        try {
            const response = await fetch(settings.claudeEndpoint || CONFIG.claude.defaultEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': settings.claudeApiKey,
                    'anthropic-version': CONFIG.claude.anthropicVersion,
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    throw new Error('Invalid API key');
                }
                throw new Error(errorData.error?.message || `Connection failed (${response.status})`);
            }

            return true;
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error. Check your connection.');
            }
            throw error;
        }
    },

    /**
     * Test OpenAI API connection
     * @param {Object} settings - API settings
     * @returns {Promise<boolean>} Connection status
     */
    async testConnectionOpenAI(settings) {
        if (!settings.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const requestBody = {
            model: settings.openaiModel || CONFIG.openai.defaultModel,
            max_tokens: 50,
            messages: [
                {
                    role: "user",
                    content: "Reply with just the word 'connected' to confirm the API is working."
                }
            ]
        };

        try {
            const response = await fetch(CONFIG.openai.defaultEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.openaiApiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    throw new Error('Invalid API key');
                }
                throw new Error(errorData.error?.message || `Connection failed (${response.status})`);
            }

            return true;
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error. Check your connection.');
            }
            throw error;
        }
    }
};

// Make API available globally
window.API = API;
