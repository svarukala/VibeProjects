/**
 * MSAL Authentication Module for AgentAnalyzer
 * Handles Microsoft 365 authentication using MSAL.js
 */

import { getMsalConfig, getGraphScopes, isConfigured } from '../config.js';

let msalInstance = null;
let currentAccount = null;

/**
 * Initializes the MSAL instance
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initializeMsal() {
    // Check if MSAL library is loaded
    if (typeof msal === 'undefined') {
        const isFileProtocol = window.location.protocol === 'file:';

        if (isFileProtocol) {
            console.error('MSAL library not loaded. You are using file:// protocol. Please run from a web server (http://localhost).');
        } else {
            console.error('MSAL library not loaded. CDN may be blocked or unavailable.');
            console.info('Check if your network/firewall blocks: alcdn.msauth.net');
        }
        return false;
    }

    if (!isConfigured()) {
        console.warn('MSAL not configured. Sign-in will be disabled.');
        return false;
    }

    try {
        const msalConfig = getMsalConfig();
        msalInstance = new msal.PublicClientApplication(msalConfig);

        // Handle redirect response
        const response = await msalInstance.handleRedirectPromise();
        if (response) {
            currentAccount = response.account;
            return true;
        }

        // Check for existing accounts
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            currentAccount = accounts[0];
            return true;
        }

        return true;
    } catch (error) {
        console.error('MSAL initialization error:', error);
        return false;
    }
}

/**
 * Signs in the user using popup method
 * @param {string[]} scopes - The scopes to request
 * @returns {Promise<Object|null>} The account object or null if failed
 */
export async function signIn(scopes = null) {
    if (!msalInstance) {
        const isFileProtocol = window.location.protocol === 'file:';
        if (isFileProtocol) {
            throw new Error('Sign-in requires a web server. Please run from http://localhost instead of opening the file directly.');
        } else if (typeof msal === 'undefined') {
            throw new Error('MSAL library failed to load. Check if your network/firewall blocks CDN access (alcdn.msauth.net, cdn.jsdelivr.net).');
        } else {
            throw new Error('MSAL not initialized. Please ensure Azure AD is configured in config/app-config.json with valid clientId and tenantId.');
        }
    }

    const loginScopes = scopes || getGraphScopes().basic;

    try {
        const response = await msalInstance.loginPopup({
            scopes: loginScopes,
            prompt: 'select_account'
        });
        currentAccount = response.account;
        return currentAccount;
    } catch (error) {
        console.error('Sign-in error:', error);
        if (error.errorCode === 'user_cancelled') {
            return null;
        }
        throw error;
    }
}

/**
 * Signs out the current user
 * @returns {Promise<void>}
 */
export async function signOut() {
    if (!msalInstance || !currentAccount) {
        return;
    }

    try {
        await msalInstance.logoutPopup({
            account: currentAccount
        });
        currentAccount = null;
    } catch (error) {
        console.error('Sign-out error:', error);
        // Clear account anyway
        currentAccount = null;
    }
}

/**
 * Gets an access token for the specified scopes
 * @param {string[]} scopes - The scopes to request
 * @returns {Promise<string|null>} The access token or null if failed
 */
export async function getAccessToken(scopes) {
    if (!msalInstance) {
        console.error('MSAL not initialized');
        return null;
    }

    if (!currentAccount) {
        console.error('No account signed in');
        return null;
    }

    const tokenRequest = {
        scopes: scopes,
        account: currentAccount
    };

    try {
        // Try silent token acquisition first
        const response = await msalInstance.acquireTokenSilent(tokenRequest);
        return response.accessToken;
    } catch (error) {
        if (error instanceof msal.InteractionRequiredAuthError) {
            // Fall back to interactive method
            try {
                const response = await msalInstance.acquireTokenPopup(tokenRequest);
                return response.accessToken;
            } catch (popupError) {
                console.error('Token acquisition error:', popupError);
                return null;
            }
        }
        console.error('Token acquisition error:', error);
        return null;
    }
}

/**
 * Gets an access token for SharePoint operations
 * @returns {Promise<string|null>} The access token or null if failed
 */
export async function getSharePointToken() {
    return getAccessToken(getGraphScopes().sharePoint);
}

/**
 * Gets an access token for full Graph API access
 * @returns {Promise<string|null>} The access token or null if failed
 */
export async function getFullAccessToken() {
    return getAccessToken(getGraphScopes().fullAccess);
}

/**
 * Checks if a user is currently signed in
 * @returns {boolean} True if signed in
 */
export function isSignedIn() {
    return currentAccount !== null;
}

/**
 * Gets the current signed-in account
 * @returns {Object|null} The current account or null
 */
export function getCurrentAccount() {
    return currentAccount;
}

/**
 * Gets the display name of the current user
 * @returns {string|null} The user's display name or null
 */
export function getUserDisplayName() {
    if (!currentAccount) {
        return null;
    }
    return currentAccount.name || currentAccount.username;
}

/**
 * Gets the email of the current user
 * @returns {string|null} The user's email or null
 */
export function getUserEmail() {
    if (!currentAccount) {
        return null;
    }
    return currentAccount.username;
}

/**
 * Requests additional scopes (consent) for a signed-in user
 * @param {string[]} scopes - Additional scopes to request
 * @returns {Promise<boolean>} True if consent was granted
 */
export async function requestConsent(scopes) {
    if (!msalInstance || !currentAccount) {
        return false;
    }

    try {
        await msalInstance.acquireTokenPopup({
            scopes: scopes,
            account: currentAccount
        });
        return true;
    } catch (error) {
        console.error('Consent request error:', error);
        return false;
    }
}

/**
 * Gets the MSAL instance (for advanced use cases)
 * @returns {Object|null} The MSAL instance
 */
export function getMsalInstance() {
    return msalInstance;
}
