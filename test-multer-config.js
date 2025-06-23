
// Enhanced AI Document Upload Test
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Test multer configuration directly
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
    cb(null, uploadsPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const uploadMultiple = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB per file
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

console.log('Multer configuration created successfully');
console.log('Storage destination: ../uploads');
console.log('File size limit: 200MB');
console.log('Allowed file types: PDF, DOC, DOCX, TXT');
