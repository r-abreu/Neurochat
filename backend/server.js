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
const stringSimilarity = require('string-similarity');

// Import email services
const { sendChatFallbackEmail, sendAgentNotificationEmail, getEmailLogs, getEmailStats } = require('./services/emailService');
const { startEmailReceiver, stopEmailReceiver, setTickets, setMessages, processIncomingEmail } = require('./services/emailReceiver');

// Import AI services
const aiService = require('./services/aiService');
const documentService = require('./services/documentService');

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
let ticketDevices = []; // Ticket-device relationships

// AI Agent storage
let aiAgentConfig = {
  id: uuidv4(),
  model: 'gpt-4o',
  agent_name: 'NeuroAI',
  response_tone: 'Professional',
  attitude_style: 'Helpful',
  context_limitations: `Role: Technical Support AI Agent (Neurovirtual)
Primary Objective:
You are a professional, helpful, and secure AI assistant that provides technical support for Neurovirtual products. You assist users by answering questions, guiding through troubleshooting steps, and escalating issues when necessary—all while ensuring a safe, focused, and friendly interaction.

🎯 Supported Products
Devices: BWMini, BWIII
Software: BWAnalysis, BWCenter

Always begin by identifying the product in question:
"Is your question related to one of our devices (BWMini or BWIII), or our software (BWAnalysis or BWCenter)?"

💬 User Interaction Guidelines
Ask one question or provide one instruction at a time.
Avoid overwhelming the user.

For multi-step processes (3+ steps):
- Provide the steps gradually.
- Ask for user confirmation after each step before continuing.

If the user stops responding, wait 15 seconds, then ask:
"Just checking — did that help, or would you like more guidance?"

Maintain professionalism and end each interaction with a positive tone.

🔧 Special Case Handling
🚫 Device Appears Damaged
Ask: "Would you like to try a few troubleshooting steps to confirm if the device is damaged?"

If the user is certain the device is defective:
Ask for the serial number: "Please provide the device's serial number so I can escalate the issue to our support team."
After receiving the serial number, escalate appropriately.

⚠️ Sensor Not Working
Refer the user to the relevant troubleshooting or learning documentation.
If the issue persists or documentation does not resolve it, escalate the case.

💵 Request for Quote or Pricing
Do not provide any pricing directly. Instead, refer the user to sales:
"For pricing or quotes, please contact our sales team through this link: https://neurovirtual.com/technicalsupport/"

🔐 Data Safety & Support Protocols
No Mention of Training Data
Never reference internal or external data sources.

Request Serial Number Only When Required
Only ask for serial numbers in the case of hardware escalation.

Do Not Request or Retain Personal Data
Avoid asking for names, email addresses, or contact details unless required by support escalation protocol.

Stay Within Scope
If a user asks something unrelated to Neurovirtual devices or software, respond with:
"I'm here to help with Neurovirtual hardware and software. For anything outside this scope, please contact our team directly."

Graceful Fallback
If you cannot answer:
"I couldn't find the information in my support materials. I recommend reaching out to our support team directly for further help."

✅ Support Flow Summary
1. Identify the product (BWMini, BWIII, BWAnalysis, or BWCenter).
2. Guide using one question or instruction at a time.
3. For multi-step processes, give steps in parts, wait for confirmation.
4. If user disengages, follow up once after 15 seconds.
5. If device is defective, request the serial number, then escalate.
6. Refer pricing requests to sales.
7. For sensor issues, offer docs first, escalate if unresolved.
8. Never expose or retain personal or internal data.`,
  exceptions_behavior: 'warranty,refund,billing,escalate,human,pricing,sales,personal_data',
  confidence_threshold: 0.7,
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

let aiDocuments = [];
let aiDocumentChunks = [];
let aiResponses = [];

// Data persistence for AI documents
const AI_DOCUMENTS_FILE = path.join(__dirname, '../data/ai-documents.json');
const AI_CHUNKS_FILE = path.join(__dirname, '../data/ai-document-chunks.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load AI documents from persistent storage
function loadAIDocuments() {
  try {
    if (fs.existsSync(AI_DOCUMENTS_FILE)) {
      const data = fs.readFileSync(AI_DOCUMENTS_FILE, 'utf8');
      aiDocuments = JSON.parse(data);
      console.log(`📁 Loaded ${aiDocuments.length} AI documents from persistent storage`);
    }
  } catch (error) {
    console.error('Error loading AI documents:', error);
    aiDocuments = [];
  }

  try {
    if (fs.existsSync(AI_CHUNKS_FILE)) {
      const data = fs.readFileSync(AI_CHUNKS_FILE, 'utf8');
      aiDocumentChunks = JSON.parse(data);
      console.log(`📁 Loaded ${aiDocumentChunks.length} AI document chunks from persistent storage`);
    }
  } catch (error) {
    console.error('Error loading AI document chunks:', error);
    aiDocumentChunks = [];
  }
}

// Save AI documents to persistent storage
function saveAIDocuments() {
  try {
    fs.writeFileSync(AI_DOCUMENTS_FILE, JSON.stringify(aiDocuments, null, 2));
    console.log(`💾 Saved ${aiDocuments.length} AI documents to persistent storage`);
  } catch (error) {
    console.error('Error saving AI documents:', error);
  }

  try {
    fs.writeFileSync(AI_CHUNKS_FILE, JSON.stringify(aiDocumentChunks, null, 2));
    console.log(`💾 Saved ${aiDocumentChunks.length} AI document chunks to persistent storage`);
  } catch (error) {
    console.error('Error saving AI document chunks:', error);
  }
}

// Auto-save AI documents periodically (every 5 minutes)
setInterval(saveAIDocuments, 5 * 60 * 1000);

// Save on process exit
process.on('SIGINT', () => {
  console.log('\n🔄 Saving AI documents before exit...');
  saveAIDocuments();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Saving AI documents before exit...');
  saveAIDocuments();
  process.exit(0);
});

// Customer session tracking
let customerSessions = new Map(); // ticketId -> { customerId, socketId, isOnline, lastSeen }
let socketToTicketMap = new Map(); // socketId -> ticketId (for disconnect cleanup)

// Agent session tracking for presence indicators
let agentSessions = new Map(); // agentId -> { socketId, isOnline, lastSeen, joinedAt }
let socketToAgentMap = new Map(); // socketId -> agentId (for disconnect cleanup)

// NeuroAI Agent ID - will be created during initialization
let neuroAIAgentId = null;

// Create NeuroAI agent
const createNeuroAIAgent = () => {
  const aiAgentId = uuidv4();
  neuroAIAgentId = aiAgentId;
  
  const neuroAIAgent = {
    id: aiAgentId,
    email: 'neuroai@neurovirtual.com',
    password: bcrypt.hashSync('neuroai-secure-password', 10),
    firstName: 'NeuroAI',
    lastName: 'Assistant',
    userType: 'agent',
    roleId: '5', // Special AI agent role
    roleName: 'AI Agent',
    permissions: ['tickets.create', 'tickets.edit', 'tickets.message', 'customers.view', 'devices.view', 'companies.view'],
    isActive: true,
    agentStatus: 'online', // AI is always online when enabled
    maxConcurrentTickets: 1000, // AI can handle many tickets
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    avatarUrl: null,
    isAIAgent: true // Special flag to identify AI agent
  };

  // Check if NeuroAI agent already exists
  const existingAI = users.find(u => u.email === 'neuroai@neurovirtual.com' || u.isAIAgent);
  if (!existingAI) {
    users.push(neuroAIAgent);
    console.log('🤖 Created NeuroAI agent with ID:', aiAgentId);
    
    // Sync permissions with AI Agent role
    const aiRole = rolesConfig.find(r => r.id === '5');
    if (aiRole) {
      const rolePermissions = Object.keys(aiRole.permissions).filter(key => aiRole.permissions[key]);
      neuroAIAgent.permissions = rolePermissions;
      console.log('🔄 Synced NeuroAI agent permissions with AI Agent role:', rolePermissions);
    }
  } else {
    neuroAIAgentId = existingAI.id;
    console.log('🤖 NeuroAI agent already exists with ID:', existingAI.id);
    
    // Update existing AI agent to use role ID 5 and sync permissions
    existingAI.roleId = '5';
    existingAI.roleName = 'AI Agent';
    const aiRole = rolesConfig.find(r => r.id === '5');
    if (aiRole) {
      const rolePermissions = Object.keys(aiRole.permissions).filter(key => aiRole.permissions[key]);
      existingAI.permissions = rolePermissions;
      console.log('🔄 Updated existing NeuroAI agent with role ID 5 and permissions:', rolePermissions);
    }
  }

  // Ensure AI agent is always marked as online when AI is enabled
  if (aiAgentConfig.enabled) {
    agentSessions.set(neuroAIAgentId, {
      socketId: 'ai-virtual-session',
      isOnline: true,
      lastSeen: new Date().toISOString(),
      joinedAt: new Date().toISOString()
    });
  }

  return neuroAIAgentId;
};

// Function to assign ticket to NeuroAI when AI responds
const assignTicketToNeuroAI = (ticketId) => {
  if (!neuroAIAgentId || !aiAgentConfig.enabled) {
    return false;
  }

  const ticketIndex = tickets.findIndex(t => t.id === ticketId);
  if (ticketIndex === -1) {
    return false;
  }

  const ticket = tickets[ticketIndex];
  
  // Only assign if ticket is not already assigned to a human agent or if it's unassigned
  if (!ticket.agentId || ticket.agentId === neuroAIAgentId) {
    tickets[ticketIndex] = {
      ...ticket,
      agentId: neuroAIAgentId,
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log(`🤖 Assigned ticket ${ticket.ticketNumber} to NeuroAI`);
    
    // Broadcast assignment change
    io.to(`ticket_${ticketId}`).emit('ticket_assigned', {
      ticketId: ticketId,
      agentId: neuroAIAgentId,
      agentName: 'NeuroAI Assistant',
      assignedAt: new Date().toISOString()
    });

    return true;
  }

  return false;
};

// Function to unassign ticket from NeuroAI when human agent takes over
const unassignTicketFromNeuroAI = (ticketId, newAgentId = null) => {
  if (!neuroAIAgentId) {
    return false;
  }

  const ticketIndex = tickets.findIndex(t => t.id === ticketId);
  if (ticketIndex === -1) {
    return false;
  }

  const ticket = tickets[ticketIndex];
  
  // Only unassign if currently assigned to NeuroAI
  if (ticket.agentId === neuroAIAgentId) {
    tickets[ticketIndex] = {
      ...ticket,
      agentId: newAgentId,
      assignedAt: newAgentId ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };

    console.log(`🤖 Unassigned ticket ${ticket.ticketNumber} from NeuroAI${newAgentId ? ` and assigned to ${newAgentId}` : ''}`);
    
    // Broadcast assignment change
    io.to(`ticket_${ticketId}`).emit('ticket_assigned', {
      ticketId: ticketId,
      agentId: newAgentId,
      agentName: newAgentId ? users.find(u => u.id === newAgentId)?.firstName + ' ' + users.find(u => u.id === newAgentId)?.lastName : null,
      assignedAt: newAgentId ? new Date().toISOString() : null,
      previousAgent: 'NeuroAI Assistant'
    });

    return true;
  }

  return false;
};

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

// Initialize device models
let deviceModels = [
  { id: uuidv4(), name: 'BWIII', description: 'BrainWave III Device', isActive: true, displayOrder: 1 },
  { id: uuidv4(), name: 'BWMini', description: 'BrainWave Mini Device', isActive: true, displayOrder: 2 },
  { id: uuidv4(), name: 'Compass', description: 'Compass Navigation Device', isActive: true, displayOrder: 3 },
  { id: uuidv4(), name: 'Maxxi', description: 'Maxxi Advanced Device', isActive: true, displayOrder: 4 }
];

// Initialize customer types
let customerTypes = [
  { id: uuidv4(), name: 'Standard', description: 'Standard support level customer', colorCode: '#6c757d', isActive: true, displayOrder: 1 },
  { id: uuidv4(), name: 'VIP', description: 'VIP customer with priority support', colorCode: '#ffc107', isActive: true, displayOrder: 2 },
  { id: uuidv4(), name: 'Distributor', description: 'Product distributor with special support', colorCode: '#6f42c1', isActive: true, displayOrder: 3 }
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
    avatarUrl: null,
    companyId: null, // Will be set after companies are initialized
    company: 'Acme Corporation' // For display purposes
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
    permissions: ['tickets.create', 'tickets.edit', 'tickets.delete', 'tickets.message', 'users.access', 'users.create', 'users.edit', 'users.delete', 'audit.view', 'insights.view', 'customers.view', 'devices.view', 'devices.create', 'devices.edit', 'devices.delete', 'companies.view', 'companies.create', 'companies.edit', 'companies.delete'],
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

// Sync all users with their role permissions
const syncAllUserPermissions = () => {
  users.forEach(user => {
    if (user.roleId) {
      const role = rolesConfig.find(r => r.id === user.roleId);
      if (role) {
        const rolePermissions = Object.keys(role.permissions).filter(key => role.permissions[key]);
        user.permissions = rolePermissions;
        console.log(`🔄 Synced permissions for user ${user.email} with role ${role.name}:`, rolePermissions);
      }
    }
  });
};

// Call sync function after users are initialized - moved after rolesConfig declaration

// Create demo tickets
// Helper function to parse address into components
const parseAddress = (fullAddress) => {
  if (!fullAddress) {
    return {
      street: null,
      state: null,
      zipCode: null,
      country: 'United States'
    };
  }
  
  // Simple parsing logic for demo addresses
  const parts = fullAddress.split(',').map(part => part.trim());
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1]; // "NY 10001" or "CA 94102"
    const stateParts = lastPart.split(' ');
    const state = stateParts[0];
    const zipCode = stateParts[1];
    const street = parts.slice(0, -1).join(', ');
    
    return {
      street: street || null,
      state: state || null,
      zipCode: zipCode || null,
      country: 'United States'
    };
  }
  
  return {
    street: fullAddress,
    state: null,
    zipCode: null,
    country: 'United States'
  };
};

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
    customerStreetAddress: '456 Main Street',
    customerCity: 'Downtown',
    customerState: 'NY',
    customerZipCode: '10001',
    customerCountry: 'United States',
    customerType: 'Standard',
    deviceModel: 'BWIII',
    deviceSerialNumber: 'BW3-2024-001234',
    aiEnabled: true,
    aiDisabledReason: null,
    aiDisabledAt: null,
    aiDisabledBy: null,
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
    customerStreetAddress: '789 Oak Avenue, Suite 200',
    customerCity: 'Tech City',
    customerState: 'CA',
    customerZipCode: '94102',
    customerCountry: 'United States',
    customerType: 'VIP',
    deviceModel: 'BWMini',
    deviceSerialNumber: 'BWM-2024-005678',
    aiEnabled: false, // AI disabled manually for this ticket
    aiDisabledReason: 'manual',
    aiDisabledAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    aiDisabledBy: demoUsers[1].id,
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
    customerStreetAddress: null,
    customerCity: null,
    customerState: null,
    customerZipCode: null,
    customerCountry: null,
    customerType: 'Standard',
    deviceModel: null,
    deviceSerialNumber: null,
    aiEnabled: true,
    aiDisabledReason: null,
    aiDisabledAt: null,
    aiDisabledBy: null,
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
    customerStreetAddress: null,
    customerCity: null,
    customerState: null,
    customerZipCode: null,
    customerCountry: null,
    customerType: 'Standard',
    deviceModel: 'Compass',
    deviceSerialNumber: 'CMP-2023-009876',
    aiEnabled: true,
    aiDisabledReason: null,
    aiDisabledAt: null,
    aiDisabledBy: null,
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
    customerStreetAddress: '123 Tech Street',
    customerCity: 'Innovation City',
    customerState: 'CA',
    customerZipCode: '94105',
    customerCountry: 'United States',
    customerType: 'Distributor',
    deviceModel: 'Maxxi',
    deviceSerialNumber: 'MXX-2024-012345',
    aiEnabled: true,
    aiDisabledReason: null,
    aiDisabledAt: null,
    aiDisabledBy: null,
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

// CRITICAL FIX: Ensure all demo tickets have the customerCity field properly set
// This fixes the issue where customerCity was showing as null
tickets.forEach((ticket, index) => {
  if (!ticket.customerCity && ticket.customerAddress) {
    // Extract city from the address for tickets that don't have explicit city
    if (ticket.id === demoTickets[0].id) {
      ticket.customerCity = 'Downtown';
      ticket.customerStreetAddress = '456 Main Street';
      ticket.customerState = 'NY';
      ticket.customerZipCode = '10001';
      ticket.customerCountry = 'United States';
    } else if (ticket.id === demoTickets[1].id) {
      ticket.customerCity = 'Tech City';
      ticket.customerStreetAddress = '789 Oak Avenue, Suite 200';
      ticket.customerState = 'CA';
      ticket.customerZipCode = '94102';
      ticket.customerCountry = 'United States';
    } else if (ticket.id === demoTickets[4].id) {
      ticket.customerCity = 'Innovation City';
      ticket.customerStreetAddress = '123 Tech Street';
      ticket.customerState = 'CA';
      ticket.customerZipCode = '94105';
      ticket.customerCountry = 'United States';
    }
  }
});

// Debug: Log the ticket data to verify customerCity is set
console.log('🔧 DEBUG: Checking demo tickets after initialization:');
tickets.forEach((ticket, index) => {
  console.log(`  Ticket ${index + 1}: ${ticket.title}`);
  console.log(`    - customerCity: "${ticket.customerCity}"`);
  console.log(`    - customerAddress: "${ticket.customerAddress}"`);
  console.log(`    - customerStreetAddress: "${ticket.customerStreetAddress}"`);
  console.log(`    - deviceModel: "${ticket.deviceModel}"`);
  console.log(`    - deviceSerialNumber: "${ticket.deviceSerialNumber}"`);
});

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
const stringSimilarity = require('string-similarity');

// Import email services
const { sendChatFallbackEmail, sendAgentNotificationEmail, getEmailLogs, getEmailStats } = require('./services/emailService');
const { startEmailReceiver, stopEmailReceiver, setTickets, setMessages, processIncomingEmail } = require('./services/emailReceiver');

// Import AI services
const aiService = require('./services/aiService');
const documentService = require('./services/documentService');

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
let ticketDevices = []; // Ticket-device relationships

// AI Agent storage
let aiAgentConfig = {
  id: uuidv4(),
  model: 'gpt-4o',
  agent_name: 'NeuroAI',
  response_tone: 'Professional',
  attitude_style: 'Helpful',
  context_limitations: `Role: Technical Support AI Agent (Neurovirtual)
Primary Objective:
You are a professional, helpful, and secure AI assistant that provides technical support for Neurovirtual products. You assist users by answering questions, guiding through troubleshooting steps, and escalating issues when necessary—all while ensuring a safe, focused, and friendly interaction.

🎯 Supported Products
Devices: BWMini, BWIII
Software: BWAnalysis, BWCenter

Always begin by identifying the product in question:
"Is your question related to one of our devices (BWMini or BWIII), or our software (BWAnalysis or BWCenter)?"

💬 User Interaction Guidelines
Ask one question or provide one instruction at a time.
Avoid overwhelming the user.

For multi-step processes (3+ steps):
- Provide the steps gradually.
- Ask for user confirmation after each step before continuing.

If the user stops responding, wait 15 seconds, then ask:
"Just checking — did that help, or would you like more guidance?"

Maintain professionalism and end each interaction with a positive tone.

🔧 Special Case Handling
🚫 Device Appears Damaged
Ask: "Would you like to try a few troubleshooting steps to confirm if the device is damaged?"

If the user is certain the device is defective:
Ask for the serial number: "Please provide the device's serial number so I can escalate the issue to our support team."
After receiving the serial number, escalate appropriately.

⚠️ Sensor Not Working
Refer the user to the relevant troubleshooting or learning documentation.
If the issue persists or documentation does not resolve it, escalate the case.

💵 Request for Quote or Pricing
Do not provide any pricing directly. Instead, refer the user to sales:
"For pricing or quotes, please contact our sales team through this link: https://neurovirtual.com/technicalsupport/"

🔐 Data Safety & Support Protocols
No Mention of Training Data
Never reference internal or external data sources.

Request Serial Number Only When Required
Only ask for serial numbers in the case of hardware escalation.

Do Not Request or Retain Personal Data
Avoid asking for names, email addresses, or contact details unless required by support escalation protocol.

Stay Within Scope
If a user asks something unrelated to Neurovirtual devices or software, respond with:
"I'm here to help with Neurovirtual hardware and software. For anything outside this scope, please contact our team directly."

Graceful Fallback
If you cannot answer:
"I couldn't find the information in my support materials. I recommend reaching out to our support team directly for further help."

✅ Support Flow Summary
1. Identify the product (BWMini, BWIII, BWAnalysis, or BWCenter).
2. Guide using one question or instruction at a time.
3. For multi-step processes, give steps in parts, wait for confirmation.
4. If user disengages, follow up once after 15 seconds.
5. If device is defective, request the serial number, then escalate.
6. Refer pricing requests to sales.
7. For sensor issues, offer docs first, escalate if unresolved.
8. Never expose or retain personal or internal data.`,
  exceptions_behavior: 'warranty,refund,billing,escalate,human,pricing,sales,personal_data',
  confidence_threshold: 0.7,
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

let aiDocuments = [];
let aiDocumentChunks = [];
let aiResponses = [];

// Data persistence for AI documents
const AI_DOCUMENTS_FILE = path.join(__dirname, '../data/ai-documents.json');
const AI_CHUNKS_FILE = path.join(__dirname, '../data/ai-document-chunks.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load AI documents from persistent storage
function loadAIDocuments() {
  try {
    if (fs.existsSync(AI_DOCUMENTS_FILE)) {
      const data = fs.readFileSync(AI_DOCUMENTS_FILE, 'utf8');
      aiDocuments = JSON.parse(data);
      console.log(`📁 Loaded ${aiDocuments.length} AI documents from persistent storage`);
    }
  } catch (error) {
    console.error('Error loading AI documents:', error);
    aiDocuments = [];
  }

  try {
    if (fs.existsSync(AI_CHUNKS_FILE)) {
      const data = fs.readFileSync(AI_CHUNKS_FILE, 'utf8');
      aiDocumentChunks = JSON.parse(data);
      console.log(`📁 Loaded ${aiDocumentChunks.length} AI document chunks from persistent storage`);
    }
  } catch (error) {
    console.error('Error loading AI document chunks:', error);
    aiDocumentChunks = [];
  }
}

// Save AI documents to persistent storage
function saveAIDocuments() {
  try {
    fs.writeFileSync(AI_DOCUMENTS_FILE, JSON.stringify(aiDocuments, null, 2));
    console.log(`💾 Saved ${aiDocuments.length} AI documents to persistent storage`);
  } catch (error) {
    console.error('Error saving AI documents:', error);
  }

  try {
    fs.writeFileSync(AI_CHUNKS_FILE, JSON.stringify(aiDocumentChunks, null, 2));
    console.log(`💾 Saved ${aiDocumentChunks.length} AI document chunks to persistent storage`);
  } catch (error) {
    console.error('Error saving AI document chunks:', error);
  }
}

// Auto-save AI documents periodically (every 5 minutes)
setInterval(saveAIDocuments, 5 * 60 * 1000);

// Save on process exit
process.on('SIGINT', () => {
  console.log('\n🔄 Saving AI documents before exit...');
  saveAIDocuments();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Saving AI documents before exit...');
  saveAIDocuments();
  process.exit(0);
});

// Customer session tracking
let customerSessions = new Map(); // ticketId -> { customerId, socketId, isOnline, lastSeen }
let socketToTicketMap = new Map(); // socketId -> ticketId (for disconnect cleanup)

// Agent session tracking for presence indicators
let agentSessions = new Map(); // agentId -> { socketId, isOnline, lastSeen, joinedAt }
let socketToAgentMap = new Map(); // socketId -> agentId (for disconnect cleanup)

// NeuroAI Agent ID - will be created during initialization
let neuroAIAgentId = null;

// Create NeuroAI agent
const createNeuroAIAgent = () => {
  const aiAgentId = uuidv4();
  neuroAIAgentId = aiAgentId;
  
  const neuroAIAgent = {
    id: aiAgentId,
    email: 'neuroai@neurovirtual.com',
    password: bcrypt.hashSync('neuroai-secure-password', 10),
    firstName: 'NeuroAI',
    lastName: 'Assistant',
    userType: 'agent',
    roleId: '5', // Special AI agent role
    roleName: 'AI Agent',
    permissions: ['tickets.create', 'tickets.edit', 'tickets.message', 'customers.view', 'devices.view', 'companies.view'],
    isActive: true,
    agentStatus: 'online', // AI is always online when enabled
    maxConcurrentTickets: 1000, // AI can handle many tickets
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    avatarUrl: null,
    isAIAgent: true // Special flag to identify AI agent
  };

  // Check if NeuroAI agent already exists
  const existingAI = users.find(u => u.email === 'neuroai@neurovirtual.com' || u.isAIAgent);
  if (!existingAI) {
    users.push(neuroAIAgent);
    console.log('🤖 Created NeuroAI agent with ID:', aiAgentId);
    
    // Sync permissions with AI Agent role
    const aiRole = rolesConfig.find(r => r.id === '5');
    if (aiRole) {
      const rolePermissions = Object.keys(aiRole.permissions).filter(key => aiRole.permissions[key]);
      neuroAIAgent.permissions = rolePermissions;
      console.log('🔄 Synced NeuroAI agent permissions with AI Agent role:', rolePermissions);
    }
  } else {
    neuroAIAgentId = existingAI.id;
    console.log('🤖 NeuroAI agent already exists with ID:', existingAI.id);
    
    // Update existing AI agent to use role ID 5 and sync permissions
    existingAI.roleId = '5';
    existingAI.roleName = 'AI Agent';
    const aiRole = rolesConfig.find(r => r.id === '5');
    if (aiRole) {
      const rolePermissions = Object.keys(aiRole.permissions).filter(key => aiRole.permissions[key]);
      existingAI.permissions = rolePermissions;
      console.log('🔄 Updated existing NeuroAI agent with role ID 5 and permissions:', rolePermissions);
    }
  }

  // Ensure AI agent is always marked as online when AI is enabled
  if (aiAgentConfig.enabled) {
    agentSessions.set(neuroAIAgentId, {
      socketId: 'ai-virtual-session',
      isOnline: true,
      lastSeen: new Date().toISOString(),
      joinedAt: new Date().toISOString()
    });
  }

  return neuroAIAgentId;
};

// Function to assign ticket to NeuroAI when AI responds
const assignTicketToNeuroAI = (ticketId) => {
  if (!neuroAIAgentId || !aiAgentConfig.enabled) {
    return false;
  }

  const ticketIndex = tickets.findIndex(t => t.id === ticketId);
  if (ticketIndex === -1) {
    return false;
  }

  const ticket = tickets[ticketIndex];
  
  // Only assign if ticket is not already assigned to a human agent or if it's unassigned
  if (!ticket.agentId || ticket.agentId === neuroAIAgentId) {
    tickets[ticketIndex] = {
      ...ticket,
      agentId: neuroAIAgentId,
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log(`🤖 Assigned ticket ${ticket.ticketNumber} to NeuroAI`);
    
    // Broadcast assignment change
    io.to(`ticket_${ticketId}`).emit('ticket_assigned', {
      ticketId: ticketId,
      agentId: neuroAIAgentId,
      agentName: 'NeuroAI Assistant',
      assignedAt: new Date().toISOString()
    });

    return true;
  }

  return false;
};

// Function to unassign ticket from NeuroAI when human agent takes over
const unassignTicketFromNeuroAI = (ticketId, newAgentId = null) => {
  if (!neuroAIAgentId) {
    return false;
  }

  const ticketIndex = tickets.findIndex(t => t.id === ticketId);
  if (ticketIndex === -1) {
    return false;
  }

  const ticket = tickets[ticketIndex];
  
  // Only unassign if currently assigned to NeuroAI
  if (ticket.agentId === neuroAIAgentId) {
    tickets[ticketIndex] = {
      ...ticket,
      agentId: newAgentId,
      assignedAt: newAgentId ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };

    console.log(`🤖 Unassigned ticket ${ticket.ticketNumber} from NeuroAI${newAgentId ? ` and assigned to ${newAgentId}` : ''}`);
    
    // Broadcast assignment change
    io.to(`ticket_${ticketId}`).emit('ticket_assigned', {
      ticketId: ticketId,
      agentId: newAgentId,
      agentName: newAgentId ? users.find(u => u.id === newAgentId)?.firstName + ' ' + users.find(u => u.id === newAgentId)?.lastName : null,
      assignedAt: newAgentId ? new Date().toISOString() : null,
      previousAgent: 'NeuroAI Assistant'
    });

    return true;
  }

  return false;
};

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

// Initialize device models
let deviceModels = [
  { id: uuidv4(), name: 'BWIII', description: 'BrainWave III Device', isActive: true, displayOrder: 1 },
  { id: uuidv4(), name: 'BWMini', description: 'BrainWave Mini Device', isActive: true, displayOrder: 2 },
  { id: uuidv4(), name: 'Compass', description: 'Compass Navigation Device', isActive: true, displayOrder: 3 },
  { id: uuidv4(), name: 'Maxxi', description: 'Maxxi Advanced Device', isActive: true, displayOrder: 4 }
];

// Initialize customer types
let customerTypes = [
  { id: uuidv4(), name: 'Standard', description: 'Standard support level customer', colorCode: '#6c757d', isActive: true, displayOrder: 1 },
  { id: uuidv4(), name: 'VIP', description: 'VIP customer with priority support', colorCode: '#ffc107', isActive: true, displayOrder: 2 },
  { id: uuidv4(), name: 'Distributor', description: 'Product distributor with special support', colorCode: '#6f42c1', isActive: true, displayOrder: 3 }
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
    avatarUrl: null,
    companyId: null, // Will be set after companies are initialized
    company: 'Acme Corporation' // For display purposes
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
    permissions: ['tickets.create', 'tickets.edit', 'tickets.delete', 'tickets.message', 'users.access', 'users.create', 'users.edit', 'users.delete', 'audit.view', 'insights.view', 'customers.view', 'devices.view', 'devices.create', 'devices.edit', 'devices.delete', 'companies.view', 'companies.create', 'companies.edit', 'companies.delete'],
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

// Sync all users with their role permissions
const syncAllUserPermissions = () => {
  users.forEach(user => {
    if (user.roleId) {
      const role = rolesConfig.find(r => r.id === user.roleId);
      if (role) {
        const rolePermissions = Object.keys(role.permissions).filter(key => role.permissions[key]);
        user.permissions = rolePermissions;
        console.log(`🔄 Synced permissions for user ${user.email} with role ${role.name}:`, rolePermissions);
      }
    }
  });
};

// Call sync function after users are initialized - moved after rolesConfig declaration

// Create demo tickets
// Helper function to parse address into components
const parseAddress = (fullAddress) => {
  if (!fullAddress) {
    return {
      street: null,
      state: null,
      zipCode: null,
      country: 'United States'
    };
  }
  
  // Simple parsing logic for demo addresses
  const parts = fullAddress.split(',').map(part => part.trim());
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1]; // "NY 10001" or "CA 94102"
    const stateParts = lastPart.split(' ');
    const state = stateParts[0];
    const zipCode = stateParts[1];
    const street = parts.slice(0, -1).join(', ');
    
    return {
      street: street || null,
      state: state || null,
      zipCode: zipCode || null,
      country: 'United States'
    };
  }
  
  return {
    street: fullAddress,
    state: null,
    zipCode: null,
    country: 'United States'
  };
};

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
    customerStreetAddress: '456 Main Street',
    customerCity: 'Downtown',
    customerState: 'NY',
    customerZipCode: '10001',
    customerCountry: 'United States',
    customerType: 'Standard',
    deviceModel: 'BWIII',
    deviceSerialNumber: 'BW3-2024-001234',
    aiEnabled: true,
    aiDisabledReason: null,
    aiDisabledAt: null,
    aiDisabledBy: null,
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
    customerStreetAddress: '789 Oak Avenue, Suite 200',
    customerCity: 'Tech City',
    customerState: 'CA',
    customerZipCode: '94102',
    customerCountry: 'United States',
    customerType: 'VIP',
    deviceModel: 'BWMini',
    deviceSerialNumber: 'BWM-2024-005678',
    aiEnabled: false, // AI disabled manually for this ticket
    aiDisabledReason: 'manual',
    aiDisabledAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    aiDisabledBy: demoUsers[1].id,
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
    customerStreetAddress: null,
    customerCity: null,
    customerState: null,
    customerZipCode: null,
    customerCountry: null,
    customerType: 'Standard',
    deviceModel: null,
    deviceSerialNumber: null,
    aiEnabled: true,
    aiDisabledReason: null,
    aiDisabledAt: null,
    aiDisabledBy: null,
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
    customerStreetAddress: null,
    customerCity: null,
    customerState: null,
    customerZipCode: null,
    customerCountry: null,
    customerType: 'Standard',
    deviceModel: 'Compass',
    deviceSerialNumber: 'CMP-2023-009876',
    aiEnabled: true,
    aiDisabledReason: null,
    aiDisabledAt: null,
    aiDisabledBy: null,
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
    customerStreetAddress: '123 Tech Street',
    customerCity: 'Innovation City',
    customerState: 'CA',
    customerZipCode: '94105',
    customerCountry: 'United States',
    customerType: 'Distributor',
    deviceModel: 'Maxxi',
    deviceSerialNumber: 'MXX-2024-012345',
    aiEnabled: true,
    aiDisabledReason: null,
    aiDisabledAt: null,
    aiDisabledBy: null,
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

// CRITICAL FIX: Ensure all demo tickets have the customerCity field properly set
// This fixes the issue where customerCity was showing as null
tickets.forEach((ticket, index) => {
  if (!ticket.customerCity && ticket.customerAddress) {
    // Extract city from the address for tickets that don't have explicit city
    if (ticket.id === demoTickets[0].id) {
      ticket.customerCity = 'Downtown';
      ticket.customerStreetAddress = '456 Main Street';
      ticket.customerState = 'NY';
      ticket.customerZipCode = '10001';
      ticket.customerCountry = 'United States';
    } else if (ticket.id === demoTickets[1].id) {
      ticket.customerCity = 'Tech City';
      ticket.customerStreetAddress = '789 Oak Avenue, Suite 200';
      ticket.customerState = 'CA';
      ticket.customerZipCode = '94102';
      ticket.customerCountry = 'United States';
    } else if (ticket.id === demoTickets[4].id) {
      ticket.customerCity = 'Innovation City';
      ticket.customerStreetAddress = '123 Tech Street';
      ticket.customerState = 'CA';
      ticket.customerZipCode = '94105';
      ticket.customerCountry = 'United States';
    }
  }
});

// Debug: Log the ticket data to verify customerCity is set
console.log('🔧 DEBUG: Checking demo tickets after initialization:');
tickets.forEach((ticket, index) => {
  console.log(`  Ticket ${index + 1}: ${ticket.title}`);
  console.log(`    - customerCity: "${ticket.customerCity}"`);
  console.log(`    - customerAddress: "${ticket.customerAddress}"`);
  console.log(`    - customerStreetAddress: "${ticket.customerStreetAddress}"`);
  console.log(`    - deviceModel: "${ticket.deviceModel}"`);
  console.log(`    - deviceSerialNumber: "${ticket.deviceSerialNumber}"`);
});

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

// Initialize demo devices first
const initializeDemoDevices = () => {
  // Get the customer's company ID for proper device association
  const customer = demoUsers[0]; // customer@demo.com
  const customerCompanyId = customer.companyId || null;

  const demoDevices = [
    {
      id: uuidv4(),
      customerId: customer.id,
      companyId: customerCompanyId, // Associate with customer's company
      model: 'BWIII',
      serialNumber: 'BW3-2024-001234',
      warrantyExpires: '2025-12-31',
      invoiceNumber: 'INV-2024-5678',
      invoiceDate: '2024-01-15',
      comments: 'Initial device purchase - standard warranty',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      customerId: customer.id,
      companyId: customerCompanyId, // Associate with customer's company
      model: 'BWMini',
      serialNumber: 'BWM-2024-005678',
      warrantyExpires: '2025-06-30',
      invoiceNumber: 'INV-2024-9012',
      invoiceDate: '2024-02-20',
      comments: 'Replacement device under warranty',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: uuidv4(),
      customerId: customer.id,
      companyId: customerCompanyId, // Associate with customer's company
      model: 'Compass',
      serialNumber: 'CMP-2024-003456',
      warrantyExpires: '2025-08-15',
      invoiceNumber: 'INV-2024-3456',
      invoiceDate: '2024-03-10',
      comments: 'Compass device for navigation projects',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  devices.push(...demoDevices);
  console.log('🔧 Added demo devices:', demoDevices.length);
  console.log('🏢 Devices associated with company ID:', customerCompanyId);
};

// Initialize devices array before using it
let devices = [];

// Initialize demo messages now that tickets are created
addDemoMessages();

// (Device auto-creation will be called after companies are initialized)

// Link demo customers to companies (done after companies are initialized later in the file)
const linkCustomersToCompanies = () => {
  // Find the demo customer
  const customer = users.find(u => u.email === 'customer@demo.com');
  if (customer) {
    // Find Acme Corporation company
    const acmeCompany = companies.find(c => c.name === 'Acme Corporation');
    if (acmeCompany) {
      customer.companyId = acmeCompany.id;
      console.log('🏢 Linked customer', customer.email, 'to company', acmeCompany.name);
    }
  }
};

// This will be called after companies are initialized
// initializeDemoDevices will be called from linkCustomersToCompanies

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

// Get device models
app.get('/api/device-models', (req, res) => {
  res.json({
    success: true,
    data: { deviceModels }
  });
});

// Get customer types
app.get('/api/customer-types', (req, res) => {
  res.json({
    success: true,
    data: { customerTypes }
  });
});

// Get system settings for frontend components (authenticated users)
app.get('/api/system-settings/public', authenticateToken, (req, res) => {
  try {
    // Return only settings that frontend components need
    const publicSettings = {
      urgency_yellow_unassigned: systemSettings.urgency_yellow_unassigned,
      urgency_red_unassigned: systemSettings.urgency_red_unassigned,
      urgency_yellow_in_progress: systemSettings.urgency_yellow_in_progress,
      urgency_red_in_progress: systemSettings.urgency_red_in_progress,
      sound_enabled_green: systemSettings.sound_enabled_green,
      sound_enabled_yellow: systemSettings.sound_enabled_yellow,
      sound_enabled_red: systemSettings.sound_enabled_red,
      customer_timeout_minutes: systemSettings.customer_timeout_minutes,
    };

    res.json({
      success: true,
      data: { settings: publicSettings }
    });
  } catch (error) {
    console.error('Error fetching public system settings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
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
        
        // Handle AI messages (sender could be null or NeuroAI agent)
        if (!sender && (msg.senderId === null || msg.senderId === neuroAIAgentId)) {
          // Legacy AI messages (with null senderId) or new NeuroAI messages
          const isAIMessage = aiService.isEnabled() && (
            msg.messageType === 'text' || 
            msg.messageType === 'system'
          ) && (msg.senderId === null || msg.senderId === neuroAIAgentId);
          
          if (isAIMessage) {
            // Check existing AI responses to confirm this is an AI message
            const aiResponse = aiResponses.find(ar => ar.messageId === msg.id);
            
            if (aiResponse) {
              return {
                ...msg,
                sender: {
                  id: neuroAIAgentId,
                  firstName: aiAgentConfig.agent_name || 'NeuroAI',
                  lastName: 'Assistant',
                  userType: 'ai'
                }
              };
            }
          }
        }
        
        // Handle NeuroAI agent messages directly
        if (sender && sender.isAIAgent) {
          return {
            ...msg,
            sender: {
              id: sender.id,
              firstName: sender.firstName,
              lastName: sender.lastName,
              userType: 'ai'
            }
          };
        }
        
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
    // AI Summary fields
    resolutionSummary: ticket.resolutionSummary || null,
    resolutionSummaryGeneratedAt: ticket.resolutionSummaryGeneratedAt || null,
    resolutionSummaryModelVersion: ticket.resolutionSummaryModelVersion || null,
    resolutionSummaryGeneratedBy: ticket.resolutionSummaryGeneratedBy || null,
    messages: ticketMessages.map(msg => {
      const sender = users.find(u => u.id === msg.senderId);
      
      // Handle AI messages (sender could be null or NeuroAI agent)
      if (!sender && (msg.senderId === null || msg.senderId === neuroAIAgentId)) {
        // Legacy AI messages (with null senderId) or new NeuroAI messages
        const isAIMessage = aiService.isEnabled() && (
          msg.messageType === 'text' || 
          msg.messageType === 'system'
        ) && (msg.senderId === null || msg.senderId === neuroAIAgentId);
        
        if (isAIMessage) {
          // Check existing AI responses to confirm this is an AI message
          const aiResponse = aiResponses.find(ar => ar.messageId === msg.id);
          
          if (aiResponse) {
            return {
              ...msg,
              sender: {
                id: neuroAIAgentId,
                firstName: aiAgentConfig.agent_name || 'NeuroAI',
                lastName: 'Assistant',
                userType: 'ai'
              }
            };
          }
        }
      }
      
      // Handle NeuroAI agent messages directly
      if (sender && sender.isAIAgent) {
        return {
          ...msg,
          sender: {
            id: sender.id,
            firstName: sender.firstName,
            lastName: sender.lastName,
            userType: 'ai'
          }
        };
      }
      
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
    customerId: (customerInfo && customerInfo.name && customerInfo.email) ? null : (user ? user.id : null),
    customerName: (customerInfo && customerInfo.name) ? customerInfo.name : (user ? `${user.firstName} ${user.lastName}` : null),
    customerEmail: (customerInfo && customerInfo.email) ? customerInfo.email : (user ? user.email : null),
    customerPhone: customerInfo?.phone || null,
    customerCompany: customerInfo?.company || null,
    customerAddress: customerInfo?.address || null, // Keep for backward compatibility
    customerStreetAddress: customerInfo?.streetAddress || null,
    customerCity: customerInfo?.city || null,
    customerState: customerInfo?.state || null,
    customerZipCode: customerInfo?.zipCode || null,
    customerCountry: customerInfo?.country || null,
    customerType: customerInfo?.customerType || 'Standard', // Add customer type field
    deviceModel: customerInfo?.deviceModel || null,
    deviceSerialNumber: customerInfo?.deviceSerialNumber || null,
    agentId: null,
    categoryId,
    title,
    description,
    status: 'new',
    priority,
    source: 'web',
    isAnonymous: !(user && (!customerInfo || !customerInfo.name || !customerInfo.email)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  console.log('✅ Created ticket:', ticket);
  tickets.push(ticket);
  console.log('Total tickets now:', tickets.length);
  
  // Auto-create device if ticket has device information
  if (ticket.deviceSerialNumber && ticket.deviceModel) {
    autoCreateDeviceFromTicket(ticket);
  }
  
  // Perform immediate company fuzzy matching for new tickets (including auto-creation)
  if (ticket.customerCompany && !ticket.companyId) {
    console.log('🔍 Triggering immediate fuzzy matching for new ticket...');
    // First try fuzzy matching
    performAutomaticCompanyMatching(ticket);
    
    // If no match found after fuzzy matching, auto-create the company
    const ticketAfterMatching = tickets.find(t => t.id === ticket.id);
    if (ticketAfterMatching && !ticketAfterMatching.companyId) {
      console.log('🏢 No fuzzy match found, auto-creating company:', ticket.customerCompany);
      const newCompany = {
        id: uuidv4(),
        name: ticket.customerCompany,
        aliases: [],
        description: `Auto-created company from ticket ${ticket.ticketNumber}`,
        primaryEmail: null,
        primaryPhone: null,
        website: null,
        address: ticket.customerStreetAddress || null,
        city: ticket.customerCity || null,
        state: ticket.customerState || null,
        zipCode: ticket.customerZipCode || null,
        country: ticket.customerCountry || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user ? user.id : null,
        updatedBy: user ? user.id : null
      };
      companies.push(newCompany);
      
      // Update the ticket with the new company
      const ticketIndex = tickets.findIndex(t => t.id === ticket.id);
      if (ticketIndex !== -1) {
        tickets[ticketIndex].companyId = newCompany.id;
        console.log('🔗 Associated ticket with newly created company:', newCompany.name);
      }
      
      console.log('🏢 Auto-created company:', newCompany.name, 'ID:', newCompany.id);
    }
  }
  
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

  // Check if we should generate AI response for the initial message
  const isCustomerInitialMessage = !user || user.id === ticket.customerId;
  const shouldGenerateAIForInitial = isCustomerInitialMessage && 
                                   aiAgentConfig.enabled && 
                                   aiService.isEnabled() && 
                                   ticket.aiEnabled !== false;

  console.log('🔍 AI DECISION DEBUG for initial message:');
  console.log('  - user:', user ? `${user.firstName} ${user.lastName} (${user.id})` : 'null');
  console.log('  - ticket.customerId:', ticket.customerId);
  console.log('  - isCustomerInitialMessage:', isCustomerInitialMessage);
  console.log('  - aiAgentConfig.enabled:', aiAgentConfig.enabled);
  console.log('  - aiService.isEnabled():', aiService.isEnabled());
  console.log('  - ticket.aiEnabled:', ticket.aiEnabled);
  console.log('  - shouldGenerateAIForInitial:', shouldGenerateAIForInitial);

  // Generate AI response for the initial message if conditions are met
  if (shouldGenerateAIForInitial) {
    console.log('🤖 Generating AI response for initial customer message');
    
    // Run AI generation asynchronously to avoid blocking the response
    setImmediate(async () => {
      try {
        // Find relevant documents for the user's message
        const relevantDocs = await aiService.findRelevantDocuments(description, aiDocumentChunks);
        console.log(`🔍 Found ${relevantDocs.length} relevant document chunks for initial message`);

        // Generate AI response
        const aiResponse = await aiService.generateResponse(description, aiAgentConfig, relevantDocs);
        console.log(`🤖 AI response generated for initial message with confidence: ${aiResponse.confidence}`);

        // Check if we should escalate based on confidence
        if (aiResponse.shouldEscalate) {
          console.log('📈 AI confidence too low for initial message, escalating to human agent');
          
          // Disable AI for this ticket and mark for escalation
          const ticketIndex = tickets.findIndex(t => t.id === ticket.id);
          if (ticketIndex !== -1) {
            tickets[ticketIndex] = {
              ...tickets[ticketIndex],
              aiEnabled: false,
              aiDisabledReason: 'escalation',
              aiDisabledAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          }

          // Send escalation message
          const escalationMessage = {
            id: uuidv4(),
            ticketId: ticket.id,
            senderId: null, // System message
            content: aiResponse.response,
            messageType: 'system',
            createdAt: new Date().toISOString(),
            isRead: false
          };

          messages.push(escalationMessage);

          // Broadcast escalation message
          const escalationMessageWithSender = {
            ...escalationMessage,
            sender: {
              id: null,
              firstName: aiAgentConfig.agent_name,
              lastName: 'AI Assistant',
              userType: 'system'
            }
          };

          io.to(`ticket_${ticket.id}`).emit('new_message', {
            message: escalationMessageWithSender
          });

          // Broadcast AI status change
          io.to(`ticket_${ticket.id}`).emit('ai_status_changed', {
            ticketId: ticket.id,
            enabled: false,
            reason: 'escalation',
            changedBy: aiAgentConfig.agent_name
          });

        } else {
          // Assign ticket to NeuroAI when AI responds
          assignTicketToNeuroAI(ticket.id);

          // Send AI response
          const aiMessage = {
            id: uuidv4(),
            ticketId: ticket.id,
            senderId: neuroAIAgentId, // NeuroAI agent message
            content: aiResponse.response,
            messageType: 'text',
            createdAt: new Date().toISOString(),
            isRead: false
          };

          messages.push(aiMessage);

          // Log AI response
          const aiResponseRecord = {
            id: uuidv4(),
            ticketId: ticket.id,
            messageId: aiMessage.id,
            sourceDocIds: aiResponse.sourceDocuments,
            userMessage: description,
            aiResponse: aiResponse.response,
            confidenceScore: aiResponse.confidence,
            modelUsed: aiResponse.modelUsed,
            responseTimeMs: aiResponse.responseTimeMs,
            createdAt: new Date().toISOString()
          };

          aiResponses.push(aiResponseRecord);

          // Broadcast AI message
          const aiMessageWithSender = {
            ...aiMessage,
            sender: {
              id: neuroAIAgentId,
              firstName: aiAgentConfig.agent_name,
              lastName: 'Assistant',
              userType: 'ai'
            }
          };

          io.to(`ticket_${ticket.id}`).emit('new_message', {
            message: aiMessageWithSender
          });

          console.log('🤖 AI response sent successfully for initial message');
        }

      } catch (error) {
        console.error('❌ Error generating AI response for initial message:', error);
        
        // Send fallback message on AI error
        const fallbackMessage = {
          id: uuidv4(),
          ticketId: ticket.id,
          senderId: null,
          content: "I'm having trouble processing your request right now. Let me connect you with a human agent who can assist you better.",
          messageType: 'system',
          createdAt: new Date().toISOString(),
          isRead: false
        };

        messages.push(fallbackMessage);

        const fallbackMessageWithSender = {
          ...fallbackMessage,
          sender: {
            id: null,
            firstName: aiAgentConfig.agent_name,
            lastName: 'AI Assistant',
            userType: 'system'
          }
        };

        io.to(`ticket_${ticket.id}`).emit('new_message', {
          message: fallbackMessageWithSender
        });
      }
    });
  }

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

  // Allow human agents to take over tickets from AI agent
  if (ticket.agentId && ticket.agentId !== neuroAIAgentId) {
    return res.status(400).json({
      success: false,
      error: { code: 'TICKET_ALREADY_CLAIMED', message: 'Ticket already assigned to another human agent' }
    });
  }

  // If taking over from AI agent, handle the transition
  const wasAssignedToAI = ticket.agentId === neuroAIAgentId;
  
  ticket.agentId = req.user.sub;
  ticket.status = 'in_progress';
  ticket.assignedAt = new Date().toISOString();
  ticket.updatedAt = new Date().toISOString();
  
  // If this was an AI ticket, log the handoff
  if (wasAssignedToAI) {
    console.log(`🤖➡️👨 Human agent ${req.user.firstName} ${req.user.lastName} taking over ticket ${ticket.ticketNumber} from NeuroAI`);
  }
  
  // Log ticket claim
  logAudit({
    userId: req.user.sub,
    userName: `${req.user.firstName} ${req.user.lastName}`,
    userType: 'agent',
    action: wasAssignedToAI ? 'ticket_taken_from_ai' : 'ticket_claimed',
    ticketNumber: ticket.ticketNumber,
    targetType: 'ticket',
    targetId: ticket.id,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: wasAssignedToAI 
      ? `${req.user.firstName} ${req.user.lastName} (${req.user.roleName || 'Unknown Role'}) took over ticket from NeuroAI and changed status to in_progress`
      : `${req.user.firstName} ${req.user.lastName} (${req.user.roleName || 'Unknown Role'}) claimed ticket and changed status to in_progress`
  });

  // Notify customer of assignment
  io.to(`ticket_${ticket.id}`).emit('ticket_claimed', {
    ticketId: ticket.id,
    agent: {
      id: req.user.sub,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    },
    claimedAt: ticket.assignedAt,
    handoffFromAI: wasAssignedToAI
  });

  // If this was a handoff from AI, also emit a specific handoff event
  if (wasAssignedToAI) {
    io.to(`ticket_${ticket.id}`).emit('ai_to_human_handoff', {
      ticketId: ticket.id,
      previousAgent: 'NeuroAI Assistant',
      newAgent: {
        id: req.user.sub,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      handoffAt: ticket.assignedAt
    });
  }

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
    'customerName', 'customerEmail', 'customerPhone', 'customerCompany', 'customerAddress',
    'customerStreetAddress', 'customerCity', 'customerState', 'customerZipCode', 'customerCountry', 'customerType',
    'deviceModel', 'deviceSerialNumber'
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
  console.log('  - updates.customerCity:', updates.customerCity);
  console.log('  - updates.customerType:', updates.customerType);
  console.log('  - updates.deviceSerialNumber:', updates.deviceSerialNumber);
  console.log('  - customerAddress included:', 'customerAddress' in updates);
  console.log('  - customerCity included:', 'customerCity' in updates);
  console.log('  - customerType included:', 'customerType' in updates);
  console.log('  - deviceSerialNumber included:', 'deviceSerialNumber' in updates);

  // DEBUG: Log original ticket before update
  console.log('🔧 ORIGINAL TICKET BEFORE UPDATE:');
  console.log('  - ticket.customerCity (before):', ticket.customerCity);
  console.log('  - ticket.customerAddress (before):', ticket.customerAddress);

  // If reassigning agent, validate the new agent exists and is active
  if (updates.agentId) {
    const newAgent = users.find(u => u.id === updates.agentId && u.userType === 'agent' && u.isActive);
    if (!newAgent) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_AGENT', message: 'Invalid or inactive agent selected' }
      });
    }
    
    // If assigning to a human agent from NeuroAI, unassign from NeuroAI
    if (ticket.agentId === neuroAIAgentId && updates.agentId !== neuroAIAgentId) {
      console.log(`🤖 Human agent taking over ticket ${ticket.ticketNumber} from NeuroAI`);
      unassignTicketFromNeuroAI(ticket.id, updates.agentId);
    }
  }
  
  // If unassigning (setting agentId to null), check if it was assigned to NeuroAI
  if (updates.agentId === null && ticket.agentId === neuroAIAgentId) {
    console.log(`🤖 Unassigning ticket ${ticket.ticketNumber} from NeuroAI`);
    unassignTicketFromNeuroAI(ticket.id, null);
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
  
  // Trigger automatic company fuzzy matching when ticket is closed or resolved
  if (updates.status === 'closed' || updates.status === 'resolved') {
    console.log('🎯 Ticket closed/resolved, triggering company fuzzy matching...');
    performAutomaticCompanyMatching(ticket);
  }

  // Trigger AI summarization when ticket is marked as resolved
  if (updates.status === 'resolved' && ticket.status !== 'resolved') {
    console.log('📝 Ticket resolved, triggering AI summarization...');
    setImmediate(async () => {
      await generateTicketSummary(ticket.id, req.user.sub);
    });
  }
  
  // Auto-create device if ticket was updated with device information
  if ((updates.deviceSerialNumber || updates.deviceModel) && ticket.deviceSerialNumber && ticket.deviceModel) {
    autoCreateDeviceFromTicket(ticket);
  }

  console.log('🔧 TICKET AFTER UPDATE:');
  console.log('  - ticket.customerAddress:', ticket.customerAddress);
  console.log('  - ticket.customerCity:', ticket.customerCity);
  console.log('  - ticket.customerType:', ticket.customerType);
  console.log('  - ticket.deviceSerialNumber:', ticket.deviceSerialNumber);
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
  console.log('  - enrichedTicket.customerCity:', enrichedTicket.customerCity);
  console.log('  - enrichedTicket.customerType:', enrichedTicket.customerType);
  console.log('  - enrichedTicket.deviceSerialNumber:', enrichedTicket.deviceSerialNumber);

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

// Generate ticket summary (manual)
app.post('/api/tickets/:ticketId/generate-summary', authenticateToken, async (req, res) => {
  console.log('🔴 [DEBUG] Generate summary route hit!');
  console.log('🔴 [DEBUG] Ticket ID:', req.params.ticketId);
  console.log('🔴 [DEBUG] User:', req.user);
  
  try {
    const ticket = tickets.find(t => t.id === req.params.ticketId);
    if (!ticket) {
      console.log('🔴 [DEBUG] Ticket not found');
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
      });
    }
    
    console.log('🔴 [DEBUG] Found ticket:', ticket.ticketNumber);
    console.log('🔴 [DEBUG] User permissions:', req.user.permissions);
    
    // Check if user has permission to generate summaries
    if (!req.user.permissions?.includes('tickets.edit')) {
      console.log('🔴 [DEBUG] No permission to generate summaries');
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to generate ticket summaries' }
      });
    }
    
    console.log('🔴 [DEBUG] AI service enabled:', aiService.isEnabled());
    
    // Check if AI service is available
    if (!aiService.isEnabled()) {
      console.log('🔴 [DEBUG] AI service not available');
      return res.status(503).json({
        success: false,
        error: { code: 'AI_SERVICE_UNAVAILABLE', message: 'AI service is not available. Please configure OpenAI API key.' }
      });
    }
    
    console.log('🔴 [DEBUG] Generating summary...');
    
    // Generate summary using the existing function (with manual generation flag)
    await generateTicketSummary(ticket.id, req.user.sub);
    
    // Get the updated ticket with the new summary
    const updatedTicket = tickets.find(t => t.id === req.params.ticketId);
    
    if (updatedTicket.resolutionSummary) {
      res.json({
        success: true,
        data: {
          summary: updatedTicket.resolutionSummary,
          generatedAt: updatedTicket.resolutionSummaryGeneratedAt,
          modelVersion: updatedTicket.resolutionSummaryModelVersion,
          generatedBy: updatedTicket.resolutionSummaryGeneratedBy
        }
      });
    } else {
      throw new Error('Summary generation completed but no summary was saved');
    }
    
  } catch (error) {
    console.error('🔴 [DEBUG] Error in generate summary:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SUMMARY_GENERATION_FAILED', message: error.message }
    });
  }
});

// Generate AI summary for resolved ticket
async function generateTicketSummary(ticketId, generatedBy = null) {
  try {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
      console.error('❌ Cannot generate summary: ticket not found');
      return;
    }

    // Skip if summary already exists and is recent (within 1 hour), unless it's a manual regeneration
    if (ticket.resolutionSummary && ticket.resolutionSummaryGeneratedAt && !generatedBy) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const summaryDate = new Date(ticket.resolutionSummaryGeneratedAt);
      if (summaryDate > hourAgo) {
        console.log('📝 Summary already exists and is recent, skipping automatic generation');
        return;
      }
    }

    // Get ticket messages for conversation transcript
    const ticketMessages = messages
      .filter(m => m.ticketId === ticketId)
      .map(msg => {
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
            firstName: ticket.customerName?.split(' ')[0] || 'Customer',
            lastName: ticket.customerName?.split(' ').slice(1).join(' ') || '',
            userType: 'customer'
          }
        };
      });

    // Get category info
    const category = categories.find(c => c.id === ticket.categoryId);
    const ticketWithCategory = { ...ticket, category };

    console.log('📝 Generating AI summary for ticket:', ticket.ticketNumber);

    // Generate summary using AI service
    const summaryResult = await aiService.generateResolutionSummary(
      ticketWithCategory,
      ticketMessages
    );

    // Save summary to ticket
    ticket.resolutionSummary = summaryResult.summary;
    ticket.resolutionSummaryGeneratedAt = new Date().toISOString();
    ticket.resolutionSummaryModelVersion = summaryResult.modelUsed;
    ticket.resolutionSummaryGeneratedBy = generatedBy;

    console.log('✅ AI summary generated successfully for ticket:', ticket.ticketNumber);
    console.log('📝 Summary:', summaryResult.summary);

    // Notify connected clients about the summary update
    io.to(`ticket_${ticketId}`).emit('ticket_summary_generated', {
      ticketId: ticketId,
      summary: summaryResult.summary,
      generatedAt: ticket.resolutionSummaryGeneratedAt,
      modelVersion: summaryResult.modelUsed,
      confidence: summaryResult.confidence
    });

    // Log audit trail
    logAudit({
      userId: generatedBy,
      userName: generatedBy ? (users.find(u => u.id === generatedBy)?.firstName + ' ' + users.find(u => u.id === generatedBy)?.lastName) : 'System',
      userType: 'system',
      action: 'ticket_summary_generated',
      ticketNumber: ticket.ticketNumber,
      targetType: 'ticket',
      targetId: ticket.id,
      details: `AI summary generated (${summaryResult.modelUsed}, confidence: ${summaryResult.confidence})`
    });

  } catch (error) {
    console.error('❌ Error generating ticket summary:', error);
    
    // Log the error in audit trail
    logAudit({
      userId: generatedBy,
      userName: generatedBy ? (users.find(u => u.id === generatedBy)?.firstName + ' ' + users.find(u => u.id === generatedBy)?.lastName) : 'System',
      userType: 'system',
      action: 'ticket_summary_failed',
      ticketNumber: tickets.find(t => t.id === ticketId)?.ticketNumber,
      targetType: 'ticket',
      targetId: ticketId,
      details: `AI summary generation failed: ${error.message}`,
      status: 'failed'
    });
  }
}

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

  // Trigger AI summarization when customer closes ticket
  console.log('📝 Customer closed ticket, triggering AI summarization...');
  setImmediate(async () => {
    await generateTicketSummary(req.params.ticketId);
  });

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

  // Trigger AI summarization when customer closes ticket with feedback
  console.log('📝 Customer closed ticket with feedback, triggering AI summarization...');
  setImmediate(async () => {
    await generateTicketSummary(req.params.ticketId);
  });

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

// Old route removed - moved to earlier position in file to avoid conflicts

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
    userType: user ? (ticket.isAnonymous ? user.userType : (user.id === ticket.customerId ? 'customer' : user.userType)) : 'customer',
    action: 'message_sent',
    ticketNumber: ticket.ticketNumber,
    targetType: 'message',
    targetId: message.id,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'],
    details: `Sent message in ticket (${messageType}): ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`
  });

  // Check if we should generate AI response
  // For anonymous tickets, only non-agent messages are customer messages  
  // For registered tickets, check if user ID matches customer ID
  const isCustomerMessage = ticket.isAnonymous ? (!user || user.userType !== 'agent') : (user && user.id === ticket.customerId);
  const shouldGenerateAI = isCustomerMessage && 
                          aiAgentConfig.enabled && 
                          aiService.isEnabled() && 
                          ticket.aiEnabled !== false &&
                          messageType === 'text';

  // Generate AI response if conditions are met
  if (shouldGenerateAI) {
    console.log('🤖 Generating AI response for customer message');
    
    // Run AI generation asynchronously to avoid blocking the response
    setImmediate(async () => {
      try {
        // Find relevant documents for the user's message
        const relevantDocs = await aiService.findRelevantDocuments(content, aiDocumentChunks);
        console.log(`🔍 Found ${relevantDocs.length} relevant document chunks`);

        // Generate AI response
        const aiResponse = await aiService.generateResponse(content, aiAgentConfig, relevantDocs);
        console.log(`🤖 AI response generated with confidence: ${aiResponse.confidence}`);

        // Check if we should escalate based on confidence
        if (aiResponse.shouldEscalate) {
          console.log('📈 AI confidence too low, escalating to human agent');
          
          // Disable AI for this ticket and mark for escalation
          const ticketIndex = tickets.findIndex(t => t.id === req.params.ticketId);
          if (ticketIndex !== -1) {
            tickets[ticketIndex] = {
              ...tickets[ticketIndex],
              aiEnabled: false,
              aiDisabledReason: 'escalation',
              aiDisabledAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          }

          // Send escalation message
          const escalationMessage = {
            id: uuidv4(),
            ticketId: req.params.ticketId,
            senderId: null, // System message
            content: aiResponse.response,
            messageType: 'system',
            createdAt: new Date().toISOString(),
            isRead: false
          };

          messages.push(escalationMessage);

          // Broadcast escalation message
          const escalationMessageWithSender = {
            ...escalationMessage,
            sender: {
              id: null,
              firstName: aiAgentConfig.agent_name,
              lastName: 'AI Assistant',
              userType: 'system'
            }
          };

          io.to(`ticket_${req.params.ticketId}`).emit('new_message', {
            message: escalationMessageWithSender
          });

          // Broadcast AI status change
          io.to(`ticket_${req.params.ticketId}`).emit('ai_status_changed', {
            ticketId: req.params.ticketId,
            enabled: false,
            reason: 'escalation',
            changedBy: aiAgentConfig.agent_name
          });

        } else {
          // Assign ticket to NeuroAI when AI responds
          assignTicketToNeuroAI(req.params.ticketId);

          // Send AI response
          const aiMessage = {
            id: uuidv4(),
            ticketId: req.params.ticketId,
            senderId: neuroAIAgentId, // NeuroAI agent message
            content: aiResponse.response,
            messageType: 'text',
            createdAt: new Date().toISOString(),
            isRead: false
          };

          messages.push(aiMessage);

          // Log AI response
          const aiResponseRecord = {
            id: uuidv4(),
            ticketId: req.params.ticketId,
            messageId: aiMessage.id,
            sourceDocIds: aiResponse.sourceDocuments,
            userMessage: content,
            aiResponse: aiResponse.response,
            confidenceScore: aiResponse.confidence,
            modelUsed: aiResponse.modelUsed,
            responseTimeMs: aiResponse.responseTimeMs,
            createdAt: new Date().toISOString()
          };

          aiResponses.push(aiResponseRecord);

          // Broadcast AI message
          const aiMessageWithSender = {
            ...aiMessage,
            sender: {
              id: neuroAIAgentId,
              firstName: aiAgentConfig.agent_name,
              lastName: 'Assistant',
              userType: 'ai'
            }
          };

          io.to(`ticket_${req.params.ticketId}`).emit('new_message', {
            message: aiMessageWithSender
          });

          console.log('🤖 AI response sent successfully');
        }

      } catch (error) {
        console.error('❌ Error generating AI response:', error);
        
        // Send fallback message on AI error
        const fallbackMessage = {
          id: uuidv4(),
          ticketId: req.params.ticketId,
          senderId: null,
          content: "I'm having trouble processing your request right now. Let me connect you with a human agent who can assist you better.",
          messageType: 'system',
          createdAt: new Date().toISOString(),
          isRead: false
        };

        messages.push(fallbackMessage);

        const fallbackMessageWithSender = {
          ...fallbackMessage,
          sender: {
            id: null,
            firstName: aiAgentConfig.agent_name,
            lastName: 'AI Assistant',
            userType: 'system'
          }
        };

        io.to(`ticket_${req.params.ticketId}`).emit('new_message', {
          message: fallbackMessageWithSender
        });
      }
    });
  }

  // For anonymous tickets, treat all non-agent messages as customer messages
  // This prevents admin tokens from interfering with customer message classification
  let sender = null;
  let senderUserType = 'customer';
  
  if (ticket.isAnonymous) {
    // For anonymous tickets, only agents should have sender info
    if (user && user.userType === 'agent') {
      sender = users.find(u => u.id === user.id);
      senderUserType = 'agent';
    } else {
      // All other messages in anonymous tickets are from customers
      sender = null;
      senderUserType = 'customer';
    }
  } else {
    // For registered tickets, use normal logic
    sender = user ? users.find(u => u.id === user.id) : null;
    senderUserType = sender ? (sender.id === ticket.customerId ? 'customer' : sender.userType) : 'customer';
  }
  
  console.log('🔍 SENDER DEBUG:');
  console.log('  - user:', user);
  console.log('  - sender:', sender);
  console.log('  - ticket.customerName:', ticket.customerName);
  console.log('  - ticket.customerId:', ticket.customerId);
  console.log('  - ticket.isAnonymous:', ticket.isAnonymous);
  console.log('  - isCustomerMessage:', ticket.isAnonymous ? !user || user.userType !== 'agent' : (user && user.id === ticket.customerId));
  console.log('  - determined userType:', senderUserType);
  
  const messageWithSender = {
    ...message,
    sender: sender ? {
      id: sender.id,
      firstName: sender.firstName,
      lastName: sender.lastName,
      userType: senderUserType
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

  // Email fallback: Send email if customer is offline and message is from agent
  const isAgentMessage = messageWithSender.sender?.userType === 'agent';
  const customerSession = customerSessions.get(req.params.ticketId);
  const isCustomerOffline = !customerSession || !customerSession.isOnline;

  if (isAgentMessage && isCustomerOffline && ticket.customerEmail && ticket.emailFallbackEnabled !== false) {
    console.log('📧 Customer is offline, sending email fallback...');
    console.log('📧 Customer session:', customerSession);
    console.log('📧 Customer email:', ticket.customerEmail);
    
    // Send email fallback asynchronously
    sendChatFallbackEmail(
      ticket.customerEmail,
      ticket.ticketNumber || req.params.ticketId,
      content,
      ticket
    ).then(result => {
      if (result.success) {
        console.log('✅ Email fallback sent successfully:', result.emailId);
      } else {
        console.error('❌ Email fallback failed:', result.error);
      }
    }).catch(error => {
      console.error('❌ Email fallback error:', error);
    });
  } else if (isAgentMessage) {
    console.log('📧 Email fallback skipped:', {
      isAgentMessage,
      isCustomerOffline,
      hasCustomerEmail: !!ticket.customerEmail,
      emailFallbackEnabled: ticket.emailFallbackEnabled !== false
    });
  }

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
    'text/plain',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed'
  ];
  
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.zip', '.rar', '.7z'
  ];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Supported formats: images (jpg, png, gif, etc.), documents (pdf, doc, docx, xls, xlsx, csv, txt), and archives (zip, rar, 7z)'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit
  },
  fileFilter: fileFilter
});

// Multiple file upload for AI documents
const uploadMultiple = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB per file
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Only allow document types for AI learning
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed for AI learning. Supported formats: PDF, DOC, DOCX, XLS, XLSX, TXT, CSV'), false);
    }
  }
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
// CUSTOMER MANAGEMENT ENDPOINTS
// ==========================================

// Get all customers (derived from tickets)
app.get('/api/customers', authenticateToken, (req, res) => {
  console.log('\n👥 GET CUSTOMERS REQUEST');
  console.log('User:', req.user?.email, 'Permissions:', req.user?.permissions);
  
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('customers.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to view customers' }
      });
    }

    // Extract query parameters for filtering and search
    const { search, country, customerType, sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Create customer map based on emails from tickets
    const customerMap = new Map();
    
    tickets.forEach(ticket => {
      const email = ticket.customerEmail;
      if (!email) return;

      if (!customerMap.has(email)) {
        // Get user data if customer is registered
        const registeredUser = users.find(u => u.email === email && u.userType === 'customer');
        
        customerMap.set(email, {
          id: registeredUser?.id || email, // Use user ID if registered, otherwise email
          name: ticket.customerName || (registeredUser ? `${registeredUser.firstName} ${registeredUser.lastName}` : ''),
          firstName: registeredUser?.firstName || ticket.customerName?.split(' ')[0] || '',
          lastName: registeredUser?.lastName || ticket.customerName?.split(' ').slice(1).join(' ') || '',
          email: email,
          phone: ticket.customerPhone || '',
          company: ticket.customerCompany || '',
          country: ticket.customerCountry || '',
          streetAddress: ticket.customerStreetAddress || '',
          city: ticket.customerCity || '',
          state: ticket.customerState || '',
          zipCode: ticket.customerZipCode || '',
          customerType: ticket.customerType || 'Standard',
          deviceModel: new Set(), // Will collect unique devices
          deviceSerialNumbers: new Set(), // Will collect unique serial numbers
          tickets: [],
          ticketCount: 0,
          lastTicketDate: null,
          isRegistered: !!registeredUser,
          createdAt: registeredUser?.createdAt || null
        });
      }

      const customer = customerMap.get(email);
      
      // Add ticket to customer
      customer.tickets.push({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        category: categories.find(c => c.id === ticket.categoryId)?.name || '',
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt
      });
      
      // Update customer fields with latest ticket data
      if (ticket.customerName && !customer.name) customer.name = ticket.customerName;
      if (ticket.customerPhone && !customer.phone) customer.phone = ticket.customerPhone;
      if (ticket.customerCompany && !customer.company) customer.company = ticket.customerCompany;
      if (ticket.customerCountry && !customer.country) customer.country = ticket.customerCountry;
      if (ticket.customerStreetAddress && !customer.streetAddress) customer.streetAddress = ticket.customerStreetAddress;
      if (ticket.customerCity && !customer.city) customer.city = ticket.customerCity;
      if (ticket.customerState && !customer.state) customer.state = ticket.customerState;
      if (ticket.customerZipCode && !customer.zipCode) customer.zipCode = ticket.customerZipCode;
      if (ticket.customerType && (!customer.customerType || customer.customerType === 'Standard')) customer.customerType = ticket.customerType;
      
      // Collect device information
      if (ticket.deviceModel) customer.deviceModel.add(ticket.deviceModel);
      if (ticket.deviceSerialNumber) customer.deviceSerialNumbers.add(ticket.deviceSerialNumber);
      
      // Update ticket count and last ticket date
      customer.ticketCount++;
      if (!customer.lastTicketDate || new Date(ticket.createdAt) > new Date(customer.lastTicketDate)) {
        customer.lastTicketDate = ticket.createdAt;
      }
    });

    // Convert to array and process device collections
    let customers = Array.from(customerMap.values()).map(customer => ({
      ...customer,
      deviceModels: Array.from(customer.deviceModel),
      deviceSerialNumbers: Array.from(customer.deviceSerialNumbers),
      // Remove the Set objects
      deviceModel: undefined,
      tickets: customer.tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }));

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(customer => 
        customer.name.toLowerCase().includes(searchLower) ||
        customer.email.toLowerCase().includes(searchLower) ||
        customer.phone.toLowerCase().includes(searchLower) ||
        customer.company.toLowerCase().includes(searchLower)
      );
    }

    if (country) {
      customers = customers.filter(customer => customer.country === country);
    }

    if (customerType) {
      customers = customers.filter(customer => customer.customerType === customerType);
    }

    // Apply sorting
    customers.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 'ticketCount':
          aValue = a.ticketCount;
          bValue = b.ticketCount;
          break;
        case 'lastTicketDate':
          aValue = new Date(a.lastTicketDate || 0);
          bValue = new Date(b.lastTicketDate || 0);
          break;
        case 'country':
          aValue = a.country || '';
          bValue = b.country || '';
          break;
        default:
          aValue = a.name || '';
          bValue = b.name || '';
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    console.log(`✅ Returning ${customers.length} customers`);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: customers.length,
          itemsPerPage: customers.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch customers' }
    });
  }
});

// Get single customer by ID/email
app.get('/api/customers/:identifier', authenticateToken, (req, res) => {
  console.log('\n👤 GET SINGLE CUSTOMER REQUEST');
  console.log('Identifier:', req.params.identifier);
  
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('customers.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to view customers' }
      });
    }

    const { identifier } = req.params;
    
    // Find customer by ID or email
    let customerTickets = tickets.filter(ticket => 
      ticket.customerId === identifier || ticket.customerEmail === identifier
    );

    if (customerTickets.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const firstTicket = customerTickets[0];
    const registeredUser = users.find(u => u.email === firstTicket.customerEmail && u.userType === 'customer');
    
    // Build customer object
    const customer = {
      id: registeredUser?.id || firstTicket.customerEmail,
      name: firstTicket.customerName || (registeredUser ? `${registeredUser.firstName} ${registeredUser.lastName}` : ''),
      firstName: registeredUser?.firstName || firstTicket.customerName?.split(' ')[0] || '',
      lastName: registeredUser?.lastName || firstTicket.customerName?.split(' ').slice(1).join(' ') || '',
      email: firstTicket.customerEmail,
      phone: firstTicket.customerPhone || '',
      company: firstTicket.customerCompany || '',
      country: firstTicket.customerCountry || '',
      streetAddress: firstTicket.customerStreetAddress || '',
      city: firstTicket.customerCity || '',
      state: firstTicket.customerState || '',
      zipCode: firstTicket.customerZipCode || '',
      customerType: firstTicket.customerType || 'Standard',
      isRegistered: !!registeredUser,
      createdAt: registeredUser?.createdAt || null,
      deviceModels: [...new Set(customerTickets.map(t => t.deviceModel).filter(Boolean))],
      deviceSerialNumbers: [...new Set(customerTickets.map(t => t.deviceSerialNumber).filter(Boolean))],
      ticketCount: customerTickets.length,
      lastTicketDate: customerTickets.reduce((latest, ticket) => {
        return !latest || new Date(ticket.createdAt) > new Date(latest) ? ticket.createdAt : latest;
      }, null)
    };

    // Enrich tickets with related data
    const enrichedTickets = customerTickets.map(ticket => {
      const agent = ticket.agentId ? users.find(u => u.id === ticket.agentId) : null;
      const category = categories.find(c => c.id === ticket.categoryId);
      const ticketMessages = messages.filter(m => m.ticketId === ticket.id);
      
      return {
        ...ticket,
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
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`✅ Returning customer ${customer.email} with ${enrichedTickets.length} tickets`);

    res.json({
      success: true,
      data: {
        customer: {
          ...customer,
          tickets: enrichedTickets
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching customer:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch customer' }
    });
  }
});

// Update customer
app.put('/api/customers/:identifier', authenticateToken, (req, res) => {
  console.log('\n👤 UPDATE CUSTOMER REQUEST');
  console.log('Identifier:', req.params.identifier);
  console.log('Body:', req.body);
  
  try {
    // Check permission
    if (!req.user.permissions || !req.user.permissions.includes('customers.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to update customers' }
      });
    }

    const { identifier } = req.params;
    const updates = req.body;
    
    // Find all tickets for this customer
    let customerTickets = tickets.filter(ticket => 
      ticket.customerId === identifier || ticket.customerEmail === identifier
    );

    if (customerTickets.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Customer not found' }
      });
    }

    // Update each ticket with the new customer information
    customerTickets.forEach(ticket => {
      if (updates.name && updates.name !== ticket.customerName) ticket.customerName = updates.name;
      if (updates.phone && updates.phone !== ticket.customerPhone) ticket.customerPhone = updates.phone;
      if (updates.company && updates.company !== ticket.customerCompany) ticket.customerCompany = updates.company;
      if (updates.country && updates.country !== ticket.customerCountry) ticket.customerCountry = updates.country;
      if (updates.streetAddress && updates.streetAddress !== ticket.customerStreetAddress) ticket.customerStreetAddress = updates.streetAddress;
      if (updates.city && updates.city !== ticket.customerCity) ticket.customerCity = updates.city;
      if (updates.state && updates.state !== ticket.customerState) ticket.customerState = updates.state;
      if (updates.zipCode && updates.zipCode !== ticket.customerZipCode) ticket.customerZipCode = updates.zipCode;
      if (updates.customerType && updates.customerType !== ticket.customerType) ticket.customerType = updates.customerType;
      
      ticket.updatedAt = new Date().toISOString();
    });

    // Update registered user if exists
    const registeredUser = users.find(u => u.email === customerTickets[0].customerEmail && u.userType === 'customer');
    if (registeredUser && updates.name) {
      const nameParts = updates.name.split(' ');
      registeredUser.firstName = nameParts[0] || '';
      registeredUser.lastName = nameParts.slice(1).join(' ') || '';
    }

    // Log audit trail
    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'customer_updated',
      targetType: 'customer',
      targetId: identifier,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Updated customer information for ${customerTickets[0].customerEmail}`
    });

    // Return updated customer data
    const firstTicket = customerTickets[0];
    const customer = {
      id: registeredUser?.id || firstTicket.customerEmail,
      name: firstTicket.customerName || (registeredUser ? `${registeredUser.firstName} ${registeredUser.lastName}` : ''),
      firstName: registeredUser?.firstName || firstTicket.customerName?.split(' ')[0] || '',
      lastName: registeredUser?.lastName || firstTicket.customerName?.split(' ').slice(1).join(' ') || '',
      email: firstTicket.customerEmail,
      phone: firstTicket.customerPhone || '',
      company: firstTicket.customerCompany || '',
      country: firstTicket.customerCountry || '',
      streetAddress: firstTicket.customerStreetAddress || '',
      city: firstTicket.customerCity || '',
      state: firstTicket.customerState || '',
      zipCode: firstTicket.customerZipCode || '',
      customerType: firstTicket.customerType || 'Standard',
      isRegistered: !!registeredUser,
      createdAt: registeredUser?.createdAt || null,
      deviceModels: [...new Set(customerTickets.map(t => t.deviceModel).filter(Boolean))],
      deviceSerialNumbers: [...new Set(customerTickets.map(t => t.deviceSerialNumber).filter(Boolean))],
      ticketCount: customerTickets.length,
      lastTicketDate: customerTickets.reduce((latest, ticket) => {
        return !latest || new Date(ticket.createdAt) > new Date(latest) ? ticket.createdAt : latest;
      }, null)
    };

    console.log(`✅ Updated customer ${customer.email}`);

    res.json({
      success: true,
      data: { customer }
    });

  } catch (error) {
    console.error('❌ Error updating customer:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update customer' }
    });
  }
});

// Delete customer
app.delete('/api/customers/:identifier', authenticateToken, (req, res) => {
  console.log('\n👤 DELETE CUSTOMER REQUEST');
  console.log('Identifier:', req.params.identifier);
  
  try {
    // Check permission - only admins can delete customers
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required to delete customers' }
      });
    }

    const { identifier } = req.params;
    
    // Find all tickets for this customer
    let customerTickets = tickets.filter(ticket => 
      ticket.customerId === identifier || ticket.customerEmail === identifier
    );

    if (customerTickets.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const customerEmail = customerTickets[0].customerEmail;

    // Check if customer has unresolved tickets
    const unresolvedTickets = customerTickets.filter(ticket => ticket.status !== 'resolved');
    if (unresolvedTickets.length > 0) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'CUSTOMER_HAS_OPEN_TICKETS', 
          message: `Cannot delete customer: ${unresolvedTickets.length} unresolved ticket(s) exist. Please resolve all tickets first.`
        }
      });
    }

    // Remove all customer tickets
    tickets = tickets.filter(ticket => 
      ticket.customerId !== identifier && ticket.customerEmail !== customerEmail
    );

    // Remove customer messages
    messages = messages.filter(message => {
      const messageTicket = tickets.find(t => t.id === message.ticketId);
      return messageTicket !== undefined;
    });

    // Remove registered user if exists
    const userIndex = users.findIndex(u => u.email === customerEmail && u.userType === 'customer');
    if (userIndex !== -1) {
      users.splice(userIndex, 1);
    }

    // Log audit trail
    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'customer_deleted',
      targetType: 'customer',
      targetId: identifier,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Deleted customer and all associated data for ${customerEmail}`
    });

    console.log(`✅ Deleted customer ${customerEmail} and all associated data`);

    res.json({
      success: true,
      message: 'Customer and all associated data deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to delete customer' }
    });
  }
});

// ==========================================
// SYSTEM MANAGEMENT ENDPOINTS
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
      'users.create': true,
      'users.edit': true,
      'users.delete': true,
      'audit.view': true,
      'insights.view': true,
      'customers.view': true,
      'devices.view': true,
      'devices.create': true,
      'devices.edit': true,
      'devices.delete': true,
      'companies.view': true,
      'companies.create': true,
      'companies.edit': true,
      'companies.delete': true,
      'system.settings': true,
      'system.ai_settings': true
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
      'audit.view': false,
      'customers.view': true,
      'devices.view': true,
      'devices.create': false,
      'devices.edit': true,
      'devices.delete': false,
      'companies.view': true,
      'companies.create': false,
      'companies.edit': true,
      'companies.delete': false,
      'system.settings': false,
      'system.ai_settings': false
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
      'audit.view': false,
      'customers.view': false,
      'devices.view': true,
      'devices.create': false,
      'devices.edit': false,
      'devices.delete': false,
      'companies.view': true,
      'companies.create': false,
      'companies.edit': false,
      'companies.delete': false,
      'system.settings': false,
      'system.ai_settings': false
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
      'audit.view': false,
      'customers.view': false,
      'devices.view': true,
      'devices.create': false,
      'devices.edit': false,
      'devices.delete': false,
      'companies.view': false,
      'companies.create': false,
      'companies.edit': false,
      'companies.delete': false,
      'system.settings': false,
      'system.ai_settings': false
    }
  },
  { 
    id: '5', 
    name: 'AI Agent', 
    description: 'AI Assistant with message and ticket management capabilities',
    permissions: {
      'tickets.create': true,
      'tickets.edit': true,
      'tickets.delete': false,
      'tickets.message': true,
      'users.access': false,
      'audit.view': false,
      'customers.view': true,
      'devices.view': true,
      'devices.create': false,
      'devices.edit': false,
      'devices.delete': false,
      'companies.view': true,
      'companies.create': false,
      'companies.edit': false,
      'companies.delete': false,
      'system.settings': false,
      'system.ai_settings': false
    }
  }
];

// Now sync all users with their role permissions
syncAllUserPermissions();

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

// Helper function to sync user permissions with their role
const syncUserPermissionsWithRole = (roleId) => {
  const role = rolesConfig.find(r => r.id === roleId);
  if (!role) return;

  // Get all permission keys that are true
  const rolePermissions = Object.keys(role.permissions).filter(key => role.permissions[key]);
  
  // Update all users with this roleId
  users.forEach(user => {
    if (user.roleId === roleId) {
      user.permissions = rolePermissions;
      console.log(`🔄 Updated permissions for user ${user.email}:`, rolePermissions);
    }
  });
};

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
    if (permissions !== undefined) {
      rolesConfig[roleIndex].permissions = permissions;
      // Sync user permissions with updated role
      syncUserPermissionsWithRole(id);
    }

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
        
        // Special handling for NeuroAI agent
        if (user.isAIAgent) {
          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            name: `${user.firstName} ${user.lastName}`, // Add combined name for display
            roleName: user.roleName || 'AI Agent',
            roleId: user.roleId || '5',
            isActive: user.isActive !== false && aiAgentConfig.enabled,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            agentStatus: aiAgentConfig.enabled ? 'online' : 'offline',
            isOnline: aiAgentConfig.enabled && aiService.isEnabled(),
            lastSeen: session ? session.lastSeen : new Date().toISOString(),
            maxConcurrentTickets: user.maxConcurrentTickets || 1000,
            permissions: user.permissions || [],
            isAIAgent: true
          };
        }
        
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
      console.log(`  - ${agent.email}: lastLogin = ${agent.lastLogin}${agent.isAIAgent ? ' (AI Agent)' : ''}`);
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
    if (role.permissions['customers.view']) legacyPermissions.push('customers.view');

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
      if (role.permissions['customers.view']) legacyPermissions.push('customers.view');

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

// Real-time company suggestion for customer chat (non-authenticated)
app.post('/api/companies/suggest-realtime', (req, res) => {
  try {
    const { companyName, threshold = 50 } = req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Company name is required' }
      });
    }

    const matches = findCompanyMatches(companyName.trim(), threshold);

    // Return only the top 3 matches for customer suggestion
    const topMatches = matches.slice(0, 3).map(match => ({
      name: match.company.name,
      confidence: match.confidence,
      description: match.company.description
    }));

    res.json({
      success: true,
      data: {
        inputName: companyName.trim(),
        suggestions: topMatches,
        threshold
      }
    });
  } catch (error) {
    console.error('Error in real-time company suggestion:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
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
      // Use io.to() instead of socket.to() because socket is already disconnecting
      io.to(`ticket_${data.ticketId}`).emit('customer_status_changed', {
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
  const { timeRange = 'monthly', startDate, endDate, agentId, category } = filters;
  
  // Filter tickets based on filters
  let filteredTickets = tickets;
  
  // Filter by date range if provided
  if (startDate || endDate) {
    console.log('📊 INSIGHTS: Filtering by date range - startDate:', startDate, 'endDate:', endDate);
    console.log('📊 INSIGHTS: Total tickets before date filter:', filteredTickets.length);
    
    filteredTickets = filteredTickets.filter(ticket => {
      const ticketDate = new Date(ticket.createdAt);
      let includeTicket = true;
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        includeTicket = includeTicket && ticketDate >= start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        includeTicket = includeTicket && ticketDate <= end;
      }
      
      return includeTicket;
    });
    
    console.log('📊 INSIGHTS: Total tickets after date filter:', filteredTickets.length);
  }
  
  if (agentId) {
    filteredTickets = filteredTickets.filter(t => t.agentId === agentId);
  }
  if (category) {
    filteredTickets = filteredTickets.filter(t => t.categoryId === category);
  }

  // Generate ticket volume data based on actual ticket creation dates
  const getTicketVolumeData = () => {
    const data = [];
    const ticketCounts = {};
    
    // Determine date range for chart data
    let chartStartDate, chartEndDate, granularity;
    
    if (startDate && endDate) {
      chartStartDate = new Date(startDate);
      chartEndDate = new Date(endDate);
      
      // Determine granularity based on date range span
      const daysDiff = Math.ceil((chartEndDate - chartStartDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 31) {
        granularity = 'daily';
      } else if (daysDiff <= 186) { // ~6 months
        granularity = 'weekly';
      } else if (daysDiff <= 730) { // ~2 years
        granularity = 'monthly';
      } else {
        granularity = 'quarterly';
      }
    } else {
      // Fallback to old logic if no date range specified
      const now = new Date();
      if (timeRange === 'daily') {
        chartStartDate = new Date(now);
        chartStartDate.setDate(chartStartDate.getDate() - 29);
        chartEndDate = now;
        granularity = 'daily';
      } else if (timeRange === 'monthly') {
        chartStartDate = new Date(now);
        chartStartDate.setMonth(chartStartDate.getMonth() - 11);
        chartEndDate = now;
        granularity = 'monthly';
      } else { // quarterly
        chartStartDate = new Date(now);
        chartStartDate.setMonth(chartStartDate.getMonth() - 21); // 7 quarters back
        chartEndDate = now;
        granularity = 'quarterly';
      }
    }
    
    // Initialize time periods based on granularity
    if (granularity === 'daily') {
      const current = new Date(chartStartDate);
      while (current <= chartEndDate) {
        const dateStr = current.toISOString().split('T')[0];
        ticketCounts[dateStr] = 0;
        current.setDate(current.getDate() + 1);
      }
    } else if (granularity === 'weekly') {
      const current = new Date(chartStartDate);
      // Start from beginning of week
      current.setDate(current.getDate() - current.getDay());
      while (current <= chartEndDate) {
        const weekStart = new Date(current);
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const dateStr = `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`;
        ticketCounts[dateStr] = 0;
        current.setDate(current.getDate() + 7);
      }
    } else if (granularity === 'monthly') {
      const current = new Date(chartStartDate.getFullYear(), chartStartDate.getMonth(), 1);
      while (current <= chartEndDate) {
        const dateStr = current.toISOString().slice(0, 7);
        ticketCounts[dateStr] = 0;
        current.setMonth(current.getMonth() + 1);
      }
    } else { // quarterly
      const startQuarter = Math.floor(chartStartDate.getMonth() / 3);
      const startYear = chartStartDate.getFullYear();
      const endQuarter = Math.floor(chartEndDate.getMonth() / 3);
      const endYear = chartEndDate.getFullYear();
      
      let currentYear = startYear;
      let currentQuarter = startQuarter;
      
      while (currentYear < endYear || (currentYear === endYear && currentQuarter <= endQuarter)) {
        const dateStr = `${currentYear}-Q${currentQuarter + 1}`;
        ticketCounts[dateStr] = 0;
        
        currentQuarter++;
        if (currentQuarter > 3) {
          currentQuarter = 0;
          currentYear++;
        }
      }
    }

    // Count actual tickets by time period
    filteredTickets.forEach(ticket => {
      const createdDate = new Date(ticket.createdAt);
      let periodKey;
      
      if (granularity === 'daily') {
        periodKey = createdDate.toISOString().split('T')[0];
      } else if (granularity === 'weekly') {
        // Find which week this ticket belongs to
        const ticketDate = new Date(createdDate);
        ticketDate.setDate(ticketDate.getDate() - ticketDate.getDay()); // Start of week
        const weekEnd = new Date(ticketDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        periodKey = `${ticketDate.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`;
      } else if (granularity === 'monthly') {
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

  // Generate geography data from ticket country information
  const geographyData = {};
  filteredTickets.forEach(ticket => {
    // Use new customerCountry field first, fallback to parsing old customerAddress
    let country = ticket.customerCountry;
    if (!country && ticket.customerAddress) {
      // Try to extract country from old address format (assuming country is at the end)
      const addressParts = ticket.customerAddress.split(',').map(part => part.trim());
      if (addressParts.length > 1) {
        country = addressParts[addressParts.length - 1];
      }
    }
    
    if (country) {
      geographyData[country] = (geographyData[country] || 0) + 1;
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

  // Generate device model data from actual tickets
  const deviceModelStats = {};
  
  // Ensure we have device models available
  if (!deviceModels || deviceModels.length === 0) {
    console.warn('No device models found, initializing defaults');
    deviceModels = [
      { name: 'BWIII', description: 'BrainWave III Device', isActive: true },
      { name: 'BWMini', description: 'BrainWave Mini Device', isActive: true },
      { name: 'Compass', description: 'Compass Navigation Device', isActive: true },
      { name: 'Maxxi', description: 'Maxxi Advanced Device', isActive: true }
    ];
  }
  
  deviceModels.forEach(model => {
    deviceModelStats[model.name] = {
      name: model.name,
      value: 0,
      color: null // Will be assigned from COLORS array in frontend
    };
  });

  // Count tickets by device model
  filteredTickets.forEach(ticket => {
    if (ticket.deviceModel && deviceModelStats[ticket.deviceModel]) {
      deviceModelStats[ticket.deviceModel].value++;
    }
  });

  const deviceModelData = Object.values(deviceModelStats).filter(model => model.value > 0);
  


  return {
    ticketVolumeData: getTicketVolumeData(),
    geographyData: geographyArray,
    topAgents,
    categoryData,
    deviceModelData,
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
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      agentId: req.query.agentId,
      category: req.query.category
    };

    console.log('📊 INSIGHTS: Received filters:', filters);

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


// Debug endpoint to check specific ticket data
app.get('/api/debug/ticket/:ticketNumber', (req, res) => {
  const { ticketNumber } = req.params;
  console.log('🔍 Debug request for ticket:', ticketNumber);
  
  const ticket = tickets.find(t => t.ticketNumber === ticketNumber);
  
  if (ticket) {
    console.log('✅ Found ticket:', ticketNumber);
    console.log('   Title:', ticket.title);
    console.log('   Customer Name:', ticket.customerName || 'N/A');
    console.log('   Customer Email:', ticket.customerEmail || 'N/A');
    console.log('   Street Address:', ticket.customerStreetAddress || 'N/A');
    console.log('   City:', ticket.customerCity || 'N/A');
    console.log('   State:', ticket.customerState || 'N/A');
    console.log('   Zip Code:', ticket.customerZipCode || 'N/A');
    console.log('   Country:', ticket.customerCountry || 'N/A');
    console.log('   Legacy Address:', ticket.customerAddress || 'N/A');
    console.log('   Last Updated:', ticket.updatedAt);
    
    res.json({
      success: true,
      data: {
        ticket: {
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail,
          customerStreetAddress: ticket.customerStreetAddress,
          customerCity: ticket.customerCity,
          customerState: ticket.customerState,
          customerZipCode: ticket.customerZipCode,
          customerCountry: ticket.customerCountry,
          customerAddress: ticket.customerAddress,
          updatedAt: ticket.updatedAt
        }
      }
    });
  } else {
    console.log('❌ Ticket not found:', ticketNumber);
    console.log('Available tickets:');
    tickets.forEach(t => {
      console.log('  - ' + t.ticketNumber + ': ' + t.title);
    });
    
    res.status(404).json({
      success: false,
      error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' },
      availableTickets: tickets.map(t => ({ ticketNumber: t.ticketNumber, title: t.title }))
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('🚀 NeuroChat Server running on http://localhost:' + PORT);
  console.log('📡 Socket.IO server ready for real-time connections');
  console.log('👤 Demo accounts ready: customer@demo.com / agent@demo.com (password: demo123)');
  
  // Initialize email system after server starts
  console.log('');
  initializeEmailService();
}); 

// ==========================================
// SYSTEM SETTINGS ENDPOINTS (Admin only)
// ==========================================

// In-memory system settings (replace with database in production)
let systemSettings = {
  // General Settings
  organizationName: 'NeuroChat Support',
  supportEmail: 'support@neurochat.com',
  
  // File Upload Settings
  maxFileSize: 10, // MB
  allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png', 'xls', 'xlsx'],
  enableFileUpload: true,
  
  // Security Settings
  sessionTimeout: 60, // minutes
  maxLoginAttempts: 5,
  
  // User Settings
  enableRegistration: true,
  defaultUserRole: 'Customer',
  maxTicketsPerUser: 10,
  
  // System Status
  systemNotifications: true,
  maintenanceMode: false,
  
  // Chat-related settings
  chatAbandonmentTimeout: 15, // in minutes
  
  // Enhanced Ticket Timing Rules (in minutes)
  ai_to_yellow_delay: 0,
  yellow_to_red_delay: 3,
  unassigned_to_yellow: 1,
  unassigned_to_red: 3,
  assigned_to_yellow: 5,
  assigned_to_red: 10,
  
  // Sound + Blink Configuration
  green_sound_enabled: true,
  yellow_sound_enabled: true,
  red_sound_enabled: true,
  yellow_sound_repeat_interval: 2,
  red_sound_repeat_interval: 2,
  green_blink_enabled: true,
  yellow_blink_enabled: true,
  red_blink_enabled: true,
  blink_duration_seconds: 10
};

// Get system settings (requires system.settings permission)
app.get('/api/system-settings', authenticateToken, (req, res) => {
  try {
    // Check if user has system settings permission
    if (!req.user.permissions.includes('system.settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'System settings permission required' }
      });
    }

    res.json({
      success: true,
      data: { settings: systemSettings }
    });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Update system settings (requires system.settings permission)
app.put('/api/system-settings', authenticateToken, (req, res) => {
  try {
    // Check if user has system settings permission
    if (!req.user.permissions.includes('system.settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'System settings permission required' }
      });
    }

    const updatedSettings = req.body;
    
    // Validate settings
    const validKeys = Object.keys(systemSettings);
    const invalidKeys = Object.keys(updatedSettings).filter(key => !validKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SETTINGS', message: `Invalid setting keys: ${invalidKeys.join(', ')}` }
      });
    }

    // Update settings
    Object.keys(updatedSettings).forEach(key => {
      if (validKeys.includes(key)) {
        systemSettings[key] = updatedSettings[key];
      }
    });

    // Log audit trail
    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'system_settings_updated',
      targetType: 'system',
      targetId: 'settings',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Updated system settings: ${Object.keys(updatedSettings).join(', ')}`
    });

    res.json({
      success: true,
      data: { settings: systemSettings }
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Create new category (requires system.settings permission)
app.post('/api/categories', authenticateToken, (req, res) => {
  try {
    // Check if user has system settings permission
    if (!req.user.permissions.includes('system.settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'System settings permission required' }
      });
    }

    const { name, description, colorCode } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Category name is required' }
      });
    }

    // Check if category name already exists
    const existingCategory = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existingCategory) {
      return res.status(409).json({
        success: false,
        error: { code: 'CATEGORY_EXISTS', message: 'Category name already exists' }
      });
    }

    const newCategory = {
      id: uuidv4(),
      name,
      description: description || '',
      colorCode: colorCode || '#6c757d'
    };

    categories.push(newCategory);

    // Log audit trail
    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'category_created',
      targetType: 'category',
      targetId: newCategory.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Created category: ${name}`
    });

    res.status(201).json({
      success: true,
      data: { category: newCategory }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Update category (Admin only)
app.put('/api/categories/:id', authenticateToken, (req, res) => {
  try {
    // Check if user is admin
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    const { id } = req.params;
    const { name, description, colorCode } = req.body;

    const categoryIndex = categories.findIndex(c => c.id === id);
    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' }
      });
    }

    // Check if new name conflicts with existing categories (excluding current)
    if (name) {
      const existingCategory = categories.find(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase());
      if (existingCategory) {
        return res.status(409).json({
          success: false,
          error: { code: 'CATEGORY_EXISTS', message: 'Category name already exists' }
        });
      }
    }

    // Update category
    if (name !== undefined) categories[categoryIndex].name = name;
    if (description !== undefined) categories[categoryIndex].description = description;
    if (colorCode !== undefined) categories[categoryIndex].colorCode = colorCode;

    // Log audit trail
    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'category_updated',
      targetType: 'category',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Updated category: ${categories[categoryIndex].name}`
    });

    res.json({
      success: true,
      data: { category: categories[categoryIndex] }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Delete category (Admin only)
app.delete('/api/categories/:id', authenticateToken, (req, res) => {
  try {
    // Check if user is admin
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    const { id } = req.params;

    const categoryIndex = categories.findIndex(c => c.id === id);
    if (categoryIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' }
      });
    }

    // Check if any tickets use this category
    const ticketsWithCategory = tickets.filter(t => t.categoryId === id);
    if (ticketsWithCategory.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'CATEGORY_IN_USE', message: 'Cannot delete category: tickets are using it' }
      });
    }

    const deletedCategory = categories[categoryIndex];
    categories.splice(categoryIndex, 1);

    // Log audit trail
    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'category_deleted',
      targetType: 'category',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Deleted category: ${deletedCategory.name}`
    });

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// ==========================================
// DROPDOWN OPTIONS ENDPOINTS (Admin only)
// ==========================================

// Get all dropdown options (Categories, Device Models, Customer Types)
app.get('/api/dropdown-options', authenticateToken, (req, res) => {
  try {
    // Check if user is admin
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    res.json({
      success: true,
      data: {
        categories: categories.map(c => ({ ...c, type: 'category' })),
        deviceModels: deviceModels.map(d => ({ ...d, type: 'deviceModel' })),
        customerTypes: customerTypes.map(c => ({ ...c, type: 'customerType' }))
      }
    });
  } catch (error) {
    console.error('Error fetching dropdown options:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// DEVICE MODELS ENDPOINTS

// Create device model
app.post('/api/device-models', authenticateToken, (req, res) => {
  try {
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    const { name, description, isActive = true, displayOrder = 0 } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Device model name is required' }
      });
    }

    // Check if name already exists
    const existing = deviceModels.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'MODEL_EXISTS', message: 'Device model name already exists' }
      });
    }

    const newModel = {
      id: uuidv4(),
      name,
      description: description || '',
      isActive,
      displayOrder
    };

    deviceModels.push(newModel);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'device_model_created',
      targetType: 'device_model',
      targetId: newModel.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Created device model: ${name}`
    });

    res.status(201).json({
      success: true,
      data: { deviceModel: newModel }
    });
  } catch (error) {
    console.error('Error creating device model:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Update device model
app.put('/api/device-models/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    const { id } = req.params;
    const { name, description, isActive, displayOrder } = req.body;

    const modelIndex = deviceModels.findIndex(d => d.id === id);
    if (modelIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'MODEL_NOT_FOUND', message: 'Device model not found' }
      });
    }

    // Check if new name conflicts with existing models (excluding current)
    if (name) {
      const existing = deviceModels.find(d => d.id !== id && d.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'MODEL_EXISTS', message: 'Device model name already exists' }
        });
      }
    }

    // Update model
    if (name !== undefined) deviceModels[modelIndex].name = name;
    if (description !== undefined) deviceModels[modelIndex].description = description;
    if (isActive !== undefined) deviceModels[modelIndex].isActive = isActive;
    if (displayOrder !== undefined) deviceModels[modelIndex].displayOrder = displayOrder;

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'device_model_updated',
      targetType: 'device_model',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Updated device model: ${deviceModels[modelIndex].name}`
    });

    res.json({
      success: true,
      data: { deviceModel: deviceModels[modelIndex] }
    });
  } catch (error) {
    console.error('Error updating device model:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Delete device model
app.delete('/api/device-models/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    const { id } = req.params;

    const modelIndex = deviceModels.findIndex(d => d.id === id);
    if (modelIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'MODEL_NOT_FOUND', message: 'Device model not found' }
      });
    }

    // Check if any tickets use this device model
    const ticketsWithModel = tickets.filter(t => t.deviceModel === deviceModels[modelIndex].name);
    if (ticketsWithModel.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'MODEL_IN_USE', message: 'Cannot delete device model: tickets are using it' }
      });
    }

    const deletedModel = deviceModels[modelIndex];
    deviceModels.splice(modelIndex, 1);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'device_model_deleted',
      targetType: 'device_model',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Deleted device model: ${deletedModel.name}`
    });

    res.json({
      success: true,
      message: 'Device model deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting device model:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// CUSTOMER TYPES ENDPOINTS

// Create customer type
app.post('/api/customer-types', authenticateToken, (req, res) => {
  try {
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    const { name, description, colorCode = '#6c757d', isActive = true, displayOrder = 0 } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Customer type name is required' }
      });
    }

    // Check if name already exists
    const existing = customerTypes.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'TYPE_EXISTS', message: 'Customer type name already exists' }
      });
    }

    const newType = {
      id: uuidv4(),
      name,
      description: description || '',
      colorCode,
      isActive,
      displayOrder
    };

    customerTypes.push(newType);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'customer_type_created',
      targetType: 'customer_type',
      targetId: newType.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Created customer type: ${name}`
    });

    res.status(201).json({
      success: true,
      data: { customerType: newType }
    });
  } catch (error) {
    console.error('Error creating customer type:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Update customer type
app.put('/api/customer-types/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    const { id } = req.params;
    const { name, description, colorCode, isActive, displayOrder } = req.body;

    const typeIndex = customerTypes.findIndex(c => c.id === id);
    if (typeIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'TYPE_NOT_FOUND', message: 'Customer type not found' }
      });
    }

    // Check if new name conflicts with existing types (excluding current)
    if (name) {
      const existing = customerTypes.find(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'TYPE_EXISTS', message: 'Customer type name already exists' }
        });
      }
    }

    // Update type
    if (name !== undefined) customerTypes[typeIndex].name = name;
    if (description !== undefined) customerTypes[typeIndex].description = description;
    if (colorCode !== undefined) customerTypes[typeIndex].colorCode = colorCode;
    if (isActive !== undefined) customerTypes[typeIndex].isActive = isActive;
    if (displayOrder !== undefined) customerTypes[typeIndex].displayOrder = displayOrder;

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'customer_type_updated',
      targetType: 'customer_type',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Updated customer type: ${customerTypes[typeIndex].name}`
    });

    res.json({
      success: true,
      data: { customerType: customerTypes[typeIndex] }
    });
  } catch (error) {
    console.error('Error updating customer type:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Delete customer type
app.delete('/api/customer-types/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.roleName !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
      });
    }

    const { id } = req.params;

    const typeIndex = customerTypes.findIndex(c => c.id === id);
    if (typeIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'TYPE_NOT_FOUND', message: 'Customer type not found' }
      });
    }

    // Check if any tickets use this customer type
    const ticketsWithType = tickets.filter(t => t.customerType === customerTypes[typeIndex].name);
    if (ticketsWithType.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'TYPE_IN_USE', message: 'Cannot delete customer type: tickets are using it' }
      });
    }

    const deletedType = customerTypes[typeIndex];
    customerTypes.splice(typeIndex, 1);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'customer_type_deleted',
      targetType: 'customer_type',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: `Deleted customer type: ${deletedType.name}`
    });

    res.json({
      success: true,
      message: 'Customer type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer type:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// ==========================================
// COMPANY/ACCOUNT MANAGEMENT API ENDPOINTS
// ==========================================

// In-memory storage for companies (replace with database calls)
let companies = [
  {
    id: uuidv4(),
    name: 'NeuroVirtual Inc.',
    aliases: ['Neurovirtual', 'NeuroVirtual USA', 'NeuroVirtual America', 'NV Inc'],
    description: 'Main company for NeuroVirtual products',
    primaryEmail: 'info@neurovirtual.com',
    primaryPhone: null,
    website: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    country: 'United States',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null
  },
  {
    id: uuidv4(),
    name: 'Acme Corporation',
    aliases: ['ACME Corp', 'Acme Corp.', 'ACME', 'Acme Inc'],
    description: 'Large enterprise customer',
    primaryEmail: 'contact@acme.com',
    primaryPhone: null,
    website: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    country: 'United States',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null
  },
  {
    id: uuidv4(),
    name: 'Innovative Solutions Ltd',
    aliases: ['Innovative Solutions', 'Innovation Solutions', 'IS Ltd', 'InnoSol'],
    description: 'Technology solutions company',
    primaryEmail: 'hello@innovativesolutions.com',
    primaryPhone: null,
    website: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    country: 'United Kingdom',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null
  },
  {
    id: uuidv4(),
    name: 'Tech Startup Inc.',
    aliases: ['Tech Startup', 'TechStart', 'TS Inc', 'TechStartup Inc'],
    description: 'Growing technology startup',
    primaryEmail: 'team@techstartup.com',
    primaryPhone: null,
    website: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    country: 'Canada',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null
  },
  {
    id: uuidv4(),
    name: 'Global Healthcare Systems',
    aliases: ['Global Healthcare', 'GHS', 'Global Health', 'Healthcare Systems'],
    description: 'International healthcare provider',
    primaryEmail: 'support@globalhealthcare.com',
    primaryPhone: null,
    website: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    country: 'Germany',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: null,
    updatedBy: null
  }
];

// Auto-create device when ticket references one
const autoCreateDeviceFromTicket = (ticket) => {
  if (!ticket.deviceSerialNumber || !ticket.deviceModel) {
    return null;
  }

  // Check if device already exists
  let device = devices.find(d => d.serialNumber === ticket.deviceSerialNumber);
  
  if (!device) {
    // Get company ID from ticket or customer
    const customer = users.find(u => u.id === ticket.customerId);
    let deviceCompanyId = ticket.companyId || customer?.companyId || null;
    
    // For tickets with customer company info, try to find or create a company based on customerCompany name
    if (!deviceCompanyId && ticket.customerCompany) {
              console.log('🏢 Looking for company:', ticket.customerCompany);
      let company = companies.find(c => 
        c.name === ticket.customerCompany || 
        (c.aliases && c.aliases.includes(ticket.customerCompany))
      );
      
      if (!company) {
        // Auto-create company for anonymous ticket
        company = {
          id: uuidv4(),
          name: ticket.customerCompany,
          aliases: [],
          description: `Auto-created company from ticket ${ticket.ticketNumber}`,
          primaryEmail: null,
          primaryPhone: null,
          website: null,
          address: ticket.customerStreetAddress || null,
          city: ticket.customerCity || null,
          state: ticket.customerState || null,
          zipCode: ticket.customerZipCode || null,
          country: ticket.customerCountry || null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: null,
          updatedBy: null
        };
        companies.push(company);
        console.log('🏢 Auto-created company:', company.name, 'ID:', company.id);
      }
      
      deviceCompanyId = company.id;
      
      // Also update the ticket with the company association
      const ticketIndex = tickets.findIndex(t => t.id === ticket.id);
      if (ticketIndex !== -1) {
        tickets[ticketIndex].companyId = company.id;
        console.log('🔗 Associated ticket with company:', company.name);
      }
    }

    // Create new device
    device = {
      id: uuidv4(),
      customerId: ticket.customerId, // Can be null for anonymous tickets
      companyId: deviceCompanyId, // Associate with company (ticket or customer company)
      model: ticket.deviceModel,
      serialNumber: ticket.deviceSerialNumber,
      warrantyExpires: null,
      invoiceNumber: null,
      invoiceDate: null,
      comments: `Auto-created from ticket ${ticket.ticketNumber || ticket.id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    devices.push(device);
    console.log('🔧 Auto-created device:', device.serialNumber, 'for company:', deviceCompanyId);
  }

  // Link ticket to device
  const existingLink = ticketDevices.find(td => 
    td.ticketId === ticket.id && td.deviceId === device.id
  );
  
  if (!existingLink) {
    ticketDevices.push({
      ticketId: ticket.id,
      deviceId: device.id,
      linkedAt: new Date().toISOString(),
      linkedBy: null
    });
    console.log('🔗 Linked ticket to device:', ticket.id, '->', device.id);
  }

  return device;
};

// Now that companies are initialized, link customers to companies and initialize devices
linkCustomersToCompanies();
initializeDemoDevices();

// Process existing demo tickets to create missing devices (now that companies are available)
console.log('🔧 Processing existing demo tickets for device auto-creation...');
tickets.forEach(ticket => {
  if (ticket.deviceSerialNumber && ticket.deviceModel) {
    console.log(`  - Processing ticket ${ticket.ticketNumber}: ${ticket.deviceSerialNumber}`);
    autoCreateDeviceFromTicket(ticket);
  }
});

// Company fuzzy matching log (replace with database calls)
let companyMatchingLog = [];

// Pending company matches for agent review
let pendingCompanyMatches = [];

// Simple fuzzy matching algorithm using Levenshtein distance
function calculateLevenshteinDistance(str1, str2) {
  const matrix = [];

  // Initialize the matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Calculate similarity percentage using both Levenshtein and string-similarity
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Use string-similarity library for better fuzzy matching
  const jaccardSimilarity = stringSimilarity.compareTwoStrings(str1.toLowerCase(), str2.toLowerCase());
  
  // Also use Levenshtein for backup/comparison
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100; // Both strings are empty
  
  const distance = calculateLevenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const levenshteinSimilarity = ((maxLength - distance) / maxLength) * 100;
  
  // Use the higher similarity score for better matching
  return Math.max(jaccardSimilarity * 100, levenshteinSimilarity);
}

// Fuzzy match company names
function findCompanyMatches(inputName, threshold = 75) {
  const matches = [];
  
  companies.forEach(company => {
    // Check against company name
    const nameScore = calculateSimilarity(inputName, company.name);
    if (nameScore >= threshold) {
      matches.push({
        company: company,
        matchedField: 'name',
        matchedValue: company.name,
        confidence: Math.round(nameScore * 100) / 100
      });
    }
    
    // Check against aliases
    if (company.aliases && Array.isArray(company.aliases)) {
      company.aliases.forEach(alias => {
        const aliasScore = calculateSimilarity(inputName, alias);
        if (aliasScore >= threshold) {
          matches.push({
            company: company,
            matchedField: 'alias',
            matchedValue: alias,
            confidence: Math.round(aliasScore * 100) / 100
          });
        }
      });
    }
  });
  
  // Sort by confidence (highest first) and remove duplicates
  const uniqueMatches = [];
  const seenCompanies = new Set();
  
  matches
    .sort((a, b) => b.confidence - a.confidence)
    .forEach(match => {
      if (!seenCompanies.has(match.company.id)) {
        seenCompanies.add(match.company.id);
        uniqueMatches.push(match);
      }
    });
  
  return uniqueMatches;
}

// Automatic fuzzy matching when ticket is closed/resolved
function performAutomaticCompanyMatching(ticket) {
  console.log('🔍 Performing automatic company matching for ticket:', ticket.id);
  
  // Only perform fuzzy matching if customer typed a company name manually
  if (!ticket.customerCompany || ticket.companyId) {
    console.log('  - Skipping: No manual company name or already assigned');
    return;
  }

  // Check if this customer already has a company assigned
  const customer = users.find(u => u.id === ticket.customerId);
  if (customer && customer.companyId) {
    console.log('  - Skipping: Customer already has a company assigned');
    return;
  }

  // Find fuzzy matches with 85% confidence threshold
  const matches = findCompanyMatches(ticket.customerCompany, 85);
  
  if (matches.length > 0) {
    const bestMatch = matches[0]; // Highest confidence match
    
    console.log(`  - Found match: "${ticket.customerCompany}" → "${bestMatch.company.name}" (${bestMatch.confidence}%)`);
    
    // Auto-approve matches with very high confidence (95%+) or exact matches
    if (bestMatch.confidence >= 95 || bestMatch.matchedField === 'name') {
      console.log(`  - Auto-approving high-confidence match (${bestMatch.confidence}%)`);
      
      // Find the ticket index for updating
      const ticketIndex = tickets.findIndex(t => t.id === ticket.id);
      if (ticketIndex !== -1) {
        // Update the ticket with company association
        tickets[ticketIndex] = {
          ...tickets[ticketIndex],
          companyId: bestMatch.company.id,
          customerCompany: bestMatch.company.name
        };
        
        // Update customer if exists
        if (ticket.customerId) {
          const customerIndex = users.findIndex(u => u.id === ticket.customerId);
          if (customerIndex !== -1) {
            users[customerIndex] = {
              ...users[customerIndex],
              companyId: bestMatch.company.id,
              company: bestMatch.company.name
            };
          }
        }
        
        // Update any devices associated with this ticket/customer
        if (ticket.customerId) {
          devices.forEach((device, index) => {
            if (device.customerId === ticket.customerId) {
              devices[index] = {
                ...device,
                companyId: bestMatch.company.id
              };
            }
          });
        }
        
        // Also update devices directly linked to this ticket
        const ticketDeviceLinks = ticketDevices.filter(td => td.ticketId === ticket.id);
        ticketDeviceLinks.forEach(link => {
          const deviceIndex = devices.findIndex(d => d.id === link.deviceId);
          if (deviceIndex !== -1 && !devices[deviceIndex].companyId) {
            devices[deviceIndex] = {
              ...devices[deviceIndex],
              companyId: bestMatch.company.id
            };
            console.log('  - Updated device company association:', devices[deviceIndex].serialNumber);
          }
        });
        
        // Log the automatic assignment
        companyMatchingLog.push({
          id: uuidv4(),
          inputCompanyName: ticket.customerCompany,
          matchedCompanyId: bestMatch.company.id,
          matchedCompanyName: bestMatch.company.name,
          confidenceScore: bestMatch.confidence,
          ticketId: ticket.id,
          customerId: ticket.customerId,
          actionTaken: 'auto_assigned',
          assignedBy: null,
          createdAt: new Date().toISOString()
        });
        
        console.log('  - Company automatically assigned to ticket and customer');
        
        // Emit notification to agents about the automatic assignment
        io.emit('company_auto_assigned', {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          customerName: ticket.customerName,
          inputCompanyName: ticket.customerCompany,
          assignedCompany: bestMatch.company.name,
          confidence: bestMatch.confidence,
          message: `Auto-assigned company: "${bestMatch.company.name}" (confidence: ${bestMatch.confidence.toFixed(1)}%)`
        });
      }
    } else {
      // Create a pending match for agent review (confidence 85-94%)
      const pendingMatch = {
        id: uuidv4(),
        ticketId: ticket.id,
        customerId: ticket.customerId,
        inputCompanyName: ticket.customerCompany,
        suggestedCompany: bestMatch.company,
        confidence: bestMatch.confidence,
        matchedField: bestMatch.matchedField,
        matchedValue: bestMatch.matchedValue,
        status: 'pending', // 'pending', 'approved', 'rejected'
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null
      };
      
      pendingCompanyMatches.push(pendingMatch);
      
      // Log the matching attempt
      companyMatchingLog.push({
        id: uuidv4(),
        inputCompanyName: ticket.customerCompany,
        matchedCompanyId: bestMatch.company.id,
        matchedCompanyName: bestMatch.company.name,
        confidenceScore: bestMatch.confidence,
        ticketId: ticket.id,
        customerId: ticket.customerId,
        actionTaken: 'suggested',
        assignedBy: null,
        createdAt: new Date().toISOString()
      });
      
      // Emit notification to connected agents
      io.emit('company_match_suggestion', {
        pendingMatchId: pendingMatch.id,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        customerName: ticket.customerName,
        inputCompanyName: ticket.customerCompany,
        suggestedCompany: bestMatch.company.name,
        confidence: bestMatch.confidence,
        message: `Customer typed: "${ticket.customerCompany}". Possible match: "${bestMatch.company.name}" (confidence: ${bestMatch.confidence.toFixed(1)}%). Assign?`
      });
      
      console.log('  - Notification sent to agents for review');
    }
  } else {
    console.log('  - No matches found above 85% confidence threshold');
    
    // Log the no-match attempt
    companyMatchingLog.push({
      id: uuidv4(),
      inputCompanyName: ticket.customerCompany,
      matchedCompanyId: null,
      matchedCompanyName: null,
      confidenceScore: null,
      ticketId: ticket.id,
      customerId: ticket.customerId,
      actionTaken: 'no_match',
      assignedBy: null,
      createdAt: new Date().toISOString()
    });
  }
}

// Get enriched company data with related counts
const getCompanyWithRelations = (company) => {
  // Count related registered customers (users)
  const relatedRegisteredCustomers = users.filter(user => 
    user.userType === 'customer' && 
    (user.companyId === company.id || user.company === company.name)
  );
  
  // Count related tickets
  const relatedTickets = tickets.filter(ticket => 
    ticket.companyId === company.id || 
    ticket.customerCompany === company.name ||
    relatedRegisteredCustomers.some(customer => customer.id === ticket.customerId)
  );
  
  // Get unique customers from tickets (both registered and non-registered)
  const ticketCustomerMap = new Map();
  
  relatedTickets.forEach(ticket => {
    if (ticket.customerEmail) {
      const existingCustomer = ticketCustomerMap.get(ticket.customerEmail);
      if (!existingCustomer) {
        // Check if this customer has a registered user account
        const registeredUser = users.find(u => u.email === ticket.customerEmail && u.userType === 'customer');
        
        ticketCustomerMap.set(ticket.customerEmail, {
          id: registeredUser?.id || ticket.customerEmail,
          name: ticket.customerName || (registeredUser ? `${registeredUser.firstName} ${registeredUser.lastName}` : ''),
          firstName: registeredUser?.firstName || ticket.customerName?.split(' ')[0] || '',
          lastName: registeredUser?.lastName || ticket.customerName?.split(' ').slice(1).join(' ') || '',
          email: ticket.customerEmail,
          phone: ticket.customerPhone || registeredUser?.phone || '',
          company: company.name,
          country: ticket.customerCountry || '',
          streetAddress: ticket.customerStreetAddress || '',
          city: ticket.customerCity || '',
          state: ticket.customerState || '',
          zipCode: ticket.customerZipCode || '',
          customerType: ticket.customerType || 'Standard',
          isRegistered: !!registeredUser,
          createdAt: registeredUser?.createdAt || null,
          lastTicketDate: ticket.createdAt,
          ticketCount: 1
        });
      } else {
        // Update existing customer data
        existingCustomer.ticketCount++;
        if (new Date(ticket.createdAt) > new Date(existingCustomer.lastTicketDate)) {
          existingCustomer.lastTicketDate = ticket.createdAt;
        }
        // Update customer fields with latest ticket data if not already set
        if (!existingCustomer.name && ticket.customerName) existingCustomer.name = ticket.customerName;
        if (!existingCustomer.phone && ticket.customerPhone) existingCustomer.phone = ticket.customerPhone;
        if (!existingCustomer.country && ticket.customerCountry) existingCustomer.country = ticket.customerCountry;
        if (!existingCustomer.streetAddress && ticket.customerStreetAddress) existingCustomer.streetAddress = ticket.customerStreetAddress;
        if (!existingCustomer.city && ticket.customerCity) existingCustomer.city = ticket.customerCity;
        if (!existingCustomer.state && ticket.customerState) existingCustomer.state = ticket.customerState;
        if (!existingCustomer.zipCode && ticket.customerZipCode) existingCustomer.zipCode = ticket.customerZipCode;
        if (ticket.customerType && existingCustomer.customerType === 'Standard') existingCustomer.customerType = ticket.customerType;
      }
    }
  });
  
  const allCustomers = Array.from(ticketCustomerMap.values());
  
  // Count related devices (both direct company association and indirect through customers)
  const relatedDevices = devices.filter(device => 
    device.companyId === company.id || 
    allCustomers.some(customer => customer.id === device.customerId)
  );
  
  return {
    ...company,
    customerCount: allCustomers.length,
    ticketCount: relatedTickets.length,
    deviceCount: relatedDevices.length,
    lastTicketDate: relatedTickets.length > 0 
      ? relatedTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
      : null,
    customers: allCustomers,
    tickets: relatedTickets,
    devices: relatedDevices
  };
};

// Get companies list with filtering and pagination
app.get('/api/companies', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company view permission required' }
      });
    }

    const { 
      search = '', 
      country = '', 
      sortBy = 'name', 
      sortOrder = 'asc',
      page = 1,
      limit = 50
    } = req.query;

    let filteredCompanies = companies.filter(company => company.isActive);

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredCompanies = filteredCompanies.filter(company =>
        company.name.toLowerCase().includes(searchLower) ||
        company.description?.toLowerCase().includes(searchLower) ||
        company.primaryEmail?.toLowerCase().includes(searchLower) ||
        (company.aliases && company.aliases.some(alias => 
          alias.toLowerCase().includes(searchLower)
        ))
      );
    }

    // Apply country filter
    if (country) {
      filteredCompanies = filteredCompanies.filter(company => company.country === country);
    }

    // Get enriched data
    const enrichedCompanies = filteredCompanies.map(getCompanyWithRelations);

    // Apply sorting
    enrichedCompanies.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'country':
          aValue = a.country || '';
          bValue = b.country || '';
          break;
        case 'customerCount':
          aValue = a.customerCount;
          bValue = b.customerCount;
          break;
        case 'ticketCount':
          aValue = a.ticketCount;
          bValue = b.ticketCount;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedCompanies = enrichedCompanies.slice(startIndex, endIndex);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'companies_viewed',
      targetType: 'companies',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Viewed companies list with filters: search="${search}", country="${country}"`
    });

    res.json({
      success: true,
      data: {
        companies: paginatedCompanies,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: enrichedCompanies.length,
          totalPages: Math.ceil(enrichedCompanies.length / limitNum),
          hasMore: endIndex < enrichedCompanies.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Get single company with details
app.get('/api/companies/:id', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company view permission required' }
      });
    }

    const { id } = req.params;
    const company = companies.find(c => c.id === id && c.isActive);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Company not found' }
      });
    }

    const enrichedCompany = getCompanyWithRelations(company);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'company_viewed',
      targetType: 'company',
      targetId: id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Viewed company details: ${company.name}`
    });

    res.json({
      success: true,
      data: { company: enrichedCompany }
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Create new company
app.post('/api/companies', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.create')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company create permission required' }
      });
    }

    const {
      name,
      aliases = [],
      description,
      primaryEmail,
      primaryPhone,
      website,
      address,
      city,
      state,
      zipCode,
      country
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Company name is required' }
      });
    }

    // Check for duplicate names
    const existingCompany = companies.find(c => 
      c.name.toLowerCase() === name.trim().toLowerCase() && c.isActive
    );
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_COMPANY', message: 'Company with this name already exists' }
      });
    }

    const newCompany = {
      id: uuidv4(),
      name: name.trim(),
      aliases: Array.isArray(aliases) ? aliases.filter(a => a && a.trim()) : [],
      description: description?.trim() || null,
      primaryEmail: primaryEmail?.trim() || null,
      primaryPhone: primaryPhone?.trim() || null,
      website: website?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      zipCode: zipCode?.trim() || null,
      country: country?.trim() || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.id,
      updatedBy: req.user.id
    };

    companies.push(newCompany);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'company_created',
      targetType: 'company',
      targetId: newCompany.id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Created company: ${newCompany.name}`
    });

    const enrichedCompany = getCompanyWithRelations(newCompany);

    res.status(201).json({
      success: true,
      data: { company: enrichedCompany }
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Update company
app.put('/api/companies/:id', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.edit')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company edit permission required' }
      });
    }

    const { id } = req.params;
    const {
      name,
      aliases,
      description,
      primaryEmail,
      primaryPhone,
      website,
      address,
      city,
      state,
      zipCode,
      country
    } = req.body;

    const companyIndex = companies.findIndex(c => c.id === id && c.isActive);
    if (companyIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Company not found' }
      });
    }

    const company = companies[companyIndex];

    // Validation
    if (name && !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Company name cannot be empty' }
      });
    }

    // Check for duplicate names (excluding current company)
    if (name && name.trim() !== company.name) {
      const existingCompany = companies.find(c => 
        c.name.toLowerCase() === name.trim().toLowerCase() && 
        c.isActive && 
        c.id !== id
      );
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE_COMPANY', message: 'Company with this name already exists' }
        });
      }
    }

    // Update company
    const updatedCompany = {
      ...company,
      name: name?.trim() || company.name,
      aliases: aliases !== undefined ? (Array.isArray(aliases) ? aliases.filter(a => a && a.trim()) : []) : company.aliases,
      description: description !== undefined ? (description?.trim() || null) : company.description,
      primaryEmail: primaryEmail !== undefined ? (primaryEmail?.trim() || null) : company.primaryEmail,
      primaryPhone: primaryPhone !== undefined ? (primaryPhone?.trim() || null) : company.primaryPhone,
      website: website !== undefined ? (website?.trim() || null) : company.website,
      address: address !== undefined ? (address?.trim() || null) : company.address,
      city: city !== undefined ? (city?.trim() || null) : company.city,
      state: state !== undefined ? (state?.trim() || null) : company.state,
      zipCode: zipCode !== undefined ? (zipCode?.trim() || null) : company.zipCode,
      country: country !== undefined ? (country?.trim() || null) : company.country,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    companies[companyIndex] = updatedCompany;

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'company_updated',
      targetType: 'company',
      targetId: id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Updated company: ${updatedCompany.name}`
    });

    const enrichedCompany = getCompanyWithRelations(updatedCompany);

    res.json({
      success: true,
      data: { company: enrichedCompany }
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Delete company (soft delete)
app.delete('/api/companies/:id', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.delete')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company delete permission required' }
      });
    }

    const { id } = req.params;
    const companyIndex = companies.findIndex(c => c.id === id && c.isActive);
    
    if (companyIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Company not found' }
      });
    }

    const company = companies[companyIndex];

    // Check if company has active customers or tickets
    const relatedCustomers = users.filter(user => 
      user.userType === 'customer' && 
      (user.companyId === company.id || user.company === company.name)
    );
    
    const relatedTickets = tickets.filter(ticket => 
      ticket.companyId === company.id || 
      ticket.customerCompany === company.name ||
      relatedCustomers.some(customer => customer.id === ticket.customerId)
    );

    if (relatedCustomers.length > 0 || relatedTickets.length > 0) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'COMPANY_IN_USE', 
          message: `Cannot delete company: ${relatedCustomers.length} customers and ${relatedTickets.length} tickets are associated with it`
        }
      });
    }

    // Soft delete
    companies[companyIndex] = {
      ...company,
      isActive: false,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'company_deleted',
      targetType: 'company',
      targetId: id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Deleted company: ${company.name}`
    });

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Fuzzy match company names
app.post('/api/companies/fuzzy-match', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company view permission required' }
      });
    }

    const { companyName, threshold = 75 } = req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Company name is required' }
      });
    }

    const matches = findCompanyMatches(companyName.trim(), threshold);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'company_fuzzy_match',
      targetType: 'company',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Fuzzy matched company name: "${companyName}" (${matches.length} matches found)`
    });

    res.json({
      success: true,
      data: {
        inputName: companyName.trim(),
        matches: matches.map(match => ({
          company: getCompanyWithRelations(match.company),
          matchedField: match.matchedField,
          matchedValue: match.matchedValue,
          confidence: match.confidence
        })),
        threshold
      }
    });
  } catch (error) {
    console.error('Error in fuzzy matching:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Assign customer to company
app.post('/api/companies/:companyId/assign-customer', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.assign')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company assignment permission required' }
      });
    }

    const { companyId } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID is required' }
      });
    }

    const company = companies.find(c => c.id === companyId && c.isActive);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Company not found' }
      });
    }

    const customerIndex = users.findIndex(u => u.id === customerId && u.userType === 'customer');
    if (customerIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const customer = users[customerIndex];
    
    // Update customer company assignment
    users[customerIndex] = {
      ...customer,
      companyId: companyId,
      company: company.name
    };

    // Update related tickets
    tickets.forEach((ticket, index) => {
      if (ticket.customerId === customerId) {
        tickets[index] = {
          ...ticket,
          companyId: companyId,
          customerCompany: company.name
        };
      }
    });

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'customer_assigned_to_company',
      targetType: 'company',
      targetId: companyId,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Assigned customer ${customer.name || customer.email} to company ${company.name}`
    });

    res.json({
      success: true,
      message: 'Customer assigned to company successfully'
    });
  } catch (error) {
    console.error('Error assigning customer to company:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Unassign customer from company
app.post('/api/companies/:companyId/unassign-customer', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.assign')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company assignment permission required' }
      });
    }

    const { companyId } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID is required' }
      });
    }

    const company = companies.find(c => c.id === companyId && c.isActive);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Company not found' }
      });
    }

    const customerIndex = users.findIndex(u => u.id === customerId && u.userType === 'customer');
    if (customerIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const customer = users[customerIndex];
    
    // Update customer company assignment
    users[customerIndex] = {
      ...customer,
      companyId: null,
      company: null
    };

    // Update related tickets
    tickets.forEach((ticket, index) => {
      if (ticket.customerId === customerId) {
        tickets[index] = {
          ...ticket,
          companyId: null,
          customerCompany: null
        };
      }
    });

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'customer_unassigned_from_company',
      targetType: 'company',
      targetId: companyId,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Unassigned customer ${customer.name || customer.email} from company ${company.name}`
    });

    res.json({
      success: true,
      message: 'Customer unassigned from company successfully'
    });
  } catch (error) {
    console.error('Error unassigning customer from company:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Get company matching suggestions when chat ends
app.post('/api/tickets/:ticketId/suggest-company-match', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company view permission required' }
      });
    }

    const { ticketId } = req.params;
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
      });
    }

    // Check if customer manually typed a company name
    if (!ticket.customerCompany || ticket.companyId) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          message: 'No company matching suggestions needed'
        }
      });
    }

    const matches = findCompanyMatches(ticket.customerCompany, 85); // Higher threshold for suggestions

    if (matches.length === 0) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          message: 'No matching companies found'
        }
      });
    }

    // Log the matching attempt
    const logEntry = {
      id: uuidv4(),
      inputCompanyName: ticket.customerCompany,
      ticketId: ticketId,
      customerId: ticket.customerId,
      matches: matches,
      actionTaken: 'suggested',
      createdAt: new Date().toISOString()
    };
    companyMatchingLog.push(logEntry);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'company_match_suggested',
      ticketNumber: ticket.ticketNumber,
      targetType: 'ticket',
      targetId: ticketId,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Suggested company matches for "${ticket.customerCompany}" (${matches.length} matches)`
    });

    res.json({
      success: true,
      data: {
        inputCompanyName: ticket.customerCompany,
        suggestions: matches.map(match => ({
          company: getCompanyWithRelations(match.company),
          matchedField: match.matchedField,
          matchedValue: match.matchedValue,
          confidence: match.confidence
        })),
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail
        }
      }
    });
  } catch (error) {
    console.error('Error suggesting company matches:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Confirm company match and assign
app.post('/api/tickets/:ticketId/confirm-company-match', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.assign')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company assignment permission required' }
      });
    }

    const { ticketId } = req.params;
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Company ID is required' }
      });
    }

    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
      });
    }

    const company = companies.find(c => c.id === companyId && c.isActive);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Company not found' }
      });
    }

    const ticket = tickets[ticketIndex];

    // Update ticket
    tickets[ticketIndex] = {
      ...ticket,
      companyId: companyId,
      customerCompany: company.name
    };

    // Update customer if exists
    if (ticket.customerId) {
      const customerIndex = users.findIndex(u => u.id === ticket.customerId);
      if (customerIndex !== -1) {
        users[customerIndex] = {
          ...users[customerIndex],
          companyId: companyId,
          company: company.name
        };
      }
    }

    // Update any devices from this ticket/customer
    if (ticket.customerId) {
      devices.forEach((device, index) => {
        if (device.customerId === ticket.customerId) {
          devices[index] = {
            ...device,
            companyId: companyId
          };
        }
      });
    }

    // Log the confirmed match
    const logEntry = {
      id: uuidv4(),
      inputCompanyName: ticket.customerCompany,
      matchedCompanyId: companyId,
      matchedCompanyName: company.name,
      ticketId: ticketId,
      customerId: ticket.customerId,
      actionTaken: 'manual_override',
      assignedBy: req.user.id,
      createdAt: new Date().toISOString()
    };
    companyMatchingLog.push(logEntry);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'company_match_confirmed',
      ticketNumber: ticket.ticketNumber,
      targetType: 'ticket',
      targetId: ticketId,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Confirmed company match: "${ticket.customerCompany}" → "${company.name}"`
    });

    res.json({
      success: true,
      message: 'Company match confirmed and assigned successfully'
    });
  } catch (error) {
    console.error('Error confirming company match:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Get pending company matches for agent review
app.get('/api/companies/pending-matches', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company view permission required' }
      });
    }

    // Filter pending matches (not reviewed yet)
    const pending = pendingCompanyMatches.filter(match => match.status === 'pending');
    
    // Enrich with ticket and customer information
    const enrichedMatches = pending.map(match => {
      const ticket = tickets.find(t => t.id === match.ticketId);
      const customer = users.find(u => u.id === match.customerId);
      
      return {
        ...match,
        ticket: ticket ? {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          status: ticket.status
        } : null,
        customer: customer ? {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email
        } : null
      };
    });

    res.json({
      success: true,
      data: enrichedMatches
    });
  } catch (error) {
    console.error('Error fetching pending company matches:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Approve/reject pending company match
app.post('/api/companies/pending-matches/:matchId/review', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('companies.assign')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Company assignment permission required' }
      });
    }

    const { matchId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Action must be "approve" or "reject"' }
      });
    }

    const matchIndex = pendingCompanyMatches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Pending match not found' }
      });
    }

    const match = pendingCompanyMatches[matchIndex];
    
    // Update match status
    pendingCompanyMatches[matchIndex] = {
      ...match,
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.id
    };

    if (action === 'approve') {
      // Assign customer to company
      const customerIndex = users.findIndex(u => u.id === match.customerId);
      if (customerIndex !== -1) {
        const customer = users[customerIndex];
        users[customerIndex] = {
          ...customer,
          companyId: match.suggestedCompany.id,
          company: match.suggestedCompany.name
        };

        // Update related tickets
        tickets.forEach((ticket, index) => {
          if (ticket.customerId === match.customerId) {
            tickets[index] = {
              ...ticket,
              companyId: match.suggestedCompany.id,
              customerCompany: match.suggestedCompany.name
            };
          }
        });

        // Update devices if any (both by customer and by ticket)
        devices.forEach((device, index) => {
          if (device.customerId === match.customerId) {
            devices[index] = {
              ...device,
              companyId: match.suggestedCompany.id
            };
          }
        });
        
        // Also update devices directly linked to this ticket
        const ticketDeviceLinks = ticketDevices.filter(td => td.ticketId === match.ticketId);
        ticketDeviceLinks.forEach(link => {
          const deviceIndex = devices.findIndex(d => d.id === link.deviceId);
          if (deviceIndex !== -1 && !devices[deviceIndex].companyId) {
            devices[deviceIndex] = {
              ...devices[deviceIndex],
              companyId: match.suggestedCompany.id
            };
          }
        });

        // Log the assignment
        companyMatchingLog.push({
          id: uuidv4(),
          inputCompanyName: match.inputCompanyName,
          matchedCompanyId: match.suggestedCompany.id,
          matchedCompanyName: match.suggestedCompany.name,
          confidenceScore: match.confidence,
          ticketId: match.ticketId,
          customerId: match.customerId,
          actionTaken: 'auto_assigned',
          assignedBy: req.user.id,
          createdAt: new Date().toISOString()
        });

        logAudit({
          userId: req.user.id,
          userName: `${req.user.firstName} ${req.user.lastName}`,
          userType: req.user.userType,
          action: 'company_match_approved',
          targetType: 'company',
          targetId: match.suggestedCompany.id,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          details: `Approved fuzzy match: "${match.inputCompanyName}" → "${match.suggestedCompany.name}" (${match.confidence}% confidence)`
        });
      }
    } else {
      // Log the rejection
      companyMatchingLog.push({
        id: uuidv4(),
        inputCompanyName: match.inputCompanyName,
        matchedCompanyId: match.suggestedCompany.id,
        matchedCompanyName: match.suggestedCompany.name,
        confidenceScore: match.confidence,
        ticketId: match.ticketId,
        customerId: match.customerId,
        actionTaken: 'manual_override',
        assignedBy: req.user.id,
        createdAt: new Date().toISOString()
      });

      logAudit({
        userId: req.user.id,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        userType: req.user.userType,
        action: 'company_match_rejected',
        targetType: 'company',
        targetId: match.suggestedCompany.id,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        details: `Rejected fuzzy match: "${match.inputCompanyName}" → "${match.suggestedCompany.name}" (${match.confidence}% confidence)`
      });
    }

    res.json({
      success: true,
      message: `Company match ${action}d successfully`
    });
  } catch (error) {
    console.error('Error reviewing company match:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// ==========================================
// EMAIL SYSTEM API ENDPOINTS
// ==========================================

// Get email logs with filtering
app.get('/api/email-logs', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('audit.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Audit view permission required' }
      });
    }

    const { ticket_id, type, status, limit = 50, offset = 0 } = req.query;
    
    const filters = {};
    if (ticket_id) filters.ticket_id = ticket_id;
    if (type) filters.type = type;
    if (status) filters.status = status;

    let logs = getEmailLogs(filters);
    
    // Pagination
    const totalCount = logs.length;
    logs = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'email_logs_viewed',
      targetType: 'email_logs',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Viewed email logs with filters: ${JSON.stringify(filters)}`
    });

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: totalCount > parseInt(offset) + parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Get email statistics
app.get('/api/email-stats', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('insights.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insights view permission required' }
      });
    }

    const stats = getEmailStats();

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'email_stats_viewed',
      targetType: 'email_stats',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: 'Viewed email system statistics'
    });

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Manual email send endpoint (for testing)
app.post('/api/tickets/:ticketId/send-email', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('tickets.message')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Ticket messaging permission required' }
      });
    }

    const { ticketId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Message content is required' }
      });
    }

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
      });
    }

    if (!ticket.customerEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer email not available' }
      });
    }

    // Send email fallback
    sendChatFallbackEmail(
      ticket.customerEmail,
      ticket.ticketNumber || ticketId,
      message.trim(),
      ticket
    ).then(result => {
      if (result.success) {
        logAudit({
          userId: req.user.id,
          userName: `${req.user.firstName} ${req.user.lastName}`,
          userType: req.user.userType,
          action: 'manual_email_sent',
          ticketNumber: ticket.ticketNumber,
          targetType: 'email',
          targetId: result.logId,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          details: `Manually sent email to customer: ${ticket.customerEmail}`
        });

        res.json({
          success: true,
          data: {
            emailId: result.emailId,
            logId: result.logId,
            message: 'Email sent successfully'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: { code: 'EMAIL_SEND_FAILED', message: result.error }
        });
      }
    }).catch(error => {
      console.error('Error in manual email send:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to send email' }
      });
    });

  } catch (error) {
    console.error('Error in manual email endpoint:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Endpoint to process email replies (for webhook integration)
app.post('/api/email/process-reply', (req, res) => {
  try {
    const { subject, body, from, messageId } = req.body;

    if (!subject || !body || !from) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Subject, body, and from fields are required' }
      });
    }

    // Process the incoming email
    processIncomingEmail(body, subject, from, messageId)
      .then(result => {
        res.json({
          success: true,
          data: result
        });
      })
      .catch(error => {
        console.error('Error processing email reply:', error);
        res.status(500).json({
          success: false,
          error: { code: 'PROCESSING_ERROR', message: error.message }
        });
      });

  } catch (error) {
    console.error('Error in email processing endpoint:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// ==========================================
// DEVICE MANAGEMENT API ROUTES
// ==========================================

// In-memory device storage (for demo - replace with real database)
// devices array is now initialized earlier in the file

// Initialize ticket-device relationships (moved to earlier in file)

// Initialize ticket-device relationships
// ticketDevices array moved to top of file with other declarations

// Helper function to get device with customer and ticket info
const getDeviceWithRelations = (device) => {
  const customer = users.find(u => u.id === device.customerId);
  const company = companies.find(c => c.id === device.companyId);
  const linkedTickets = ticketDevices
    .filter(td => td.deviceId === device.id)
    .map(td => {
      const ticket = tickets.find(t => t.id === td.ticketId);
      return ticket ? {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        createdAt: ticket.createdAt
      } : null;
    })
    .filter(t => t !== null);

  return {
    ...device,
    customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Anonymous User',
    customerEmail: customer ? customer.email : 'anonymous@example.com',
    companyName: company ? company.name : (customer?.company || 'No Company'),
    ticketCount: linkedTickets.length,
    linkedTickets
  };
};

// (Function moved earlier in the file)

// GET /api/devices - Get all devices with filtering and pagination
app.get('/api/devices', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('devices.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Device view permission required' }
      });
    }

    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      model = '', 
      status = '',
      customerId = '',
      companyId = ''
    } = req.query;

    let filteredDevices = devices.map(device => getDeviceWithRelations(device));

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      filteredDevices = filteredDevices.filter(device =>
        device.serialNumber.toLowerCase().includes(searchLower) ||
        device.model.toLowerCase().includes(searchLower) ||
        device.customerName.toLowerCase().includes(searchLower) ||
        device.customerEmail.toLowerCase().includes(searchLower) ||
        (device.comments && device.comments.toLowerCase().includes(searchLower))
      );
    }

    if (model) {
      filteredDevices = filteredDevices.filter(device => device.model === model);
    }

    if (customerId) {
      filteredDevices = filteredDevices.filter(device => device.customerId === customerId);
    }

    if (companyId) {
      filteredDevices = filteredDevices.filter(device => device.companyId === companyId);
    }

    if (status) {
      const now = new Date();
      filteredDevices = filteredDevices.filter(device => {
        if (!device.warrantyExpires) return status === 'no-warranty';
        const warrantyDate = new Date(device.warrantyExpires);
        
        switch (status) {
          case 'active':
            return warrantyDate > now;
          case 'expired':
            return warrantyDate <= now;
          case 'expiring-soon':
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            return warrantyDate > now && warrantyDate <= thirtyDaysFromNow;
          default:
            return true;
        }
      });
    }

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedDevices = filteredDevices.slice(startIndex, endIndex);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'devices_viewed',
      targetType: 'device_list',
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Viewed devices list (page ${page}, ${filteredDevices.length} results)`
    });

    res.json({
      success: true,
      data: {
        devices: paginatedDevices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredDevices.length,
          totalPages: Math.ceil(filteredDevices.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// GET /api/devices/:id - Get specific device with full details
app.get('/api/devices/:id', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('devices.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Device view permission required' }
      });
    }

    const { id } = req.params;
    const device = devices.find(d => d.id === id);

    if (!device) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Device not found' }
      });
    }

    const deviceWithRelations = getDeviceWithRelations(device);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'device_viewed',
      targetType: 'device',
      targetId: id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Viewed device details: ${device.serialNumber}`
    });

    res.json({
      success: true,
      data: { device: deviceWithRelations }
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// POST /api/devices - Create new device manually
app.post('/api/devices', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('devices.create')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Device creation permission required' }
      });
    }

    const {
      customerId,
      model,
      serialNumber,
      warrantyExpires,
      invoiceNumber,
      invoiceDate,
      comments
    } = req.body;

    // Validation
    if (!customerId || !model || !serialNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID, model, and serial number are required' }
      });
    }

    // Check if serial number already exists
    if (devices.find(d => d.serialNumber === serialNumber)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Device with this serial number already exists' }
      });
    }

    // Verify customer exists
    const customer = users.find(u => u.id === customerId && u.userType === 'customer');
    if (!customer) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Customer not found' }
      });
    }

    // Verify model is valid
    if (!deviceModels.find(dm => dm.name === model)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid device model' }
      });
    }

    const newDevice = {
      id: uuidv4(),
      customerId,
      companyId: customer.companyId || null, // Inherit company from customer
      model,
      serialNumber,
      warrantyExpires: warrantyExpires || null,
      invoiceNumber: invoiceNumber || null,
      invoiceDate: invoiceDate || null,
      comments: comments || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    devices.push(newDevice);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'device_created',
      targetType: 'device',
      targetId: newDevice.id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Created device: ${newDevice.serialNumber} (${newDevice.model})`
    });

    const deviceWithRelations = getDeviceWithRelations(newDevice);

    res.status(201).json({
      success: true,
      data: { device: deviceWithRelations }
    });
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// PUT /api/devices/:id - Update device
app.put('/api/devices/:id', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('devices.edit')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Device edit permission required' }
      });
    }

    const { id } = req.params;
    const deviceIndex = devices.findIndex(d => d.id === id);

    if (deviceIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Device not found' }
      });
    }

    const {
      warrantyExpires,
      invoiceNumber,
      invoiceDate,
      comments
    } = req.body;

    const oldDevice = { ...devices[deviceIndex] };
    
    // Update device
    devices[deviceIndex] = {
      ...devices[deviceIndex],
      warrantyExpires: warrantyExpires !== undefined ? warrantyExpires : devices[deviceIndex].warrantyExpires,
      invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : devices[deviceIndex].invoiceNumber,
      invoiceDate: invoiceDate !== undefined ? invoiceDate : devices[deviceIndex].invoiceDate,
      comments: comments !== undefined ? comments : devices[deviceIndex].comments,
      updatedAt: new Date().toISOString()
    };

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'device_updated',
      targetType: 'device',
      targetId: id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Updated device: ${devices[deviceIndex].serialNumber}`
    });

    const deviceWithRelations = getDeviceWithRelations(devices[deviceIndex]);

    res.json({
      success: true,
      data: { device: deviceWithRelations }
    });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// DELETE /api/devices/:id - Delete device
app.delete('/api/devices/:id', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('devices.delete')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Device delete permission required' }
      });
    }

    const { id } = req.params;
    const deviceIndex = devices.findIndex(d => d.id === id);

    if (deviceIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Device not found' }
      });
    }

    const device = devices[deviceIndex];
    
    // Remove device
    devices.splice(deviceIndex, 1);
    
    // Remove ticket-device relationships
    ticketDevices = ticketDevices.filter(td => td.deviceId !== id);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'device_deleted',
      targetType: 'device',
      targetId: id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Deleted device: ${device.serialNumber}`
    });

    res.json({
      success: true,
      data: { message: 'Device deleted successfully' }
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// GET /api/devices/stats - Get device statistics
app.get('/api/devices/stats', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('devices.view')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Device view permission required' }
      });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const stats = {
      totalDevices: devices.length,
      activeWarranties: devices.filter(d => d.warrantyExpires && new Date(d.warrantyExpires) > now).length,
      expiredWarranties: devices.filter(d => d.warrantyExpires && new Date(d.warrantyExpires) <= now).length,
      expiringSoon: devices.filter(d => 
        d.warrantyExpires && 
        new Date(d.warrantyExpires) > now && 
        new Date(d.warrantyExpires) <= thirtyDaysFromNow
      ).length,
      noWarrantyInfo: devices.filter(d => !d.warrantyExpires).length,
      modelBreakdown: deviceModels.map(model => ({
        model: model.name,
        count: devices.filter(d => d.model === model.name).length
      }))
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching device stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// ==========================================
// AI AGENT SYSTEM ENDPOINTS
// ==========================================

// Get AI agent configuration (Admin only)
app.get('/api/ai-agent/config', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('system.ai_settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'AI settings permission required' }
      });
    }

    res.json({
      success: true,
      data: { config: aiAgentConfig }
    });
  } catch (error) {
    console.error('Error fetching AI agent config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Update AI agent configuration (Admin only)
app.put('/api/ai-agent/config', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('system.ai_settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'AI settings permission required' }
      });
    }

    const {
      model,
      agent_name,
      response_tone,
      attitude_style,
      context_limitations,
      exceptions_behavior,
      confidence_threshold,
      enabled
    } = req.body;

    // Update configuration
    aiAgentConfig = {
      ...aiAgentConfig,
      model: model || aiAgentConfig.model,
      agent_name: agent_name || aiAgentConfig.agent_name,
      response_tone: response_tone || aiAgentConfig.response_tone,
      attitude_style: attitude_style || aiAgentConfig.attitude_style,
      context_limitations: context_limitations || aiAgentConfig.context_limitations,
      exceptions_behavior: exceptions_behavior || aiAgentConfig.exceptions_behavior,
      confidence_threshold: confidence_threshold !== undefined ? confidence_threshold : aiAgentConfig.confidence_threshold,
      enabled: enabled !== undefined ? enabled : aiAgentConfig.enabled,
      updatedAt: new Date().toISOString()
    };

    // Update NeuroAI agent status based on AI configuration
    if (neuroAIAgentId) {
      const neuroAIIndex = users.findIndex(u => u.id === neuroAIAgentId);
      if (neuroAIIndex !== -1) {
        users[neuroAIIndex] = {
          ...users[neuroAIIndex],
          firstName: aiAgentConfig.agent_name,
          agentStatus: aiAgentConfig.enabled ? 'online' : 'offline',
          isActive: aiAgentConfig.enabled,
          updatedAt: new Date().toISOString()
        };

        // Update agent session status
        if (aiAgentConfig.enabled) {
          agentSessions.set(neuroAIAgentId, {
            socketId: 'ai-virtual-session',
            isOnline: true,
            lastSeen: new Date().toISOString(),
            joinedAt: agentSessions.get(neuroAIAgentId)?.joinedAt || new Date().toISOString()
          });
        } else {
          agentSessions.delete(neuroAIAgentId);
        }
      }
    }

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'ai_config_updated',
      targetType: 'ai_config',
      targetId: aiAgentConfig.id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: 'Updated AI agent configuration'
    });

    res.json({
      success: true,
      data: { config: aiAgentConfig }
    });
  } catch (error) {
    console.error('Error updating AI agent config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Get AI agent statistics (Admin only)
app.get('/api/ai-agent/stats', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('system.ai_settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'AI settings permission required' }
      });
    }

    // Calculate statistics from in-memory data
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalResponses = aiResponses.length;
    const responsesLast24h = aiResponses.filter(r => new Date(r.createdAt) >= last24h).length;
    const responsesLast7Days = aiResponses.filter(r => new Date(r.createdAt) >= last7Days).length;

    const totalConfidence = aiResponses.reduce((sum, r) => sum + r.confidenceScore, 0);
    const averageConfidence = totalResponses > 0 ? totalConfidence / totalResponses : 0;

    const totalResponseTime = aiResponses.reduce((sum, r) => sum + r.responseTimeMs, 0);
    const averageResponseTime = totalResponses > 0 ? totalResponseTime / totalResponses : 0;

    // Count escalations (responses with low confidence)
    const escalations = aiResponses.filter(r => r.confidenceScore < (aiAgentConfig.confidence_threshold || 0.7)).length;
    const escalationRate = totalResponses > 0 ? (escalations / totalResponses) * 100 : 0;

    const documentsCount = aiDocuments.filter(d => d.isActive).length;
    const chunksCount = aiDocumentChunks.length;

    // Count tickets with AI disabled
    const ticketsWithAiDisabled = tickets.filter(t => t.aiEnabled === false).length;

    const stats = {
      totalResponses,
      responsesLast24h,
      responsesLast7Days,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      escalationRate: Math.round(escalationRate * 100) / 100,
      documentsCount,
      chunksCount,
      ticketsWithAiDisabled
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching AI agent stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Upload AI knowledge base document (Admin only)
app.post('/api/ai-agent/documents', authenticateToken, (req, res) => {
  uploadMultiple.array('documents')(req, res, async (err) => {
    if (err) {
      console.error('❌ Multer error in AI document upload:', err.message);
      return res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: err.message }
      });
    }
    
    await handleAiDocumentUpload(req, res);
  });
});

// Handle AI document upload
async function handleAiDocumentUpload(req, res) {
  try {
    console.log('📄 AI Document Upload Request Started');
    console.log('User:', req.user.email, 'Role:', req.user.roleName);
    
    if (!req.user.permissions.includes('system.ai_settings')) {
      console.log('❌ Access denied: User does not have AI settings permission');
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'AI settings permission required' }
      });
    }

    if (!req.files || req.files.length === 0) {
      console.log('❌ No files uploaded');
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No files uploaded' }
      });
    }

    console.log(`📁 Processing ${req.files.length} files...`);
    const uploadedDocuments = [];
    const failedDocuments = [];

    for (const file of req.files) {
      console.log(`🔍 Processing file: ${file.originalname}`);
      try {
        const fileType = path.extname(file.originalname).substring(1).toLowerCase();
        console.log(`   - File type: ${fileType}`);
        console.log(`   - File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        console.log(`   - File path: ${file.path}`);

        // Check if documentService exists and has the required methods
        if (!documentService || typeof documentService.validateDocument !== 'function') {
          throw new Error('DocumentService not available or missing validateDocument method');
        }

        // Validate document
        console.log('   - Validating document...');
        const validation = documentService.validateDocument(file.path, fileType, file.size);
        if (!validation.isValid) {
          console.log('   - ❌ Validation failed:', validation.errors);
          await documentService.cleanup(file.path);
          failedDocuments.push({
            fileName: file.originalname,
            errors: validation.errors
          });
          continue;
        }
        console.log('   - ✅ Validation passed');

        // Process document
        console.log('   - Processing document content...');
        const processedDoc = await documentService.processDocument(
          file.path,
          file.originalname,
          fileType,
          file.size
        );
        console.log(`   - ✅ Document processed: ${processedDoc.chunkCount} chunks`);

        // Create document record
        const document = {
          id: uuidv4(),
          fileName: processedDoc.fileName,
          fileType: processedDoc.fileType,
          filePath: file.path,
          fileSize: processedDoc.fileSize,
          parsedText: processedDoc.fullText,
          chunkCount: processedDoc.chunkCount,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        aiDocuments.push(document);
        console.log(`   - ✅ Added document with ID: ${document.id}`);

        // Create document chunks
        console.log('   - Creating document chunks...');
        processedDoc.chunks.forEach((chunk, index) => {
          aiDocumentChunks.push({
            id: chunk.id,
            documentId: document.id,
            chunkText: chunk.text,
            chunkIndex: chunk.index,
            embedding: chunk.embedding,
            createdAt: new Date().toISOString()
          });
        });
        console.log(`   - ✅ Created ${processedDoc.chunks.length} chunks`);

        uploadedDocuments.push({
          id: document.id,
          fileName: document.fileName,
          fileType: document.fileType,
          fileSize: document.fileSize,
          chunkCount: document.chunkCount,
          createdAt: document.createdAt
        });

      } catch (fileError) {
        console.error(`   - ❌ Error processing file ${file.originalname}:`, fileError.message);
        
        // Cleanup file on error
        if (documentService && typeof documentService.cleanup === 'function') {
          await documentService.cleanup(file.path);
        }
        
        failedDocuments.push({
          fileName: file.originalname,
          errors: [fileError.message]
        });
      }
    }

    // Save documents to persistent storage immediately after upload
    console.log('💾 Saving documents to persistent storage...');
    try {
      saveAIDocuments();
      console.log('✅ Documents saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving documents:', saveError.message);
    }

    // Log audit trail
    if (uploadedDocuments.length > 0) {
      logAudit({
        userId: req.user.id,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        userType: req.user.userType,
        action: 'ai_document_uploaded',
        targetType: 'ai_document',
        targetId: uploadedDocuments.map(doc => doc.id).join(', '),
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        details: `Uploaded AI knowledge documents: ${uploadedDocuments.map(doc => doc.fileName).join(', ')}`
      });
    }

    console.log('📊 Upload Summary:');
    console.log(`   - Successful uploads: ${uploadedDocuments.length}`);
    console.log(`   - Failed uploads: ${failedDocuments.length}`);

    res.status(201).json({
      success: true,
      data: {
        uploadedDocuments,
        failedDocuments
      }
    });

  } catch (error) {
    console.error('❌ Critical error in AI document upload:', error);
    console.error('Error stack:', error.stack);
    
    // Cleanup files on error
    if (req.files) {
      console.log('🧹 Cleaning up uploaded files due to error...');
      for (const file of req.files) {
        try {
          if (documentService && typeof documentService.cleanup === 'function') {
            await documentService.cleanup(file.path);
          } else if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupError) {
          console.warn(`Warning: Could not cleanup file ${file.path}:`, cleanupError.message);
        }
      }
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Document upload failed: ' + error.message }
    });
  }
}

// Get AI knowledge base documents (Admin only)
app.get('/api/ai-agent/documents', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('system.ai_settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'AI settings permission required' }
      });
    }

    const documents = aiDocuments.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      chunkCount: doc.chunkCount,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      preview: documentService.getDocumentPreview(doc.parsedText)
    }));

    res.json({
      success: true,
      data: { documents }
    });
  } catch (error) {
    console.error('Error fetching AI documents:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Delete AI knowledge base document (Admin only)
app.delete('/api/ai-agent/documents/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.permissions.includes('system.ai_settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'AI settings permission required' }
      });
    }

    const { id } = req.params;
    const docIndex = aiDocuments.findIndex(doc => doc.id === id);

    if (docIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Document not found' }
      });
    }

    const document = aiDocuments[docIndex];

    // Remove document and its chunks
    aiDocuments.splice(docIndex, 1);
    aiDocumentChunks = aiDocumentChunks.filter(chunk => chunk.documentId !== id);

    // Save to persistent storage after deletion
    saveAIDocuments();

    // Cleanup file
    await documentService.cleanup(document.filePath);

    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: 'ai_document_deleted',
      targetType: 'ai_document',
      targetId: id,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `Deleted AI knowledge document: ${document.fileName}`
    });

    res.json({
      success: true,
      data: { message: 'Document deleted successfully' }
    });

  } catch (error) {
    console.error('Error deleting AI document:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Toggle AI for specific ticket (Agents only)
app.post('/api/tickets/:ticketId/toggle-ai', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('tickets.edit')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Ticket edit permission required' }
      });
    }

    const { ticketId } = req.params;
    const { enabled, reason } = req.body;

    const ticketIndex = tickets.findIndex(t => t.id === ticketId);
    if (ticketIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Ticket not found' }
      });
    }

    const ticket = tickets[ticketIndex];
    const wasEnabled = ticket.aiEnabled !== false;

    // Update ticket AI status
    tickets[ticketIndex] = {
      ...ticket,
      aiEnabled: enabled,
      aiDisabledReason: enabled ? null : (reason || 'manual'),
      aiDisabledAt: enabled ? null : new Date().toISOString(),
      aiDisabledBy: enabled ? null : req.user.id,
      updatedAt: new Date().toISOString()
    };

    // Log the change
    logAudit({
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userType: req.user.userType,
      action: enabled ? 'ai_enabled' : 'ai_disabled',
      ticketNumber: ticket.ticketNumber,
      targetType: 'ticket',
      targetId: ticketId,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: `AI ${enabled ? 'enabled' : 'disabled'} for ticket${reason ? ` (${reason})` : ''}`
    });

    // Broadcast status change to ticket room
    io.to(`ticket_${ticketId}`).emit('ai_status_changed', {
      ticketId,
      enabled,
      reason,
      changedBy: `${req.user.firstName} ${req.user.lastName}`
    });

    res.json({
      success: true,
      data: { 
        aiEnabled: enabled,
        message: `AI ${enabled ? 'enabled' : 'disabled'} for this ticket`
      }
    });

  } catch (error) {
    console.error('Error toggling AI for ticket:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// Get AI response statistics (Admin only)
app.get('/api/ai-agent/stats', authenticateToken, (req, res) => {
  try {
    if (!req.user.permissions.includes('system.ai_settings')) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'AI settings permission required' }
      });
    }

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      totalResponses: aiResponses.length,
      responsesLast24h: aiResponses.filter(r => new Date(r.createdAt) > last24Hours).length,
      responsesLast7Days: aiResponses.filter(r => new Date(r.createdAt) > last7Days).length,
      averageConfidence: aiResponses.length > 0 ? 
        aiResponses.reduce((sum, r) => sum + r.confidenceScore, 0) / aiResponses.length : 0,
      averageResponseTime: aiResponses.length > 0 ? 
        aiResponses.reduce((sum, r) => sum + r.responseTimeMs, 0) / aiResponses.length : 0,
      escalationRate: aiResponses.length > 0 ? 
        aiResponses.filter(r => r.confidenceScore < aiAgentConfig.confidence_threshold).length / aiResponses.length : 0,
      documentsCount: aiDocuments.length,
      chunksCount: aiDocumentChunks.length,
      ticketsWithAiDisabled: tickets.filter(t => t.aiEnabled === false).length
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Error fetching AI stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
});

// ==========================================
// EMAIL RECEIVER SERVICE INITIALIZATION
// ==========================================

let emailReceiver = null;

// Initialize email receiver service
function initializeEmailService() {
  console.log('🚀 Initializing email system...');
  
  // Set up the email receiver with current tickets and messages
  setTickets(tickets);
  setMessages(messages);
  
  // Start the email receiver service
  try {
    emailReceiver = startEmailReceiver();
    if (emailReceiver) {
      console.log('✅ Email receiver service started successfully');
    } else {
      console.log('⚠️ Email receiver service could not start (missing configuration)');
    }
  } catch (error) {
    console.error('❌ Failed to start email receiver service:', error);
  }
}

// Initialize AI service
async function initializeAIService() {
  console.log('🤖 Initializing AI system...');
  
  try {
    // Load AI documents from persistent storage
    loadAIDocuments();
    
    const isInitialized = await aiService.initialize();
    if (isInitialized) {
      console.log('✅ AI service initialized successfully');
    } else {
      console.log('⚠️ AI service initialization skipped (no API key)');
    }
    
    // Create NeuroAI agent after AI service is initialized
    const neuroAIId = createNeuroAIAgent();
    console.log('✅ NeuroAI agent initialized with ID:', neuroAIId);
    
  } catch (error) {
    console.error('❌ Failed to initialize AI service:', error);
  }
}

// Initialize services on startup
initializeEmailService();
initializeAIService();

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  if (emailReceiver) {
    console.log('🛑 Stopping email receiver service...');
    stopEmailReceiver(emailReceiver);
  }
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down server...');
  
  if (emailReceiver) {
    console.log('🛑 Stopping email receiver service...');
    stopEmailReceiver(emailReceiver);
  }
  
  process.exit(0);
});