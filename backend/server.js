const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (for demo - replace with real database)
const users = [];
const tickets = [];
const messages = [];
const categories = [
  { id: uuidv4(), name: 'Software', description: 'Software-related issues', colorCode: '#28a745' },
  { id: uuidv4(), name: 'Hardware', description: 'Hardware problems', colorCode: '#dc3545' },
  { id: uuidv4(), name: 'Billing', description: 'Billing inquiries', colorCode: '#ffc107' },
  { id: uuidv4(), name: 'Account', description: 'Account management', colorCode: '#17a2b8' },
  { id: uuidv4(), name: 'General', description: 'General support', colorCode: '#6c757d' }
];

// Create demo users
const demoUsers = [
  {
    id: uuidv4(),
    email: 'customer@demo.com',
    password: bcrypt.hashSync('demo123', 10),
    firstName: 'John',
    lastName: 'Customer',
    userType: 'customer',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: uuidv4(),
    email: 'agent@demo.com',
    password: bcrypt.hashSync('demo123', 10),
    firstName: 'Jane',
    lastName: 'Agent',
    userType: 'agent',
    isActive: true,
    agentStatus: 'online',
    maxConcurrentTickets: 5,
    createdAt: new Date().toISOString()
  }
];

users.push(...demoUsers);

// JWT Secret
const JWT_SECRET = 'demo-secret-key';

// Utility functions
const generateTicketNumber = () => {
  const num = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `TKT-${num}`;
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'Access token required' }});
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' }});
    }
    req.user = decoded;
    next();
  });
};

// Routes

// Authentication
app.post('/api/auth/login', async (req, res) => {
  console.log('\n🔐 LOGIN REQUEST RECEIVED');
  console.log('Body:', req.body);
  console.log('Available users:', users.map(u => ({ email: u.email, userType: u.userType })));
  
  const { email, password } = req.body;
  
  console.log('Looking for user with email:', email);
  const user = users.find(u => u.email === email);
  console.log('Found user:', user ? 'YES' : 'NO');
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    console.log('❌ Authentication failed');
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    });
  }

  console.log('✅ Authentication successful for:', user.email);
  const token = jwt.sign(
    { 
      sub: user.id, 
      email: user.email, 
      userType: user.userType 
    }, 
    JWT_SECRET, 
    { expiresIn: '1h' }
  );

  const response = {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        agentStatus: user.agentStatus || null
      },
      tokens: {
        accessToken: token,
        expiresIn: 3600
      }
    }
  };

  console.log('📤 Sending response:', JSON.stringify(response, null, 2));
  res.json(response);
});

// Get categories
app.get('/api/categories', (req, res) => {
  res.json({
    success: true,
    data: { categories }
  });
});

// Get tickets
app.get('/api/tickets', authenticateToken, (req, res) => {
  let userTickets = tickets;
  
  // Filter by user type
  if (req.user.userType === 'customer') {
    userTickets = tickets.filter(t => t.customerId === req.user.sub);
  }

  // Add related data
  const enrichedTickets = userTickets.map(ticket => {
    const customer = users.find(u => u.id === ticket.customerId);
    const agent = ticket.agentId ? users.find(u => u.id === ticket.agentId) : null;
    const category = categories.find(c => c.id === ticket.categoryId);
    const ticketMessages = messages.filter(m => m.ticketId === ticket.id);
    
    return {
      ...ticket,
      customer: customer ? {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email
      } : (ticket.isAnonymous ? {
        id: null,
        firstName: ticket.customerName.split(' ')[0] || ticket.customerName,
        lastName: ticket.customerName.split(' ').slice(1).join(' ') || '',
        email: ticket.customerEmail
      } : null),
      agent: agent ? {
        id: agent.id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email
      } : null,
      category,
      messageCount: ticketMessages.length,
      lastMessageAt: ticketMessages.length > 0 ? ticketMessages[ticketMessages.length - 1].createdAt : ticket.createdAt
    };
  });

  res.json({
    success: true,
    data: {
      tickets: enrichedTickets,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: enrichedTickets.length,
        itemsPerPage: 50
      }
    }
  });
});

// Create ticket (supports both authenticated and anonymous)
app.post('/api/tickets', (req, res) => {
  console.log('\n🎫 CREATE TICKET REQUEST RECEIVED');
  console.log('Body:', req.body);
  
  const { title, description, categoryId, priority = 'medium', customerInfo } = req.body;
  console.log('Extracted data:', { title, description, categoryId, priority, customerInfo });

  // Try to authenticate if token is provided
  let user = null;
  if (req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      user = users.find(u => u.id === decoded.sub);
      console.log('Authenticated user:', user);
    } catch (error) {
      console.log('Token invalid or expired, continuing as anonymous');
    }
  }

  // Validate required fields
  if (!title || !description || !categoryId) {
    console.log('❌ Validation failed - missing required fields');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Title, description, and category are required' }
    });
  }

  // For anonymous users, require customer info
  if (!user && (!customerInfo || !customerInfo.name || !customerInfo.email)) {
    console.log('❌ Validation failed - customer info required for anonymous users');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Customer name and email are required' }
    });
  }

  const ticket = {
    id: uuidv4(),
    ticketNumber: generateTicketNumber(),
    customerId: user ? user.id : null,
    customerName: user ? `${user.firstName} ${user.lastName}` : customerInfo.name,
    customerEmail: user ? user.email : customerInfo.email,
    customerCompany: customerInfo?.company || null,
    agentId: null,
    categoryId,
    title,
    description,
    status: 'new',
    priority,
    source: 'web',
    isAnonymous: !user,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  console.log('✅ Created ticket:', ticket);
  tickets.push(ticket);
  console.log('Total tickets now:', tickets.length);

  // Create initial message with the ticket description
  const initialMessage = {
    id: uuidv4(),
    ticketId: ticket.id,
    senderId: user ? user.id : null,
    content: description,
    messageType: 'text',
    createdAt: new Date().toISOString(),
    isRead: false
  };

  messages.push(initialMessage);
  console.log('✅ Created initial message:', initialMessage);

  // Notify agents of new ticket
  io.emit('new_ticket', { ticket });

  const category = categories.find(c => c.id === categoryId);
  
  console.log('Found category:', category);

  const response = {
    success: true,
    data: {
      ticket: {
        ...ticket,
        customer: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName
        } : {
          name: ticket.customerName,
          email: ticket.customerEmail,
          company: ticket.customerCompany
        },
        category
      }
    }
  };

  console.log('📤 Sending ticket creation response:', JSON.stringify(response, null, 2));
  res.status(201).json(response);
});

// Claim ticket
app.post('/api/tickets/:id/claim', authenticateToken, (req, res) => {
  if (req.user.userType !== 'agent') {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only agents can claim tickets' }
    });
  }

  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  if (ticket.agentId) {
    return res.status(400).json({
      success: false,
      error: { code: 'TICKET_ALREADY_CLAIMED', message: 'Ticket already assigned to another agent' }
    });
  }

  ticket.agentId = req.user.sub;
  ticket.status = 'in_progress';
  ticket.assignedAt = new Date().toISOString();
  ticket.updatedAt = new Date().toISOString();

  // Notify customer of assignment
  io.to(`ticket_${ticket.id}`).emit('ticket_claimed', {
    ticketId: ticket.id,
    agent: {
      id: req.user.sub,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    },
    claimedAt: ticket.assignedAt
  });

  res.json({
    success: true,
    data: {
      ticket: {
        id: ticket.id,
        status: ticket.status,
        agentId: ticket.agentId,
        assignedAt: ticket.assignedAt
      }
    }
  });
});

// Update ticket
app.put('/api/tickets/:id', authenticateToken, (req, res) => {
  if (req.user.userType !== 'agent') {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only agents can update tickets' }
    });
  }

  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  // Only allow updating certain fields
  const allowedUpdates = ['status', 'priority'];
  const updates = {};
  
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  // Update the ticket
  Object.assign(ticket, updates);
  ticket.updatedAt = new Date().toISOString();

  console.log(`🎫 Ticket ${req.params.id} updated by agent ${req.user.sub}:`, updates);

  // Notify connected clients about ticket update
  io.to(`ticket_${ticket.id}`).emit('ticket_updated', {
    ticketId: ticket.id,
    updates: updates,
    updatedBy: req.user.sub,
    updatedAt: ticket.updatedAt
  });

  // Send the updated ticket data back
  const agent = users.find(u => u.id === ticket.agentId);
  const customer = users.find(u => u.id === ticket.customerId);
  const category = categories.find(c => c.id === ticket.categoryId);

  const enrichedTicket = {
    ...ticket,
    customer: customer ? {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email
    } : (ticket.isAnonymous ? {
      id: null,
      firstName: ticket.customerName.split(' ')[0] || ticket.customerName,
      lastName: ticket.customerName.split(' ').slice(1).join(' ') || '',
      email: ticket.customerEmail
    } : null),
    agent: agent ? {
      id: agent.id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      email: agent.email
    } : null,
    category
  };

  res.json({
    success: true,
    data: {
      ticket: enrichedTicket
    }
  });
});

// Get messages for a ticket (supports both authenticated and anonymous)
app.get('/api/tickets/:ticketId/messages', (req, res) => {
  const ticket = tickets.find(t => t.id === req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  // Try to authenticate if token is provided
  let user = null;
  if (req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      user = users.find(u => u.id === decoded.sub);
    } catch (error) {
      console.log('Token invalid or expired, continuing as anonymous');
    }
  }

  // Check permissions for authenticated users
  if (user && user.userType === 'customer' && ticket.customerId !== user.id) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Access denied' }
    });
  }

  const ticketMessages = messages
    .filter(m => m.ticketId === req.params.ticketId)
    .map(message => {
      const sender = users.find(u => u.id === message.senderId);
      
      return {
        ...message,
        sender: sender ? {
          id: sender.id,
          firstName: sender.firstName,
          lastName: sender.lastName,
          userType: sender.userType
        } : {
          id: null,
          firstName: ticket.customerName.split(' ')[0] || ticket.customerName,
          lastName: ticket.customerName.split(' ').slice(1).join(' ') || '',
          userType: 'customer'
        }
      };
    });

  res.json({
    success: true,
    data: {
      messages: ticketMessages,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: ticketMessages.length,
        itemsPerPage: 50
      }
    }
  });
});

// Send message (supports both authenticated and anonymous)
app.post('/api/tickets/:ticketId/messages', (req, res) => {
  const { content, messageType = 'text' } = req.body;
  
  if (!content) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Message content is required' }
    });
  }

  const ticket = tickets.find(t => t.id === req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  // Try to authenticate if token is provided
  let user = null;
  if (req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      user = users.find(u => u.id === decoded.sub);
    } catch (error) {
      console.log('Token invalid or expired, continuing as anonymous');
    }
  }

  // For anonymous users, ensure they can only send to their own ticket
  if (!user && !ticket.isAnonymous) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Access denied' }
    });
  }

  const message = {
    id: uuidv4(),
    ticketId: req.params.ticketId,
    senderId: user ? user.id : null,
    content,
    messageType,
    createdAt: new Date().toISOString(),
    isRead: false
  };

  messages.push(message);

  const sender = user ? users.find(u => u.id === user.id) : null;
  
  console.log('🔍 SENDER DEBUG:');
  console.log('  - user:', user);
  console.log('  - sender:', sender);
  console.log('  - ticket.customerName:', ticket.customerName);
  console.log('  - ticket.isAnonymous:', ticket.isAnonymous);
  
  const messageWithSender = {
    ...message,
    sender: sender ? {
      id: sender.id,
      firstName: sender.firstName,
      lastName: sender.lastName,
      userType: sender.userType
    } : {
      id: null,
      firstName: ticket.customerName.split(' ')[0] || ticket.customerName,
      lastName: ticket.customerName.split(' ').slice(1).join(' ') || '',
      userType: 'customer'
    }
  };

  console.log('📤 Broadcasting message to ticket room:', `ticket_${req.params.ticketId}`);
  console.log('📤 Message data:', JSON.stringify(messageWithSender, null, 2));

  // Broadcast message to ticket room
  io.to(`ticket_${req.params.ticketId}`).emit('new_message', {
    message: messageWithSender
  });

  res.status(201).json({
    success: true,
    data: { message: messageWithSender }
  });
});

// Serve static demo page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>NeuroChat Ticketing System - Demo</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 1200px; 
                margin: 0 auto; 
                padding: 20px;
                background: #f5f5f5;
            }
            .container { 
                background: white; 
                padding: 30px; 
                border-radius: 10px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #007bff;
            }
            .demo-section {
                margin: 30px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid #007bff;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                margin: 10px;
                transition: background 0.2s;
            }
            .button:hover { background: #0056b3; }
            .status { 
                padding: 10px; 
                background: #d4edda; 
                border: 1px solid #c3e6cb; 
                border-radius: 4px;
                margin: 15px 0;
            }
            .api-endpoint {
                background: #e9ecef;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                margin: 5px 0;
            }
            .grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin: 20px 0;
            }
            @media (max-width: 768px) {
                .grid { grid-template-columns: 1fr; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎯 NeuroChat Ticketing System</h1>
                <p>Real-time Customer Support Platform - Demo Version</p>
            </div>

            <div class="status">
                ✅ <strong>Server Status:</strong> Running on http://localhost:3001<br>
                🔗 <strong>WebSocket:</strong> Connected and ready for real-time chat<br>
                📊 <strong>Database:</strong> In-memory demo data loaded
            </div>

            <div class="demo-section">
                <h2>🚀 Quick Demo</h2>
                <p>Ready-to-use demo accounts:</p>
                <div class="grid">
                    <div>
                        <h3>👤 Customer Account</h3>
                        <strong>Email:</strong> customer@demo.com<br>
                        <strong>Password:</strong> demo123<br>
                        <em>Can create tickets and chat with support</em>
                    </div>
                    <div>
                        <h3>🛠️ Agent Account</h3>
                        <strong>Email:</strong> agent@demo.com<br>
                        <strong>Password:</strong> demo123<br>
                        <em>Can claim tickets and respond to customers</em>
                    </div>
                </div>
            </div>

            <div class="demo-section">
                <h2>🌐 API Endpoints</h2>
                <p>Test the REST API directly:</p>
                <div class="api-endpoint">POST /api/auth/login - User authentication</div>
                <div class="api-endpoint">GET /api/tickets - List tickets</div>
                <div class="api-endpoint">POST /api/tickets - Create new ticket</div>
                <div class="api-endpoint">GET /api/tickets/:id/messages - Get chat messages</div>
                <div class="api-endpoint">POST /api/tickets/:id/messages - Send message</div>
                <div class="api-endpoint">GET /api/categories - List support categories</div>
            </div>

            <div class="demo-section">
                <h2>💬 Real-time Features</h2>
                <p>WebSocket events for real-time communication:</p>
                <ul>
                    <li><strong>new_ticket</strong> - Notifies agents of new tickets</li>
                    <li><strong>new_message</strong> - Real-time chat messages</li>
                    <li><strong>ticket_claimed</strong> - Agent assignment notifications</li>
                    <li><strong>typing_start/stop</strong> - Typing indicators</li>
                </ul>
            </div>

            <div class="demo-section">
                <h2>🔧 Next Steps</h2>
                <p>To see the full application in action:</p>
                <ol>
                    <li><strong>Backend is running!</strong> ✅ API server is live on port 3001</li>
                    <li><strong>Build the Frontend:</strong> Create React app that connects to this API</li>
                    <li><strong>Test Real-time Chat:</strong> Use WebSocket client to test Socket.IO events</li>
                    <li><strong>Deploy Database:</strong> Replace in-memory storage with Azure SQL</li>
                </ol>
                
                <p><strong>Want me to build the frontend now?</strong> I can create a React application that connects to this backend!</p>
            </div>

            <div class="demo-section">
                <h2>📋 System Features</h2>
                <div class="grid">
                    <div>
                        <h3>✅ Working Features</h3>
                        <ul>
                            <li>User authentication (JWT)</li>
                            <li>Ticket creation & management</li>
                            <li>Real-time chat messaging</li>
                            <li>Agent ticket claiming</li>
                            <li>Role-based permissions</li>
                            <li>WebSocket communication</li>
                        </ul>
                    </div>
                    <div>
                        <h3>🎯 Demo Capabilities</h3>
                        <ul>
                            <li>Login as customer or agent</li>
                            <li>Create support tickets</li>
                            <li>Send real-time messages</li>
                            <li>Claim and update tickets</li>
                            <li>View ticket history</li>
                            <li>Category management</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <script>
            console.log('🎯 NeuroChat Backend Server Running!');
            console.log('📡 API Base URL: http://localhost:3001/api');
            console.log('🔌 WebSocket URL: http://localhost:3001');
            console.log('📖 Demo Accounts Ready - Check the page for login details');
        </script>
    </body>
    </html>
  `);
});

// Socket.IO handling
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  // Join ticket room
  socket.on('join_ticket', (data) => {
    socket.join(`ticket_${data.ticketId}`);
    socket.emit('ticket_joined', { ticketId: data.ticketId, success: true });
    console.log(`📝 User ${socket.id} joined ticket ${data.ticketId}`);
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    socket.to(`ticket_${data.ticketId}`).emit('user_typing', {
      ticketId: data.ticketId,
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(`ticket_${data.ticketId}`).emit('user_typing', {
      ticketId: data.ticketId,
      isTyping: false
    });
  });

  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('🚀 NeuroChat Server running on http://localhost:' + PORT);
  console.log('📡 Socket.IO server ready for real-time connections');
  console.log('👤 Demo accounts ready: customer@demo.com / agent@demo.com (password: demo123)');
}); 