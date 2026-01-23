import React, { useState } from 'react';
import { 
  FiFolder, 
  FiFolderOpen, 
  FiFile, 
  FiImage, 
  FiCode, 
  FiChevronRight, 
  FiChevronDown 
} from 'react-icons/fi';

const FileNavigation = ({ fileTree, selectedFile, onFileSelect }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (file) => {
    if (file.type === 'directory') {
      return expandedFolders.has(file.path) ? FiFolderOpen : FiFolder;
    }
    
    if (file.mimeType) {
      if (file.mimeType.startsWith('image/')) {
        return FiImage;
      } else if (file.mimeType === 'application/json' || 
                 file.path.toLowerCase().endsWith('.json')) {
        return FiCode;
      }
    }
    
    return FiFile;
  };

  const getFileIconColor = (file) => {
    if (file.type === 'directory') {
      return 'text-ms-blue-500';
    }
    
    if (file.mimeType) {
      if (file.mimeType.startsWith('image/')) {
        return 'text-green-500';
      } else if (file.mimeType === 'application/json' || 
                 file.path.toLowerCase().endsWith('.json')) {
        return 'text-orange-500';
      }
    }
    
    return 'text-ms-neutral-500';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.path);
      const isSelected = selectedFile && selectedFile.path === item.path;
      const Icon = getFileIcon(item);
      const iconColor = getFileIconColor(item);
      
      return (
        <div key={item.path}>
          <div
            className={`file-tree-item ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (item.type === 'directory') {
                toggleFolder(item.path);
              } else {
                onFileSelect(item);
              }
            }}
          >
            <div className="flex items-center flex-1 min-w-0">
              {item.type === 'directory' && (
                <div className="w-4 h-4 flex items-center justify-center mr-1">
                  {isExpanded ? (
                    <FiChevronDown className="w-3 h-3 text-ms-neutral-600" />
                  ) : (
                    <FiChevronRight className="w-3 h-3 text-ms-neutral-600" />
                  )}
                </div>
              )}
              
              <Icon className={`w-4 h-4 mr-2 flex-shrink-0 ${iconColor}`} />
              
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">
                  {item.name}
                </div>
                {item.type === 'file' && item.size > 0 && (
                  <div className="text-xs text-ms-neutral-500">
                    {formatFileSize(item.size)}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {item.type === 'directory' && item.children && isExpanded && (
            <div>
              {renderFileTree(item.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-ms-neutral-200">
        <h3 className="text-lg font-semibold text-ms-neutral-900 mb-1">
          Agent Files
        </h3>
        <p className="text-sm text-ms-neutral-600">
          {fileTree.length} {fileTree.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto scrollbar-fluent p-2">
        {fileTree.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-ms-neutral-500">
            <div className="text-center">
              <FiFolder className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files found</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {renderFileTree(fileTree)}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {selectedFile && (
        <div className="p-4 border-t border-ms-neutral-200 bg-ms-neutral-50">
          <div className="text-xs text-ms-neutral-600 space-y-1">
            <div><strong>Path:</strong> {selectedFile.path}</div>
            {selectedFile.mimeType && (
              <div><strong>Type:</strong> {selectedFile.mimeType}</div>
            )}
            {selectedFile.size > 0 && (
              <div><strong>Size:</strong> {formatFileSize(selectedFile.size)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileNavigation;