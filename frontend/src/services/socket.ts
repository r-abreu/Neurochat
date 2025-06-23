import { io, Socket } from 'socket.io-client';
import { Message, Ticket } from '../types';

export interface SocketEvents {
  // Incoming events
  'new_message': (data: { message: Message }) => void;
  'ticket_updated': (ticket: Ticket) => void;
  'ticket_deleted': (data: { ticketId: string; deletedBy: string; deletedAt: string }) => void;
  'ticket_claimed': (data: { ticketId: string; agent: any; claimedAt: string; handoffFromAI?: boolean }) => void;
  'ai_to_human_handoff': (data: { ticketId: string; previousAgent: string; newAgent: any; handoffAt: string }) => void;
  'agent_joined': (data: { ticketId: string; agentName: string }) => void;
  'agent_left': (data: { ticketId: string; agentName: string }) => void;
  'user_typing': (data: { ticketId: string; isTyping: boolean }) => void;
  'new_ticket': (data: { ticket: any }) => void;
  'ticket_joined': (data: { ticketId: string; success: boolean }) => void;
  'customer_status_changed': (data: { ticketId: string; isOnline: boolean; lastSeen: string }) => void;
  'agent_status_changed': (data: { agentId: string; isOnline: boolean; lastSeen: string }) => void;
  'ai_status_changed': (data: { ticketId: string; enabled: boolean; reason?: string; changedBy: string }) => void;
  'company_match_suggestion': (data: { pendingMatchId: string; ticketId: string; ticketNumber: string; customerName: string; inputCompanyName: string; suggestedCompany: string; confidence: number; message: string }) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentTicketId: string | null = null;
  private baseURL = 'http://localhost:3001';

  constructor() {
    // Socket.IO is now available via the installed package
  }

  connect(token?: string): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    console.log('🔌 Connecting to Socket.IO server...');

    return new Promise((resolve, reject) => {
      this.socket = io(this.baseURL, {
        auth: {
          token: token || ''
        },
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', this.socket?.id);
        this.isConnected = true;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket.IO disconnected:', reason);
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error);
        reject(error);
      });

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (!this.isConnected) {
          console.warn('⚠️ Socket connection timeout after 5 seconds');
          reject(new Error('Socket connection timeout'));
        }
      }, 5000);
    });
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting from Socket.IO server...');
      
      // Leave current ticket room before disconnecting
      if (this.currentTicketId) {
        this.leaveTicket(this.currentTicketId);
      }
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentTicketId = null;
    }
  }

  // Force disconnect without leaving ticket room (for browser close scenarios)
  forceDisconnect(): void {
    if (this.socket) {
      console.log('🔌 Force disconnecting from Socket.IO server...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentTicketId = null;
    }
  }

  // Join a ticket room for real-time updates
  joinTicket(ticketId: string, isCustomer: boolean = false): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot join ticket room');
      return;
    }

    if (this.currentTicketId) {
      this.leaveTicket(this.currentTicketId);
    }

    console.log('📝 Joining ticket room:', ticketId, isCustomer ? '(as customer)' : '(as agent)');
    this.socket.emit('join_ticket', { ticketId, isCustomer });
    this.currentTicketId = ticketId;
  }

  // Leave current ticket room
  leaveTicket(ticketId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    console.log('🚪 Leaving ticket room:', ticketId);
    this.socket.emit('leave_ticket', { ticketId });
    if (this.currentTicketId === ticketId) {
      this.currentTicketId = null;
    }
  }

  // Send a message
  sendMessage(ticketId: string, content: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot send message');
      return;
    }

    this.socket.emit('send_message', { ticketId, content });
  }

  // Typing indicators
  startTyping(ticketId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('typing_start', { ticketId });
  }

  stopTyping(ticketId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('typing_stop', { ticketId });
  }

  // Agent dashboard presence
  joinAgentDashboard(agentId: string, agentName: string): void {
    console.log('🔧 joinAgentDashboard called with:', { agentId, agentName });
    console.log('🔧 Socket status:', { 
      socketExists: !!this.socket, 
      isConnected: this.isConnected, 
      actuallyConnected: this.socket?.connected 
    });
    
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Socket not connected, cannot join agent dashboard');
      console.warn('⚠️ Socket details:', { 
        socketExists: !!this.socket, 
        isConnected: this.isConnected,
        actuallyConnected: this.socket?.connected
      });
      return;
    }

    console.log('👨‍💼 Emitting agent_dashboard_join event:', { agentId, agentName });
    this.socket.emit('agent_dashboard_join', { agentId, agentName });
    console.log('✅ agent_dashboard_join event emitted successfully');
  }

  leaveAgentDashboard(agentId: string, agentName: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    console.log('👨‍💼 Leaving agent dashboard:', { agentId, agentName });
    this.socket.emit('agent_dashboard_leave', { agentId, agentName });
  }

  // Event listeners
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void {
    if (!this.socket) {
      return;
    }

    this.socket.on(event as string, callback);
  }

  off<K extends keyof SocketEvents>(event: K, callback?: SocketEvents[K]): void {
    if (!this.socket) {
      return;
    }

    if (callback) {
      this.socket.off(event as string, callback);
    } else {
      this.socket.off(event as string);
    }
  }

  // Utility methods
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getCurrentTicketId(): string | null {
    return this.currentTicketId;
  }
}

export const socketService = new SocketService();
export default socketService; 