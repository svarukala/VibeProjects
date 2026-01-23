# Copilot Agent Scanner

A web application for uploading, extracting, and viewing Copilot agent app zip files.

## Features

- Drag and drop zip file upload
- File extraction and navigation
- File content viewer for JSON and images
- Microsoft Fluent UI design principles
- Responsive layout with split-pane interface

## Tech Stack

- **Frontend**: React with Tailwind CSS
- **Backend**: Node.js with Express
- **File Processing**: ZIP extraction and content parsing

## Project Structure

```
copilot-agent-scanner/
├── backend/          # Node.js Express server
├── frontend/         # React application
└── README.md
```

## Getting Started

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Development

The application runs on:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

Upload a Copilot agent zip file to explore its contents with the intuitive file browser interface.