# Agent Flash - Project Plan

## Overview

Agent Flash is a single-page application (SPA) that enables users to create AI-generated flash cards on any topic for efficient learning. The app leverages the Claude API with web search capabilities to generate relevant, thought-provoking questions and answers.

---

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Storage**: LocalStorage for persistence
- **API**: Claude API (Anthropic) with web search tool
- **No frameworks** - Pure vanilla implementation for simplicity

---

## Project Structure

```
AgentFlash/
├── index.html          # Main HTML file (single page app)
├── css/
│   └── styles.css      # All styles (variables, components, animations)
├── js/
│   ├── app.js          # Main application entry point & state management
│   ├── api.js          # Claude API integration (configurable)
│   ├── flashcard.js    # Flash card component & logic
│   ├── storage.js      # LocalStorage operations
│   └── ui.js           # UI rendering & DOM manipulation
├── assets/
│   └── icons/          # SVG icons for UI elements
├── config.js           # API configuration (endpoint, model, etc.)
└── Claude.md           # This planning document
```

---

## Feature Breakdown

### 1. Landing Page / Home View

**Components:**
- App logo and title "Agent Flash"
- Topic input field (text input for custom topics)
- Suggested topic chips/buttons (optional quick-select)
- Flash card count dropdown (5, 10, 15, 20, 25)
- "Generate Flash Cards" button
- "View Past Sessions" button/link
- Settings icon for API configuration

**Behavior:**
- Validate topic is not empty before generating
- Show loading state while API generates cards
- Minimum 5 cards enforced via dropdown options

### 2. Flash Card Generation (API Integration)

**Claude API Configuration:**
```javascript
// config.js structure
const CONFIG = {
  apiKey: '',           // User-provided API key
  apiEndpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  useWebSearch: true    // Enable web search for current info
};
```

**Prompt Strategy:**
- Request Claude to search the web for the topic
- Generate N questions that test understanding (not just recall)
- Each question should have a clear, concise answer
- Format response as JSON array for easy parsing

**Response Format:**
```json
{
  "topic": "User's topic",
  "cards": [
    {
      "id": 1,
      "question": "Thought-provoking question here?",
      "answer": "Clear, educational answer here."
    }
  ]
}
```

### 3. Flash Card Study View

**Components:**
- Progress indicator (e.g., "Card 3 of 10")
- Flash card display area (large, centered)
- Card front: Question text
- Card back: Answer text
- Flip animation (3D CSS transform)
- "Correct" button (green)
- "Wrong" button (red)
- Navigation hint text

**Behavior:**
- Card starts showing question (front)
- User clicks/taps card to flip and reveal answer
- After flip, show Correct/Wrong buttons
- Track user's response
- Auto-advance to next card after selection
- Disable flip buttons until card is flipped

### 4. Score / Results View

**Components:**
- Session summary header
- Topic name display
- Score display (correct/total)
- Percentage and visual indicator (progress ring or bar)
- Performance message (based on score)
- List of cards with user's responses (expandable)
- "Study Again" button (same cards)
- "New Topic" button (return to home)
- "Save & Exit" (saves to history)

**Score Messages:**
- 90-100%: "Excellent! You've mastered this topic!"
- 70-89%: "Great job! You're getting there."
- 50-69%: "Good effort! Review the cards you missed."
- Below 50%: "Keep practicing! You'll improve."

### 5. History / Past Sessions View

**Components:**
- List of past study sessions
- Each item shows: Topic, Date, Score, Card count
- Click to expand and review cards
- "Study Again" option for each session
- "Delete" option for each session
- "Clear All History" with confirmation
- "Back to Home" button

**Sorting:**
- Most recent first (default)
- Option to sort by score or topic name

### 6. Settings Modal

**Components:**
- API Key input (password field with show/hide toggle)
- API Endpoint input (for custom endpoints)
- Model selection dropdown
- "Save Settings" button
- "Test Connection" button
- Settings stored in LocalStorage

---

## Data Models

### Session Object (LocalStorage)
```javascript
{
  id: "uuid-string",
  topic: "Topic Name",
  createdAt: "ISO date string",
  cardCount: 10,
  cards: [
    {
      id: 1,
      question: "Question text",
      answer: "Answer text",
      userAnswer: "correct" | "wrong" | null
    }
  ],
  score: {
    correct: 7,
    wrong: 3,
    percentage: 70
  },
  completed: true | false
}
```

### App State Object
```javascript
{
  currentView: "home" | "study" | "results" | "history" | "settings",
  currentSession: Session | null,
  currentCardIndex: 0,
  isCardFlipped: false,
  isLoading: false,
  error: null
}
```

---

## UI/UX Design Specifications

### Color Palette
```css
--primary: #6366f1;       /* Indigo - main brand color */
--primary-dark: #4f46e5;  /* Darker indigo for hover */
--secondary: #f59e0b;     /* Amber - accents */
--success: #10b981;       /* Green - correct answers */
--error: #ef4444;         /* Red - wrong answers */
--background: #0f172a;    /* Dark slate - main bg */
--surface: #1e293b;       /* Lighter slate - cards */
--text-primary: #f8fafc;  /* Near white - main text */
--text-secondary: #94a3b8;/* Muted - secondary text */
```

### Typography
- Font family: Inter (Google Fonts) or system-ui fallback
- Headings: Bold, larger sizes
- Body: Regular weight, readable line height
- Monospace for code/technical content

### Card Design
- Rounded corners (16px border-radius)
- Subtle shadow for depth
- Smooth 3D flip animation (0.6s ease)
- Front: Question with "?" watermark
- Back: Answer with subtle background pattern

### Responsive Breakpoints
- Mobile: < 640px (single column, full-width cards)
- Tablet: 640px - 1024px (comfortable padding)
- Desktop: > 1024px (centered content, max-width container)

### Animations
- Card flip: 3D rotateY transform
- Button hover: Scale and shadow transitions
- Page transitions: Fade in/out
- Loading: Pulsing skeleton or spinner
- Score reveal: Count-up animation

---

## Implementation Phases

### Phase 1: Project Setup & Core Structure
- Create HTML skeleton with semantic structure
- Set up CSS with variables and base styles
- Create JavaScript modules structure
- Implement basic state management

### Phase 2: Landing Page
- Build topic input form
- Create flash card count dropdown
- Style the home view
- Add navigation structure

### Phase 3: API Integration
- Implement Claude API client
- Create configuration system
- Build prompt generation logic
- Handle API responses and errors
- Implement loading states

### Phase 4: Flash Card Component
- Create card HTML/CSS structure
- Implement 3D flip animation
- Build card navigation logic
- Add correct/wrong tracking

### Phase 5: Results View
- Build score calculation
- Create results display
- Implement score animations
- Add review functionality

### Phase 6: LocalStorage & History
- Implement storage service
- Save/load sessions
- Build history view
- Add delete functionality

### Phase 7: Settings & Configuration
- Create settings modal
- Implement API key storage
- Add connection testing
- Polish configuration UX

### Phase 8: Polish & Refinement
- Add responsive design tweaks
- Implement error handling
- Add accessibility features
- Performance optimization
- Final visual polish

---

## API Prompt Template

```
You are helping create educational flash cards. Search the web for current, accurate information about: "{topic}"

Generate exactly {count} flash cards with thought-provoking questions that test understanding, not just memorization.

Requirements:
- Questions should make the learner think critically
- Answers should be clear and educational (2-4 sentences)
- Cover different aspects of the topic
- Progress from fundamental to advanced concepts

Respond with ONLY valid JSON in this exact format:
{
  "topic": "{topic}",
  "cards": [
    {"id": 1, "question": "...", "answer": "..."},
    ...
  ]
}
```

---

## Error Handling Strategy

1. **API Errors**
   - Invalid API key: Show configuration prompt
   - Rate limiting: Show retry message with countdown
   - Network error: Offer offline mode with cached content
   - Invalid response: Retry with simplified prompt

2. **User Input Errors**
   - Empty topic: Inline validation message
   - Topic too short: Suggest more specific topic

3. **Storage Errors**
   - LocalStorage full: Offer to clear old sessions
   - Corrupted data: Reset with user confirmation

---

## Accessibility Considerations

- Semantic HTML elements
- ARIA labels for interactive elements
- Keyboard navigation support (Tab, Enter, Space)
- Focus indicators
- Color contrast compliance (WCAG AA)
- Screen reader announcements for card flips
- Reduced motion option

---

## Future Enhancements (Out of Scope)

- User accounts and cloud sync
- Spaced repetition algorithm
- Card difficulty ratings
- Social sharing
- Multiple card types (image, audio)
- Import/export functionality
- Study streaks and gamification

---

## Notes

- Keep the implementation simple and maintainable
- Prioritize user experience over features
- Test thoroughly on mobile devices
- Ensure API key is never exposed in code
- Use semantic versioning for future updates

## To run the app

 1. Using Python:
  cd C:\vibe\AgentFlash
  python -m http.server 8000
  1. Then open http://localhost:8000
  2. Using Node.js:
  npx serve C:\vibe\AgentFlash
  3. VS Code Live Server extension

  First Steps

  1. Open the app in your browser
  2. Click "Settings" in the header
  3. Enter your Claude API key
  4. Test the connection
  5. Save and start learning!