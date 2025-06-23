const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const aiService = require('./aiService');

class DocumentService {
  constructor() {
    this.supportedTypes = ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'];
    this.maxChunkSize = 1000; // Maximum characters per chunk
    this.chunkOverlap = 100; // Character overlap between chunks
  }

  // Check if file type is supported
  isSupported(fileType) {
    return this.supportedTypes.includes(fileType.toLowerCase());
  }

  // Parse uploaded document and extract text
  async parseDocument(filePath, fileType) {
    try {
      let text = '';
      
      switch (fileType.toLowerCase()) {
        case 'pdf':
          text = await this.parsePDF(filePath);
          break;
        case 'doc':
        case 'docx':
          text = await this.parseWord(filePath);
          break;
        case 'txt':
          text = await this.parseText(filePath);
          break;
        case 'xls':
        case 'xlsx':
          text = await this.parseExcel(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      return text.trim();
    } catch (error) {
      console.error(`Error parsing ${fileType} document:`, error);
      throw new Error(`Failed to parse document: ${error.message}`);
    }
  }

  // Parse PDF document
  async parsePDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  // Parse Word document
  async parseWord(filePath) {
    const data = await mammoth.extractRawText({ path: filePath });
    return data.value;
  }

  // Parse text file
  async parseText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  // Parse Excel file
  async parseExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    let text = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csvData = xlsx.utils.sheet_to_csv(sheet);
      text += `Sheet: ${sheetName}\n${csvData}\n\n`;
    });

    return text;
  }

  // Split text into chunks for vector processing
  splitIntoChunks(text) {
    if (text.length <= this.maxChunkSize) {
      return [text];
    }

    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + this.maxChunkSize;
      
      // If we're not at the end, try to find a good breaking point
      if (endIndex < text.length) {
        // Look for sentence boundaries
        const lastPeriod = text.lastIndexOf('.', endIndex);
        const lastNewline = text.lastIndexOf('\n', endIndex);
        const lastSpace = text.lastIndexOf(' ', endIndex);
        
        // Use the best breaking point
        if (lastPeriod > startIndex + this.maxChunkSize * 0.7) {
          endIndex = lastPeriod + 1;
        } else if (lastNewline > startIndex + this.maxChunkSize * 0.7) {
          endIndex = lastNewline + 1;
        } else if (lastSpace > startIndex + this.maxChunkSize * 0.7) {
          endIndex = lastSpace + 1;
        }
      }

      const chunk = text.substring(startIndex, endIndex).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      // Move start index, accounting for overlap
      startIndex = endIndex - this.chunkOverlap;
    }

    return chunks;
  }

  // Process document for AI knowledge base
  async processDocument(filePath, fileName, fileType, fileSize) {
    try {
      console.log(`🔍 Processing document: ${fileName}`);
      
      // Parse document text
      const text = await this.parseDocument(filePath, fileType);
      console.log(`📄 Extracted ${text.length} characters from ${fileName}`);

      // Split into chunks
      const chunks = this.splitIntoChunks(text);
      console.log(`✂️ Split into ${chunks.length} chunks`);

      // Generate embeddings for chunks if AI service is available
      const processedChunks = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let embedding = null;
        
        if (aiService.isEnabled()) {
          try {
            embedding = await aiService.generateEmbedding(chunk);
          } catch (error) {
            console.warn(`Failed to generate embedding for chunk ${i}:`, error.message);
          }
        }

        processedChunks.push({
          id: uuidv4(),
          text: chunk,
          index: i,
          embedding: embedding ? JSON.stringify(embedding) : null
        });
      }

      return {
        fileName,
        fileType,
        fileSize,
        fullText: text,
        chunks: processedChunks,
        chunkCount: processedChunks.length
      };

    } catch (error) {
      console.error(`Error processing document ${fileName}:`, error);
      throw error;
    }
  }

  // Clean up temporary files
  async cleanup(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      console.warn(`Warning: Could not clean up file ${filePath}:`, error.message);
    }
  }

  // Get document content for display
  getDocumentPreview(text, maxLength = 500) {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength) + '...';
  }

  // Validate document before processing
  validateDocument(filePath, fileType, fileSize) {
    const errors = [];

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      errors.push('File not found');
    }

    // Check file type
    if (!this.isSupported(fileType)) {
      errors.push(`Unsupported file type: ${fileType}`);
    }

    // Check file size (max 200MB)
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (fileSize > maxSize) {
      errors.push(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new DocumentService(); 