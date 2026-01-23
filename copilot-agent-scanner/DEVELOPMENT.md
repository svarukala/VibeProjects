# Copilot Agent Scanner - Development Setup

## Quick Start

### 1. Install Dependencies

```powershell
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start Development Servers

#### Option 1: Run both servers manually

```powershell
# Terminal 1 - Start backend server
cd backend
npm run dev

# Terminal 2 - Start frontend server
cd frontend
npm start
```

#### Option 2: Use the setup script

```powershell
# Run the development setup script
.\setup-dev.ps1
```

### 3. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Usage

1. **Upload**: Drag and drop a ZIP file containing your Copilot agent app
2. **Navigate**: Browse the extracted files in the left sidebar
3. **View**: Click on files to view their contents in the right panel
4. **Explore**: JSON files are syntax-highlighted, images are displayed

## Features

- ✅ Drag & drop ZIP file upload
- ✅ File extraction and tree navigation
- ✅ JSON syntax highlighting
- ✅ Image file display
- ✅ Microsoft Fluent UI design
- ✅ Responsive layout
- ✅ Error handling and loading states

## Architecture

```
copilot-agent-scanner/
├── backend/             # Node.js Express API
│   ├── server.js        # Main server file
│   ├── package.json     # Backend dependencies
│   └── uploads/         # Temporary upload storage
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── App.js       # Main application
│   │   └── index.css    # Tailwind CSS styles
│   └── package.json     # Frontend dependencies
└── README.md
```

## Development Notes

- Backend uses Express with multer for file uploads
- ZIP extraction handled by yauzl library
- Frontend built with React and Tailwind CSS
- Follows Microsoft Fluent UI design principles
- File tree navigation with expand/collapse
- Syntax highlighting for JSON files using Prism