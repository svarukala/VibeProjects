# ReduceMeetings - Project Plan

## Overview

A single-page application (SPA) that helps users analyze their Microsoft 365 calendar recurring meetings and provides AI-powered recommendations on which meetings to keep, remove, or follow up on based on actual engagement patterns.

---

## Goals

1. Allow users to sign in with Microsoft 365 account using MSAL.js
2. Analyze recurring meetings from the user's calendar (configurable time range, default 2 months)
3. Evaluate user engagement per meeting based on:
   - Actual meeting attendance/join history
   - Activity in meeting chat
   - @ mentions in meeting threads
4. Use OpenAI API to generate intelligent recommendations with reasoning
5. Persist recommendations in browser local storage with date labels
6. Provide a clean UI to review recommendations and take bulk actions

---

## Technical Architecture

### Frontend Stack
- **HTML5** - Single page structure
- **CSS3** - Responsive design (mobile-first approach)
- **Vanilla JavaScript (ES6+)** - No framework dependencies for simplicity
- **MSAL.js 2.x** - Microsoft Authentication Library for browser

### External APIs
- **Microsoft Graph API** - Calendar, user profile, meeting attendance, chat data
- **OpenAI API** - GPT model for recommendation heuristics

### Storage
- **Browser LocalStorage** - Persist recommendations with timestamps

---

## Project Structure

```
ReduceMeetings/
├── index.html                 # Main SPA entry point
├── css/
│   ├── styles.css            # Main styles
│   └── responsive.css        # Media queries and responsive rules
├── js/
│   ├── config.js             # Configuration (Entra ID, OpenAI, etc.)
│   ├── auth.js               # MSAL.js authentication logic
│   ├── graph.js              # Microsoft Graph API calls
│   ├── calendar.js           # Calendar analysis logic
│   ├── openai.js             # OpenAI API integration
│   ├── storage.js            # LocalStorage operations
│   ├── ui.js                 # UI rendering and interactions
│   └── app.js                # Main application orchestration
├── assets/
│   └── icons/                # SVG icons for UI
├── config.example.json       # Example configuration template
└── README.md                 # Setup and usage instructions
```

---

## Configuration Schema

### config.js Structure

```javascript
const CONFIG = {
  // Microsoft Entra ID (Azure AD) Configuration
  auth: {
    clientId: '',              // Application (client) ID from Entra ID
    authority: '',             // https://login.microsoftonline.com/{tenant-id}
    redirectUri: '',           // Redirect URI registered in Entra ID
    scopes: [
      'User.Read',
      'Calendars.Read',
      'Calendars.ReadWrite',
      'OnlineMeetings.Read',
      'Chat.Read'
    ]
  },

  // OpenAI Configuration
  openai: {
    apiKey: '',                // OpenAI API key
    model: 'gpt-4',           // Model to use
    endpoint: 'https://api.openai.com/v1/chat/completions'
  },

  // Application Settings
  settings: {
    defaultMonthsToAnalyze: 2, // Default lookback period
    maxMonthsToAnalyze: 12,    // Maximum allowed
    storageKeyPrefix: 'reducemeetings_'
  }
};
```

---

## Microsoft Graph API Endpoints

### Required Endpoints

| Purpose | Endpoint | Method | Permissions |
|---------|----------|--------|-------------|
| User Profile | `/me` | GET | User.Read |
| Calendar Events | `/me/calendar/events` | GET | Calendars.Read |
| Recurring Events | `/me/calendar/events?$filter=type eq 'seriesMaster'` | GET | Calendars.Read |
| Event Instances | `/me/events/{id}/instances` | GET | Calendars.Read |
| Online Meeting | `/me/onlineMeetings` | GET | OnlineMeetings.Read |
| Meeting Chat | `/me/chats?$filter=chatType eq 'meeting'` | GET | Chat.Read |
| Chat Messages | `/chats/{chat-id}/messages` | GET | Chat.Read |
| Delete Event | `/me/events/{id}` | DELETE | Calendars.ReadWrite |

### Data Retrieval Strategy

1. **Get Recurring Meetings**
   - Fetch all events with `type eq 'seriesMaster'`
   - Get instances within the date range

2. **Attendance Data**
   - Infer attendance from calendar event response status (accepted, declined, tentative)
   - Past events with no response are considered missed

3. **Chat Activity**
   - Find meeting-associated chats
   - Count user messages and @ mentions

---

## Implementation Phases

### Phase 1: Project Setup & Authentication
1. Create project file structure
2. Implement MSAL.js authentication flow
3. Handle login/logout UI states
4. Store access tokens securely
5. Implement token refresh logic

### Phase 2: Calendar Data Retrieval
1. Build Graph API client wrapper
2. Implement date range selection UI
3. Fetch recurring events (series masters)
4. Fetch event instances within date range
5. Build data model for meetings

### Phase 3: Engagement Analysis
1. Analyze calendar event response status for attendance inference
2. Map Teams meetings to calendar events
3. Fetch meeting-associated chats
4. Analyze chat messages for user activity
5. Detect @ mentions of the user
6. Calculate engagement metrics per meeting

### Phase 4: AI Recommendations
1. Implement OpenAI API client
2. Design prompt template for meeting analysis
3. Build context payload (meeting data + engagement)
4. Parse AI recommendations and reasoning
5. Handle rate limiting and errors

### Phase 5: Local Storage & History
1. Design storage schema with timestamps
2. Save analysis results with date labels
3. Build history selection UI
4. Implement compare with previous analysis
5. Handle storage limits gracefully

### Phase 6: UI/UX Implementation
1. Build responsive layout (mobile/tablet/desktop)
2. Create meeting cards with recommendation badges
3. Implement expandable reasoning sections
4. Build bulk selection interface
5. Implement filter/sort by recommendation type
6. Add progress indicators for analysis

### Phase 7: Actions & Integration
1. Implement meeting removal via Graph API
2. Build bulk action confirmation dialogs
3. Add undo capability (time-limited)
4. Implement export recommendations feature
5. Add refresh/re-analyze functionality

---

## Data Models

### Meeting Analysis Object

```javascript
{
  id: "string",                    // Graph event ID
  seriesMasterId: "string",        // Parent series ID
  subject: "string",
  organizer: {
    name: "string",
    email: "string"
  },
  recurrencePattern: "string",     // Daily, Weekly, etc.
  totalInstances: 0,               // In date range
  engagement: {
    timesJoined: 0,
    timesSkipped: 0,
    attendanceRate: 0.0,           // 0-1
    chatMessagesCount: 0,
    mentionsCount: 0,
    lastAttended: "date",
    lastMissed: "date"
  },
  recommendation: {
    action: "keep|remove|follow",
    confidence: 0.0,               // 0-1
    reasoning: "string",
    factors: []
  }
}
```

### Storage Schema

```javascript
{
  "reducemeetings_analysis_2026-01-14": {
    timestamp: "ISO date",
    dateRange: {
      start: "ISO date",
      end: "ISO date"
    },
    monthsAnalyzed: 2,
    totalMeetings: 0,
    recommendations: {
      keep: [],
      remove: [],
      follow: []
    },
    meetings: []                   // Full meeting objects
  }
}
```

---

## OpenAI Prompt Strategy

### System Prompt

```
You are a meeting efficiency analyst. Analyze calendar meeting data and
recommend whether the user should KEEP, REMOVE, or FOLLOW UP on each
recurring meeting.

Consider:
- Attendance rate (how often they actually join)
- Chat engagement (active participant vs silent observer)
- @ mentions (are they being called upon?)
- Meeting frequency vs value

Output JSON with action, confidence (0-1), and reasoning.
```

### User Prompt Template

```
Analyze this meeting:
- Subject: {subject}
- Organizer: {organizer}
- Recurrence: {pattern}
- Instances in period: {total}
- Times joined: {joined} ({rate}%)
- Chat messages sent: {messages}
- Times mentioned: {mentions}

Provide recommendation as JSON:
{
  "action": "keep|remove|follow",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "factors": ["factor1", "factor2"]
}
```

---

## UI Wireframe Concepts

### Main Layout

```
┌──────────────────────────────────────────────────────┐
│  [Logo] ReduceMeetings          [User] [Sign Out]    │
├──────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐ │
│  │  Analysis Period: [2 months ▼]  [Start Analysis]│ │
│  │  Previous Analyses: [Jan 14, 2026 ▼]            │ │
│  └─────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│  Tabs: [All] [Keep (12)] [Remove (5)] [Follow (3)]   │
├──────────────────────────────────────────────────────┤
│  [Select All] [Bulk Remove] [Export]                 │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐  │
│  │ ☐ Weekly Team Standup            🟢 KEEP       │  │
│  │   Organizer: manager@company.com              │  │
│  │   Attended: 7/8 (87%)  Chat: Active           │  │
│  │   [Show Reasoning ▼]                          │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │ ☐ All-Hands Monthly              🔴 REMOVE     │  │
│  │   Organizer: ceo@company.com                  │  │
│  │   Attended: 0/2 (0%)   Chat: None             │  │
│  │   [Show Reasoning ▼]                          │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Mobile Layout (Collapsed)

```
┌─────────────────────────┐
│ ☰ ReduceMeetings  [👤]  │
├─────────────────────────┤
│ Period: [2 mo ▼]        │
│ [Start Analysis]        │
├─────────────────────────┤
│ [All][Keep][Rem][Fol]   │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ 🟢 Weekly Standup   │ │
│ │ 87% attendance      │ │
│ │ [Details]           │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## Security Considerations

1. **Token Storage**
   - Use MSAL.js built-in token cache
   - Never store tokens in plain localStorage
   - Implement proper token refresh flow

2. **API Keys**
   - OpenAI API key should be entered by user at runtime
   - Consider backend proxy for production use
   - Never commit API keys to repository

3. **Data Privacy**
   - Only store aggregated data, not meeting content
   - Clear sensitive data on sign out
   - Implement data retention policy

4. **Permissions**
   - Request minimal Graph API scopes
   - Explain permission requirements to user
   - Handle permission denial gracefully

---

## Entra ID App Registration Requirements

1. **Register Application**
   - Go to Azure Portal > Entra ID > App registrations
   - Create new registration (Single-page application)
   - Note the Application (client) ID

2. **Configure Authentication**
   - Add SPA redirect URI (e.g., `http://localhost:3000`)
   - Enable implicit grant for Access tokens and ID tokens

3. **API Permissions**
   - User.Read (delegated)
   - Calendars.Read (delegated)
   - Calendars.ReadWrite (delegated)
   - OnlineMeetings.Read (delegated)
   - Chat.Read (delegated)

4. **Admin Consent**
   - No admin consent required for the above delegated permissions

---

## Known Limitations & Mitigations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No actual join data (only response status) | Attendance is inferred, not actual | Use accepted/declined status as proxy for attendance |
| Meeting chat may be in separate Teams chat | Chat data incomplete | Search all user chats for meeting references |
| Graph API rate limits | Slow for many meetings | Implement batching and throttling |
| OpenAI costs | Per-meeting analysis cost | Batch meetings in single prompt |
| LocalStorage 5MB limit | Limited history | Compress data, limit stored analyses |

---

## Testing Plan

1. **Authentication Flow**
   - Login success/failure
   - Token refresh
   - Sign out cleanup

2. **Graph API**
   - Mock responses for offline testing
   - Handle API errors gracefully
   - Test with various calendar configurations

3. **OpenAI Integration**
   - Test prompt effectiveness
   - Handle rate limits
   - Validate JSON parsing

4. **UI/UX**
   - Responsive breakpoints (320px, 768px, 1024px, 1440px)
   - Accessibility (keyboard nav, screen readers)
   - Loading states

---

## Future Enhancements (Out of Scope)

- Backend service for OpenAI proxy (security)
- Meeting analytics dashboard
- Calendar cleanup automation
- Team-level meeting analysis
- Integration with Outlook add-in
- Export to CSV/PDF reports

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @azure/msal-browser | ^3.x | Microsoft authentication |
| None (vanilla JS) | - | Core application |

---

## Development Notes

- Use ES6 modules with `<script type="module">`
- Serve locally with any static file server (Live Server, http-server)
- Test with real Microsoft 365 account (developer tenant recommended)
- OpenAI API key needed for recommendation engine

---

## Next Steps

1. Review and approve this plan
2. Set up Entra ID app registration
3. Obtain OpenAI API key
4. Begin Phase 1 implementation

