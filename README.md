# NeuroChat Ticketing System

A modern web-based ticketing system with real-time chat capabilities, featuring separate interfaces for customers and support agents.

## System Overview

This ticketing system provides:
- **Customer Interface**: Simple chat-based support without login required
- **Agent Interface**: Full dashboard for managing tickets and conversations
- **Real-time Communication**: Socket.IO powered chat
- **Optional Authentication**: Customers can login to view ticket history

## Getting Started

### Prerequisites
- Node.js (v16+)
- npm

### Installation & Setup

1. **Backend Setup:**
   ```bash
   cd backend
   npm install
   node server.js
   ```
   Backend runs on: `http://localhost:3001`

2. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm start
   ```
   Frontend runs on: `http://localhost:3002`

## User Interfaces

### 🔗 Access Links

- **Customer Support (Default)**: `http://localhost:3002/`
- **Agent Dashboard**: `http://localhost:3002/agent`
- **Customer Login**: `http://localhost:3002/customer/login`

### Customer Experience

**Anonymous Chat Support:**
1. Visit `http://localhost:3002/`
2. Fill in basic info (Name, Email, Company - optional)
3. Select support category
4. Start typing to create a ticket and begin chat
5. No login required!

**Optional Customer Login:**
- Visit `http://localhost:3002/customer/login`
- Login to view past tickets and chat history
- Demo account: `customer@demo.com` / `demo123`

### Agent Experience

**Agent Dashboard:**
1. Visit `http://localhost:3002/agent`
2. Login with agent credentials
3. View all tickets, claim, and respond to customers
4. Real-time notifications for new tickets
5. Demo account: `agent@demo.com` / `demo123`

## Features

### Customer Features
- ✅ Anonymous ticket creation (no signup required)
- ✅ Real-time chat interface
- ✅ Basic info collection (name, email, company)
- ✅ Category selection
- ✅ Optional login to view past tickets
- ✅ Mobile-responsive design

### Agent Features
- ✅ Dashboard with all tickets
- ✅ Ticket claiming and assignment
- ✅ Real-time chat with customers
- ✅ Ticket status management
- ✅ Customer information display
- ✅ Role-based access control

### Technical Features
- ✅ JWT Authentication (optional for customers)
- ✅ Socket.IO real-time communication
- ✅ Modern React + TypeScript frontend
- ✅ Express.js backend
- ✅ Tailwind CSS styling
- ✅ Responsive design

## Demo Accounts

For testing purposes, the system includes demo accounts:

**Customer Account:**
- Email: `customer@demo.com`
- Password: `demo123`

**Agent Account:**
- Email: `agent@demo.com`
- Password: `demo123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Tickets
- `GET /api/tickets` - Get tickets (filtered by user role)
- `POST /api/tickets` - Create ticket (supports anonymous users)
- `POST /api/tickets/:id/claim` - Agent claims ticket

### Messages
- `GET /api/tickets/:id/messages` - Get chat messages
- `POST /api/tickets/:id/messages` - Send message

### Categories
- `GET /api/categories` - Get support categories

## Architecture

```
Frontend (React + TypeScript)
├── Customer Chat Interface (/)
├── Customer Login (/customer/login)
├── Agent Login (/agent)
└── Agent Dashboard

Backend (Express.js + Socket.IO)
├── REST API
├── WebSocket Events
├── JWT Authentication
└── In-Memory Storage (demo)
```

## Usage Scenarios

### 1. Quick Customer Support
Customer visits `/`, fills basic info, starts chatting immediately.

### 2. Agent Support
Agent visits `/agent`, logs in, manages tickets and chats with customers.

### 3. Returning Customer
Customer visits `/customer/login`, logs in to view past conversations.

## Development

The system is designed for easy extension:
- Add database integration (currently uses in-memory storage)
- Implement file upload for tickets
- Add email notifications
- Create admin panel
- Add ticket templates
- Implement SLA tracking

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, Socket.IO
- **Authentication**: JWT
- **Real-time**: WebSockets
- **Styling**: Tailwind CSS
- **State Management**: React Context API

---

🚀 **Ready to use!** Visit the interfaces above to start testing the system. 