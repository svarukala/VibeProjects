/**
 * Deep Analysis Options Component for AgentAnalyzer
 * Manages the deep analysis checkboxes and triggers
 */

import { isSignedIn } from '../auth/msal-auth.js';
import { checkDeepAnalysisAvailability, DeepAnalysisOptions } from '../services/deep-analysis-service.js';

// DOM Elements
let chkSharepoint = null;
let chkCopilotConnectors = null;
let chkApiConnectors = null;
let deepAnalyzeBtn = null;
let signInRequired = null;

let onAnalyzeCallback = null;
let availability = null;

/**
 * Initializes the deep analysis options component
 * @param {Object} elements - Object containing DOM element references
 * @param {Function} onAnalyze - Callback when analyze button is clicked
 */
export function initDeepAnalysisOptions(elements, onAnalyze) {
    chkSharepoint = elements.chkSharepoint;
    chkCopilotConnectors = elements.chkCopilotConnectors;
    chkApiConnectors = elements.chkApiConnectors;
    deepAnalyzeBtn = elements.deepAnalyzeBtn;
    signInRequired = elements.signInRequired;
    onAnalyzeCallback = onAnalyze;

    setupEventListeners();
}

/**
 * Sets up event listeners
 */
function setupEventListeners() {
    // Checkbox change events
    [chkSharepoint, chkCopilotConnectors, chkApiConnectors].forEach(chk => {
        if (chk) {
            chk.addEventListener('change', updateAnalyzeButton);
        }
    });

    // Analyze button click
    if (deepAnalyzeBtn) {
        deepAnalyzeBtn.addEventListener('click', handleAnalyzeClick);
    }
}

/**
 * Updates the component based on authentication state and agent info
 * @param {Object} agentInfo - The parsed agent information
 */
export function updateDeepAnalysisState(agentInfo) {
    const signedIn = isSignedIn();

    // Check availability
    availability = checkDeepAnalysisAvailability(agentInfo);

    // Update sign-in hint visibility
    if (signInRequired) {
        signInRequired.style.display = signedIn ? 'none' : 'inline';
    }

    // Update SharePoint checkbox
    updateCheckbox(chkSharepoint, {
        enabled: signedIn && availability.sharepoint.available,
        available: availability.sharepoint.available,
        count: availability.sharepoint.count,
        reason: availability.sharepoint.reason,
        requiresSignIn: true,
        signedIn: signedIn
    });

    // Update Copilot Connectors checkbox
    updateCheckbox(chkCopilotConnectors, {
        enabled: signedIn && availability.copilotConnectors.available,
        available: availability.copilotConnectors.available,
        count: availability.copilotConnectors.count,
        reason: availability.copilotConnectors.reason,
        requiresSignIn: true,
        signedIn: signedIn
    });

    // Update API Connectors checkbox (doesn't require sign-in)
    updateCheckbox(chkApiConnectors, {
        enabled: availability.apiConnectors.available,
        available: availability.apiConnectors.available,
        count: availability.apiConnectors.count,
        reason: availability.apiConnectors.reason,
        requiresSignIn: false,
        signedIn: signedIn
    });

    // Update analyze button
    updateAnalyzeButton();
}

/**
 * Updates a checkbox based on state
 * @param {HTMLElement} checkbox - The checkbox element
 * @param {Object} state - State object
 */
function updateCheckbox(checkbox, state) {
    if (!checkbox) return;

    // Enable/disable based on availability and sign-in
    checkbox.disabled = !state.enabled;

    // Update tooltip
    if (!state.available) {
        checkbox.title = state.reason || 'Not available';
    } else if (state.requiresSignIn && !state.signedIn) {
        checkbox.title = 'Sign in required';
    } else {
        checkbox.title = state.count ? `${state.count} item(s) found` : '';
    }

    // Uncheck if disabled
    if (checkbox.disabled && checkbox.checked) {
        checkbox.checked = false;
    }
}

/**
 * Updates the analyze button state
 */
function updateAnalyzeButton() {
    if (!deepAnalyzeBtn) return;

    const anySelected =
        (chkSharepoint?.checked) ||
        (chkCopilotConnectors?.checked) ||
        (chkApiConnectors?.checked);

    deepAnalyzeBtn.disabled = !anySelected;
}

/**
 * Handles analyze button click
 */
function handleAnalyzeClick() {
    if (!onAnalyzeCallback) return;

    const options = {
        sharepoint: chkSharepoint?.checked || false,
        copilotConnectors: chkCopilotConnectors?.checked || false,
        apiConnectors: chkApiConnectors?.checked || false
    };

    onAnalyzeCallback(options);
}

/**
 * Gets the currently selected options
 * @returns {Object} Selected options object
 */
export function getSelectedOptions() {
    return {
        sharepoint: chkSharepoint?.checked || false,
        copilotConnectors: chkCopilotConnectors?.checked || false,
        apiConnectors: chkApiConnectors?.checked || false
    };
}

/**
 * Resets all checkboxes
 */
export function resetOptions() {
    if (chkSharepoint) {
        chkSharepoint.checked = false;
        chkSharepoint.disabled = true;
    }
    if (chkCopilotConnectors) {
        chkCopilotConnectors.checked = false;
        chkCopilotConnectors.disabled = true;
    }
    if (chkApiConnectors) {
        chkApiConnectors.checked = false;
        chkApiConnectors.disabled = true;
    }
    if (deepAnalyzeBtn) {
        deepAnalyzeBtn.disabled = true;
    }
}

/**
 * Disables all controls during analysis
 */
export function disableControls() {
    if (chkSharepoint) chkSharepoint.disabled = true;
    if (chkCopilotConnectors) chkCopilotConnectors.disabled = true;
    if (chkApiConnectors) chkApiConnectors.disabled = true;
    if (deepAnalyzeBtn) deepAnalyzeBtn.disabled = true;
}

/**
 * Re-enables controls after analysis (respecting availability)
 * @param {Object} agentInfo - The parsed agent information
 */
export function enableControls(agentInfo) {
    updateDeepAnalysisState(agentInfo);
}

/**
 * Gets the availability status
 * @returns {Object|null} Availability status
 */
export function getAvailability() {
    return availability;
}
