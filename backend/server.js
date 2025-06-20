const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// In-memory storage (for demo - replace with real database)
let users = [];
let tickets = [];
let messages = [];
let internalComments = []; // New: Internal comments for tickets
let categories = [];

// Customer session tracking
let customerSessions = new Map(); // ticketId -> { customerId, socketId, isOnline, lastSeen }
let socketToTicketMap = new Map(); // socketId -> ticketId (for disconnect cleanup)

// Agent session tracking for presence indicators
let agentSessions = new Map(); // agentId -> { socketId, isOnline, lastSeen, joinedAt }
let socketToAgentMap = new Map(); // socketId -> agentId (for disconnect cleanup)

// Add some demo messages for testing
const addDemoMessages = () => {
  const demoMessages = [
    {
      id: uuidv4(),
      ticketId: tickets[0]?.id, // First ticket (Login Issues)
      senderId: demoUsers[0].id, // customer@demo.com
      content: 'I cannot login to my account. It keeps saying invalid credentials.',
      messageType: 'text',
      isAnonymous: false,
      senderName: null,
      createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString() // 4 minutes ago
    },
    {
      id: uuidv4(),
      ticketId: tickets[1]?.id, // Second ticket (Application Crash)
      senderId: demoUsers[0].id, // customer@demo.com
      content: 'The application crashed again while I was working on my project.',
      messageType: 'text',
      isAnonymous: false,
      senderName: null,
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 minutes ago
    },
    {
      id: uuidv4(),
      ticketId: tickets[1]?.id, // Second ticket (Application Crash)
      senderId: demoUsers[1].id, // agent@demo.com
      content: 'Hi! I can help you with this issue. Can you tell me what version of the application you are using?',
      messageType: 'text',
      isAnonymous: false,
      senderName: null,
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
    },
    {
      id: uuidv4(),
      ticketId: tickets[1]?.id, // Second ticket (Application Crash)
      senderId: demoUsers[0].id, // customer@demo.com
      content: 'I am using version 2.1.4. The crash happens when I click Save.',
      messageType: 'text',
      isAnonymous: false,
      senderName: null,
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
    },
    {
      id: uuidv4(),
      ticketId: tickets[2]?.id, // Third ticket (Billing Question)
      senderId: demoUsers[0].id, // customer@demo.com
      content: 'I was charged twice for my subscription this month. Can you help?',
      messageType: 'text',
      isAnonymous: false,
      senderName: null,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
    },
    {
      id: uuidv4(),
      ticketId: tickets[2]?.id, // Third ticket (Billing Question)
      senderId: demoUsers[2].id, // agent2@demo.com
      content: 'I have reviewed your account and processed a refund for the duplicate charge. You should see it in 3-5 business days.',
      messageType: 'text',
      isAnonymous: false,
      senderName: null,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    },
    {
      id: uuidv4(),
      ticketId: tickets[4]?.id, // Anonymous ticket (Feature Request)
      senderId: null,
      content: 'I would really love to see a dark mode option in the application. It would be much easier on the eyes.',
      messageType: 'text',
      isAnonymous: true,
      senderName: 'Anonymous User',
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutes ago
    }
  ];
  
  messages.push(...demoMessages);
  console.log('📨 Added demo messages:', demoMessages.length);
};

// Initialize categories
categories = [
  { id: uuidv4(), name: 'Software', description: 'Software-related issues', colorCode: '#28a745' },
  { id: uuidv4(), name: 'Hardware', description: 'Hardware problems', colorCode: '#dc3545' },
  { id: uuidv4(), name: 'Billing', description: 'Billing inquiries', colorCode: '#ffc107' },
  { id: uuidv4(), name: 'Account', description: 'Account management', colorCode: '#17a2b8' },
  { id: uuidv4(), name: 'General', description: 'General support', colorCode: '#6c757d' }
];

// Demo messages will be initialized after tickets are created
const demoUsers = [
  {
    id: uuidv4(),
    email: 'customer@demo.com',
    password: bcrypt.hashSync('demo123', 10),
    firstName: 'John',
    lastName: 'Customer',
    userType: 'customer',
    isActive: true,
    lastLogin: null,
    createdAt: new Date().toISOString(),
    avatarUrl: null
  },
  {
    id: uuidv4(),
    email: 'admin@demo.com',
    password: bcrypt.hashSync('demo123', 10),
    firstName: 'Jane',
    lastName: 'Admin',
    userType: 'agent',
    roleId: '1',
    roleName: 'Admin',
    permissions: ['tickets.create', 'tickets.edit', 'tickets.delete', 'tickets.message', 'users.access', 'users.create', 'users.edit', 'users.delete', 'audit.view', 'insights.view'],
    isActive: true,
    agentStatus: 'online',
    maxConcurrentTickets: 10,
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    createdAt: new Date().toISOString(),
    avatarUrl: null
  },
  {
    id: uuidv4(),
    email: 'tier2@demo.com',
    password: bcrypt.hashSync('demo123', 10),
    firstName: 'Mike',
    lastName: 'Senior',
    userType: 'agent',
    roleId: '2',
    roleName: 'Tier2',
    permissions: ['tickets.create', 'tickets.edit', 'tickets.message'],
    isActive: true,
    agentStatus: 'online',
    maxConcurrentTickets: 8,
    lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    createdAt: new Date().toISOString(),
    avatarUrl: null
  },
  {
    id: uuidv4(),
    email: 'agent@demo.com',
    password: bcrypt.hashSync('demo123', 10),
    firstName: 'Sarah',
    lastName: 'Agent',
    userType: 'agent',
    roleId: '3',
    roleName: 'Tier1',
    permissions: ['tickets.create', 'tickets.edit', 'tickets.message'],
    isActive: true,
    agentStatus: 'online',
    maxConcurrentTickets: 5,
    lastLogin: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    createdAt: new Date().toISOString(),
    avatarUrl: null
  },
  {
    id: uuidv4(),
    email: 'viewer@demo.com',
    password: bcrypt.hashSync('demo123', 10),
    firstName: 'Bob',
    lastName: 'Viewer',
    userType: 'agent',
    roleId: '4',
    roleName: 'Viewer',
    permissions: ['tickets.view'],
    isActive: true,
    agentStatus: 'online',
    maxConcurrentTickets: 3,
    lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    createdAt: new Date().toISOString(),
    avatarUrl: null
  }
];

users.push(...demoUsers);

// Create demo tickets
const demoTickets = [
  {
    id: uuidv4(),
    ticketNumber: '2506190001', // Today's first ticket
    title: 'Login Issues',
    description: 'Cannot login to my account',
    status: 'new',
    priority: 'high',
    customerId: demoUsers[0].id, // customer@demo.com
    agentId: null,
    categoryId: categories[3].id, // Account
    isAnonymous: false,
    customerName: null,
    customerEmail: null,
    customerPhone: '+1-555-0101',
    customerCompany: 'Acme Corporation',
    customerAddress: '456 Main Street, Downtown, NY 10001',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    ticketNumber: '2506190002', // Today's second ticket
    title: 'Application Crash',
    description: 'The application keeps crashing when I try to save my work',
    status: 'in_progress',
    priority: 'high',
    customerId: demoUsers[0].id, // customer@demo.com
    agentId: demoUsers[1].id, // agent@demo.com
    categoryId: categories[0].id, // Software
    isAnonymous: false,
    customerName: null,
    customerEmail: null,
    customerPhone: '+1-555-0202',
    customerCompany: 'Innovative Solutions Ltd',
    customerAddress: '789 Oak Avenue\nSuite 200\nTech City, CA 94102',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 minutes ago
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    ticketNumber: '2506170001', // 2 days ago, first ticket
    title: 'Billing Question',
    description: 'I was charged twice for my subscription',
    status: 'resolved',
    priority: 'medium',
    customerId: demoUsers[0].id, // customer@demo.com
    agentId: demoUsers[2].id, // agent2@demo.com
    categoryId: categories[2].id, // Billing
    isAnonymous: false,
    customerName: null,
    customerEmail: null,
    customerPhone: null,
    customerCompany: null,
    customerAddress: null,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
  },
  {
    id: uuidv4(),
    ticketNumber: '2506120001', // 7 days ago, first ticket
    title: 'Hardware Replacement',
    description: 'My keyboard is not working properly',
    status: 'resolved',
    priority: 'low',
    customerId: demoUsers[0].id, // customer@demo.com
    agentId: demoUsers[3].id, // agent3@demo.com
    categoryId: categories[1].id, // Hardware
    isAnonymous: false,
    customerName: null,
    customerEmail: null,
    customerPhone: null,
    customerCompany: null,
    customerAddress: null,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    resolvedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() // 6 days ago
  },
  {
    id: uuidv4(),
    ticketNumber: '2506190003', // Today's third ticket
    title: 'Feature Request',
    description: 'Can you add dark mode to the application?',
    status: 'new',
    priority: 'low',
    customerId: null,
    agentId: null,
    categoryId: categories[4].id, // General
    isAnonymous: true,
    customerName: 'Anonymous User',
    customerEmail: 'anonymous@example.com',
    customerPhone: '+1-555-0123',
    customerCompany: 'Tech Startup Inc.',
    customerAddress: '123 Tech Street, Innovation City, CA 94105',
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
  }
];

// Ticket counter for sequential numbering
let ticketCounters = {};

// Initialize the ticket counter based on existing demo tickets
ticketCounters['250619'] = 3; // Today has 3 tickets
ticketCounters['250617'] = 1; // 2 days ago has 1 ticket
ticketCounters['250612'] = 1; // 7 days ago has 1 ticket

tickets.push(...demoTickets);

// Add demo internal comments
const demoInternalComments = [
  {
    id: uuidv4(),
    ticketId: demoTickets[1].id, // Application Crash ticket
    agentId: demoUsers[1].id, // agent@demo.com
    content: 'Customer confirmed they are using version 2.1.4. Need to check known issues for this version.',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 minutes ago
    agentName: 'Jane Agent'
  },
  {
    id: uuidv4(),
    ticketId: demoTickets[1].id, // Application Crash ticket
    agentId: demoUsers[1].id, // agent@demo.com
    content: 'Found similar issue in bug tracker #BUG-2145. Escalating to development team.',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    agentName: 'Jane Agent'
  },
  {
    id: uuidv4(),
    ticketId: demoTickets[2].id, // Billing Question ticket
    agentId: demoUsers[2].id, // agent2@demo.com
    content: 'Verified duplicate charge in billing system. Processing refund now.',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    agentName: 'Mike Support'
  }
];

internalComments.push(...demoInternalComments);

// Initialize demo messages now that tickets are created
addDemoMessages();

// Initialize audit logs array early
let auditLogs = [];

// Generate demo audit logs
const generateDemoAuditLogs = () => {
  const actions = [
    'login_success', 'login_failed', 'ticket_created', 'ticket_updated', 
    'ticket_claimed', 'message_sent', 'customer_chat_joined', 'customer_chat_left'
  ];
  
  const agents = demoUsers.filter(u => u.userType === 'agent');
  const customers = demoUsers.filter(u => u.userType === 'customer');
  
  for (let i = 0; i < 50; i++) {
    const isCustomerAction = Math.random() > 0.6;
    const user = isCustomerAction ? customers[0] : agents[Math.floor(Math.random() * agents.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    let status = 'success';
    if (action === 'login_failed' || Math.random() > 0.9) {
      status = 'failed';
    } else if (Math.random() > 0.95) {
      status = 'warning';
    }
    
    const auditEntry = {
      id: uuidv4(),
      timestamp: timestamp.toISOString(),
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userType: user.userType,
      action,
      ticketNumber: Math.random() > 0.3 ? `TKT-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}` : null,
      targetType: action.includes('ticket') ? 'ticket' : action.includes('message') ? 'message' : 'session',
      targetId: uuidv4(),
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      country: ['USA', 'Canada', 'UK', 'Germany', 'France'][Math.floor(Math.random() * 5)],
      details: `Demo ${action.replace(/_/g, ' ')} action`,
      status
    };
    
    auditLogs.push(auditEntry);
  }
  
  console.log('📝 Generated demo audit logs:', auditLogs.length);
};

generateDemoAuditLogs();

// Health check endpoint (no authentication required)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Utility functions
const generateTicketNumber = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
  const day = now.getDate().toString().padStart(2, '0'); // Day with leading zero
  const dateKey = `${year}${month}${day}`;
  
  // Initialize counter for this date if it doesn't exist
  if (!ticketCounters[dateKey]) {
    ticketCounters[dateKey] = 0;
  }
  
  // Increment counter and format with leading zeros
  ticketCounters[dateKey]++;
  const sequentialNumber = ticketCounters[dateKey].toString().padStart(4, '0');
  
  return `${dateKey}${sequentialNumber}`;
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('🔐 Authentication failed: No token provided');
    return res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'Access token required' }});
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('🔐 Authentication failed: Token validation error:', err.message);
      return res.status(403).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' }});
    }
    console.log('🔐 Authentication successful for user:', decoded.sub, decoded.email);
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
    
    // Log failed login attempt
    logAudit({
      userId: user ? user.id : null,
      userName: user ? `${user.firstName} ${user.lastName}` : email,
      userType: user ? user.userType : 'unknown',
      action: 'login_failed',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Failed login attempt for ${email}`,
      status: 'failed'
    });
    
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    });
  }

  console.log('✅ Authentication successful for:', user.email);
  
  // Update lastLogin timestamp
  user.lastLogin = new Date().toISOString();
  console.log('🕒 Updated lastLogin for', user.email, 'to:', user.lastLogin);
  
  // Log successful login
  logAudit({
    userId: user.id,
    userName: `${user.firstName} ${user.lastName}`,
    userType: user.userType,
    action: 'login_success',
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: `Successful login`
  });
  
  const token = jwt.sign(
    { 
      sub: user.id, 
      email: user.email, 
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      roleId: user.roleId,
      roleName: user.roleName,
      permissions: user.permissions || []
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
        agentStatus: user.agentStatus || null,
        roleId: user.roleId,
        roleName: user.roleName,
        permissions: user.permissions || [],
        avatarUrl: user.avatarUrl || null
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

// This endpoint was removed to avoid conflict with User Management endpoint

// Get customer connection status for a ticket
app.get('/api/tickets/:id/customer-status', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Getting customer status for ticket ${id}`);
    console.log(`🔍 All customer sessions:`, Array.from(customerSessions.entries()));
    
    const session = customerSessions.get(id);
    console.log(`🔍 Found session for ticket ${id}:`, session);
    
    if (session) {
      const responseData = {
        isOnline: session.isOnline,
        lastSeen: session.lastSeen,
        customerId: session.customerId
      };
      console.log(`🔍 Returning session data:`, responseData);
      
      res.json({
        success: true,
        data: responseData
      });
    } else {
      const responseData = {
        isOnline: false,
        lastSeen: null,
        customerId: null
      };
      console.log(`🔍 No session found, returning default:`, responseData);
      
      res.json({
        success: true,
        data: responseData
      });
    }
  } catch (error) {
    console.error('Error getting customer status:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
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
      lastMessageAt: ticketMessages.length > 0 ? ticketMessages[ticketMessages.length - 1].createdAt : ticket.createdAt,
      messages: ticketMessages.map(msg => {
        const sender = users.find(u => u.id === msg.senderId);
        return {
          ...msg,
          sender: sender ? {
            id: sender.id,
            firstName: sender.firstName,
            lastName: sender.lastName,
            userType: sender.id === ticket.customerId ? 'customer' : sender.userType
          } : {
            id: null,
            firstName: ticket.customerName.split(' ')[0] || ticket.customerName,
            lastName: ticket.customerName.split(' ').slice(1).join(' ') || '',
            userType: 'customer'
          }
        };
      })
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

// Get single ticket by ID
app.get('/api/tickets/:id', authenticateToken, (req, res) => {
  console.log('🔍 GET SINGLE TICKET REQUEST');
  console.log('  - ticketId:', req.params.id);
  console.log('  - user:', req.user.sub, req.user.userType);
  
  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) {
    console.log('❌ Ticket not found');
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }
  
  // Check permissions
  if (req.user.userType === 'customer' && ticket.customerId !== req.user.sub) {
    console.log('❌ Permission denied - customer can only view own tickets');
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You can only view your own tickets' }
    });
  }
  
  // Enrich ticket with related data
  const customer = users.find(u => u.id === ticket.customerId);
  const agent = ticket.agentId ? users.find(u => u.id === ticket.agentId) : null;
  const category = categories.find(c => c.id === ticket.categoryId);
  const ticketMessages = messages.filter(m => m.ticketId === ticket.id);
  
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
    category,
    messageCount: ticketMessages.length,
    lastMessageAt: ticketMessages.length > 0 ? ticketMessages[ticketMessages.length - 1].createdAt : ticket.createdAt,
    messages: ticketMessages.map(msg => {
      const sender = users.find(u => u.id === msg.senderId);
      return {
        ...msg,
        sender: sender ? {
          id: sender.id,
          firstName: sender.firstName,
          lastName: sender.lastName,
          userType: sender.id === ticket.customerId ? 'customer' : sender.userType
        } : {
          id: null,
          firstName: ticket.customerName.split(' ')[0] || ticket.customerName,
          lastName: ticket.customerName.split(' ').slice(1).join(' ') || '',
          userType: 'customer'
        }
      };
    })
  };
  
  console.log('✅ Returning single ticket:', enrichedTicket.id);
  console.log('  - customerAddress:', enrichedTicket.customerAddress);
  
  res.json({
    success: true,
    data: {
      ticket: enrichedTicket
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

  // For agents, check if they have tickets.create permission
  if (user && user.userType === 'agent') {
    if (!user.permissions || !user.permissions.includes('tickets.create')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to create tickets' }
      });
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
    customerPhone: customerInfo?.phone || null,
    customerCompany: customerInfo?.company || null,
    customerAddress: customerInfo?.address || null,
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
  
  // Log ticket creation
  logAudit({
    userId: user ? user.id : null,
    userName: user ? `${user.firstName} ${user.lastName}` : customerInfo.name,
    userType: user ? user.userType : 'customer',
    action: 'ticket_created',
    ticketNumber: ticket.ticketNumber,
    targetType: 'ticket',
    targetId: ticket.id,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: `Created ticket: ${title} (Priority: ${priority}, Category: ${categoryId})`
  });

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

  // Check if user has tickets.edit permission (claiming is editing the ticket)
  if (!req.user.permissions || !req.user.permissions.includes('tickets.edit')) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to claim tickets' }
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
  
  // Log ticket claim
  logAudit({
    userId: req.user.sub,
    userName: `${req.user.firstName} ${req.user.lastName}`,
    userType: 'agent',
    action: 'ticket_claimed',
    ticketNumber: ticket.ticketNumber,
    targetType: 'ticket',
    targetId: ticket.id,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: `${req.user.firstName} ${req.user.lastName} (${req.user.roleName || 'Unknown Role'}) claimed ticket and changed status to in_progress`
  });

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
  console.log('🔧 TICKET UPDATE REQUEST RECEIVED');
  console.log('  - ticketId:', req.params.id);
  console.log('  - body:', req.body);
  console.log('  - customerAddress in body:', req.body.customerAddress);
  console.log('  - typeof customerAddress:', typeof req.body.customerAddress);
  
  if (req.user.userType !== 'agent') {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only agents can update tickets' }
    });
  }

  // Check if user has tickets.edit permission
  if (!req.user.permissions || !req.user.permissions.includes('tickets.edit')) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to edit tickets' }
    });
  }

  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  console.log('🔧 TICKET BEFORE UPDATE:');
  console.log('  - ticket.customerAddress:', ticket.customerAddress);

  // Only allow updating certain fields (exclude read-only fields like ticketNumber, createdAt)
  const allowedUpdates = [
    'title', 'description', 'status', 'priority', 'agentId',
    'customerName', 'customerEmail', 'customerPhone', 'customerCompany', 'customerAddress'
  ];
  const updates = {};
  
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  console.log('🔧 UPDATES OBJECT:');
  console.log('  - updates:', updates);
  console.log('  - updates.customerAddress:', updates.customerAddress);
  console.log('  - customerAddress included:', 'customerAddress' in updates);

  // If reassigning agent, validate the new agent exists and is active
  if (updates.agentId) {
    const newAgent = users.find(u => u.id === updates.agentId && u.userType === 'agent' && u.isActive);
    if (!newAgent) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_AGENT', message: 'Invalid or inactive agent selected' }
      });
    }
  }

  // Store original values for audit log
  const originalValues = {};
  Object.keys(updates).forEach(key => {
    originalValues[key] = ticket[key];
  });

  // Update the ticket
  Object.assign(ticket, updates);
  ticket.updatedAt = new Date().toISOString();
  
  // Add resolvedAt timestamp when ticket is resolved
  if (updates.status === 'resolved' && ticket.status === 'resolved') {
    ticket.resolvedAt = new Date().toISOString();
  }

  console.log('🔧 TICKET AFTER UPDATE:');
  console.log('  - ticket.customerAddress:', ticket.customerAddress);
  console.log(`🎫 Ticket ${req.params.id} updated by agent ${req.user.sub}:`, updates);
  
  // Log ticket update with human-readable values
  const changes = Object.keys(updates).map(key => {
    let originalValue = originalValues[key];
    let newValue = updates[key];
    
    // Convert agent IDs to human-readable names for audit trail
    if (key === 'agentId') {
      if (originalValue) {
        const originalAgent = users.find(u => u.id === originalValue);
        originalValue = originalAgent ? `${originalAgent.firstName} ${originalAgent.lastName} (${originalAgent.roleName || 'Unknown Role'})` : originalValue;
      } else {
        originalValue = 'Unassigned';
      }
      
      if (newValue) {
        const newAgent = users.find(u => u.id === newValue);
        newValue = newAgent ? `${newAgent.firstName} ${newAgent.lastName} (${newAgent.roleName || 'Unknown Role'})` : newValue;
      } else {
        newValue = 'Unassigned';
      }
    }
    
    // Convert customer IDs to human-readable names for audit trail
    if (key === 'customerId') {
      if (originalValue) {
        const originalCustomer = users.find(u => u.id === originalValue);
        originalValue = originalCustomer ? `${originalCustomer.firstName} ${originalCustomer.lastName}` : originalValue;
      } else {
        originalValue = 'Anonymous Customer';
      }
      
      if (newValue) {
        const newCustomer = users.find(u => u.id === newValue);
        newValue = newCustomer ? `${newCustomer.firstName} ${newCustomer.lastName}` : newValue;
      } else {
        newValue = 'Anonymous Customer';
      }
    }
    
    // Convert category IDs to human-readable names
    if (key === 'categoryId') {
      if (originalValue) {
        const originalCategory = categories.find(c => c.id === originalValue);
        originalValue = originalCategory ? originalCategory.name : originalValue;
      }
      
      if (newValue) {
        const newCategory = categories.find(c => c.id === newValue);
        newValue = newCategory ? newCategory.name : newValue;
      }
    }
    
    return `${key}: "${originalValue}" → "${newValue}"`;
  }).join(', ');
  
  logAudit({
    userId: req.user.sub,
    userName: `${req.user.firstName} ${req.user.lastName}`,
    userType: 'agent',
    action: 'ticket_updated',
    ticketNumber: ticket.ticketNumber,
    targetType: 'ticket',
    targetId: ticket.id,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: `Updated ticket fields: ${changes}`
  });

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

  console.log('🔧 ENRICHED RESPONSE TICKET:');
  console.log('  - enrichedTicket.customerAddress:', enrichedTicket.customerAddress);

  res.json({
    success: true,
    data: {
      ticket: enrichedTicket
    }
  });
});

// Delete ticket
app.delete('/api/tickets/:id', authenticateToken, (req, res) => {
  if (req.user.userType !== 'agent') {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only agents can delete tickets' }
    });
  }

  // Check if user has tickets.delete permission
  if (!req.user.permissions || !req.user.permissions.includes('tickets.delete')) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to delete tickets' }
    });
  }

  const ticketIndex = tickets.findIndex(t => t.id === req.params.id);
  if (ticketIndex === -1) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  const ticket = tickets[ticketIndex];
  
  // Log ticket deletion before removing it
  const assignedAgent = ticket.agentId ? users.find(u => u.id === ticket.agentId) : null;
  const assignedTo = assignedAgent ? `${assignedAgent.firstName} ${assignedAgent.lastName} (${assignedAgent.roleName || 'Unknown Role'})` : 'Unassigned';
  
  logAudit({
    userId: req.user.sub,
    userName: `${req.user.firstName} ${req.user.lastName}`,
    userType: 'agent',
    action: 'ticket_deleted',
    ticketNumber: ticket.ticketNumber,
    targetType: 'ticket',
    targetId: ticket.id,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: `Deleted ticket: "${ticket.title}" (Status: ${ticket.status}, Assigned to: ${assignedTo})`
  });
  
  // Remove the ticket from the array
  tickets.splice(ticketIndex, 1);
  
  // Also remove all messages associated with this ticket
  const messagesToRemove = messages.filter(m => m.ticketId === req.params.id);
  messagesToRemove.forEach(msg => {
    const msgIndex = messages.findIndex(m => m.id === msg.id);
    if (msgIndex !== -1) {
      messages.splice(msgIndex, 1);
    }
  });

  console.log(`🗑️ Ticket ${req.params.id} deleted by agent ${req.user.sub}`);
  console.log(`🗑️ Also removed ${messagesToRemove.length} associated messages`);

  // Notify connected clients about ticket deletion
  io.emit('ticket_deleted', {
    ticketId: ticket.id,
    deletedBy: req.user.sub,
    deletedAt: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      message: 'Ticket deleted successfully',
      ticketId: req.params.id,
      deletedAt: new Date().toISOString()
    }
  });
});

// Get internal comments for a ticket
app.get('/api/tickets/:ticketId/internal-comments', authenticateToken, (req, res) => {
  if (req.user.userType !== 'agent') {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only agents can view internal comments' }
    });
  }

  const ticket = tickets.find(t => t.id === req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  const ticketComments = internalComments
    .filter(c => c.ticketId === req.params.ticketId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  res.json({
    success: true,
    data: {
      comments: ticketComments
    }
  });
});

// Add internal comment to a ticket
app.post('/api/tickets/:ticketId/internal-comments', authenticateToken, (req, res) => {
  console.log('💬 INTERNAL COMMENT REQUEST RECEIVED');
  console.log('  - ticketId:', req.params.ticketId);
  console.log('  - body:', req.body);
  console.log('  - user:', req.user);
  console.log('  - userType:', req.user?.userType);

  if (req.user.userType !== 'agent') {
    console.log('  - REJECTED: User is not an agent');
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only agents can add internal comments' }
    });
  }

  const { content } = req.body;
  
  if (!content || !content.trim()) {
    console.log('  - REJECTED: No content provided');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Comment content is required' }
    });
  }

  const ticket = tickets.find(t => t.id === req.params.ticketId);
  if (!ticket) {
    console.log('  - REJECTED: Ticket not found');
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  const agent = users.find(u => u.id === req.user.sub);
  if (!agent) {
    console.log('  - REJECTED: Agent not found');
    return res.status(404).json({
      success: false,
      error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' }
    });
  }

  console.log('  - Agent found:', agent.firstName, agent.lastName);

  const comment = {
    id: uuidv4(),
    ticketId: req.params.ticketId,
    agentId: req.user.sub,
    content: content.trim(),
    createdAt: new Date().toISOString(),
    agentName: `${agent.firstName} ${agent.lastName}`
  };

  internalComments.push(comment);
  
  // Log internal comment addition
  logAudit({
    userId: req.user.sub,
    userName: `${agent.firstName} ${agent.lastName}`,
    userType: 'agent',
    action: 'internal_comment_added',
    ticketNumber: ticket.ticketNumber,
    targetType: 'comment',
    targetId: comment.id,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: `Added internal comment: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`
  });

  console.log(`💬 Internal comment added to ticket ${req.params.ticketId} by agent ${req.user.sub}`);
  console.log('💬 Comment created:', comment);

  res.status(201).json({
    success: true,
    data: {
      comment
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
          userType: sender.id === ticket.customerId ? 'customer' : sender.userType
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

// Get customer status for a ticket
app.get('/api/tickets/:ticketId/customer-status', authenticateToken, (req, res) => {
  // Only agents can check customer status
  if (req.user.userType !== 'agent') {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only agents can check customer status' }
    });
  }

  const ticket = tickets.find(t => t.id === req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  const session = customerSessions.get(req.params.ticketId);
  const customerStatus = {
    isOnline: session ? session.isOnline : false,
    lastSeen: session ? session.lastSeen : null,
    hasEverConnected: !!session
  };

  res.json({
    success: true,
    data: { customerStatus }
  });
});

// Close ticket (for customers - no authentication required)
app.post('/api/tickets/:ticketId/close', (req, res) => {
  const ticket = tickets.find(t => t.id === req.params.ticketId);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  // Only allow closing if the ticket is not already resolved
  if (ticket.status === 'resolved') {
    return res.status(400).json({
      success: false,
      error: { code: 'TICKET_ALREADY_CLOSED', message: 'Ticket is already closed' }
    });
  }

  // Update ticket status to resolved
  ticket.status = 'resolved';
  ticket.updatedAt = new Date().toISOString();
  ticket.resolvedAt = new Date().toISOString();

  console.log(`🎫 Ticket ${req.params.ticketId} closed by customer`);

  // Clean up customer session when ticket is closed
  const session = customerSessions.get(req.params.ticketId);
  if (session) {
    session.isOnline = false;
    session.lastSeen = new Date().toISOString();
    
    // Remove socket mapping if exists
    if (session.socketId) {
      socketToTicketMap.delete(session.socketId);
    }
    
    console.log(`🔴 Customer session for ticket ${req.params.ticketId} marked offline due to ticket closure`);
  }

  // Notify agents about ticket closure and customer disconnect
  io.emit('ticket_updated', {
    ticketId: ticket.id,
    updates: { status: 'resolved' },
    updatedBy: 'customer',
    updatedAt: ticket.updatedAt
  });

  // Also notify about customer disconnect
  io.to(`ticket_${req.params.ticketId}`).emit('customer_status_changed', {
    ticketId: req.params.ticketId,
    isOnline: false,
    lastSeen: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      message: 'Ticket closed successfully'
    }
  });
});

// Submit feedback without closing ticket (for customers - no authentication required)
app.post('/api/tickets/:ticketId/feedback', (req, res) => {
  const { resolution } = req.body;
  const ticket = tickets.find(t => t.id === req.params.ticketId);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  // Don't allow feedback on already resolved tickets
  if (ticket.status === 'resolved') {
    return res.status(400).json({
      success: false,
      error: { code: 'TICKET_ALREADY_CLOSED', message: 'Cannot submit feedback for closed ticket' }
    });
  }

  // Validate resolution value
  if (!resolution || !['resolved', 'not_resolved', 'partially_resolved'].includes(resolution)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid resolution value' }
    });
  }

  // Create a system message with the feedback (but don't close ticket)
  const feedbackMessages = {
    'resolved': 'Customer feedback: Problem resolved',
    'not_resolved': 'Customer feedback: Problem not resolved', 
    'partially_resolved': 'Customer feedback: Problem partially resolved'
  };

  const systemMessage = {
    id: uuidv4(),
    ticketId: req.params.ticketId,
    senderId: null,
    content: feedbackMessages[resolution],
    messageType: 'system',
    createdAt: new Date().toISOString(),
    isRead: false
  };

  messages.push(systemMessage);

  console.log(`🎫 Feedback submitted for ticket ${req.params.ticketId}: ${resolution}`);

  // Broadcast system message to agents
  const messageWithSender = {
    ...systemMessage,
    sender: {
      id: null,
      firstName: 'System',
      lastName: '',
      userType: 'system'
    }
  };

  io.to(`ticket_${req.params.ticketId}`).emit('new_message', {
    message: messageWithSender
  });

  res.json({
    success: true,
    data: {
      message: 'Feedback submitted successfully'
    }
  });
});

// Close ticket with feedback (for customers - no authentication required)
app.post('/api/tickets/:ticketId/close-with-feedback', (req, res) => {
  const { resolution } = req.body;
  const ticket = tickets.find(t => t.id === req.params.ticketId);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  // Only allow closing if the ticket is not already resolved
  if (ticket.status === 'resolved') {
    return res.status(400).json({
      success: false,
      error: { code: 'TICKET_ALREADY_CLOSED', message: 'Ticket is already closed' }
    });
  }

  // Validate resolution value
  if (!resolution || !['resolved', 'not_resolved', 'partially_resolved'].includes(resolution)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid resolution value' }
    });
  }

  // Update ticket status to resolved
  ticket.status = 'resolved';
  ticket.updatedAt = new Date().toISOString();
  ticket.resolvedAt = new Date().toISOString();

  // Create a system message with the resolution feedback
  const resolutionMessages = {
    'resolved': 'Ticket closed by customer. Problem: resolved',
    'not_resolved': 'Ticket closed by customer. Problem: not resolved', 
    'partially_resolved': 'Ticket closed by customer. Problem: partially resolved'
  };

  const systemMessage = {
    id: uuidv4(),
    ticketId: req.params.ticketId,
    senderId: null,
    content: resolutionMessages[resolution],
    messageType: 'system',
    createdAt: new Date().toISOString(),
    isRead: false
  };

  messages.push(systemMessage);

  console.log(`🎫 Ticket ${req.params.ticketId} closed by customer with resolution: ${resolution}`);

  // Clean up customer session when ticket is closed
  const session = customerSessions.get(req.params.ticketId);
  if (session) {
    session.isOnline = false;
    session.lastSeen = new Date().toISOString();
    
    // Remove socket mapping if exists
    if (session.socketId) {
      socketToTicketMap.delete(session.socketId);
    }
    
    console.log(`🔴 Customer session for ticket ${req.params.ticketId} marked offline due to ticket closure`);
  }

  // Broadcast system message to agents
  const messageWithSender = {
    ...systemMessage,
    sender: {
      id: null,
      firstName: 'System',
      lastName: '',
      userType: 'system'
    }
  };

  io.to(`ticket_${req.params.ticketId}`).emit('new_message', {
    message: messageWithSender
  });

  // Notify agents about ticket closure and customer disconnect
  io.emit('ticket_updated', {
    ticketId: ticket.id,
    updates: { status: 'resolved' },
    updatedBy: 'customer',
    updatedAt: ticket.updatedAt
  });

  // Also notify about customer disconnect
  io.to(`ticket_${req.params.ticketId}`).emit('customer_status_changed', {
    ticketId: req.params.ticketId,
    isOnline: false,
    lastSeen: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      message: 'Ticket closed successfully with feedback'
    }
  });
});

// Mark ticket as abandoned (for customers - no authentication required)
app.post('/api/tickets/:ticketId/abandon', (req, res) => {
  const { reason } = req.body;
  const ticket = tickets.find(t => t.id === req.params.ticketId);
  
  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
    });
  }

  // Don't mark as abandoned if already resolved
  if (ticket.status === 'resolved') {
    return res.json({
      success: true,
      data: { message: 'Ticket already resolved' }
    });
  }

  // Create a system message about the abandonment
  const systemMessage = {
    id: uuidv4(),
    ticketId: req.params.ticketId,
    senderId: null,
    content: 'Ticket abandoned by customer',
    messageType: 'system',
    createdAt: new Date().toISOString(),
    isRead: false
  };

  messages.push(systemMessage);

  console.log(`🎫 Ticket ${req.params.ticketId} abandoned by customer (reason: ${reason})`);

  // Clean up customer session
  const session = customerSessions.get(req.params.ticketId);
  if (session) {
    session.isOnline = false;
    session.lastSeen = new Date().toISOString();
    
    // Remove socket mapping if exists
    if (session.socketId) {
      socketToTicketMap.delete(session.socketId);
    }
    
    console.log(`🔴 Customer session for ticket ${req.params.ticketId} marked offline due to abandonment`);
  }

  // Broadcast system message to agents
  const messageWithSender = {
    ...systemMessage,
    sender: {
      id: null,
      firstName: 'System',
      lastName: '',
      userType: 'system'
    }
  };

  io.to(`ticket_${req.params.ticketId}`).emit('new_message', {
    message: messageWithSender
  });

  // Notify agents about customer disconnect
  io.to(`ticket_${req.params.ticketId}`).emit('customer_status_changed', {
    ticketId: req.params.ticketId,
    isOnline: false,
    lastSeen: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      message: 'Ticket marked as abandoned'
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

  // For agents, check if they have tickets.message permission
  if (user && user.userType === 'agent') {
    if (!user.permissions || !user.permissions.includes('tickets.message')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to send messages' }
      });
    }
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
  
  // Log message sending
  logAudit({
    userId: user ? user.id : null,
    userName: user ? `${user.firstName} ${user.lastName}` : ticket.customerName,
    userType: user ? (user.id === ticket.customerId ? 'customer' : user.userType) : 'customer',
    action: 'message_sent',
    ticketNumber: ticket.ticketNumber,
    targetType: 'message',
    targetId: message.id,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: `Sent message in ticket (${messageType}): ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`
  });

  const sender = user ? users.find(u => u.id === user.id) : null;
  
  console.log('🔍 SENDER DEBUG:');
  console.log('  - user:', user);
  console.log('  - sender:', sender);
  console.log('  - ticket.customerName:', ticket.customerName);
  console.log('  - ticket.customerId:', ticket.customerId);
  console.log('  - ticket.isAnonymous:', ticket.isAnonymous);
  console.log('  - sender.id === ticket.customerId:', sender?.id === ticket.customerId);
  console.log('  - determined userType:', sender?.id === ticket.customerId ? 'customer' : sender?.userType);
  
  const messageWithSender = {
    ...message,
    sender: sender ? {
      id: sender.id,
      firstName: sender.firstName,
      lastName: sender.lastName,
      userType: sender.id === ticket.customerId ? 'customer' : sender.userType
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and UUID
    const uniqueSuffix = Date.now() + '-' + uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed'
  ];
  
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.zip', '.rar', '.7z'
  ];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Supported formats: images (jpg, png, gif, etc.), documents (pdf, doc, docx, xls, xlsx, csv), and archives (zip, rar, 7z)'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// File upload endpoint
app.post('/api/tickets/:ticketId/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.log('❌ Multer error:', err.message);
      return res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: err.message }
      });
    }
    
    handleFileUpload(req, res);
  });
});

function handleFileUpload(req, res) {
  console.log('\n📎 FILE UPLOAD REQUEST RECEIVED');
  console.log('Ticket ID:', req.params.ticketId);
  console.log('File:', req.file ? req.file.originalname : 'No file');
  console.log('Authorization header:', req.headers.authorization ? 'Present' : 'Not present');
  
  try {
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' }
      });
    }

    const ticket = tickets.find(t => t.id === req.params.ticketId);
    console.log('Found ticket:', ticket ? `${ticket.ticketNumber} (isAnonymous: ${ticket.isAnonymous})` : 'Not found');
    
    if (!ticket) {
      console.log('❌ Ticket not found');
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
        console.log('Authenticated user:', user ? `${user.firstName} ${user.lastName} (${user.userType})` : 'Not found');
      } catch (error) {
        console.log('Token invalid or expired, continuing as anonymous');
      }
    } else {
      console.log('No authorization header, continuing as anonymous');
    }

    // For anonymous users, ensure they can only upload to their own ticket
    console.log('Permission check: user =', !!user, ', ticket.isAnonymous =', ticket.isAnonymous);
    if (!user && !ticket.isAnonymous) {
      console.log('❌ Access denied: anonymous user trying to upload to non-anonymous ticket');
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Access denied' }
      });
    }

    // Create file message
    const fileMessage = {
      id: uuidv4(),
      ticketId: req.params.ticketId,
      senderId: user ? user.id : null,
      content: `📎 Uploaded file: ${req.file.originalname}`,
      messageType: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
      createdAt: new Date().toISOString(),
      isRead: false,
      fileName: req.file.originalname,
      filePath: `uploads/${req.file.filename}`,
      fileSize: req.file.size,
      fileUrl: `/uploads/${req.file.filename}`
    };

    messages.push(fileMessage);

    // Log file upload
    logAudit({
      userId: user ? user.id : null,
      userName: user ? `${user.firstName} ${user.lastName}` : ticket.customerName,
      userType: user ? (user.id === ticket.customerId ? 'customer' : user.userType) : 'customer',
      action: 'file_uploaded',
      ticketNumber: ticket.ticketNumber,
      targetType: 'file',
      targetId: fileMessage.id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Uploaded file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`
    });

    const sender = user ? users.find(u => u.id === user.id) : null;
    
    const messageWithSender = {
      ...fileMessage,
      sender: sender ? {
        id: sender.id,
        firstName: sender.firstName,
        lastName: sender.lastName,
        userType: sender.id === ticket.customerId ? 'customer' : sender.userType
      } : {
        id: null,
        firstName: ticket.customerName.split(' ')[0] || ticket.customerName,
        lastName: ticket.customerName.split(' ').slice(1).join(' ') || '',
        userType: 'customer'
      }
    };

    console.log('📎 Broadcasting file message to ticket room:', `ticket_${req.params.ticketId}`);
    console.log('📎 File message data:', JSON.stringify(messageWithSender, null, 2));

    // Broadcast file message to ticket room
    io.to(`ticket_${req.params.ticketId}`).emit('new_message', {
      message: messageWithSender
    });

    res.status(201).json({
      success: true,
      data: { 
        message: messageWithSender,
        file: {
          originalName: req.file.originalname,
          fileName: req.file.filename,
          size: req.file.size,
          url: `/uploads/${req.file.filename}`
        }
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    // Delete the uploaded file if there was an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: error.message || 'File upload failed' }
    });
  }
}

// File download endpoint
app.get('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'File not found' }
    });
  }
  
  // Find the message that contains this file to get original filename
  const fileMessage = messages.find(m => m.filePath === `uploads/${filename}`);
  const originalName = fileMessage ? fileMessage.fileName : filename;
  
  res.download(filePath, originalName);
});

// Get all files for a ticket
app.get('/api/tickets/:ticketId/files', authenticateToken, (req, res) => {
  console.log('\n📁 GET FILES REQUEST');
  console.log('Ticket ID:', req.params.ticketId);
  console.log('User:', req.user?.email);
  console.log('Request headers:', {
    authorization: req.headers.authorization ? 'Present' : 'Missing',
    'content-type': req.headers['content-type']
  });
  console.log('All messages count:', messages.length);
  console.log('Messages for this ticket:', messages.filter(m => m.ticketId === req.params.ticketId).length);
  
  try {
    const ticket = tickets.find(t => t.id === req.params.ticketId);
    
    if (!ticket) {
      console.log('❌ Ticket not found');
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
      });
    }

    // Get all file messages for this ticket
    const fileMessages = messages.filter(m => 
      m.ticketId === req.params.ticketId && 
      (m.messageType === 'file' || m.messageType === 'image') &&
      m.fileName && m.filePath
    );

    console.log(`📁 Found ${fileMessages.length} files for ticket ${req.params.ticketId}`);

    // Transform file messages to file objects with additional metadata
    const files = fileMessages.map(msg => {
      const sender = users.find(u => u.id === msg.senderId);
      
      return {
        id: msg.id,
        fileName: msg.fileName,
        originalName: msg.fileName,
        fileSize: msg.fileSize,
        fileUrl: msg.fileUrl,
        filePath: msg.filePath,
        uploadedAt: msg.createdAt,
        messageType: msg.messageType,
        sender: sender ? {
          id: sender.id,
          firstName: sender.firstName,
          lastName: sender.lastName,
          userType: sender.userType
        } : {
          id: null,
          firstName: ticket.customerName?.split(' ')[0] || 'Customer',
          lastName: ticket.customerName?.split(' ').slice(1).join(' ') || '',
          userType: 'customer'
        }
      };
    });

    // Sort files by upload date (newest first)
    files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    console.log('📁 Returning files:', files.map(f => `${f.fileName} (${f.messageType})`));

    res.json({
      success: true,
      data: { files }
    });

  } catch (error) {
    console.error('❌ Error fetching files:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch files' }
    });
  }
});

// ==========================================
// USER MANAGEMENT ENDPOINTS
// ==========================================

// Store roles configuration
let rolesConfig = [
  { 
    id: '1', 
    name: 'Admin', 
    description: 'Full system access',
    permissions: {
      'tickets.create': true,
      'tickets.edit': true, 
      'tickets.delete': true,
      'tickets.message': true,
      'users.access': true,
      'audit.view': true,
      'insights.view': true
    }
  },
  { 
    id: '2', 
    name: 'Tier2', 
    description: 'Senior support agent',
    permissions: {
      'tickets.create': true,
      'tickets.edit': true,
      'tickets.delete': false,
      'tickets.message': true,
      'users.access': false,
      'audit.view': false
    }
  },
  { 
    id: '3', 
    name: 'Tier1', 
    description: 'Standard support agent',
    permissions: {
      'tickets.create': true,
      'tickets.edit': true,
      'tickets.delete': false,
      'tickets.message': true,
      'users.access': false,
      'audit.view': false
    }
  },
  { 
    id: '4', 
    name: 'Viewer', 
    description: 'Read-only access',
    permissions: {
      'tickets.create': false,
      'tickets.edit': false,
      'tickets.delete': false,
      'tickets.message': false,
      'users.access': false,
      'audit.view': false
    }
  }
];

// Get all roles
app.get('/api/roles', authenticateToken, (req, res) => {
  console.log('GET /api/roles endpoint hit');
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('users.access')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(rolesConfig);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new role
app.post('/api/roles', authenticateToken, (req, res) => {
  try {
    // Check permission  
    if (!req.user.permissions || !req.user.permissions.includes('users.access')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, description, permissions } = req.body;
    
    if (!name || !permissions) {
      return res.status(400).json({ message: 'Name and permissions are required' });
    }

    // Check if role name already exists
    const existingRole = rolesConfig.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (existingRole) {
      return res.status(409).json({ message: 'Role name already exists' });
    }

    const newRole = {
      id: (rolesConfig.length + 1).toString(),
      name,
      description: description || '',
      permissions
    };

    rolesConfig.push(newRole);
    res.status(201).json(newRole);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update role
app.put('/api/roles/:id', authenticateToken, (req, res) => {
  console.log('PUT /api/roles/:id endpoint hit with id:', req.params.id);
  console.log('Request body:', req.body);
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('users.access')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const roleIndex = rolesConfig.findIndex(r => r.id === id);
    if (roleIndex === -1) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Update role
    if (name !== undefined) rolesConfig[roleIndex].name = name;
    if (description !== undefined) rolesConfig[roleIndex].description = description;
    if (permissions !== undefined) rolesConfig[roleIndex].permissions = permissions;

    res.json(rolesConfig[roleIndex]);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete role
app.delete('/api/roles/:id', authenticateToken, (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('users.access')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;

    // Can't delete default roles
    if (['1', '2', '3', '4'].includes(id)) {
      return res.status(400).json({ message: 'Cannot delete default roles' });
    }

    const roleIndex = rolesConfig.findIndex(r => r.id === id);
    if (roleIndex === -1) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Check if any users have this role
    const usersWithRole = users.filter(u => u.roleId === id);
    if (usersWithRole.length > 0) {
      return res.status(400).json({ message: 'Cannot delete role: users are assigned to it' });
    }

    rolesConfig.splice(roleIndex, 1);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all agents
app.get('/api/agents', authenticateToken, (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('users.access')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const agents = users
      .filter(user => user.userType === 'agent')
      .map(user => {
        // Check if agent is currently online via socket session
        const session = agentSessions.get(user.id);
        const isCurrentlyOnline = session && session.isOnline;
        
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: `${user.firstName} ${user.lastName}`, // Add combined name for display
          roleName: user.roleName || 'Tier1',
          roleId: user.roleId || '3',
          isActive: user.isActive !== false,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          agentStatus: user.agentStatus || 'offline',
          isOnline: isCurrentlyOnline || false, // Add real-time online status
          lastSeen: session ? session.lastSeen : user.lastLogin,
          maxConcurrentTickets: user.maxConcurrentTickets || 5,
          permissions: user.permissions || []
        };
      });

    console.log('🔍 AGENTS ENDPOINT - Returning agents with lastLogin values:');
    agents.forEach(agent => {
      console.log(`  - ${agent.email}: lastLogin = ${agent.lastLogin}`);
    });

    res.json({
      success: true,
      data: {
        agents: agents
      }
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new agent
app.post('/api/agents', authenticateToken, async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('users.create')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { email, firstName, lastName, roleId, password, isActive, maxConcurrentTickets } = req.body;

    // Validation
    if (!email || !firstName || !lastName || !roleId || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Get role information from rolesConfig
    const role = rolesConfig.find(r => r.id === roleId);
    if (!role) {
      return res.status(400).json({ message: 'Invalid role ID' });
    }

    // Convert permissions object to array for compatibility
    const permissionArray = [];
    Object.keys(role.permissions).forEach(perm => {
      if (role.permissions[perm]) {
        permissionArray.push(perm);
      }
    });

    // Map new permissions to legacy format for compatibility
    const legacyPermissions = [];
    if (role.permissions['tickets.create']) legacyPermissions.push('tickets.create');
    if (role.permissions['tickets.edit']) legacyPermissions.push('tickets.edit');
    if (role.permissions['tickets.delete']) legacyPermissions.push('tickets.delete');
    if (role.permissions['tickets.message']) legacyPermissions.push('tickets.message');
    if (role.permissions['users.access']) {
      legacyPermissions.push('users.access', 'users.create', 'users.edit', 'users.delete');
    }
    if (role.permissions['audit.view']) legacyPermissions.push('audit.view');
    if (role.permissions['insights.view']) legacyPermissions.push('insights.view');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new agent
    const newAgent = {
      id: uuidv4(),
      email,
      firstName,
      lastName,
      password: hashedPassword,
      userType: 'agent',
      roleId,
      roleName: role.name,
      permissions: legacyPermissions,
      isActive: isActive !== false,
      agentStatus: 'offline',
      maxConcurrentTickets: maxConcurrentTickets || 5,
      createdAt: new Date().toISOString(),
      mustChangePassword: false,
      avatarUrl: null
    };

    users.push(newAgent);

    // Return agent without password
    const { password: _, ...agentResponse } = newAgent;
    res.status(201).json(agentResponse);
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update agent
app.put('/api/agents/:id', authenticateToken, (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('users.edit')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    const { firstName, lastName, roleId, isActive, maxConcurrentTickets, agentStatus } = req.body;

    const agentIndex = users.findIndex(u => u.id === id && u.userType === 'agent');
    if (agentIndex === -1) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    const agent = users[agentIndex];

    // Update role if provided
    if (roleId) {
      const role = rolesConfig.find(r => r.id === roleId);
      if (!role) {
        return res.status(400).json({ message: 'Invalid role ID' });
      }

      // Convert permissions for legacy compatibility
      const legacyPermissions = [];
      if (role.permissions['tickets.create']) legacyPermissions.push('tickets.create');
      if (role.permissions['tickets.edit']) legacyPermissions.push('tickets.edit');
      if (role.permissions['tickets.delete']) legacyPermissions.push('tickets.delete');
      if (role.permissions['tickets.message']) legacyPermissions.push('tickets.message');
      if (role.permissions['users.access']) {
        legacyPermissions.push('users.access', 'users.create', 'users.edit', 'users.delete');
      }
      if (role.permissions['audit.view']) legacyPermissions.push('audit.view');
      if (role.permissions['insights.view']) legacyPermissions.push('insights.view');

      agent.roleId = roleId;
      agent.roleName = role.name;
      agent.permissions = legacyPermissions;
    }

    // Update other fields
    if (firstName !== undefined) agent.firstName = firstName;
    if (lastName !== undefined) agent.lastName = lastName;
    if (isActive !== undefined) agent.isActive = isActive;
    if (maxConcurrentTickets !== undefined) agent.maxConcurrentTickets = maxConcurrentTickets;
    if (agentStatus !== undefined) agent.agentStatus = agentStatus;

    agent.updatedAt = new Date().toISOString();

    users[agentIndex] = agent;

    // Return agent without password
    const { password: _, ...agentResponse } = agent;
    res.json(agentResponse);
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete/Deactivate agent
app.delete('/api/agents/:id', authenticateToken, (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('users.delete')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    const { permanent } = req.query; // ?permanent=true for hard delete

    const agentIndex = users.findIndex(u => u.id === id && u.userType === 'agent');
    if (agentIndex === -1) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (permanent === 'true') {
      // Hard delete - remove from array
      users.splice(agentIndex, 1);
      res.json({ message: 'Agent permanently deleted' });
    } else {
      // Soft delete - just deactivate
      users[agentIndex].isActive = false;
      users[agentIndex].agentStatus = 'offline';
      users[agentIndex].updatedAt = new Date().toISOString();
      res.json({ message: 'Agent deactivated' });
    }
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset agent password
app.post('/api/agents/:id/reset-password', authenticateToken, async (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('users.edit')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id } = req.params;
    const { newPassword, sendEmail } = req.body;

    const agentIndex = users.findIndex(u => u.id === id && u.userType === 'agent');
    if (agentIndex === -1) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    let password = newPassword;
    if (!password) {
      // Generate temporary password
      password = 'temp' + Math.random().toString(36).slice(-8);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    users[agentIndex].password = hashedPassword;
    users[agentIndex].mustChangePassword = true;
    users[agentIndex].passwordResetToken = null;
    users[agentIndex].passwordResetExpires = null;
    users[agentIndex].updatedAt = new Date().toISOString();

    // In a real implementation, you would send an email here
    if (sendEmail) {
      console.log(`Password reset email would be sent to ${users[agentIndex].email} with temporary password: ${password}`);
    }

    res.json({ 
      message: 'Password reset successfully',
      temporaryPassword: !newPassword ? password : undefined
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==========================================
// PROFILE MANAGEMENT ENDPOINTS
// ==========================================

// Get current user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  console.log('👤 PROFILE GET REQUEST RECEIVED');
  console.log('  - userId:', req.user.sub);
  
  try {
    const user = users.find(u => u.id === req.user.sub);
    if (!user) {
      console.log('❌ User not found with ID:', req.user.sub);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('✅ Found user profile:', user.email);

    // Return user profile without password
    const { password: _, ...userProfile } = user;
    res.json(userProfile);
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile (name and avatar)
app.put('/api/profile', authenticateToken, (req, res) => {
  console.log('👤 PROFILE UPDATE REQUEST RECEIVED');
  console.log('  - userId:', req.user.sub);
  console.log('  - body:', req.body);
  
  try {
    const { firstName, lastName, avatarUrl } = req.body;
    
    const userIndex = users.findIndex(u => u.id === req.user.sub);
    if (userIndex === -1) {
      console.log('❌ User not found with ID:', req.user.sub);
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[userIndex];
    console.log('✅ Found user:', user.email);

    // Update profile fields
    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;

    console.log('✅ Profile updated successfully');

    // Return updated profile without password
    const { password: _, ...userProfile } = user;
    res.json(userProfile);
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Change password
app.put('/api/profile/password', authenticateToken, async (req, res) => {
  console.log('🔐 PASSWORD CHANGE REQUEST RECEIVED');
  console.log('  - userId:', req.user.sub);
  
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const userIndex = users.findIndex(u => u.id === req.user.sub);
    if (userIndex === -1) {
      console.log('❌ User not found with ID:', req.user.sub);
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[userIndex];
    console.log('✅ Found user for password change:', user.email);

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    user.password = hashedPassword;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==========================================
// AUDIT LOGGING SYSTEM
// ==========================================

// In-memory audit log storage (replace with database in production)
// auditLogs is declared earlier in the file

// Helper function to log audit events
const logAudit = (params) => {
  const {
    userId = null,
    userName = null,
    userType,
    action,
    ticketNumber = null,
    targetType = null,
    targetId = null,
    ipAddress = null,
    userAgent = null,
    country = null,
    details = null,
    status = 'success'
  } = params;

  const auditEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    userId,
    userName,
    userType,
    action,
    ticketNumber,
    targetType,
    targetId,
    ipAddress,
    userAgent,
    country,
    details: typeof details === 'object' ? JSON.stringify(details) : details,
    status
  };

  auditLogs.push(auditEntry);
  console.log('🔍 Audit Log:', auditEntry);
  
  // Keep only last 10000 entries in memory
  if (auditLogs.length > 10000) {
    auditLogs = auditLogs.slice(-10000);
  }
};

// Helper function to get client IP
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Get audit logs with filtering and pagination
app.get('/api/audit', authenticateToken, (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('audit.view')) {
      logAudit({
        userId: req.user.id,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        userType: 'agent',
        action: 'audit_access_denied',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        status: 'failed'
      });
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      page = 1,
      limit = 50,
      search = '',
      startDate = '',
      endDate = '',
      userType = '',
      action = '',
      status = ''
    } = req.query;

    let filteredLogs = [...auditLogs];

    // Apply filters
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log =>
        (log.userName && log.userName.toLowerCase().includes(searchTerm)) ||
        log.action.toLowerCase().includes(searchTerm) ||
        (log.ticketNumber && log.ticketNumber.toLowerCase().includes(searchTerm)) ||
        (log.details && log.details.toLowerCase().includes(searchTerm))
      );
    }

    if (startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
    }

    if (endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate);
    }

    if (userType) {
      filteredLogs = filteredLogs.filter(log => log.userType === userType);
    }

    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }

    if (status) {
      filteredLogs = filteredLogs.filter(log => log.status === status);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const paginatedLogs = filteredLogs.slice(offset, offset + limitNum);

    // Log the audit view access
    logAudit({
      userId: req.user.sub,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: 'agent',
      action: 'audit_viewed',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Viewed page ${page}, filters: ${JSON.stringify(req.query)}`
    });

    res.json({
      logs: paginatedLogs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(filteredLogs.length / limitNum),
        totalRecords: filteredLogs.length,
        hasNext: offset + limitNum < filteredLogs.length,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get audit log statistics
app.get('/api/audit/stats', authenticateToken, (req, res) => {
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('audit.view')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      total: auditLogs.length,
      last24h: auditLogs.filter(log => new Date(log.timestamp) >= last24h).length,
      last7d: auditLogs.filter(log => new Date(log.timestamp) >= last7d).length,
      byUserType: {
        agent: auditLogs.filter(log => log.userType === 'agent').length,
        customer: auditLogs.filter(log => log.userType === 'customer').length,
        system: auditLogs.filter(log => log.userType === 'system').length
      },
      byStatus: {
        success: auditLogs.filter(log => log.status === 'success').length,
        failed: auditLogs.filter(log => log.status === 'failed').length,
        warning: auditLogs.filter(log => log.status === 'warning').length
      },
      topActions: getTopActions()
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

function getTopActions() {
  const actionCounts = {};
  auditLogs.forEach(log => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  });
  
  return Object.entries(actionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));
}

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
  console.log('🔧 BACKEND: New socket connection established, ID:', socket.id);
  
  // Handle agent dashboard connection
  socket.on('agent_dashboard_join', (data) => {
    console.log('🔧 BACKEND: Received agent_dashboard_join event:', data);
    const { agentId, agentName } = data;
    console.log(`👨‍💼 Agent ${agentName} (${agentId}) joined dashboard`);
    
    // Track agent session
    agentSessions.set(agentId, {
      socketId: socket.id,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      joinedAt: new Date().toISOString()
    });
    
    socketToAgentMap.set(socket.id, agentId);
    
    console.log('🔧 BACKEND: Agent sessions after join:', Array.from(agentSessions.entries()));
    console.log('🔧 BACKEND: Socket to agent map:', Array.from(socketToAgentMap.entries()));
    
    // Notify all connected clients about agent status change
    console.log('🔧 BACKEND: Emitting agent_status_changed event to all clients');
    io.emit('agent_status_changed', {
      agentId,
      isOnline: true,
      lastSeen: new Date().toISOString()
    });
    
    console.log(`🟢 Agent ${agentName} is now online and event broadcasted`);
  });
  
  // Handle agent dashboard leave
  socket.on('agent_dashboard_leave', (data) => {
    const { agentId, agentName } = data;
    console.log(`👨‍💼 Agent ${agentName} (${agentId}) left dashboard`);
    
    const session = agentSessions.get(agentId);
    if (session && session.socketId === socket.id) {
      session.isOnline = false;
      session.lastSeen = new Date().toISOString();
      
      // Notify all connected clients about agent status change
      io.emit('agent_status_changed', {
        agentId,
        isOnline: false,
        lastSeen: new Date().toISOString()
      });
      
      console.log(`🔴 Agent ${agentName} is now offline`);
    }
  });

  // Join ticket room
  socket.on('join_ticket', (data) => {
    socket.join(`ticket_${data.ticketId}`);
    socket.emit('ticket_joined', { ticketId: data.ticketId, success: true });
    console.log(`📝 User ${socket.id} joined ticket ${data.ticketId}`);
    console.log(`📝 Join data:`, data);
    
    // Track customer session for the ticket
    const ticket = tickets.find(t => t.id === data.ticketId);
    console.log(`📝 Found ticket:`, ticket ? `${ticket.id} (isAnonymous: ${ticket.isAnonymous})` : 'NOT FOUND');
    
    // Determine if this is a customer connection
    // Priority: explicit isCustomer flag, then ticket existence check
    const shouldTrackCustomer = data.isCustomer || (ticket && ticket.isAnonymous) || (!ticket && data.isCustomer !== false);
    console.log(`📝 Should track customer: ${shouldTrackCustomer} (isCustomer: ${data.isCustomer}, ticketExists: ${!!ticket}, ticketIsAnonymous: ${ticket?.isAnonymous})`);
    
    if (shouldTrackCustomer) {
      // Track socket to ticket mapping for cleanup on disconnect
      socketToTicketMap.set(socket.id, data.ticketId);
      
      customerSessions.set(data.ticketId, {
        customerId: ticket?.customerId || 'anonymous',
        socketId: socket.id,
        isOnline: true,
        lastSeen: new Date().toISOString()
      });
      
      // Log customer entry
      logAudit({
        userId: ticket?.customerId || null,
        userName: ticket?.customerName || 'Anonymous Customer',
        userType: 'customer',
        action: 'customer_chat_joined',
        ticketNumber: ticket?.ticketNumber || null,
        targetType: 'session',
        targetId: socket.id,
        ipAddress: socket.request.connection.remoteAddress,
        userAgent: socket.handshake.headers['user-agent'],
        details: `Customer joined chat session for ticket ${data.ticketId}`
      });
      
      console.log(`🟢 Customer for ticket ${data.ticketId} is now online - session created:`, customerSessions.get(data.ticketId));
      
      // Notify agents that customer is online
      socket.to(`ticket_${data.ticketId}`).emit('customer_status_changed', {
        ticketId: data.ticketId,
        isOnline: true,
        lastSeen: new Date().toISOString()
      });
      
      console.log(`🟢 Notified agents about customer online status for ticket ${data.ticketId}`);
    } else {
      console.log(`ℹ️ Not tracking customer session for ticket ${data.ticketId} (user is likely an agent)`);
    }
  });

  // Handle leaving ticket room
  socket.on('leave_ticket', (data) => {
    socket.leave(`ticket_${data.ticketId}`);
    console.log(`📝 User ${socket.id} left ticket ${data.ticketId}`);
    
    // Update customer session status
    const session = customerSessions.get(data.ticketId);
    console.log(`📝 Found customer session for leave_ticket:`, session);
    
    if (session && session.socketId === socket.id) {
      session.isOnline = false;
      session.lastSeen = new Date().toISOString();
      
      // Log customer exit
      const ticket = tickets.find(t => t.id === data.ticketId);
      logAudit({
        userId: ticket?.customerId || null,
        userName: ticket?.customerName || 'Anonymous Customer',
        userType: 'customer',
        action: 'customer_chat_left',
        ticketNumber: ticket?.ticketNumber || null,
        targetType: 'session',
        targetId: socket.id,
        ipAddress: socket.request.connection.remoteAddress,
        userAgent: socket.handshake.headers['user-agent'],
        details: `Customer left chat session for ticket ${data.ticketId}`
      });
      
      // Remove socket to ticket mapping
      socketToTicketMap.delete(socket.id);
      
      // Notify agents that customer went offline
      socket.to(`ticket_${data.ticketId}`).emit('customer_status_changed', {
        ticketId: data.ticketId,
        isOnline: false,
        lastSeen: new Date().toISOString()
      });
      
      console.log(`🔴 Customer for ticket ${data.ticketId} is now offline - emitted customer_status_changed`);
    } else {
      console.log(`ℹ️ No customer session found for ticket ${data.ticketId} or socket mismatch`);
    }
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
    
    // Check if this socket was associated with an agent session
    const agentId = socketToAgentMap.get(socket.id);
    if (agentId) {
      const agentSession = agentSessions.get(agentId);
      console.log(`👨‍💼 Socket ${socket.id} was mapped to agent:`, agentId);
      
      if (agentSession && agentSession.socketId === socket.id && agentSession.isOnline) {
        agentSession.isOnline = false;
        agentSession.lastSeen = new Date().toISOString();
        
        // Notify all connected clients about agent going offline
        io.emit('agent_status_changed', {
          agentId,
          isOnline: false,
          lastSeen: new Date().toISOString()
        });
        
        console.log(`🔴 Agent ${agentId} disconnected and marked offline`);
      }
      
      // Clean up agent socket mapping
      socketToAgentMap.delete(socket.id);
    }
    
    // Check if this socket was associated with a customer session
    const ticketId = socketToTicketMap.get(socket.id);
    console.log(`📝 Socket ${socket.id} was mapped to ticket:`, ticketId);
    
    if (ticketId) {
      const session = customerSessions.get(ticketId);
      console.log(`📝 Found customer session for disconnect:`, session);
      
      if (session && session.socketId === socket.id && session.isOnline) {
        session.isOnline = false;
        session.lastSeen = new Date().toISOString();
        
        // Log customer disconnect
        const ticket = tickets.find(t => t.id === ticketId);
        logAudit({
          userId: ticket?.customerId || null,
          userName: ticket?.customerName || 'Anonymous Customer',
          userType: 'customer',
          action: 'customer_chat_disconnected',
          ticketNumber: ticket?.ticketNumber || null,
          targetType: 'session',
          targetId: socket.id,
          ipAddress: socket.request.connection.remoteAddress,
          userAgent: socket.handshake.headers['user-agent'],
          details: `Customer disconnected from chat session for ticket ${ticketId}`
        });
        
        // Notify agents that customer disconnected
        // Use io.to() instead of socket.to() because socket is already disconnecting
        io.to(`ticket_${ticketId}`).emit('customer_status_changed', {
          ticketId: ticketId,
          isOnline: false,
          lastSeen: new Date().toISOString()
        });
        
        console.log(`🔴 Customer for ticket ${ticketId} disconnected - emitted customer_status_changed`);
      } else {
        console.log(`ℹ️ Session not found, socket mismatch, or already offline for ticket ${ticketId}`);
      }
      
      // Clean up socket mapping
      socketToTicketMap.delete(socket.id);
    } else {
      console.log(`ℹ️ Socket ${socket.id} was not associated with any customer session`);
    }
  });
});

// ========================================
// INSIGHTS/ANALYTICS ENDPOINTS
// ========================================

// Helper function to generate real insights data from actual system data
function generateInsightsData(filters = {}) {
  const { timeRange = 'monthly', agentId, category } = filters;
  
  // Filter tickets based on filters
  let filteredTickets = tickets;
  if (agentId) {
    filteredTickets = filteredTickets.filter(t => t.agentId === agentId);
  }
  if (category) {
    filteredTickets = filteredTickets.filter(t => t.categoryId === category);
  }

  // Generate ticket volume data based on actual ticket creation dates
  const getTicketVolumeData = () => {
    const now = new Date();
    const data = [];
    const ticketCounts = {};
    
    // Initialize time periods
    if (timeRange === 'daily') {
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        ticketCounts[dateStr] = 0;
      }
    } else if (timeRange === 'monthly') {
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const dateStr = date.toISOString().slice(0, 7);
        ticketCounts[dateStr] = 0;
      }
    } else { // quarterly
      for (let i = 7; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - (i * 3));
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const dateStr = `${date.getFullYear()}-Q${quarter}`;
        ticketCounts[dateStr] = 0;
      }
    }

    // Count actual tickets by time period
    filteredTickets.forEach(ticket => {
      const createdDate = new Date(ticket.createdAt);
      let periodKey;
      
      if (timeRange === 'daily') {
        periodKey = createdDate.toISOString().split('T')[0];
      } else if (timeRange === 'monthly') {
        periodKey = createdDate.toISOString().slice(0, 7);
      } else { // quarterly
        const quarter = Math.floor(createdDate.getMonth() / 3) + 1;
        periodKey = `${createdDate.getFullYear()}-Q${quarter}`;
      }
      
      if (ticketCounts.hasOwnProperty(periodKey)) {
        ticketCounts[periodKey]++;
      }
    });

    // Convert to array format
    Object.keys(ticketCounts).forEach(date => {
      data.push({
        date,
        tickets: ticketCounts[date]
      });
    });
    
    return data.sort((a, b) => a.date.localeCompare(b.date));
  };

  // Generate geography data from audit logs (country field)
  const geographyData = {};
  auditLogs.forEach(log => {
    if (log.country) {
      geographyData[log.country] = (geographyData[log.country] || 0) + 1;
    }
  });
  
  const geographyArray = Object.entries(geographyData)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 countries

  // Generate top agents data from actual ticket assignments and resolutions
  const agentStats = {};
  users.filter(user => user.userType === 'agent').forEach(agent => {
    agentStats[agent.id] = {
      id: agent.id,
      name: `${agent.firstName} ${agent.lastName}`,
      ticketsResolved: 0,
      totalResolutionTime: 0,
      resolvedCount: 0,
      totalActiveTime: 0
    };
  });

  // Calculate actual resolution stats
  filteredTickets.forEach(ticket => {
    if (ticket.agentId && ticket.status === 'resolved' && ticket.resolvedAt) {
      const agentId = ticket.agentId;
      if (agentStats[agentId]) {
        agentStats[agentId].ticketsResolved++;
        agentStats[agentId].resolvedCount++;
        
        // Calculate resolution time in minutes
        const resolutionTime = (new Date(ticket.resolvedAt) - new Date(ticket.createdAt)) / (1000 * 60);
        agentStats[agentId].totalResolutionTime += resolutionTime;
      }
    }
  });

  // Calculate agent activity from audit logs with more realistic time calculation
  const agentLoginSessions = {};
  
  // Group login sessions by agent and date
  auditLogs
    .filter(log => log.action === 'login_success' && log.userType === 'agent')
    .forEach(log => {
      if (!agentLoginSessions[log.userId]) {
        agentLoginSessions[log.userId] = {};
      }
      
      const loginDate = new Date(log.timestamp).toDateString();
      if (!agentLoginSessions[log.userId][loginDate]) {
        agentLoginSessions[log.userId][loginDate] = [];
      }
      
      agentLoginSessions[log.userId][loginDate].push(new Date(log.timestamp));
    });

  // Calculate realistic work hours based on login patterns
  Object.keys(agentLoginSessions).forEach(agentId => {
    if (agentStats[agentId]) {
      let totalHours = 0;
      
      Object.keys(agentLoginSessions[agentId]).forEach(date => {
        const loginTimes = agentLoginSessions[agentId][date].sort((a, b) => a - b);
        
        if (loginTimes.length === 1) {
          // Single login: estimate 6-8 hours based on time of day
          const loginHour = loginTimes[0].getHours();
          if (loginHour >= 8 && loginHour <= 10) {
            totalHours += 8; // Full day
          } else if (loginHour >= 11 && loginHour <= 14) {
            totalHours += 6; // Partial day
          } else {
            totalHours += 4; // Short session
          }
        } else {
          // Multiple logins: calculate span between first and last login
          const firstLogin = loginTimes[0];
          const lastLogin = loginTimes[loginTimes.length - 1];
          const hoursDiff = (lastLogin - firstLogin) / (1000 * 60 * 60);
          
          // Cap at 10 hours max per day, minimum 2 hours
          totalHours += Math.min(Math.max(hoursDiff + 1, 2), 10);
        }
      });
      
      agentStats[agentId].totalActiveTime = totalHours;
    }
  });

  const topAgents = Object.values(agentStats)
    .map(agent => ({
      ...agent,
      avgResolutionTime: agent.resolvedCount > 0 ? Math.round(agent.totalResolutionTime / agent.resolvedCount) : 0
    }))
    .sort((a, b) => b.ticketsResolved - a.ticketsResolved);

  // Generate category data from actual tickets
  const categoryStats = {};
  categories.forEach(cat => {
    categoryStats[cat.id] = {
      name: cat.name,
      value: 0,
      color: cat.colorCode
    };
  });

  filteredTickets.forEach(ticket => {
    if (ticket.categoryId && categoryStats[ticket.categoryId]) {
      categoryStats[ticket.categoryId].value++;
    }
  });

  const categoryData = Object.values(categoryStats).filter(cat => cat.value > 0);

  // Calculate real resolution metrics
  const resolvedTickets = filteredTickets.filter(t => t.status === 'resolved' && t.resolvedAt);
  const resolutionTimes = resolvedTickets.map(ticket => 
    (new Date(ticket.resolvedAt) - new Date(ticket.createdAt)) / (1000 * 60) // minutes
  );

  const resolutionMetrics = {
    avgResolutionTime: resolutionTimes.length > 0 ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) : 0,
    minResolutionTime: resolutionTimes.length > 0 ? Math.round(Math.min(...resolutionTimes)) : 0,
    maxResolutionTime: resolutionTimes.length > 0 ? Math.round(Math.max(...resolutionTimes)) : 0
  };

  // Generate agent activity data from login logs with realistic time calculation
  const agentActivityData = users
    .filter(user => user.userType === 'agent')
    .map(agent => {
      // Get all login sessions for this agent in the selected time range
      const relevantLogs = auditLogs.filter(log => 
        log.userId === agent.id && 
        log.action === 'login_success'
      );
      
      // Group by date and calculate daily hours
      const dailyHours = {};
      relevantLogs.forEach(log => {
        const logDate = new Date(log.timestamp);
        const dateStr = logDate.toDateString();
        
        if (!dailyHours[dateStr]) {
          dailyHours[dateStr] = [];
        }
        dailyHours[dateStr].push(logDate);
      });
      
      // Calculate total hours for recent activity
      let totalRecentHours = 0;
      const last7Days = 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - last7Days);
      
      Object.keys(dailyHours).forEach(dateStr => {
        const date = new Date(dateStr);
        if (date >= cutoffDate) {
          const loginTimes = dailyHours[dateStr].sort((a, b) => a - b);
          
          if (loginTimes.length === 1) {
            // Single login: estimate based on time of day
            const loginHour = loginTimes[0].getHours();
            if (loginHour >= 8 && loginHour <= 10) {
              totalRecentHours += 8; // Full day
            } else if (loginHour >= 11 && loginHour <= 14) {
              totalRecentHours += 6; // Partial day
            } else {
              totalRecentHours += 4; // Short session
            }
          } else {
            // Multiple logins: calculate span
            const firstLogin = loginTimes[0];
            const lastLogin = loginTimes[loginTimes.length - 1];
            const hoursDiff = (lastLogin - firstLogin) / (1000 * 60 * 60);
            totalRecentHours += Math.min(Math.max(hoursDiff + 1, 2), 10);
          }
        }
      });
      
      return {
        agentId: agent.id,
        name: `${agent.firstName} ${agent.lastName}`,
        date: new Date().toISOString().split('T')[0],
        hoursWorked: Math.round(totalRecentHours * 10) / 10, // Round to 1 decimal
        avgDailyHours: agentStats[agent.id] ? Math.round((agentStats[agent.id].totalActiveTime / Math.max(Object.keys(dailyHours).length, 1)) * 10) / 10 : 0
      };
    });

  // Generate unresolved tickets data
  const unresolvedTicketsList = filteredTickets.filter(t => t.status !== 'resolved' && t.status !== 'closed');
  const overdueTickets = unresolvedTicketsList.filter(ticket => {
    const daysSinceCreated = (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreated > 3; // Consider overdue after 3 days
  });

  const avgAge = unresolvedTicketsList.length > 0 ? 
    Math.round(unresolvedTicketsList.reduce((sum, ticket) => {
      return sum + (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    }, 0) / unresolvedTicketsList.length) : 0;

  const unresolvedTickets = {
    count: unresolvedTicketsList.length,
    overdueCount: overdueTickets.length,
    avgAge,
    tickets: unresolvedTicketsList
      .slice(0, 5)
      .map(ticket => ({
        id: ticket.id,
        title: ticket.title,
        daysOpen: Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      }))
  };

  // Generate ticket flow data from actual ticket statuses
  const statusCounts = {
    'new': 0,
    'in_progress': 0,
    'resolved': 0,
    'closed': 0
  };

  // Debug: Log all ticket statuses to understand the data
  console.log('🔍 TICKET FLOW DEBUG: Analyzing', filteredTickets.length, 'tickets');
  const statusDebug = {};
  
  filteredTickets.forEach(ticket => {
    const status = ticket.status.toLowerCase().trim();
    
    // Count for debug
    statusDebug[status] = (statusDebug[status] || 0) + 1;
    
    // Map statuses correctly
    switch(status) {
      case 'new':
        statusCounts['new']++;
        break;
      case 'in_progress':
      case 'in-progress':
      case 'assigned':
      case 'open':
        statusCounts['in_progress']++;
        break;
      case 'resolved':
      case 'completed':
        statusCounts['resolved']++;
        break;
      case 'closed':
      case 'cancelled':
        statusCounts['closed']++;
        break;
      default:
        console.log('⚠️ Unknown ticket status:', status);
        // Default unknown statuses to 'new'
        statusCounts['new']++;
    }
  });

  console.log('🔍 TICKET FLOW DEBUG: Status breakdown:', statusDebug);
  console.log('🔍 TICKET FLOW DEBUG: Final counts:', statusCounts);

  const ticketFlowData = [
    { stage: 'New', count: statusCounts['new'], color: '#3B82F6' },
    { stage: 'In Progress', count: statusCounts['in_progress'], color: '#F59E0B' },
    { stage: 'Resolved', count: statusCounts['resolved'], color: '#10B981' },
    { stage: 'Closed', count: statusCounts['closed'], color: '#6B7280' }
  ];

  return {
    ticketVolumeData: getTicketVolumeData(),
    geographyData: geographyArray,
    topAgents,
    categoryData,
    resolutionMetrics,
    agentActivityData,
    unresolvedTickets,
    ticketFlowData
  };
}

// Get insights/analytics data
app.get('/api/insights', authenticateToken, (req, res) => {
  try {
    console.log('📊 INSIGHTS ENDPOINT CALLED by user:', req.user.sub);
    
    // Check if user has permission to view insights
    const user = users.find(u => u.id === req.user.sub);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    // Check permissions
    const hasInsightsPermission = user.permissions?.includes('insights.view');
    if (!hasInsightsPermission) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. Insights permission required.' }
      });
    }

    const filters = {
      timeRange: req.query.timeRange || 'monthly',
      agentId: req.query.agentId,
      category: req.query.category
    };

    const insightsData = generateInsightsData(filters);

    res.json({
      success: true,
      data: insightsData
    });

  } catch (error) {
    console.error('Error getting insights:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get insights data', details: error.message }
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('🚀 NeuroChat Server running on http://localhost:' + PORT);
  console.log('📡 Socket.IO server ready for real-time connections');
  console.log('👤 Demo accounts ready: customer@demo.com / agent@demo.com (password: demo123)');
}); 