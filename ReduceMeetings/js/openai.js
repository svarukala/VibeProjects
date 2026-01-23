/**
 * OpenAI Module
 *
 * Handles AI-powered meeting recommendations using OpenAI API
 */

import CONFIG from './config.js';
import storageManager from './storage.js';

class OpenAIClient {
    constructor() {
        this.apiKey = null;
        this.model = CONFIG.openai.model;
        this.endpoint = CONFIG.openai.endpoint;
        this.maxTokens = CONFIG.openai.maxTokens;
    }

    /**
     * Initialize with API key (from storage or runtime)
     */
    initialize() {
        this.apiKey = storageManager.loadOpenAIKey();
        return this.apiKey !== null;
    }

    /**
     * Set API key and optionally save to storage
     */
    setApiKey(apiKey, saveToStorage = true) {
        this.apiKey = apiKey;
        if (saveToStorage) {
            storageManager.saveOpenAIKey(apiKey);
        }
    }

    /**
     * Check if API key is configured
     */
    hasApiKey() {
        return this.apiKey && this.apiKey.length > 0;
    }

    /**
     * Clear API key
     */
    clearApiKey() {
        this.apiKey = null;
        storageManager.clearOpenAIKey();
    }

    /**
     * Get the system prompt for meeting analysis
     */
    getSystemPrompt() {
        return `You are a meeting efficiency analyst helping professionals optimize their calendars. Your task is to analyze recurring meeting data and provide actionable recommendations.

For each meeting, recommend one of three actions:
- KEEP: The meeting provides clear value based on engagement patterns
- REMOVE: The meeting shows signs of low value and could be eliminated
- FOLLOW: The meeting needs discussion with the organizer or team before deciding

Consider these factors when analyzing:
1. Attendance rate - How often does the user actually attend?
2. Chat engagement - Are they active participants or silent observers?
3. @ mentions - Are they being specifically called upon?
4. Meeting frequency vs apparent value
5. Organizer relationship (external vs internal)

Be decisive but fair. A meeting can still be valuable even with lower attendance if other signals suggest importance.

Always respond with valid JSON matching the exact format specified.`;
    }

    /**
     * Build user prompt for a batch of meetings
     */
    buildBatchPrompt(meetings) {
        const meetingSummaries = meetings.map((meeting, index) => {
            const rate = Math.round(meeting.engagement.attendanceRate * 100);
            return `Meeting ${index + 1}:
- Subject: ${meeting.subject}
- Organizer: ${meeting.organizer.name} (${meeting.organizer.email})
- Recurrence: ${meeting.recurrencePattern}
- Total instances: ${meeting.totalInstances}
- Times attended: ${meeting.engagement.timesAttended} (${rate}%)
- Times skipped: ${meeting.engagement.timesSkipped}
- Chat messages: ${meeting.engagement.chatMessagesCount}
- @ mentions: ${meeting.engagement.mentionsCount}
- Last attended: ${meeting.engagement.lastAttended || 'Never'}`;
        }).join('\n\n');

        return `Analyze these ${meetings.length} recurring meetings and provide recommendations:

${meetingSummaries}

Respond with a JSON array containing exactly ${meetings.length} recommendations in order:
[
  {
    "action": "keep|remove|follow",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation (1-2 sentences)",
    "factors": ["key factor 1", "key factor 2"]
  }
]

Important: Return ONLY the JSON array, no additional text.`;
    }

    /**
     * Build prompt for a single meeting
     */
    buildSinglePrompt(meeting) {
        const rate = Math.round(meeting.engagement.attendanceRate * 100);

        return `Analyze this recurring meeting:

- Subject: ${meeting.subject}
- Organizer: ${meeting.organizer.name} (${meeting.organizer.email})
- Recurrence: ${meeting.recurrencePattern}
- Total instances in period: ${meeting.totalInstances}
- Times attended: ${meeting.engagement.timesAttended} (${rate}%)
- Times skipped: ${meeting.engagement.timesSkipped}
- Chat messages sent: ${meeting.engagement.chatMessagesCount}
- Times @ mentioned: ${meeting.engagement.mentionsCount}
- Last attended: ${meeting.engagement.lastAttended || 'Never'}
- Last missed: ${meeting.engagement.lastMissed || 'Never'}

Provide your recommendation as JSON:
{
  "action": "keep|remove|follow",
  "confidence": 0.0-1.0,
  "reasoning": "Your explanation here",
  "factors": ["factor1", "factor2"]
}

Return ONLY the JSON object, no additional text.`;
    }

    /**
     * Make API request to OpenAI
     */
    async makeRequest(messages) {
        if (!this.hasApiKey()) {
            throw new OpenAIError('API key not configured', 'NO_API_KEY');
        }

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                max_tokens: this.maxTokens,
                temperature: 0.3 // Lower temperature for more consistent recommendations
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));

            if (response.status === 401) {
                throw new OpenAIError('Invalid API key', 'INVALID_KEY');
            } else if (response.status === 429) {
                throw new OpenAIError('Rate limit exceeded. Please wait and try again.', 'RATE_LIMIT');
            } else if (response.status === 400 && error.error?.code === 'context_length_exceeded') {
                throw new OpenAIError('Too many meetings to analyze at once. Try a smaller batch.', 'CONTEXT_LENGTH');
            }

            throw new OpenAIError(
                error.error?.message || `API error: ${response.status}`,
                'API_ERROR'
            );
        }

        const data = await response.json();
        return data.choices[0]?.message?.content;
    }

    /**
     * Parse JSON response from OpenAI
     */
    parseResponse(content, expectedCount = 1) {
        if (!content) {
            throw new OpenAIError('Empty response from API', 'EMPTY_RESPONSE');
        }

        // Clean up the response - remove markdown code blocks if present
        let cleaned = content.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.slice(7);
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
        }
        cleaned = cleaned.trim();

        try {
            const parsed = JSON.parse(cleaned);

            // Validate structure
            if (expectedCount === 1) {
                return this.validateRecommendation(parsed);
            } else {
                if (!Array.isArray(parsed)) {
                    throw new Error('Expected array of recommendations');
                }
                return parsed.map(r => this.validateRecommendation(r));
            }
        } catch (error) {
            console.error('Failed to parse OpenAI response:', content);
            throw new OpenAIError(
                `Failed to parse AI response: ${error.message}`,
                'PARSE_ERROR'
            );
        }
    }

    /**
     * Validate and normalize a single recommendation
     */
    validateRecommendation(rec) {
        const validActions = ['keep', 'remove', 'follow'];

        // Normalize action
        const action = (rec.action || 'keep').toLowerCase();
        if (!validActions.includes(action)) {
            rec.action = 'keep'; // Default to keep if invalid
        } else {
            rec.action = action;
        }

        // Normalize confidence
        rec.confidence = Math.max(0, Math.min(1, parseFloat(rec.confidence) || 0.5));

        // Ensure reasoning exists
        rec.reasoning = rec.reasoning || 'No reasoning provided';

        // Ensure factors is an array
        rec.factors = Array.isArray(rec.factors) ? rec.factors : [];

        return rec;
    }

    /**
     * Analyze a single meeting
     */
    async analyzeMeeting(meeting) {
        const messages = [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: this.buildSinglePrompt(meeting) }
        ];

        const response = await this.makeRequest(messages);
        return this.parseResponse(response, 1);
    }

    /**
     * Analyze multiple meetings in a batch (more cost-effective)
     */
    async analyzeMeetingsBatch(meetings, progressCallback = null) {
        if (meetings.length === 0) return [];

        // For very large batches, split into chunks
        const maxBatchSize = 10;
        const results = [];

        for (let i = 0; i < meetings.length; i += maxBatchSize) {
            const batch = meetings.slice(i, i + maxBatchSize);

            if (progressCallback) {
                progressCallback({
                    current: i,
                    total: meetings.length,
                    message: `Analyzing meetings ${i + 1}-${Math.min(i + maxBatchSize, meetings.length)} of ${meetings.length}...`
                });
            }

            const batchResults = await this.analyzeBatch(batch);
            results.push(...batchResults);

            // Add small delay between batches to avoid rate limiting
            if (i + maxBatchSize < meetings.length) {
                await this.delay(500);
            }
        }

        return results;
    }

    /**
     * Analyze a batch of meetings (up to 10)
     */
    async analyzeBatch(meetings) {
        const messages = [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: this.buildBatchPrompt(meetings) }
        ];

        try {
            const response = await this.makeRequest(messages);
            const recommendations = this.parseResponse(response, meetings.length);

            // Handle mismatch in count
            if (recommendations.length !== meetings.length) {
                console.warn(`Expected ${meetings.length} recommendations, got ${recommendations.length}`);
                // Pad with defaults if needed
                while (recommendations.length < meetings.length) {
                    recommendations.push(this.getDefaultRecommendation());
                }
            }

            return recommendations;
        } catch (error) {
            // If batch fails, try individual analysis
            if (error.code === 'CONTEXT_LENGTH' && meetings.length > 1) {
                console.warn('Batch too large, falling back to individual analysis');
                const results = [];
                for (const meeting of meetings) {
                    try {
                        const rec = await this.analyzeMeeting(meeting);
                        results.push(rec);
                    } catch (individualError) {
                        console.error('Individual analysis failed:', individualError);
                        results.push(this.getDefaultRecommendation());
                    }
                    await this.delay(200);
                }
                return results;
            }
            throw error;
        }
    }

    /**
     * Get a default recommendation when AI fails
     */
    getDefaultRecommendation() {
        return {
            action: 'follow',
            confidence: 0.3,
            reasoning: 'Unable to analyze this meeting automatically. Please review manually.',
            factors: ['AI analysis unavailable']
        };
    }

    /**
     * Test API connection with a simple request
     */
    async testConnection() {
        const messages = [
            { role: 'user', content: 'Reply with exactly: "OK"' }
        ];

        try {
            const response = await this.makeRequest(messages);
            return { success: true, response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Helper: Delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Custom error class for OpenAI errors
 */
class OpenAIError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'OpenAIError';
        this.code = code;
    }
}

// Export singleton instance
const openaiClient = new OpenAIClient();
export { OpenAIError };
export default openaiClient;
