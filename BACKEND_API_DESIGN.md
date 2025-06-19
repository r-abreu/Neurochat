# NeuroChat Ticketing System - Backend API Design

## 1. REST API Endpoints

### Base URL
```
Production: https://api.neurochat.com/v1
Development: http://localhost:3000/api/v1
```

### Authentication Endpoints

#### POST /auth/login
**Description:** User login (Customer/Agent)
```json
// Request
{
  "email": "user@example.com",
  "password": "securePassword123"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "userType": "customer", // or "agent"
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "agentStatus": null // only for agents
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token",
      "expiresIn": 3600
    }
  }
}

// Error Response (401 Unauthorized)
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

#### POST /auth/register
**Description:** Register new customer
```json
// Request
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "firstName": "Jane",
  "lastName": "Smith",
  "userType": "customer"
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "newuser@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "userType": "customer",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token",
      "expiresIn": 3600
    }
  }
}
```

#### POST /auth/refresh
**Description:** Refresh access token
```json
// Request
{
  "refreshToken": "jwt_refresh_token"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_access_token",
    "expiresIn": 3600
  }
}
```

#### POST /auth/logout
**Description:** Logout user
```json
// Request Headers
Authorization: Bearer jwt_access_token

// Response (200 OK)
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST /auth/forgot-password
**Description:** Request password reset
```json
// Request
{
  "email": "user@example.com"
}

// Response (200 OK)
{
  "success": true,
  "message": "Password reset email sent"
}
```

### Ticket Management Endpoints

#### GET /tickets
**Description:** Get tickets (filtered based on user type)
**Query Parameters:**
- `status`: new, in_progress, resolved, closed
- `category`: category_id
- `priority`: low, medium, high, urgent
- `page`: pagination page (default: 1)
- `limit`: items per page (default: 10, max: 100)
- `search`: search term
- `sortBy`: created_at, updated_at, priority
- `sortOrder`: asc, desc

```json
// Customer Request (gets only their tickets)
GET /tickets?status=in_progress&page=1&limit=10

// Agent Request (gets assigned tickets or all tickets)
GET /tickets?status=new&category=software&page=1&limit=20

// Response (200 OK)
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": "uuid",
        "ticketNumber": "TKT-123456",
        "title": "Login issues with mobile app",
        "description": "Cannot login to mobile app...",
        "status": "in_progress",
        "priority": "high",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T11:45:00Z",
        "customer": {
          "id": "uuid",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        },
        "agent": {
          "id": "uuid",
          "firstName": "Agent",
          "lastName": "Smith",
          "email": "agent@example.com"
        },
        "category": {
          "id": "uuid",
          "name": "Software",
          "colorCode": "#28a745"
        },
        "messageCount": 5,
        "lastMessageAt": "2024-01-15T11:45:00Z",
        "satisfactionRating": null
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 47,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### GET /tickets/:id
**Description:** Get specific ticket details
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "ticket": {
      "id": "uuid",
      "ticketNumber": "TKT-123456",
      "title": "Login issues with mobile app",
      "description": "Cannot login to mobile app after recent update...",
      "status": "in_progress",
      "priority": "high",
      "source": "web",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T11:45:00Z",
      "assignedAt": "2024-01-15T10:35:00Z",
      "resolvedAt": null,
      "closedAt": null,
      "customer": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "createdAt": "2024-01-01T00:00:00Z"
      },
      "agent": {
        "id": "uuid",
        "firstName": "Agent",
        "lastName": "Smith",
        "email": "agent@example.com",
        "agentStatus": "online"
      },
      "category": {
        "id": "uuid",
        "name": "Software",
        "description": "Software-related issues",
        "colorCode": "#28a745"
      },
      "history": [
        {
          "id": "uuid",
          "fieldName": "status",
          "oldValue": "new",
          "newValue": "in_progress",
          "changedBy": {
            "id": "uuid",
            "firstName": "Agent",
            "lastName": "Smith"
          },
          "createdAt": "2024-01-15T10:35:00Z"
        }
      ],
      "satisfactionRating": null
    }
  }
}
```

#### POST /tickets
**Description:** Create new ticket (Customer only)
```json
// Request
{
  "title": "Cannot access my account",
  "description": "I've been trying to log in but keep getting an error message...",
  "categoryId": "uuid",
  "priority": "medium", // optional, defaults to "medium"
  "source": "web" // optional, defaults to "web"
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "ticket": {
      "id": "uuid",
      "ticketNumber": "TKT-789012",
      "title": "Cannot access my account",
      "description": "I've been trying to log in...",
      "status": "new",
      "priority": "medium",
      "source": "web",
      "createdAt": "2024-01-15T12:00:00Z",
      "customer": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe"
      },
      "category": {
        "id": "uuid",
        "name": "Account",
        "colorCode": "#17a2b8"
      }
    }
  }
}
```

#### PATCH /tickets/:id
**Description:** Update ticket (Agent only)
```json
// Request
{
  "status": "resolved",
  "priority": "high",
  "categoryId": "uuid",
  "changeReason": "Issue identified and fixed"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "ticket": {
      "id": "uuid",
      "status": "resolved",
      "priority": "high",
      "updatedAt": "2024-01-15T14:30:00Z",
      "resolvedAt": "2024-01-15T14:30:00Z"
    }
  }
}
```

#### POST /tickets/:id/claim
**Description:** Claim ticket (Agent only)
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "ticket": {
      "id": "uuid",
      "status": "in_progress",
      "agentId": "uuid",
      "assignedAt": "2024-01-15T13:00:00Z"
    }
  }
}
```

#### POST /tickets/:id/rate
**Description:** Rate ticket satisfaction (Customer only)
```json
// Request
{
  "rating": 5, // 1-5 scale
  "comment": "Excellent support, very helpful!"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "satisfactionRating": 5,
    "comment": "Excellent support, very helpful!"
  }
}
```

### Message/Chat Endpoints

#### GET /tickets/:ticketId/messages
**Description:** Get messages for a ticket
**Query Parameters:**
- `page`: pagination page (default: 1)
- `limit`: items per page (default: 50, max: 100)
- `before`: get messages before this timestamp
- `after`: get messages after this timestamp

```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "ticketId": "uuid",
        "senderId": "uuid",
        "content": "Hello, I need help with my account",
        "messageType": "text",
        "createdAt": "2024-01-15T10:30:00Z",
        "isRead": true,
        "readAt": "2024-01-15T10:31:00Z",
        "sender": {
          "id": "uuid",
          "firstName": "John",
          "lastName": "Doe",
          "userType": "customer"
        },
        "attachments": []
      },
      {
        "id": "uuid",
        "ticketId": "uuid",
        "senderId": "uuid",
        "content": "Hi John, I'd be happy to help you with your account. Can you describe the specific issue?",
        "messageType": "text",
        "createdAt": "2024-01-15T10:32:00Z",
        "isRead": false,
        "readAt": null,
        "sender": {
          "id": "uuid",
          "firstName": "Agent",
          "lastName": "Smith",
          "userType": "agent"
        },
        "attachments": []
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 2,
      "itemsPerPage": 50,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### POST /tickets/:ticketId/messages
**Description:** Send message to ticket
```json
// Request
{
  "content": "I'm getting an error code 500 when trying to login",
  "messageType": "text" // optional, defaults to "text"
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "message": {
      "id": "uuid",
      "ticketId": "uuid",
      "senderId": "uuid",
      "content": "I'm getting an error code 500 when trying to login",
      "messageType": "text",
      "createdAt": "2024-01-15T10:35:00Z",
      "isRead": false,
      "sender": {
        "id": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "userType": "customer"
      }
    }
  }
}
```

#### PATCH /messages/:messageId/read
**Description:** Mark message as read
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "message": {
      "id": "uuid",
      "isRead": true,
      "readAt": "2024-01-15T10:36:00Z"
    }
  }
}
```

### User Management Endpoints

#### GET /users/profile
**Description:** Get current user profile
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "userType": "customer",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLogin": "2024-01-15T10:30:00Z",
      // Agent-specific fields
      "agentStatus": "online", // only for agents
      "maxConcurrentTickets": 5 // only for agents
    }
  }
}
```

#### PATCH /users/profile
**Description:** Update user profile
```json
// Request
{
  "firstName": "Johnny",
  "lastName": "Doe"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "Johnny",
      "lastName": "Doe",
      "updatedAt": "2024-01-15T12:00:00Z"
    }
  }
}
```

#### PATCH /users/agent-status (Agent only)
**Description:** Update agent status
```json
// Request
{
  "status": "busy" // online, busy, offline
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "agentStatus": "busy",
    "updatedAt": "2024-01-15T12:00:00Z"
  }
}
```

### Category Endpoints

#### GET /categories
**Description:** Get all active categories
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Software",
        "description": "Software-related issues and bugs",
        "colorCode": "#28a745",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00Z"
      },
      {
        "id": "uuid",
        "name": "Hardware",
        "description": "Hardware problems and maintenance",
        "colorCode": "#dc3545",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

### Analytics Endpoints (Agent only)

#### GET /analytics/dashboard
**Description:** Get dashboard analytics
```json
// Response (200 OK)
{
  "success": true,
  "data": {
    "overview": {
      "totalTickets": 1250,
      "newTickets": 45,
      "inProgressTickets": 78,
      "resolvedTickets": 1127,
      "avgResolutionTimeMinutes": 245
    },
    "agentPerformance": {
      "totalTicketsHandled": 156,
      "resolvedTickets": 142,
      "avgResolutionTimeMinutes": 198,
      "avgSatisfactionRating": 4.2
    },
    "recentActivity": [
      {
        "type": "ticket_created",
        "ticketId": "uuid",
        "ticketNumber": "TKT-123456",
        "customerName": "John Doe",
        "createdAt": "2024-01-15T12:30:00Z"
      }
    ]
  }
}
```

## 2. WebSocket Events (Socket.IO)

### Connection & Authentication

#### Client connects
```javascript
// Client side
const socket = io('http://localhost:3000', {
  auth: {
    token: 'jwt_access_token'
  }
});

// Server validates JWT and joins user to appropriate rooms
```

#### Authentication Events
```javascript
// Client -> Server: Authenticate
socket.emit('authenticate', {
  token: 'jwt_access_token'
});

// Server -> Client: Authentication result
socket.on('authenticated', (data) => {
  // { success: true, user: {...} }
});

socket.on('authentication_error', (error) => {
  // { error: 'Invalid token' }
});
```

### Chat Events

#### Join/Leave Ticket Chat
```javascript
// Client -> Server: Join ticket room
socket.emit('join_ticket', {
  ticketId: 'uuid'
});

// Server -> Client: Joined ticket room
socket.on('ticket_joined', (data) => {
  // { ticketId: 'uuid', success: true }
});

// Client -> Server: Leave ticket room
socket.emit('leave_ticket', {
  ticketId: 'uuid'
});
```

#### Message Events
```javascript
// Client -> Server: Send message
socket.emit('send_message', {
  ticketId: 'uuid',
  content: 'Hello, I need help with my account',
  messageType: 'text'
});

// Server -> All clients in ticket room: New message
socket.on('new_message', (data) => {
  /*
  {
    message: {
      id: 'uuid',
      ticketId: 'uuid',
      senderId: 'uuid',
      content: 'Hello, I need help with my account',
      messageType: 'text',
      createdAt: '2024-01-15T10:30:00Z',
      sender: {
        id: 'uuid',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer'
      }
    }
  }
  */
});

// Client -> Server: Typing indicator
socket.emit('typing_start', {
  ticketId: 'uuid'
});

socket.emit('typing_stop', {
  ticketId: 'uuid'
});

// Server -> Other clients in room: Typing indicator
socket.on('user_typing', (data) => {
  /*
  {
    ticketId: 'uuid',
    user: {
      id: 'uuid',
      firstName: 'John',
      lastName: 'Doe'
    },
    isTyping: true
  }
  */
});

// Client -> Server: Mark message as read
socket.emit('mark_message_read', {
  messageId: 'uuid'
});

// Server -> Other clients: Message read status
socket.on('message_read', (data) => {
  /*
  {
    messageId: 'uuid',
    readBy: 'uuid',
    readAt: '2024-01-15T10:31:00Z'
  }
  */
});
```

### Ticket Events

#### Ticket Status Updates
```javascript
// Server -> Clients: Ticket status changed
socket.on('ticket_updated', (data) => {
  /*
  {
    ticketId: 'uuid',
    updates: {
      status: 'in_progress',
      agentId: 'uuid',
      updatedAt: '2024-01-15T10:35:00Z'
    },
    updatedBy: {
      id: 'uuid',
      firstName: 'Agent',
      lastName: 'Smith'
    }
  }
  */
});

// Server -> Agents: New ticket created
socket.on('new_ticket', (data) => {
  /*
  {
    ticket: {
      id: 'uuid',
      ticketNumber: 'TKT-123456',
      title: 'Login issues',
      priority: 'high',
      category: {...},
      customer: {...},
      createdAt: '2024-01-15T10:30:00Z'
    }
  }
  */
});

// Server -> Customer: Ticket claimed by agent
socket.on('ticket_claimed', (data) => {
  /*
  {
    ticketId: 'uuid',
    agent: {
      id: 'uuid',
      firstName: 'Agent',
      lastName: 'Smith',
      email: 'agent@example.com'
    },
    claimedAt: '2024-01-15T10:35:00Z'
  }
  */
});
```

#### Agent Events
```javascript
// Agent -> Server: Update status
socket.emit('agent_status_update', {
  status: 'busy' // online, busy, offline
});

// Server -> All agents: Agent status changed
socket.on('agent_status_changed', (data) => {
  /*
  {
    agentId: 'uuid',
    status: 'busy',
    updatedAt: '2024-01-15T10:35:00Z'
  }
  */
});
```

### Notification Events

#### System Notifications
```javascript
// Server -> Client: System notification
socket.on('notification', (data) => {
  /*
  {
    id: 'uuid',
    type: 'info', // success, info, warning, error
    title: 'Ticket Updated',
    message: 'Your ticket TKT-123456 has been resolved',
    data: {
      ticketId: 'uuid',
      action: 'view_ticket'
    },
    timestamp: '2024-01-15T10:35:00Z'
  }
  */
});
```

## 3. Authentication & Authorization

### JWT Token Structure
```javascript
// Access Token Payload
{
  "sub": "user_id_uuid",
  "email": "user@example.com",
  "userType": "customer", // or "agent"
  "iat": 1642248000,
  "exp": 1642251600 // 1 hour expiration
}

// Refresh Token Payload
{
  "sub": "user_id_uuid",
  "type": "refresh",
  "iat": 1642248000,
  "exp": 1643457600 // 30 days expiration
}
```

### Role-Based Access Control

#### Customer Permissions
- Create tickets
- View own tickets
- Send/receive messages on own tickets
- Update own profile
- Rate ticket satisfaction

#### Agent Permissions
- View all tickets
- Claim/unclaim tickets
- Update ticket status, priority, category
- Send/receive messages on assigned tickets
- View analytics and reports
- Update agent status

### Middleware Implementation Example
```typescript
// auth.ts middleware
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'NO_TOKEN', message: 'Access token required' }
    });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }
      });
    }
    
    req.user = decoded as JWTPayload;
    next();
  });
};

// Role-based authorization
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' }
      });
    }
    next();
  };
};

// Usage
router.get('/analytics/dashboard', 
  authenticateToken, 
  requireRole(['agent']), 
  getDashboardAnalytics
);
```

## 4. Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}, // Optional additional details
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Common Error Codes
- `INVALID_CREDENTIALS` - Login failed
- `TOKEN_EXPIRED` - JWT token expired
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `VALIDATION_ERROR` - Request data validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `TICKET_ALREADY_CLAIMED` - Ticket already assigned to another agent
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_SERVER_ERROR` - Unexpected server error

### Rate Limiting
```typescript
// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});

// Apply to all routes
app.use('/api/', rateLimiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Limit auth attempts
  skipSuccessfulRequests: true
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

This comprehensive API design provides a robust foundation for the real-time ticketing system, ensuring security, scalability, and excellent user experience for both customers and agents. 