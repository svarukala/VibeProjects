import React from 'react';
import { FiUpload, FiRefreshCw } from 'react-icons/fi';

const Header = ({ onReset, hasSession }) => {
  return (
    <header className="bg-white border-b border-ms-neutral-200 shadow-fluent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <FiUpload className="h-8 w-8 text-ms-blue-500 mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-ms-neutral-900">
                  Copilot Agent Scanner
                </h1>
                <p className="text-sm text-ms-neutral-600">
                  Upload and explore Copilot agent apps
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {hasSession && (
              <button
                onClick={onReset}
                className="btn-fluent flex items-center space-x-2 hover:bg-ms-neutral-100"
                title="Upload new file"
              >
                <FiRefreshCw className="h-4 w-4" />
                <span>New Upload</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;