/**
 * ReduceMeetings Configuration
 *
 * Update these values with your Entra ID (Azure AD) app registration details
 * and OpenAI API credentials.
 */

const CONFIG = {
    // Microsoft Entra ID (Azure AD) Configuration
    auth: {
        // Application (client) ID from Entra ID app registration
        clientId: '2dfacfe6-44b7-4096-9a0b-950981c29fe6',

        // Authority URL - use 'common' for multi-tenant, or specific tenant ID
        // For single tenant: https://login.microsoftonline.com/{tenant-id}
        // For multi-tenant: https://login.microsoftonline.com/common
        authority: 'https://login.microsoftonline.com/144b8c80-398d-405e-8055-fc9a9d5013f8',

        // Redirect URI - must match what's registered in Entra ID
        // For local development: http://localhost:3000 or http://localhost:5500
        redirectUri: window.location.origin,

        // Microsoft Graph API scopes
        scopes: [
            'User.Read',              // Read user profile
            'Calendars.Read',         // Read calendar events
            'Calendars.ReadWrite',    // Delete calendar events
            'OnlineMeetings.Read',    // Read online meeting details
            'Chat.Read'               // Read meeting chats
        ]
    },

    // OpenAI Configuration
    openai: {
        // OpenAI API key - user will enter this at runtime for security
        apiKey: '',

        // Model to use for recommendations
        model: 'gpt-4',

        // API endpoint
        endpoint: 'https://api.openai.com/v1/chat/completions',

        // Max tokens for response
        maxTokens: 1000
    },

    // Application Settings
    settings: {
        // Default number of months to analyze
        defaultMonthsToAnalyze: 2,

        // Maximum months allowed for analysis
        maxMonthsToAnalyze: 12,

        // Minimum months allowed
        minMonthsToAnalyze: 1,

        // LocalStorage key prefix
        storageKeyPrefix: 'reducemeetings_',

        // Maximum analyses to keep in storage
        maxStoredAnalyses: 10
    },

    // Microsoft Graph API base URL
    graphBaseUrl: 'https://graph.microsoft.com/v1.0'
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG.auth);
Object.freeze(CONFIG.settings);
Object.freeze(CONFIG);

export default CONFIG;
