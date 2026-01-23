import React from 'react';
import './App.css';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import FileBrowser from './components/FileBrowser';
import { useState } from 'react';

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [fileTree, setFileTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUploadSuccess = (data) => {
    setSessionId(data.sessionId);
    setFileTree(data.fileTree);
    setSelectedFile(null);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleReset = () => {
    setSessionId(null);
    setFileTree([]);
    setSelectedFile(null);
  };

  return (
    <div className="App min-h-screen bg-ms-neutral-50 flex flex-col">
      <Header onReset={handleReset} hasSession={!!sessionId} />
      
      <main className="flex-1 flex flex-col">
        {!sessionId ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl">
              <FileUpload 
                onUploadSuccess={handleUploadSuccess}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex">
            <FileBrowser
              sessionId={sessionId}
              fileTree={fileTree}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;