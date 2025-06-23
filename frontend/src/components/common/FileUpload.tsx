import React, { useState, useRef, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (files: FileList) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  disabled = false,
  multiple = false,
  accept = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.7z',
  maxSize = 200 * 1024 * 1024, // 200MB
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: FileList): boolean => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB.`);
        return false;
      }
      
      // Check file type
      const allowedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        alert(`File type "${fileExtension}" is not allowed. Supported formats: ${allowedExtensions.join(', ')}`);
        return false;
      }
    }
    return true;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);
    
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = e.dataTransfer.files;
      if (validateFiles(files)) {
        onFileSelect(files);
      }
      e.dataTransfer.clearData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, onFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (validateFiles(e.target.files)) {
        onFileSelect(e.target.files);
      }
    }
    // Clear the input value so the same file can be selected again
    e.target.value = '';
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileInputChange}
        disabled={disabled}
        className="hidden"
      />
      
      <div
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
          }
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center space-y-2">
          <svg 
            className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
          
          <div className="text-sm">
            <span className={`font-medium ${isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {isDragging ? 'Drop files here' : 'Click to upload or drag files here'}
            </span>
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>Supported: Images, PDF, DOC, XLS, CSV, ZIP</p>
            <p>Max size: {formatFileSize(maxSize)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload; 