/**
 * Schema Validator for AgentAnalyzer
 * Validates agent manifests against known schemas
 */

/**
 * Known schema versions and their required fields
 */
const SCHEMA_DEFINITIONS = {
    'manifest': {
        required: ['$schema', 'version', 'name', 'description'],
        optional: ['icons', 'copilotAgents', 'developer', 'packageName']
    },
    'declarativeAgent_1.0': {
        required: ['$schema', 'name', 'description'],
        optional: ['instructions', 'capabilities', 'conversation_starters', 'actions']
    },
    'declarativeAgent_1.2': {
        required: ['$schema', 'name', 'description'],
        optional: ['version', 'instructions', 'capabilities', 'conversation_starters', 'actions']
    },
    'declarativeAgent_1.5': {
        required: ['$schema', 'name', 'description'],
        optional: ['version', 'instructions', 'capabilities', 'conversation_starters', 'conversationStarters', 'actions']
    }
};

/**
 * Validates a manifest.json file
 * @param {Object} manifest - Parsed manifest object
 * @returns {Object} Validation result
 */
export function validateManifest(manifest) {
    return validateAgainstSchema(manifest, 'manifest');
}

/**
 * Validates a declarative agent JSON file
 * @param {Object} agentConfig - Parsed agent config object
 * @returns {Object} Validation result
 */
export function validateDeclarativeAgent(agentConfig) {
    // Determine schema version
    const schemaVersion = extractSchemaVersion(agentConfig.$schema);
    const schemaKey = `declarativeAgent_${schemaVersion || '1.0'}`;

    // Use closest matching schema
    const schema = SCHEMA_DEFINITIONS[schemaKey] || SCHEMA_DEFINITIONS['declarativeAgent_1.0'];

    return validateAgainstSchema(agentConfig, schemaKey, schema);
}

/**
 * Validates an object against a schema definition
 * @param {Object} obj - Object to validate
 * @param {string} schemaName - Schema name for error messages
 * @param {Object} schema - Schema definition (optional, looks up by name)
 * @returns {Object} Validation result
 */
function validateAgainstSchema(obj, schemaName, schema = null) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
        schemaName: schemaName
    };

    if (!obj) {
        result.isValid = false;
        result.errors.push('Object is null or undefined');
        return result;
    }

    schema = schema || SCHEMA_DEFINITIONS[schemaName];

    if (!schema) {
        result.warnings.push(`Unknown schema: ${schemaName}`);
        return result;
    }

    // Check required fields
    for (const field of schema.required || []) {
        if (!(field in obj)) {
            result.isValid = false;
            result.errors.push(`Missing required field: ${field}`);
        } else if (obj[field] === null || obj[field] === undefined || obj[field] === '') {
            result.warnings.push(`Required field is empty: ${field}`);
        }
    }

    // Check for unknown fields (informational)
    const knownFields = [...(schema.required || []), ...(schema.optional || [])];
    for (const field of Object.keys(obj)) {
        if (!knownFields.includes(field) && !field.startsWith('$')) {
            result.warnings.push(`Unknown field: ${field}`);
        }
    }

    return result;
}

/**
 * Extracts schema version from schema URL
 * @param {string} schemaUrl - The schema URL
 * @returns {string|null} Version string
 */
function extractSchemaVersion(schemaUrl) {
    if (!schemaUrl) return null;

    // Match patterns like "v1.5", "1.5", or "-1.5"
    const patterns = [
        /v(\d+\.\d+)/i,
        /-(\d+\.\d+)/,
        /\/(\d+\.\d+)\//
    ];

    for (const pattern of patterns) {
        const match = schemaUrl.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

/**
 * Validates JSON syntax
 * @param {string} jsonString - JSON string to validate
 * @returns {Object} Validation result with parsed object if valid
 */
export function validateJsonSyntax(jsonString) {
    const result = {
        isValid: false,
        parsed: null,
        error: null,
        line: null,
        column: null
    };

    try {
        result.parsed = JSON.parse(jsonString);
        result.isValid = true;
    } catch (error) {
        result.error = error.message;

        // Try to extract line/column from error message
        const posMatch = error.message.match(/position (\d+)/);
        if (posMatch) {
            const position = parseInt(posMatch[1], 10);
            const { line, column } = getLineColumn(jsonString, position);
            result.line = line;
            result.column = column;
        }
    }

    return result;
}

/**
 * Gets line and column from character position
 * @param {string} text - The text
 * @param {number} position - Character position
 * @returns {Object} Line and column numbers
 */
function getLineColumn(text, position) {
    const lines = text.substring(0, position).split('\n');
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1
    };
}

/**
 * Validates OpenAPI specification
 * @param {Object} spec - Parsed OpenAPI spec
 * @returns {Object} Validation result
 */
export function validateOpenApiSpec(spec) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
        version: null
    };

    if (!spec) {
        result.isValid = false;
        result.errors.push('Specification is null or undefined');
        return result;
    }

    // Check for OpenAPI or Swagger version
    if (spec.openapi) {
        result.version = spec.openapi;
        if (!spec.openapi.startsWith('3.')) {
            result.warnings.push(`OpenAPI version ${spec.openapi} may not be fully supported`);
        }
    } else if (spec.swagger) {
        result.version = spec.swagger;
        result.warnings.push('Swagger 2.0 detected. Consider upgrading to OpenAPI 3.0');
    } else {
        result.isValid = false;
        result.errors.push('Missing openapi or swagger version field');
    }

    // Check required fields
    if (!spec.info) {
        result.isValid = false;
        result.errors.push('Missing info section');
    } else {
        if (!spec.info.title) {
            result.errors.push('Missing info.title');
        }
        if (!spec.info.version) {
            result.errors.push('Missing info.version');
        }
    }

    // Check paths
    if (!spec.paths || Object.keys(spec.paths).length === 0) {
        result.warnings.push('No paths defined');
    }

    return result;
}

/**
 * Validates capabilities array
 * @param {Array} capabilities - Capabilities array
 * @returns {Object} Validation result
 */
export function validateCapabilities(capabilities) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
        capabilities: []
    };

    if (!Array.isArray(capabilities)) {
        result.isValid = false;
        result.errors.push('Capabilities must be an array');
        return result;
    }

    const knownCapabilities = [
        'OneDriveAndSharePoint',
        'GraphConnectors',
        'WebSearch',
        'CodeInterpreter',
        'ImageGenerator'
    ];

    for (let i = 0; i < capabilities.length; i++) {
        const cap = capabilities[i];
        const capInfo = {
            index: i,
            name: cap.name || 'Unknown',
            isValid: true,
            errors: []
        };

        if (!cap.name && !cap.items_by_sharepoint_ids && !cap.items_by_url && !cap.connections) {
            capInfo.isValid = false;
            capInfo.errors.push('Capability has no identifiable type');
        }

        if (cap.name && !knownCapabilities.includes(cap.name)) {
            result.warnings.push(`Unknown capability type: ${cap.name}`);
        }

        result.capabilities.push(capInfo);
    }

    return result;
}
