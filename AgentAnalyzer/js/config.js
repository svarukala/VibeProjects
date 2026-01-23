/**
 * Configuration module for AgentAnalyzer
 * Loads and manages application configuration
 */

let appConfig = null;

/**
 * Loads the application configuration from app-config.json
 * @returns {Promise<Object>} The configuration object
 */
export async function loadConfig() {
    if (appConfig) {
        return appConfig;
    }

    try {
        const response = await fetch('./config/app-config.json');
        if (!response.ok) {
            throw new Error('Failed to load configuration');
        }
        appConfig = await response.json();

        // Set default redirect URI if not specified
        if (!appConfig.azure.redirectUri) {
            appConfig.azure.redirectUri = window.location.origin + window.location.pathname;
        }

        return appConfig;
    } catch (error) {
        console.error('Error loading configuration:', error);
        // Set and return default configuration
        appConfig = getDefaultConfig();
        return appConfig;
    }
}

/**
 * Returns the default configuration
 * @returns {Object} Default configuration object
 */
function getDefaultConfig() {
    return {
        azure: {
            clientId: '',
            tenantId: 'common',
            redirectUri: window.location.origin + window.location.pathname
        },
        openai: {
            endpoint: 'https://api.openai.com/v1',
            model: 'gpt-4',
            maxTokens: 4096
        },
        analysis: {
            sharepoint: {
                largeFileSizeThreshold: 83886080, // 80MB in bytes
                highFileCountThreshold: 1000
            },
            connectors: {
                maxRecommendedCount: 5,
                minDescriptionLength: 20,
                maxDescriptionLength: 500
            }
        },
        ui: {
            maxInstructionsPreviewLength: 500,
            editorTheme: 'vs-light'
        }
    };
}

/**
 * Gets the current configuration
 * @returns {Object|null} The current configuration or null if not loaded
 */
export function getConfig() {
    return appConfig;
}

/**
 * Gets the MSAL configuration for authentication
 * @returns {Object} MSAL configuration object
 */
export function getMsalConfig() {
    const config = getConfig() || getDefaultConfig();
    return {
        auth: {
            clientId: config.azure.clientId,
            authority: `https://login.microsoftonline.com/${config.azure.tenantId}`,
            redirectUri: config.azure.redirectUri,
            postLogoutRedirectUri: config.azure.redirectUri
        },
        cache: {
            cacheLocation: 'sessionStorage',
            storeAuthStateInCookie: false
        },
        system: {
            loggerOptions: {
                loggerCallback: (level, message, containsPii) => {
                    if (containsPii) return;
                    switch (level) {
                        case msal.LogLevel.Error:
                            console.error(message);
                            break;
                        case msal.LogLevel.Warning:
                            console.warn(message);
                            break;
                        default:
                            break;
                    }
                },
                piiLoggingEnabled: false
            }
        }
    };
}

/**
 * Gets the Graph API scopes for different features
 * @returns {Object} Object containing scope arrays for different features
 */
export function getGraphScopes() {
    return {
        basic: ['User.Read'],
        sharePoint: [
            'User.Read',
            'Sites.Read.All',
            'Files.Read.All'
        ],
        fullAccess: [
            'User.Read',
            'Sites.Read.All',
            'Files.Read.All',
            'InformationProtectionPolicy.Read.All'
        ]
    };
}

/**
 * Gets the OpenAI configuration
 * @returns {Object} OpenAI configuration object
 */
export function getOpenAIConfig() {
    const config = getConfig() || getDefaultConfig();
    return config.openai;
}

/**
 * Gets analysis thresholds and settings
 * @returns {Object} Analysis configuration object
 */
export function getAnalysisConfig() {
    const config = getConfig() || getDefaultConfig();
    return config.analysis;
}

/**
 * Gets UI configuration
 * @returns {Object} UI configuration object
 */
export function getUIConfig() {
    const config = getConfig() || getDefaultConfig();
    return config.ui;
}

/**
 * Checks if the application is properly configured
 * @returns {boolean} True if configured, false otherwise
 */
export function isConfigured() {
    const config = getConfig();
    return config && config.azure.clientId && config.azure.clientId !== 'YOUR_CLIENT_ID_HERE';
}

/**
 * Updates configuration at runtime (for testing purposes)
 * @param {Object} newConfig - Partial configuration to merge
 */
export function updateConfig(newConfig) {
    if (appConfig) {
        appConfig = { ...appConfig, ...newConfig };
    }
}
