# ReduceMeetings

A single-page application that analyzes your Microsoft 365 calendar recurring meetings and provides recommendations on which meetings to keep, remove, or follow up on.

## Quick Start

### 1. Register an App in Microsoft Entra ID

1. Go to [Azure Portal](https://portal.azure.com) > **Microsoft Entra ID** > **App registrations**
2. Click **New registration**
3. Fill in:
   - **Name**: `ReduceMeetings`
   - **Supported account types**: Choose based on your needs:
     - *Single tenant*: Accounts in this organizational directory only
     - *Multi-tenant*: Accounts in any organizational directory
   - **Redirect URI**: Select **Single-page application (SPA)** and enter:
     - For VS Code Live Server: `http://127.0.0.1:5500`
     - For other servers: `http://localhost:3000` (adjust port as needed)
4. Click **Register**
5. Copy the **Application (client) ID** - you'll need this

### 2. Configure API Permissions

In your app registration:

1. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
2. Add these permissions:
   - `User.Read` - Read user profile
   - `Calendars.Read` - Read calendar events
   - `Calendars.ReadWrite` - Delete calendar events (for bulk remove)
   - `OnlineMeetings.Read` - Read online meeting details
   - `Chat.Read` - Read meeting chats
3. Click **Grant admin consent** (if you have admin rights)

### 3. Configure the Application

Edit `js/config.js` and update:

```javascript
const CONFIG = {
    auth: {
        // Paste your Application (client) ID here
        clientId: 'YOUR_CLIENT_ID_HERE',

        // For single tenant, use your tenant ID:
        // authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
        // For multi-tenant, use 'common':
        authority: 'https://login.microsoftonline.com/common',

        // This should match what you registered
        redirectUri: window.location.origin,
        // ...
    }
};
```

### 4. Run the Application

The app needs to be served over HTTP (not opened directly as a file) due to MSAL.js requirements.

**Option A: VS Code Live Server (Recommended)**
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` and select "Open with Live Server"
3. The app will open at `http://127.0.0.1:5500`

**Option B: Python Simple Server**
```bash
cd C:\vibe\ReduceMeetings
python -m http.server 3000
```
Then open `http://localhost:3000`

**Option C: Node.js http-server**
```bash
npx http-server -p 3000
```
Then open `http://localhost:3000`

### 5. Test the Application

1. Open the app in your browser
2. Click **"Test Connection"** to verify the configuration
3. Click **"Sign in with Microsoft"**
4. Grant the requested permissions
5. Once signed in, click **"Start Analysis"** to analyze your calendar

## Troubleshooting

### "Please configure your Entra ID Client ID"
- Edit `js/config.js` and replace `YOUR_CLIENT_ID_HERE` with your actual client ID

### "AADSTS50011: The redirect URI does not match"
- Make sure the redirect URI in Entra ID matches exactly what's in your browser
- Check if it's `http://127.0.0.1:5500` vs `http://localhost:5500` (they're different!)

### "AADSTS65001: The user or administrator has not consented"
- Admin consent may be required for some permissions
- Contact your IT admin, or use a developer tenant

### "Popup blocked" on sign in
- Allow popups for the site, or the app will fall back to redirect flow

### No meetings found
- Make sure you have recurring meetings in your calendar
- Try extending the analysis period to 6 or 12 months

## Project Structure

```
ReduceMeetings/
├── index.html          # Main HTML page
├── css/
│   ├── styles.css      # Main styles
│   └── responsive.css  # Responsive design
├── js/
│   ├── config.js       # Configuration (edit this!)
│   ├── auth.js         # MSAL authentication
│   ├── graph.js        # Microsoft Graph API client
│   ├── calendar.js     # Calendar analysis logic
│   ├── storage.js      # LocalStorage operations
│   ├── ui.js           # UI rendering
│   └── app.js          # Main application
├── README.md           # This file
└── Claude.md           # Project plan
```

## Current Features (Phase 1-2)

- Microsoft 365 sign-in with MSAL.js
- Fetch and analyze recurring calendar meetings
- Basic recommendations based on attendance rate
- Filter meetings by recommendation type
- View reasoning behind recommendations
- Bulk selection for meetings
- Save/load analysis history from LocalStorage

## Coming Soon (Phase 3-7)

- OpenAI-powered intelligent recommendations
- Meeting chat activity analysis
- @ mention detection
- Bulk remove meetings from calendar
- Export recommendations
- Compare analyses over time

## Requirements

- Modern browser (Chrome, Edge, Firefox, Safari)
- Microsoft 365 account
- App registered in Microsoft Entra ID
