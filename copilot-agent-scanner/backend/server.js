const express = require('express');
const cors = require('cors');
const multer = require('multer');
const yauzl = require('yauzl');
const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        path.extname(file.originalname).toLowerCase() === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Store extracted files information
let extractedFiles = {};

// Utility function to extract ZIP file
const extractZipFile = (zipPath, extractDir) => {
  return new Promise((resolve, reject) => {
    const files = [];
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        const fileName = entry.fileName;
        const fullPath = path.join(extractDir, fileName);
        
        if (/\/$/.test(fileName)) {
          // Directory entry
          fs.ensureDirSync(fullPath);
          files.push({
            name: fileName,
            type: 'directory',
            path: fileName,
            size: 0
          });
          zipfile.readEntry();
        } else {
          // File entry
          fs.ensureDirSync(path.dirname(fullPath));
          
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            
            const writeStream = fs.createWriteStream(fullPath);
            readStream.pipe(writeStream);
            
            writeStream.on('close', () => {
              const mimeType = mime.lookup(fileName) || 'application/octet-stream';
              files.push({
                name: path.basename(fileName),
                type: 'file',
                path: fileName,
                size: entry.uncompressedSize,
                mimeType: mimeType,
                fullPath: fullPath
              });
              zipfile.readEntry();
            });
            
            writeStream.on('error', reject);
          });
        }
      });
      
      zipfile.on('end', () => {
        resolve(files);
      });
      
      zipfile.on('error', reject);
    });
  });
};

// Build file tree structure
const buildFileTree = (files) => {
  const tree = [];
  const pathMap = {};
  
  // Sort files by path to ensure directories come before their contents
  files.sort((a, b) => a.path.localeCompare(b.path));
  
  files.forEach(file => {
    const pathParts = file.path.split('/').filter(part => part);
    let currentLevel = tree;
    let currentPath = '';
    
    pathParts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (index === pathParts.length - 1) {
        // This is the file/directory itself
        currentLevel.push({
          ...file,
          name: part,
          children: file.type === 'directory' ? [] : undefined
        });
      } else {
        // This is a parent directory
        let existingDir = currentLevel.find(item => item.name === part && item.type === 'directory');
        
        if (!existingDir) {
          existingDir = {
            name: part,
            type: 'directory',
            path: currentPath,
            children: []
          };
          currentLevel.push(existingDir);
        }
        
        currentLevel = existingDir.children;
      }
    });
  });
  
  return tree;
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Copilot Agent Scanner Backend is running' });
});

// Upload and extract ZIP file
app.post('/api/upload', upload.single('zipFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const zipPath = req.file.path;
    const extractDir = path.join(__dirname, 'extracted', path.parse(req.file.filename).name);
    
    // Ensure extract directory exists
    await fs.ensureDir(extractDir);
    
    // Extract the ZIP file
    const files = await extractZipFile(zipPath, extractDir);
    
    // Build file tree
    const fileTree = buildFileTree(files);
    
    // Store file information with session ID
    const sessionId = path.parse(req.file.filename).name;
    extractedFiles[sessionId] = {
      files: files,
      tree: fileTree,
      extractDir: extractDir,
      uploadedAt: new Date().toISOString()
    };
    
    // Clean up uploaded ZIP file
    await fs.remove(zipPath);
    
    res.json({
      sessionId: sessionId,
      fileTree: fileTree,
      totalFiles: files.length,
      message: 'ZIP file extracted successfully'
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process ZIP file', details: error.message });
  }
});

// Get file tree for a session
app.get('/api/files/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (!extractedFiles[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    fileTree: extractedFiles[sessionId].tree,
    totalFiles: extractedFiles[sessionId].files.length
  });
});

// Get file content
app.get('/api/files/:sessionId/content', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { filePath } = req.query;
    
    if (!extractedFiles[sessionId]) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const sessionData = extractedFiles[sessionId];
    const file = sessionData.files.find(f => f.path === filePath && f.type === 'file');
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fullPath = file.fullPath;
    
    // Check if file exists
    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    // Handle different file types
    if (file.mimeType.startsWith('image/')) {
      // For images, send the file directly
      res.sendFile(fullPath);
    } else if (file.mimeType === 'application/json' || 
               file.mimeType.startsWith('text/') ||
               path.extname(file.path).toLowerCase() === '.json') {
      // For text files and JSON, read and send content
      const content = await fs.readFile(fullPath, 'utf8');
      res.json({
        content: content,
        mimeType: file.mimeType,
        size: file.size,
        path: file.path
      });
    } else {
      // For other files, send basic info
      res.json({
        message: 'Binary file - content not displayable',
        mimeType: file.mimeType,
        size: file.size,
        path: file.path
      });
    }
    
  } catch (error) {
    console.error('File content error:', error);
    res.status(500).json({ error: 'Failed to read file content', details: error.message });
  }
});

// Clean up session data
app.delete('/api/files/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!extractedFiles[sessionId]) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const extractDir = extractedFiles[sessionId].extractDir;
    
    // Remove extracted files
    if (await fs.pathExists(extractDir)) {
      await fs.remove(extractDir);
    }
    
    // Remove from memory
    delete extractedFiles[sessionId];
    
    res.json({ message: 'Session cleaned up successfully' });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup session', details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error', details: error.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Copilot Agent Scanner Backend running on port ${PORT}`);
  console.log(`📁 Upload endpoint: http://localhost:${PORT}/api/upload`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;