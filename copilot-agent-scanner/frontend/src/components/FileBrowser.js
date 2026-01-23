import React from 'react';
import FileNavigation from './FileNavigation';
import FileViewer from './FileViewer';

const FileBrowser = ({ sessionId, fileTree, selectedFile, onFileSelect }) => {
  return (
    <div className="flex h-full">
      {/* Left Sidebar - File Navigation */}
      <div className="w-1/3 min-w-80 border-r border-ms-neutral-200 bg-white">
        <FileNavigation
          fileTree={fileTree}
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
        />
      </div>

      {/* Right Panel - File Viewer */}
      <div className="flex-1 bg-ms-neutral-50">
        <FileViewer
          sessionId={sessionId}
          selectedFile={selectedFile}
        />
      </div>
    </div>
  );
};

export default FileBrowser;