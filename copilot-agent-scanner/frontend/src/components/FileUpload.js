import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiFile, FiLoader, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';

const FileUpload = ({ onUploadSuccess, isLoading, setIsLoading }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setUploadStatus('error');
      setErrorMessage('Please upload a ZIP file');
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setUploadStatus('error');
      setErrorMessage('File size must be less than 50MB');
      return;
    }

    await uploadFile(file);
  }, []);

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('zipFile', file);

    setIsLoading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage('');

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      setUploadStatus('success');
      setUploadProgress(100);
      
      // Delay to show success state
      setTimeout(() => {
        onUploadSuccess(response.data);
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setIsLoading(false);
      
      if (error.response?.data?.error) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage('Failed to upload file. Please try again.');
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
    },
    multiple: false,
    disabled: isLoading,
  });

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage('');
  };

  return (
    <div className="card-fluent">
      <div className="text-center mb-6">
        <FiUpload className="mx-auto h-12 w-12 text-ms-blue-500 mb-4" />
        <h2 className="text-2xl font-semibold text-ms-neutral-900 mb-2">
          Upload Copilot Agent App
        </h2>
        <p className="text-ms-neutral-600">
          Drag and drop a ZIP file containing your Copilot agent app, or click to browse
        </p>
      </div>

      {uploadStatus === 'idle' && (
        <div
          {...getRootProps()}
          className={`drop-zone ${isDragActive ? 'active' : ''} ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center">
            <FiFile className="h-16 w-16 text-ms-neutral-400 mb-4" />
            {isDragActive ? (
              <p className="text-lg font-medium text-ms-blue-600">
                Drop the ZIP file here...
              </p>
            ) : (
              <>
                <p className="text-lg font-medium text-ms-neutral-700 mb-2">
                  Drag & drop a ZIP file here
                </p>
                <p className="text-sm text-ms-neutral-500 mb-4">
                  or click to select from your computer
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isLoading}
                >
                  Browse Files
                </button>
              </>
            )}
          </div>
          <div className="mt-4 text-xs text-ms-neutral-500">
            Supported format: ZIP files up to 50MB
          </div>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="text-center py-8">
          <FiLoader className="animate-spin h-12 w-12 text-ms-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-ms-neutral-900 mb-2">
            Processing your file...
          </h3>
          <p className="text-sm text-ms-neutral-600 mb-4">
            Extracting and analyzing Copilot agent app contents
          </p>
          
          <div className="w-full max-w-sm mx-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-ms-neutral-600">Progress</span>
              <span className="text-xs text-ms-neutral-600">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-ms-neutral-200 rounded-full h-2">
              <div
                className="bg-ms-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="text-center py-8">
          <FiCheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-ms-neutral-900 mb-2">
            Upload Successful!
          </h3>
          <p className="text-sm text-ms-neutral-600">
            Your Copilot agent app has been processed and is ready to explore
          </p>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="text-center py-8">
          <FiAlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-ms-neutral-900 mb-2">
            Upload Failed
          </h3>
          <p className="text-sm text-red-600 mb-4">
            {errorMessage}
          </p>
          <button
            onClick={resetUpload}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;