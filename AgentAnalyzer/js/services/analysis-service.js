/**
 * Analysis Service for AgentAnalyzer
 * Handles AI-powered analysis using OpenAI
 */

import { getOpenAIConfig } from '../config.js';

/**
 * Recommendation severity levels
 */
export const Severity = {
    CRITICAL: 'critical',
    WARNING: 'warning',
    SUGGESTION: 'suggestion',
    SUCCESS: 'success'
};

/**
 * Analyzes the agent instructions against best practices
 * @param {Object} agentInfo - The parsed agent information
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeAgent(agentInfo) {
    const results = {
        timestamp: new Date().toISOString(),
        recommendations: [],
        summary: null
    };

    // Perform local analysis first
    const localAnalysis = performLocalAnalysis(agentInfo);
    results.recommendations.push(...localAnalysis);

    // Perform AI analysis if configured
    const aiAnalysis = await performAIAnalysis(agentInfo);
    if (aiAnalysis) {
        results.recommendations.push(...aiAnalysis);
    }

    // Generate summary
    results.summary = generateSummary(results.recommendations);

    return results;
}

/**
 * Performs local rule-based analysis
 * @param {Object} agentInfo - The parsed agent information
 * @returns {Array} Array of recommendations
 */
function performLocalAnalysis(agentInfo) {
    const recommendations = [];

    // Check instructions
    if (agentInfo.instructions) {
        const instructionsAnalysis = analyzeInstructions(agentInfo.instructions);
        recommendations.push(...instructionsAnalysis);
    } else {
        recommendations.push({
            severity: Severity.CRITICAL,
            category: 'Instructions',
            title: 'Missing Instructions',
            description: 'No instructions found for the agent. Instructions are essential for defining agent behavior.',
            suggestion: 'Add clear, specific instructions that define the agent\'s purpose and behavior.'
        });
    }

    // Check description
    if (agentInfo.agentDescription || agentInfo.description) {
        const desc = agentInfo.agentDescription || agentInfo.description;
        const descAnalysis = analyzeDescription(desc);
        recommendations.push(...descAnalysis);
    } else {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'Description',
            title: 'Missing Description',
            description: 'No description found for the agent.',
            suggestion: 'Add a clear description that explains what the agent does.'
        });
    }

    // Check conversation starters
    if (agentInfo.conversationStarters && agentInfo.conversationStarters.length > 0) {
        const startersAnalysis = analyzeConversationStarters(agentInfo.conversationStarters);
        recommendations.push(...startersAnalysis);
    } else {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Starter Prompts',
            title: 'No Conversation Starters',
            description: 'No starter prompts defined for the agent.',
            suggestion: 'Add 3-5 conversation starters to help users understand how to interact with the agent.'
        });
    }

    // Check capabilities
    if (agentInfo.capabilities) {
        const capAnalysis = analyzeCapabilities(agentInfo.capabilities);
        recommendations.push(...capAnalysis);
    }

    return recommendations;
}

/**
 * Analyzes agent instructions
 * @param {string} instructions - The instructions text
 * @returns {Array} Array of recommendations
 */
function analyzeInstructions(instructions) {
    const recommendations = [];
    const length = instructions.length;

    // Check length
    if (length < 100) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'Instructions',
            title: 'Instructions Too Short',
            description: `Instructions are only ${length} characters. Short instructions may not provide enough guidance.`,
            suggestion: 'Expand instructions to include specific behaviors, response formats, and edge cases.'
        });
    } else if (length > 8000) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'Instructions',
            title: 'Instructions Very Long',
            description: `Instructions are ${length} characters. Very long instructions may be difficult to follow.`,
            suggestion: 'Consider condensing instructions or prioritizing key behaviors.'
        });
    } else {
        recommendations.push({
            severity: Severity.SUCCESS,
            category: 'Instructions',
            title: 'Instructions Length Appropriate',
            description: `Instructions length (${length} characters) is within recommended range.`
        });
    }

    // Check for key elements
    const keyElements = [
        { pattern: /role|persona|act as/i, name: 'Role Definition' },
        { pattern: /scope|limitation|boundary/i, name: 'Scope Definition' },
        { pattern: /format|response|output/i, name: 'Response Format' },
        { pattern: /don't|do not|never|avoid/i, name: 'Restrictions' },
        { pattern: /example|such as|like/i, name: 'Examples' }
    ];

    const missingElements = [];
    for (const element of keyElements) {
        if (!element.pattern.test(instructions)) {
            missingElements.push(element.name);
        }
    }

    if (missingElements.length > 0) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Instructions',
            title: 'Consider Adding Key Elements',
            description: `Instructions may be missing: ${missingElements.join(', ')}.`,
            suggestion: 'Best practice instructions typically include role definition, scope, response format, restrictions, and examples.'
        });
    }

    // Check for vague language
    const vaguePatterns = [
        /be helpful/i,
        /do your best/i,
        /try to/i,
        /if possible/i,
        /might|maybe|perhaps/i
    ];

    const vagueMatches = vaguePatterns.filter(p => p.test(instructions));
    if (vagueMatches.length > 2) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Instructions',
            title: 'Vague Language Detected',
            description: 'Instructions contain vague language that may lead to inconsistent behavior.',
            suggestion: 'Use specific, actionable language. Instead of "try to be helpful", specify exact behaviors.'
        });
    }

    return recommendations;
}

/**
 * Analyzes agent description
 * @param {string} description - The description text
 * @returns {Array} Array of recommendations
 */
function analyzeDescription(description) {
    const recommendations = [];
    const length = description.length;

    if (length < 20) {
        recommendations.push({
            severity: Severity.WARNING,
            category: 'Description',
            title: 'Description Too Short',
            description: 'The agent description is very brief.',
            suggestion: 'Add a more detailed description explaining the agent\'s purpose and capabilities.'
        });
    } else if (length > 500) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Description',
            title: 'Description May Be Too Long',
            description: 'Consider if the description can be more concise.',
            suggestion: 'Keep descriptions focused on the main purpose. Move details to instructions.'
        });
    } else {
        recommendations.push({
            severity: Severity.SUCCESS,
            category: 'Description',
            title: 'Description Length Appropriate',
            description: 'Description length is within recommended range.'
        });
    }

    return recommendations;
}

/**
 * Analyzes conversation starters
 * @param {Array} starters - Array of conversation starters
 * @returns {Array} Array of recommendations
 */
function analyzeConversationStarters(starters) {
    const recommendations = [];

    if (starters.length < 3) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Starter Prompts',
            title: 'Few Conversation Starters',
            description: `Only ${starters.length} starter prompt(s) defined.`,
            suggestion: 'Add at least 3-5 conversation starters to showcase different agent capabilities.'
        });
    } else if (starters.length > 6) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Starter Prompts',
            title: 'Many Conversation Starters',
            description: `${starters.length} starters defined. Too many options may overwhelm users.`,
            suggestion: 'Consider reducing to 4-6 of the most important conversation starters.'
        });
    } else {
        recommendations.push({
            severity: Severity.SUCCESS,
            category: 'Starter Prompts',
            title: 'Good Number of Starters',
            description: `${starters.length} conversation starters defined.`
        });
    }

    // Check for variety
    const texts = starters.map(s => (s.text || s.title || '').toLowerCase());
    const hasSimilar = texts.some((t, i) =>
        texts.some((t2, j) => i !== j && (t.includes(t2) || t2.includes(t)))
    );

    if (hasSimilar) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Starter Prompts',
            title: 'Similar Starters Detected',
            description: 'Some conversation starters appear similar.',
            suggestion: 'Ensure each starter demonstrates a different capability or use case.'
        });
    }

    return recommendations;
}

/**
 * Analyzes agent capabilities
 * @param {Array} capabilities - Array of capabilities
 * @returns {Array} Array of recommendations
 */
function analyzeCapabilities(capabilities) {
    const recommendations = [];

    // Check for SharePoint with Excel files but no Code Interpreter
    const hasSharePoint = capabilities.some(c => c.type === 'SharePoint');
    const hasCodeInterpreter = capabilities.some(c => c.type === 'CodeInterpreter');

    if (hasSharePoint && !hasCodeInterpreter) {
        recommendations.push({
            severity: Severity.SUGGESTION,
            category: 'Capabilities',
            title: 'Consider Code Interpreter',
            description: 'SharePoint capability is enabled. If your knowledge sources contain Excel files, Code Interpreter is recommended.',
            suggestion: 'Enable Code Interpreter capability for Excel data analysis.'
        });
    }

    return recommendations;
}

/**
 * Performs AI-powered analysis using OpenAI
 * @param {Object} agentInfo - The parsed agent information
 * @returns {Promise<Array|null>} Array of recommendations or null
 */
async function performAIAnalysis(agentInfo) {
    const config = getOpenAIConfig();

    if (!config.endpoint || !config.apiKey) {
        return null;
    }

    const prompt = buildAnalysisPrompt(agentInfo);

    try {
        const response = await fetch(`${config.endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    {
                        role: 'system',
                        content: getSystemPrompt()
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: config.maxTokens,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            console.error('OpenAI API error:', response.status);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (content) {
            return parseAIResponse(content);
        }
    } catch (error) {
        console.error('AI analysis error:', error);
    }

    return null;
}

/**
 * Gets the system prompt for AI analysis
 * @returns {string} System prompt
 */
function getSystemPrompt() {
    return `You are an expert in Microsoft 365 Copilot agent development. Analyze the provided agent configuration and provide specific, actionable recommendations based on best practices from:
- Microsoft Declarative Agent Instructions Guide
- Microsoft Copilot Studio Generative Mode Guidance
- Microsoft Copilot Studio Authoring Instructions

Return your analysis as a JSON array of recommendation objects with this structure:
{
    "severity": "critical|warning|suggestion",
    "category": "Category Name",
    "title": "Short Title",
    "description": "Detailed description of the issue",
    "suggestion": "Specific actionable recommendation"
}

Focus on:
1. Instructions clarity and completeness
2. Description quality
3. Starter prompts effectiveness
4. Overall agent design best practices`;
}

/**
 * Builds the analysis prompt for AI
 * @param {Object} agentInfo - The parsed agent information
 * @returns {string} Analysis prompt
 */
function buildAnalysisPrompt(agentInfo) {
    return `Analyze this Microsoft 365 Copilot Declarative Agent configuration:

Agent Name: ${agentInfo.agentName || agentInfo.name || 'Unknown'}

Description: ${agentInfo.agentDescription || agentInfo.description || 'None provided'}

Instructions:
${agentInfo.instructions || 'None provided'}

Conversation Starters:
${JSON.stringify(agentInfo.conversationStarters || [], null, 2)}

Capabilities: ${agentInfo.capabilities?.map(c => c.type).join(', ') || 'None'}

Please analyze and provide recommendations in JSON format.`;
}

/**
 * Parses the AI response into recommendation objects
 * @param {string} content - The AI response content
 * @returns {Array} Array of recommendations
 */
function parseAIResponse(content) {
    try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const recommendations = JSON.parse(jsonMatch[0]);
            // Validate and normalize recommendations
            return recommendations.map(r => ({
                severity: r.severity || Severity.SUGGESTION,
                category: r.category || 'AI Analysis',
                title: r.title || 'Recommendation',
                description: r.description || '',
                suggestion: r.suggestion || '',
                source: 'AI'
            }));
        }
    } catch (error) {
        console.error('Error parsing AI response:', error);
    }

    return [];
}

/**
 * Generates a summary of the analysis results
 * @param {Array} recommendations - Array of recommendations
 * @returns {Object} Summary object
 */
function generateSummary(recommendations) {
    const counts = {
        critical: 0,
        warning: 0,
        suggestion: 0,
        success: 0,
        total: recommendations.length
    };

    for (const rec of recommendations) {
        if (counts[rec.severity] !== undefined) {
            counts[rec.severity]++;
        }
    }

    let status = 'good';
    if (counts.critical > 0) {
        status = 'critical';
    } else if (counts.warning > 2) {
        status = 'needs-attention';
    } else if (counts.warning > 0) {
        status = 'minor-issues';
    }

    return {
        status,
        counts,
        message: getSummaryMessage(status, counts)
    };
}

/**
 * Gets a summary message based on status
 * @param {string} status - The status
 * @param {Object} counts - The counts object
 * @returns {string} Summary message
 */
function getSummaryMessage(status, counts) {
    switch (status) {
        case 'critical':
            return `Found ${counts.critical} critical issue(s) that should be addressed.`;
        case 'needs-attention':
            return `Found ${counts.warning} warning(s) that need attention.`;
        case 'minor-issues':
            return `Found ${counts.warning} minor issue(s) to consider.`;
        default:
            return 'Agent configuration looks good!';
    }
}

/**
 * Updates the OpenAI API key at runtime
 * @param {string} apiKey - The new API key
 */
export function setApiKey(apiKey) {
    const config = getOpenAIConfig();
    config.apiKey = apiKey;
}
