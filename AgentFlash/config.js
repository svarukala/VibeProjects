/**
 * Agent Flash - Configuration
 * API settings and default values
 */

const CONFIG = {
    // Claude API Settings
    claude: {
        defaultEndpoint: 'https://api.anthropic.com/v1/messages',
        defaultModel: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        anthropicVersion: '2023-06-01',
        models: [
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Recommended)' },
            { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
            { id: 'claude-haiku-3-5-20241022', name: 'Claude 3.5 Haiku' }
        ]
    },

    // OpenAI API Settings
    openai: {
        defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4o',
        maxTokens: 4096,
        models: [
            { id: 'gpt-4o', name: 'GPT-4o (Recommended)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
        ]
    },

    // Default provider
    defaultProvider: 'claude',

    // Flash Card Settings
    flashCards: {
        minCount: 5,
        maxCount: 25,
        defaultCount: 10,
        countOptions: [5, 10, 15, 20, 25]
    },

    // Storage Keys
    storageKeys: {
        apiProvider: 'agentflash_api_provider',
        claudeApiKey: 'agentflash_claude_api_key',
        claudeEndpoint: 'agentflash_claude_endpoint',
        claudeModel: 'agentflash_claude_model',
        openaiApiKey: 'agentflash_openai_api_key',
        openaiModel: 'agentflash_openai_model',
        sessions: 'agentflash_sessions',
        currentSession: 'agentflash_current_session'
    },

    // Score Messages
    scoreMessages: {
        excellent: { min: 90, message: "Excellent! You've mastered this topic!" },
        great: { min: 70, message: "Great job! You're getting there." },
        good: { min: 50, message: "Good effort! Review the cards you missed." },
        keepTrying: { min: 0, message: "Keep practicing! You'll improve with time." }
    },

    // Claude Prompt Template (with web search)
    getClaudePrompt: (topic, count) => `You are helping create educational flash cards. Use the web search tool to find current, accurate information about: "${topic}"

After searching, generate exactly ${count} flash cards with a variety of question types to make learning engaging and effective.

Requirements:
- Mix different question formats for variety:
  * Direct questions: "What is the capital of Virginia?" (Answer: Richmond)
  * Reverse questions: "Which state has Sacramento as its capital?" (Answer: California)
  * Yes/No questions: "Is Tokyo the capital of Japan?" (Answer: Yes)
  * True/False questions: "True or False: The Amazon is the longest river." (Answer: False, the Nile is)
  * Fill-in-the-blank style: "The chemical symbol for gold is ___?" (Answer: Au)
  * Single-word or short answers when appropriate
- Cover different aspects of the topic from basic to advanced
- Ensure factual accuracy based on your web search results
- Keep answers concise - single words, short phrases, or 1-2 sentences as appropriate for the question type

IMPORTANT: Respond with ONLY valid JSON in this exact format, no other text:
{
  "topic": "${topic}",
  "cards": [
    {"id": 1, "question": "What is...?", "answer": "Short answer"},
    {"id": 2, "question": "Which X has Y?", "answer": "Answer"}
  ]
}

Generate exactly ${count} cards with sequential IDs starting from 1.`,

    // OpenAI Prompt Template (no web search)
    getOpenAIPrompt: (topic, count) => `You are helping create educational flash cards about: "${topic}"

Generate exactly ${count} flash cards with a variety of question types to make learning engaging and effective.

Requirements:
- Mix different question formats for variety:
  * Direct questions: "What is the capital of Virginia?" (Answer: Richmond)
  * Reverse questions: "Which state has Sacramento as its capital?" (Answer: California)
  * Yes/No questions: "Is Tokyo the capital of Japan?" (Answer: Yes)
  * True/False questions: "True or False: The Amazon is the longest river." (Answer: False, the Nile is)
  * Fill-in-the-blank style: "The chemical symbol for gold is ___?" (Answer: Au)
  * Single-word or short answers when appropriate
- Cover different aspects of the topic from basic to advanced
- Ensure factual accuracy
- Keep answers concise - single words, short phrases, or 1-2 sentences as appropriate for the question type

You must respond with ONLY valid JSON in this exact format:
{
  "topic": "${topic}",
  "cards": [
    {"id": 1, "question": "What is...?", "answer": "Short answer"},
    {"id": 2, "question": "Which X has Y?", "answer": "Answer"}
  ]
}

Generate exactly ${count} cards with sequential IDs starting from 1.`
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.claude);
Object.freeze(CONFIG.openai);
Object.freeze(CONFIG.flashCards);
Object.freeze(CONFIG.storageKeys);
Object.freeze(CONFIG.scoreMessages);
