/**
 * Agent Details Component for AgentAnalyzer
 * Displays agent information and properties
 */

import { AgentType } from '../services/agent-parser.js';
import { getUIConfig } from '../config.js';

// DOM Elements
let agentTypeBadge = null;
let agentNameElement = null;
let agentDescriptionElement = null;
let instructionsToggle = null;
let instructionsContent = null;
let agentInstructions = null;
let agentPropertiesElement = null;
let starterPromptsSection = null;
let starterPromptsElement = null;

/**
 * Initializes the agent details component
 * @param {Object} elements - Object containing DOM element references
 */
export function initAgentDetails(elements) {
    agentTypeBadge = elements.agentTypeBadge;
    agentNameElement = elements.agentName;
    agentDescriptionElement = elements.agentDescription;
    instructionsToggle = elements.instructionsToggle;
    instructionsContent = elements.instructionsContent;
    agentInstructions = elements.agentInstructions;
    agentPropertiesElement = elements.agentProperties;
    starterPromptsSection = elements.starterPromptsSection;
    starterPromptsElement = elements.starterPrompts;

    // Setup instructions toggle
    if (instructionsToggle) {
        instructionsToggle.addEventListener('click', toggleInstructions);
    }
}

/**
 * Renders the agent details from parsed information
 * @param {Object} agentInfo - The parsed agent information
 */
export function renderAgentDetails(agentInfo) {
    if (!agentInfo) {
        renderError('Unable to parse agent information');
        return;
    }

    // Agent type badge
    renderAgentType(agentInfo.type);

    // Agent name
    const name = agentInfo.agentName || agentInfo.name || 'Unnamed Agent';
    agentNameElement.textContent = name;

    // Description
    const description = agentInfo.agentDescription || agentInfo.description || 'No description available';
    agentDescriptionElement.textContent = description;

    // Instructions
    renderInstructions(agentInfo.instructions);

    // Properties
    renderProperties(agentInfo);

    // Starter prompts
    renderStarterPrompts(agentInfo.conversationStarters);
}

/**
 * Renders the agent type badge
 * @param {string} type - The agent type
 */
function renderAgentType(type) {
    agentTypeBadge.className = 'agent-type-badge';

    switch (type) {
        case AgentType.DECLARATIVE:
            agentTypeBadge.classList.add('da');
            agentTypeBadge.textContent = 'Declarative Agent';
            break;
        case AgentType.CUSTOM:
            agentTypeBadge.classList.add('ca');
            agentTypeBadge.textContent = 'Custom Agent';
            break;
        default:
            agentTypeBadge.textContent = 'Unknown Type';
    }
}

/**
 * Renders the agent instructions
 * @param {string} instructions - The instructions text
 */
function renderInstructions(instructions) {
    if (!instructions) {
        agentInstructions.textContent = 'No instructions defined';
    } else {
        agentInstructions.textContent = instructions;
    }

    // Always show expanded by default
    instructionsContent.classList.remove('collapsed');
}

/**
 * Toggles the instructions expansion
 */
function toggleInstructions() {
    instructionsContent.classList.toggle('collapsed');

    const expandBtn = instructionsToggle.querySelector('.expand-btn');
    if (expandBtn) {
        expandBtn.classList.toggle('expanded');
    }
}

/**
 * Renders agent properties (capabilities and settings)
 * @param {Object} agentInfo - The parsed agent information
 */
function renderProperties(agentInfo) {
    agentPropertiesElement.innerHTML = '';

    // Add capabilities as chips
    if (agentInfo.capabilities && agentInfo.capabilities.length > 0) {
        for (const cap of agentInfo.capabilities) {
            const chip = createPropertyChip(cap.type, true);
            agentPropertiesElement.appendChild(chip);
        }
    }

    // Add boolean properties
    if (agentInfo.properties) {
        for (const [key, prop] of Object.entries(agentInfo.properties)) {
            if (prop.type === 'boolean') {
                const displayName = formatPropertyName(key);
                const chip = createPropertyChip(displayName, prop.value);
                agentPropertiesElement.appendChild(chip);
            }
        }
    }

    // Add schema version if available
    if (agentInfo.schemaVersion) {
        const chip = createPropertyChip(`Schema v${agentInfo.schemaVersion}`, true, 'info');
        agentPropertiesElement.appendChild(chip);
    }

    // Show message if no properties
    if (agentPropertiesElement.children.length === 0) {
        agentPropertiesElement.innerHTML = '<span class="no-properties">No properties configured</span>';
    }
}

/**
 * Creates a property chip element
 * @param {string} label - The chip label
 * @param {boolean} enabled - Whether the property is enabled
 * @param {string} variant - Optional variant class
 * @returns {HTMLElement} The chip element
 */
function createPropertyChip(label, enabled, variant = null) {
    const chip = document.createElement('span');
    chip.className = `property-chip ${enabled ? 'enabled' : 'disabled'}`;

    if (variant) {
        chip.classList.add(variant);
    }

    // Icon based on state
    const icon = enabled ? getCheckIcon() : getCrossIcon();
    chip.innerHTML = `${icon}<span>${label}</span>`;

    return chip;
}

/**
 * Renders starter prompts / conversation starters
 * @param {Array} starters - Array of conversation starters
 */
function renderStarterPrompts(starters) {
    starterPromptsElement.innerHTML = '';

    if (!starters || starters.length === 0) {
        starterPromptsSection.style.display = 'none';
        return;
    }

    starterPromptsSection.style.display = 'block';

    for (const starter of starters) {
        const item = document.createElement('div');
        item.className = 'starter-prompt-item';

        const text = starter.text || starter.title || '';
        const title = starter.title || '';

        if (title && title !== text) {
            item.innerHTML = `<strong>${escapeHtml(title)}</strong>: ${escapeHtml(text)}`;
        } else {
            item.textContent = text;
        }

        starterPromptsElement.appendChild(item);
    }
}

/**
 * Renders an error state
 * @param {string} message - Error message
 */
function renderError(message) {
    agentTypeBadge.className = 'agent-type-badge';
    agentTypeBadge.textContent = 'Error';
    agentNameElement.textContent = 'Unable to Load';
    agentDescriptionElement.textContent = message;
    agentInstructions.textContent = '-';
    agentPropertiesElement.innerHTML = '';
    starterPromptsSection.style.display = 'none';
}

/**
 * Clears all agent details
 */
export function clearAgentDetails() {
    agentTypeBadge.className = 'agent-type-badge';
    agentTypeBadge.textContent = 'Loading...';
    agentNameElement.textContent = 'Agent Name';
    agentDescriptionElement.textContent = '-';
    agentInstructions.textContent = '-';
    agentPropertiesElement.innerHTML = '';
    starterPromptsSection.style.display = 'none';
}

/**
 * Formats a property name for display
 * @param {string} name - The property name (camelCase or snake_case)
 * @returns {string} Formatted display name
 */
function formatPropertyName(name) {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

/**
 * Gets the check icon SVG
 * @returns {string} SVG markup
 */
function getCheckIcon() {
    return `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
    </svg>`;
}

/**
 * Gets the cross icon SVG
 * @returns {string} SVG markup
 */
function getCrossIcon() {
    return `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>`;
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
