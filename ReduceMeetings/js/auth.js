/**
 * Authentication Module
 *
 * Handles Microsoft authentication using MSAL.js 2.x
 */

import CONFIG from './config.js';

// Login request configuration
const loginRequest = {
    scopes: CONFIG.auth.scopes
};

// Token request configuration
const tokenRequest = {
    scopes: CONFIG.auth.scopes
};

/**
 * Build MSAL configuration (called at runtime when msal is available)
 */
function buildMsalConfig() {
    return {
        auth: {
            clientId: CONFIG.auth.clientId,
            authority: CONFIG.auth.authority,
            redirectUri: CONFIG.auth.redirectUri,
            postLogoutRedirectUri: CONFIG.auth.redirectUri,
            navigateToLoginRequestUrl: true
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
                            console.error('[MSAL]', message);
                            break;
                        case msal.LogLevel.Warning:
                            console.warn('[MSAL]', message);
                            break;
                        case msal.LogLevel.Info:
                            console.info('[MSAL]', message);
                            break;
                        case msal.LogLevel.Verbose:
                            console.debug('[MSAL]', message);
                            break;
                    }
                },
                logLevel: msal.LogLevel.Warning
            }
        }
    };
}

class AuthManager {
    constructor() {
        this.msalInstance = null;
        this.account = null;
        this.initialized = false;
    }

    /**
     * Initialize MSAL instance
     */
    async initialize() {
        if (this.initialized) return;

        // Wait for MSAL to be available (loaded from CDN)
        if (typeof msal === 'undefined') {
            await new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 100; // 5 seconds max
                const check = setInterval(() => {
                    attempts++;
                    if (typeof msal !== 'undefined') {
                        clearInterval(check);
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(check);
                        reject(new Error('MSAL library failed to load. Check your internet connection.'));
                    }
                }, 50);
            });
        }

        try {
            // Create MSAL instance
            const msalConfig = buildMsalConfig();
            this.msalInstance = new msal.PublicClientApplication(msalConfig);

            // Handle redirect promise (for redirect flow)
            const response = await this.msalInstance.handleRedirectPromise();

            if (response) {
                this.account = response.account;
                console.log('Login successful via redirect');
            } else {
                // Check for existing accounts
                const accounts = this.msalInstance.getAllAccounts();
                if (accounts.length > 0) {
                    this.account = accounts[0];
                    console.log('Found existing account');
                }
            }

            this.initialized = true;
        } catch (error) {
            console.error('MSAL initialization error:', error);
            throw error;
        }
    }

    /**
     * Sign in the user using popup
     */
    async signIn() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const response = await this.msalInstance.loginPopup(loginRequest);
            this.account = response.account;
            console.log('Login successful');
            return this.account;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Sign in using redirect (alternative to popup)
     */
    async signInRedirect() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            await this.msalInstance.loginRedirect(loginRequest);
        } catch (error) {
            console.error('Login redirect error:', error);
            throw error;
        }
    }

    /**
     * Sign out the user
     */
    async signOut() {
        if (!this.msalInstance) return;

        try {
            // Clear local data
            this.account = null;

            // Logout using popup to avoid full page redirect
            await this.msalInstance.logoutPopup({
                account: this.msalInstance.getActiveAccount(),
                postLogoutRedirectUri: CONFIG.auth.redirectUri
            });
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    /**
     * Get access token for Graph API
     */
    async getAccessToken() {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.account) {
            throw new Error('No account found. Please sign in first.');
        }

        const request = {
            ...tokenRequest,
            account: this.account
        };

        try {
            // Try to get token silently first
            const response = await this.msalInstance.acquireTokenSilent(request);
            return response.accessToken;
        } catch (error) {
            // If silent token acquisition fails, try popup
            if (error instanceof msal.InteractionRequiredAuthError) {
                console.log('Silent token acquisition failed, trying popup');
                const response = await this.msalInstance.acquireTokenPopup(request);
                return response.accessToken;
            }
            throw error;
        }
    }

    /**
     * Check if user is signed in
     */
    isSignedIn() {
        return this.account !== null;
    }

    /**
     * Get current account info
     */
    getAccount() {
        return this.account;
    }

    /**
     * Get user display name
     */
    getUserName() {
        return this.account?.name || this.account?.username || 'User';
    }

    /**
     * Get user email
     */
    getUserEmail() {
        return this.account?.username || '';
    }
}

// Export singleton instance
const authManager = new AuthManager();
export default authManager;
