# 🤖 AI Agent System Setup Guide

## Overview
The Smart AI Agent System has been successfully implemented and integrated into your NeuroChat support platform. This guide will help you complete the final setup steps.

## ✅ What's Already Implemented

### Backend Components
- ✅ **AI Service** (`backend/services/aiService.js`) - OpenAI integration, response generation, confidence calculation
- ✅ **Document Service** (`backend/services/documentService.js`) - PDF/DOC/Excel parsing, text chunking, embeddings
- ✅ **API Endpoints** - Complete REST API for AI configuration, document management, statistics
- ✅ **Message Processing** - Automatic AI response generation with escalation logic
- ✅ **Database Schema** - AI-related tables and fields

### Frontend Components
- ✅ **AI Agent Settings** - Complete admin panel for AI configuration (`frontend/src/components/users/AiAgentSettings.tsx`)
- ✅ **API Integration** - Full API service methods for AI operations
- ✅ **Navigation Integration** - AI Agent Settings tab added to System Settings

### Key Features
- ✅ **Multi-Model Support** - GPT-3.5 Turbo, GPT-4, GPT-4 Turbo, GPT-4o
- ✅ **Document-Grounded Responses** - Vector search with PDF, DOC, DOCX, TXT, Excel support
- ✅ **Confidence-Based Escalation** - Automatic handoff to human agents
- ✅ **Per-Ticket AI Toggle** - Manual AI disable/enable functionality
- ✅ **Real-time Processing** - Socket.IO integration for live AI responses
- ✅ **Audit Logging** - Complete tracking of AI interactions

## 🔧 Required Setup Steps

### 1. Environment Configuration

Create a `.env` file in the `backend` directory with the following:

```bash
# Required for AI functionality
OPENAI_API_KEY=your-openai-api-key-here

# JWT Secret for authentication
JWT_SECRET=your-super-secure-jwt-secret-here

# Server Configuration
PORT=3001
NODE_ENV=development

# Optional: Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@neurochat.com
```

### 2. OpenAI API Key Setup

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file as `OPENAI_API_KEY`
4. Ensure you have sufficient credits in your OpenAI account

### 3. Starting the System

```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend
cd frontend
npm install
npm start
```

### 4. Accessing AI Agent Settings

1. Login as an Admin user
2. Navigate to **User Management**
3. Click on **AI Agent Settings** tab
4. Configure your AI agent preferences:
   - Choose AI model (GPT-4o recommended)
   - Set agent name and behavior
   - Adjust confidence threshold
   - Upload knowledge base documents

## 📊 AI Agent Configuration Options

### Available Models
- **GPT-3.5 Turbo** - Fast, cost-effective
- **GPT-4** - High quality responses
- **GPT-4 Turbo** - Enhanced capabilities
- **GPT-4o** - Latest and most capable (Default)

### Response Tones
- Technical, Friendly, Formal, Empathetic, Professional, Casual

### Attitude Styles
- Curious, Calm, Assertive, Supportive, Analytical, Patient

### Document Types Supported
- PDF files
- Microsoft Word (DOC/DOCX)
- Plain text (TXT)
- Excel files (XLS/XLSX)

## 🎯 How It Works

1. **Customer Message** → AI analyzes message content
2. **Document Search** → Finds relevant knowledge base content using vector similarity
3. **Response Generation** → Creates contextual response using OpenAI API
4. **Confidence Check** → Evaluates response quality (0-1 scale)
5. **Auto-Escalation** → Forwards to human agent if confidence < threshold
6. **Real-time Delivery** → Sends AI response via WebSocket

## 📈 Monitoring & Analytics

The AI Agent Settings panel provides comprehensive statistics:
- Total AI responses generated
- Response trends (24h, 7 days)
- Average confidence scores
- Response time metrics
- Escalation rates
- Knowledge base status

## 🛠️ Troubleshooting

### AI Not Responding
- Check OpenAI API key in `.env` file
- Verify OpenAI account has sufficient credits
- Check backend console for errors

### Document Upload Issues
- Ensure file size < 10MB
- Supported formats: PDF, DOC, DOCX, TXT, XLS, XLSX
- Check file permissions and disk space

### High Escalation Rate
- Lower confidence threshold (0.5-0.7 recommended)
- Add more relevant documents to knowledge base
- Review and refine response tone settings

## 🔒 Security Notes

- AI responses are logged for audit purposes
- Only Admin users can access AI configuration
- Document content is processed securely
- API keys should be kept confidential

## 🚀 Next Steps

1. Set up your OpenAI API key
2. Configure initial AI agent settings
3. Upload your first knowledge base documents
4. Test with sample customer messages
5. Monitor performance and adjust settings as needed

Your AI Agent System is ready to provide intelligent, document-grounded support responses! 🎉 