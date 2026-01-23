import React, { useState, useEffect } from 'react';
import { FiFile, FiImage, FiCode, FiEye, FiDownload, FiLoader } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import axios from 'axios';

const FileViewer = ({ sessionId, selectedFile }) => {
  const [fileContent, setFileContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedFile && selectedFile.type === 'file') {
      fetchFileContent();
    } else {
      setFileContent(null);
      setError(null);
    }
  }, [selectedFile, sessionId]);

  const fetchFileContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/files/${sessionId}/content`, {
        params: { filePath: selectedFile.path },
        responseType: selectedFile.mimeType?.startsWith('image/') ? 'blob' : 'json'
      });

      if (selectedFile.mimeType?.startsWith('image/')) {
        // Handle image files
        const imageUrl = URL.createObjectURL(response.data);
        setFileContent({ type: 'image', url: imageUrl });
      } else {
        // Handle text/JSON files
        setFileContent(response.data);
      }
    } catch (err) {
      console.error('Error fetching file content:', err);
      setError(err.response?.data?.error || 'Failed to load file content');
    } finally {
      setLoading(false);
    }
  };

  const formatJsonContent = (content) => {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  const getLanguageFromMimeType = (mimeType, path) => {
    if (mimeType === 'application/json' || path?.toLowerCase().endsWith('.json')) {
      return 'json';
    }
    if (mimeType?.startsWith('text/')) {
      return 'text';
    }
    return 'text';
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FiLoader className="animate-spin h-8 w-8 text-ms-blue-500 mx-auto mb-2" />
            <p className="text-sm text-ms-neutral-600">Loading file content...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FiFile className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-2">Error loading file</p>
            <p className="text-xs text-ms-neutral-500">{error}</p>
          </div>
        </div>
      );
    }

    if (!fileContent) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FiEye className="h-8 w-8 text-ms-neutral-400 mx-auto mb-2" />
            <p className="text-sm text-ms-neutral-600">Select a file to view its contents</p>
          </div>
        </div>
      );
    }

    // Image content
    if (fileContent.type === 'image') {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="max-w-full max-h-full">
            <img
              src={fileContent.url}
              alt={selectedFile.name}
              className="max-w-full max-h-96 object-contain shadow-fluent rounded-sm"
            />
          </div>
        </div>
      );
    }

    // Text/JSON content
    if (fileContent.content) {
      const language = getLanguageFromMimeType(selectedFile.mimeType, selectedFile.path);
      const displayContent = language === 'json' 
        ? formatJsonContent(fileContent.content)
        : fileContent.content;

      return (
        <div className="h-full">
          <SyntaxHighlighter
            language={language}
            style={vs}
            className="syntax-highlight h-full"
            showLineNumbers={true}
            wrapLines={true}
            customStyle={{
              margin: 0,
              padding: '16px',
              fontSize: '13px',
              lineHeight: '1.45',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              backgroundColor: '#ffffff',
              height: '100%',
              overflow: 'auto'
            }}
          >
            {displayContent}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Binary file
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiFile className="h-8 w-8 text-ms-neutral-400 mx-auto mb-2" />
          <p className="text-sm text-ms-neutral-600 mb-1">Binary file</p>
          <p className="text-xs text-ms-neutral-500">Content not displayable</p>
        </div>
      </div>
    );
  };

  const getFileTypeIcon = () => {
    if (!selectedFile) return FiFile;
    
    if (selectedFile.mimeType?.startsWith('image/')) {
      return FiImage;
    } else if (selectedFile.mimeType === 'application/json' || 
               selectedFile.path?.toLowerCase().endsWith('.json')) {
      return FiCode;
    }
    
    return FiFile;
  };

  const FileTypeIcon = getFileTypeIcon();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-ms-neutral-200 bg-white">
        {selectedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 min-w-0">
              <FileTypeIcon className="w-5 h-5 text-ms-blue-500 mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-ms-neutral-900 truncate">
                  {selectedFile.name}
                </h3>
                <p className="text-sm text-ms-neutral-600 truncate">
                  {selectedFile.path}
                </p>
              </div>
            </div>
            
            {selectedFile.type === 'file' && (
              <div className="flex items-center space-x-2 ml-4">
                <button
                  className="btn-fluent p-2"
                  title="Download file"
                  onClick={() => {
                    // Implement download functionality if needed
                    console.log('Download:', selectedFile.path);
                  }}
                >
                  <FiDownload className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center">
            <FiEye className="w-5 h-5 text-ms-neutral-400 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-ms-neutral-900">
                File Viewer
              </h3>
              <p className="text-sm text-ms-neutral-600">
                Select a file from the navigation to view its contents
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden bg-white">
        {selectedFile?.type === 'directory' ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FiFile className="h-8 w-8 text-ms-neutral-400 mx-auto mb-2" />
              <p className="text-sm text-ms-neutral-600">Directory selected</p>
              <p className="text-xs text-ms-neutral-500">Choose a file to view its contents</p>
            </div>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default FileViewer;