export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: 'customer' | 'agent';
  userType?: 'customer' | 'agent'; // Keep for backward compatibility
  avatar?: string;
  avatarUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string;
  // Agent-specific fields
  agentStatus?: 'online' | 'busy' | 'offline';
  isOnline?: boolean; // Real-time online status via socket
  lastSeen?: string; // Real-time last seen timestamp
  maxConcurrentTickets?: number;
  // Role-based access
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  mustChangePassword?: boolean;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: 'new' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  category: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCompany?: string;
  customerAddress?: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  customer?: User;
  agent?: User;
  messages?: Message[];
}

export interface Message {
  id: string;
  ticketId: string;
  senderId?: string;
  userId?: string; // Keep for backward compatibility
  content: string;
  messageType: 'text' | 'system' | 'file' | 'image';
  createdAt: string;
  user?: User;
  sender?: {
    id: string | null;
    firstName: string;
    lastName: string;
    userType: 'customer' | 'agent' | 'system';
  };
  // File attachment properties
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  fileUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface TicketFilter {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
}

export interface NotificationToast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number;
}

export interface InternalComment {
  id: string;
  ticketId: string;
  agentId: string;
  agentName: string;
  content: string;
  createdAt: string;
}

// New interfaces for role management
export interface Role {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface AgentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name?: string; // Combined name for display
  roleName: 'Admin' | 'Tier2' | 'Tier1' | 'Viewer';
  roleId: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  agentStatus: 'online' | 'busy' | 'offline';
  isOnline?: boolean; // Real-time online status via socket
  lastSeen?: string; // Real-time last seen timestamp
  maxConcurrentTickets: number;
  permissions: string[];
  mustChangePassword?: boolean;
}

export interface CreateAgentRequest {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  password: string;
  isActive: boolean;
  maxConcurrentTickets: number;
}

export interface UpdateAgentRequest {
  firstName?: string;
  lastName?: string;
  roleId?: string;
  isActive?: boolean;
  maxConcurrentTickets?: number;
  agentStatus?: 'online' | 'busy' | 'offline';
} 