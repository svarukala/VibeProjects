/**
 * Microsoft Graph API Client
 *
 * Handles all Microsoft Graph API calls
 */

import CONFIG from './config.js';
import authManager from './auth.js';

class GraphClient {
    constructor() {
        this.baseUrl = CONFIG.graphBaseUrl;
    }

    /**
     * Make an authenticated request to Graph API
     */
    async request(endpoint, options = {}) {
        const accessToken = await authManager.getAccessToken();

        const url = endpoint.startsWith('http')
            ? endpoint
            : `${this.baseUrl}${endpoint}`;

        const defaultOptions = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new GraphError(
                error.error?.message || `Graph API error: ${response.status}`,
                response.status,
                error.error?.code
            );
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    /**
     * GET request
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    /**
     * Get current user profile
     */
    async getMe() {
        return this.get('/me');
    }

    /**
     * Get user photo
     */
    async getPhoto() {
        try {
            const accessToken = await authManager.getAccessToken();
            const response = await fetch(`${this.baseUrl}/me/photo/$value`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) return null;

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error) {
            console.warn('Could not fetch user photo:', error);
            return null;
        }
    }

    /**
     * Get all calendar events within a date range
     */
    async getCalendarEvents(startDate, endDate) {
        const start = startDate.toISOString();
        const end = endDate.toISOString();

        const endpoint = `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=500&$orderby=start/dateTime`;

        return this.getAllPages(endpoint);
    }

    /**
     * Get recurring events (series masters)
     */
    async getRecurringEvents(startDate, endDate) {
        const start = startDate.toISOString();
        const end = endDate.toISOString();

        // Get calendar view and filter for recurring meetings
        const endpoint = `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=500`;

        const events = await this.getAllPages(endpoint);

        // Group by seriesMasterId to identify unique recurring meetings
        const recurringMap = new Map();

        for (const event of events) {
            if (event.seriesMasterId) {
                if (!recurringMap.has(event.seriesMasterId)) {
                    recurringMap.set(event.seriesMasterId, {
                        seriesMasterId: event.seriesMasterId,
                        subject: event.subject,
                        organizer: event.organizer,
                        onlineMeeting: event.onlineMeeting,
                        instances: []
                    });
                }
                recurringMap.get(event.seriesMasterId).instances.push(event);
            }
        }

        return Array.from(recurringMap.values());
    }

    /**
     * Get series master event details
     */
    async getSeriesMaster(seriesMasterId) {
        return this.get(`/me/events/${seriesMasterId}`);
    }

    /**
     * Get instances of a recurring event
     */
    async getEventInstances(eventId, startDate, endDate) {
        const start = startDate.toISOString();
        const end = endDate.toISOString();

        const endpoint = `/me/events/${eventId}/instances?startDateTime=${start}&endDateTime=${end}&$top=100`;

        return this.getAllPages(endpoint);
    }

    /**
     * Get user's chats (including meeting chats)
     */
    async getMeetingChats() {
        const endpoint = `/me/chats?$filter=chatType eq 'meeting'&$top=50`;
        return this.getAllPages(endpoint);
    }

    /**
     * Get messages from a specific chat
     */
    async getChatMessages(chatId, top = 50) {
        const endpoint = `/me/chats/${chatId}/messages?$top=${top}`;
        return this.getAllPages(endpoint);
    }

    /**
     * Get online meetings
     */
    async getOnlineMeetings() {
        try {
            const endpoint = '/me/onlineMeetings';
            return this.getAllPages(endpoint);
        } catch (error) {
            console.warn('Could not fetch online meetings:', error);
            return [];
        }
    }

    /**
     * Delete a calendar event
     */
    async deleteEvent(eventId) {
        return this.delete(`/me/events/${eventId}`);
    }

    /**
     * Delete all instances of a recurring event (delete the series)
     */
    async deleteRecurringSeries(seriesMasterId) {
        return this.delete(`/me/events/${seriesMasterId}`);
    }

    /**
     * Handle paginated responses
     */
    async getAllPages(endpoint) {
        const results = [];
        let nextLink = endpoint;

        while (nextLink) {
            const response = await this.get(nextLink);
            if (response.value) {
                results.push(...response.value);
            }
            nextLink = response['@odata.nextLink']
                ? response['@odata.nextLink'].replace(this.baseUrl, '')
                : null;
        }

        return results;
    }

    /**
     * Test the connection to Graph API
     */
    async testConnection() {
        try {
            const me = await this.getMe();
            return {
                success: true,
                user: me
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

/**
 * Custom error class for Graph API errors
 */
class GraphError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.name = 'GraphError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

// Export singleton instance
const graphClient = new GraphClient();
export default graphClient;
export { GraphError };
