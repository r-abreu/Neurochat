# File Upload Implementation

## Overview
This document describes the implementation of file upload functionality for customer chat in the NeuroChat application.

## Features Implemented

### Backend (Node.js/Express)
- **File Upload Endpoint**: `POST /api/tickets/:ticketId/upload`
- **File Download Endpoint**: `GET /api/files/:filename`
- **File Storage**: Files are stored in the `uploads/` directory
- **File Size Limit**: 10MB maximum per file
- **Supported File Types**:
  - Images: jpg, jpeg, png, gif, webp, bmp, svg
  - Documents: pdf, doc, docx, xls, xlsx, csv
  - Archives: zip, rar, 7z

### Frontend (React/TypeScript)
- **Drag and Drop Interface**: Custom FileUpload component with drag and drop support
- **File Type Validation**: Client-side validation for file types and sizes
- **Visual Feedback**: Upload progress indicators and file previews
- **Image Previews**: Inline display of uploaded images
- **Download Links**: Direct download links for all file types

## Technical Implementation

### Backend Changes
1. **Dependencies Added**:
   - `multer`: For handling multipart/form-data file uploads
   - `path`: For file path operations
   - `fs`: For file system operations

2. **File Storage Configuration**:
   - Files stored with unique timestamps and UUIDs
   - Original filenames preserved in database
   - Static file serving for uploaded files

3. **Database Schema**:
   - Messages table already supported file attachments with fields:
     - `file_name`: Original filename
     - `file_path`: Server file path
     - `file_size`: File size in bytes
     - `message_type`: 'file' or 'image'

### Frontend Changes
1. **New Components**:
   - `FileUpload.tsx`: Reusable drag-and-drop file upload component
   
2. **Updated Components**:
   - `CustomerChat.tsx`: Integrated file upload functionality
   - Enhanced message rendering for file attachments
   
3. **Type Definitions**:
   - Extended `Message` interface to include file properties
   - Added support for 'file' and 'image' message types

4. **API Service**:
   - Added `uploadFile()` method for file uploads
   - Proper error handling and progress feedback

## Usage

### For Customers
1. Click the attachment button (📎) in the chat input area
2. Either click to browse files or drag and drop files directly
3. Files are automatically uploaded and appear as messages
4. Images show inline previews
5. All files have download links

### File Validation
- Maximum file size: 10MB
- Supported formats are validated on both client and server
- Clear error messages for invalid files

### File Access
- Files are accessible via direct URLs: `/uploads/filename`
- Download endpoint provides original filenames
- Files are associated with tickets for audit purposes

## Security Considerations
- File type validation on both client and server
- Unique filenames prevent conflicts and path traversal
- File size limits prevent abuse
- Files are served statically but could be enhanced with authentication

## Future Enhancements
- File thumbnails for documents
- Multiple file selection improvements
- File compression for large images
- Database storage for better scalability
- File cleanup for closed tickets
- Virus scanning integration 