import React, { useState, useMemo, useEffect } from 'react';
import { Ticket } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import soundService from '../../services/soundService';
import ConfigurableTicketTable from './ConfigurableTicketTable';
import EnhancedUrgencyIndicator from './EnhancedUrgencyIndicator';

interface TicketListProps {
  tickets: Ticket[];
  loading: boolean;
  onTicketSelect: (ticket: Ticket) => void;
  onRefresh: () => void;
  onCreateTicket?: () => void;
  currentView?: string;
  lastUpdated?: Date | null;
  autoUpdating?: boolean;
  onCustomerMessage?: (ticketId: string) => void;
  onAgentReply?: (ticketId: string) => void;
}

const TicketList: React.FC<TicketListProps> = ({
  tickets,
  loading,
  onTicketSelect,
  onRefresh,
  onCreateTicket,
  currentView = 'tickets',
  lastUpdated,
  autoUpdating = false,
  onCustomerMessage,
  onAgentReply
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [blinkingRows, setBlinkingRows] = useState<Map<string, { urgency: string; startTime: number }>>(new Map());
  const [messageBlinkingRows, setMessageBlinkingRows] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<any[]>([]);
  const [agentPresence, setAgentPresence] = useState<Map<string, boolean>>(new Map());
  const [reassignTicketId, setReassignTicketId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);

  // Update current time every 10 seconds to refresh relative times and "last updated" display
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      
      // Clean up expired blinking rows (after 10 seconds)
      setBlinkingRows(prev => {
        const updated = new Map(prev);
        Array.from(updated.entries()).forEach(([ticketId, data]) => {
          if (now - data.startTime > 10000) { // 10 seconds
            updated.delete(ticketId);
          }
        });
        return updated.size !== prev.size ? updated : prev;
      });
    }, 1000); // Update every second for more responsive blinking cleanup

    return () => clearInterval(interval);
  }, []);

  // Load agents for reassign functionality
  useEffect(() => {
    const loadAgents = async () => {
      if (user?.role === 'agent' && user?.permissions?.includes('tickets.edit')) {
        try {
          const fetchedAgents = await apiService.getAgents();
          setAgents(fetchedAgents);
        } catch (error) {
          console.error('Error loading agents:', error);
        }
      }
    };

    loadAgents();
    
    // Listen for agent status changes
    const handleAgentStatusChange = (data: { agentId: string; isOnline: boolean; lastSeen: string }) => {
      console.log('👨‍💼 TicketList: Agent status changed:', data);
      setAgentPresence(prev => {
        const updated = new Map(prev);
        updated.set(data.agentId, data.isOnline);
        return updated;
      });
      
      // Also update the agents list with real-time status
      setAgents(prev => prev.map(agent => 
        agent.id === data.agentId 
          ? { ...agent, isOnline: data.isOnline, lastSeen: data.lastSeen }
          : agent
      ));
    };

    // Import socket service dynamically to avoid circular dependencies
    import('../../services/socket').then(({ socketService }) => {
      socketService.on('agent_status_changed', handleAgentStatusChange);
    });

    return () => {
      import('../../services/socket').then(({ socketService }) => {
        socketService.off('agent_status_changed', handleAgentStatusChange);
      });
    };
  }, [user]);

  // Handle urgency changes to trigger row blinking
  const handleUrgencyChange = (ticketId: string, urgency: string) => {
    setBlinkingRows(prev => {
      const updated = new Map(prev);
      updated.set(ticketId, { urgency, startTime: Date.now() });
      return updated;
    });
  };

  // Handle customer message to trigger blue blinking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCustomerMessage = (ticketId: string) => {
    setMessageBlinkingRows(prev => {
      const updated = new Set(prev);
      updated.add(ticketId);
      return updated;
    });
    onCustomerMessage?.(ticketId);
  };

  // Handle agent reply to stop blue blinking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAgentReply = (ticketId: string) => {
    setMessageBlinkingRows(prev => {
      const updated = new Set(prev);
      updated.delete(ticketId);
      return updated;
    });
    onAgentReply?.(ticketId);
  };

  const filteredTickets = useMemo(() => {
    let filtered = tickets.filter(ticket => {
      const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (ticket.customerName && ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (ticket.customerCompany && ticket.customerCompany.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (ticket.customer?.name && ticket.customer.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });

    // Apply view-based filtering
    if (currentView === 'my-tickets' && user?.id) {
      filtered = filtered.filter(ticket => ticket.agentId === user.id);
    } else if (currentView === 'my-open-tickets' && user?.id) {
      filtered = filtered.filter(ticket => 
        ticket.agentId === user.id && ticket.status !== 'resolved'
      );
    } else if (currentView === 'all-open-tickets') {
      filtered = filtered.filter(ticket => ticket.status !== 'resolved');
    } else if (currentView === 'unassigned') {
      filtered = filtered.filter(ticket => !ticket.agentId);
    } else if (currentView === 'resolved') {
      filtered = filtered.filter(ticket => ticket.status === 'resolved');
    }

    return filtered;
  }, [tickets, searchTerm, statusFilter, priorityFilter, currentView, user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const now = currentTime; // Use state to trigger re-renders
    const messageTime = new Date(dateString).getTime();
    const diffMs = now - messageTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return new Date(messageTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getLastCustomerMessage = (ticket: Ticket) => {
    console.log(`🔍 Getting last customer message for ticket ${ticket.id}:`, {
      hasMessages: !!ticket.messages,
      messageCount: ticket.messages?.length || 0,
      messages: ticket.messages?.map(m => ({ id: m.id, sender: m.sender, createdAt: m.createdAt }))
    });
    
    if (!ticket.messages || ticket.messages.length === 0) return null;
    
    // Find the most recent message from a customer
    const customerMessages = ticket.messages
      .filter(msg => msg.sender?.userType === 'customer')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`📨 Customer messages found:`, customerMessages.length);
    return customerMessages.length > 0 ? customerMessages[0] : null;
  };

  const getLastAgentMessage = (ticket: Ticket) => {
    console.log(`🔍 Getting last agent message for ticket ${ticket.id}:`, {
      hasMessages: !!ticket.messages,
      messageCount: ticket.messages?.length || 0
    });
    
    if (!ticket.messages || ticket.messages.length === 0) return null;
    
    // Find the most recent message from an agent or AI
    const agentMessages = ticket.messages
      .filter(msg => msg.sender?.userType === 'agent' || msg.sender?.userType === 'ai')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`👨‍💼 Agent/AI messages found:`, agentMessages.length);
    return agentMessages.length > 0 ? agentMessages[0] : null;
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'new':
        return 'New - Not Assigned';
      case 'in_progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      default:
        return status.replace('_', ' ');
    }
  };

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'my-tickets':
        return 'My Tickets';
      case 'my-open-tickets':
        return 'My Open Tickets';
      case 'all-open-tickets':
        return 'All Open Tickets';
      case 'unassigned':
        return 'Unassigned Tickets';
      case 'resolved':
        return 'Resolved Tickets';
      default:
        return 'Support Tickets';
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!window.confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingTicketId(ticketId);
      console.log('Attempting to delete ticket:', ticketId);
      await apiService.deleteTicket(ticketId);
      console.log('Ticket deleted successfully');
      onRefresh(); // Refresh the ticket list
    } catch (error) {
      console.error('Error deleting ticket:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to delete ticket: ${errorMessage}`);
    } finally {
      setDeletingTicketId(null);
    }
  };

  const handleReassignTicket = async (ticketId: string, newAgentId: string) => {
    try {
      setReassigning(true);
      await apiService.reassignTicket(ticketId, newAgentId);
      setReassignTicketId(null);
      onRefresh(); // Refresh the ticket list
    } catch (error) {
      console.error('Error reassigning ticket:', error);
      alert('Failed to reassign ticket. Please try again.');
    } finally {
      setReassigning(false);
    }
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    
    const now = currentTime;
    const diffMs = now - lastUpdated.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    
    if (diffSeconds < 60) {
      return `Updated ${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
      return `Updated ${diffMinutes}m ago`;
    } else {
      return `Updated at ${lastUpdated.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    }
  };

  // Get row style for blinking effect
  const getRowStyle = (ticketId: string) => {
    const blinkData = blinkingRows.get(ticketId);
    const hasMessageBlink = messageBlinkingRows.has(ticketId);
    
    // Priority: message blinking (blue) takes precedence over urgency blinking
    if (hasMessageBlink) {
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.2)', // blue with transparency
        animation: 'blink 0.5s ease-in-out infinite alternate',
        transition: 'background-color 0.3s ease'
      };
    }
    
    if (!blinkData) return {};

    const { urgency } = blinkData;
    let backgroundColor = '';
    
    switch (urgency) {
      case 'red':
        backgroundColor = 'rgba(239, 68, 68, 0.2)'; // red with transparency
        break;
      case 'yellow':
        backgroundColor = 'rgba(245, 158, 11, 0.2)'; // yellow with transparency
        break;
      case 'green':
        backgroundColor = 'rgba(34, 197, 94, 0.2)'; // green with transparency
        break;
      default:
        backgroundColor = 'rgba(156, 163, 175, 0.2)'; // gray with transparency
    }

    return {
      backgroundColor,
      animation: 'blink 0.5s ease-in-out infinite alternate',
      transition: 'background-color 0.3s ease'
    };
  };

  // Enhanced warning info function compatible with the new urgency system
  const getWarningInfo = (ticket: Ticket) => {
    const now = currentTime;
    const createdTime = new Date(ticket.createdAt).getTime();
    const elapsedMinutes = Math.floor((now - createdTime) / (1000 * 60));
    const isAssigned = !!ticket.agentId;
    const isResolved = ticket.status === 'resolved';
    const isInProgress = ticket.status === 'in_progress';
    
    // Check if AI is handling
    const isAIHandling = ticket.agentId === 'neuro-ai-agent' || 
      (ticket.messages && ticket.messages.some(msg => msg.sender?.userType === 'ai'));
    
    // Check if customer requested human
    const customerMessages = ticket.messages?.filter(msg => msg.sender?.userType === 'customer') || [];
    const customerRequestedHuman = customerMessages.some(msg => {
      const content = msg.content.toLowerCase();
      return content.includes('human') || content.includes('person') || 
             content.includes('agent') || content.includes('representative') ||
             content.includes('speak to someone') || content.includes('talk to someone');
    });

    if (isResolved) {
      return {
        level: 'success',
        message: '✅ Ticket resolved successfully',
        color: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700'
      };
    }

    // Assignment-based warnings
    if (!isAssigned || isAIHandling) {
      if (isAIHandling && !customerRequestedHuman) {
        return {
          level: 'info',
          message: '🤖 AI interaction ongoing',
          color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700'
        };
      }

      if (isAIHandling && customerRequestedHuman) {
        if (elapsedMinutes <= 3) {
          return {
            level: 'warning',
            message: '🟡 Human Agent requested, claim ticket now',
            color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700'
          };
        } else {
          return {
            level: 'critical',
            message: '🚨 Urgent! Human agent must take this ticket NOW',
            color: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'
          };
        }
      }

      if (!isAIHandling && !isAssigned) {
        if (elapsedMinutes <= 1) {
          return {
            level: 'info',
            message: '🆕 Customer waiting for an agent',
            color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700'
          };
        } else if (elapsedMinutes <= 3) {  
          return {
            level: 'warning',
            message: '⚠️ Customer waiting >1 min, claim ticket ASAP',
            color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700'
          };
        } else {
          return {
            level: 'critical',
            message: '🔥 Customer waiting too long, claim ticket NOW!',
            color: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'
          };
        }
      }
    }

    // Status-based warnings (assigned to human agent)
    if (isAssigned && !isAIHandling) {
      if (isInProgress) {
        if (elapsedMinutes <= 5) {
          return {
            level: 'success',
            message: '✋ Support in progress (<5 min)',
            color: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700'
          };
        } else if (elapsedMinutes <= 10) {
          return {
            level: 'warning',
            message: '⏰ Support taking longer than expected (>5 min)',
            color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700'
          };
        } else {
          return {
            level: 'critical',
            message: '🔥 Support taking too long — escalate now!',
            color: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'
          };
        }
      } else {
        if (elapsedMinutes <= 5) {
          return {
            level: 'success',
            message: '✋ Assigned to agent - Customer being helped',
            color: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700'
          };
        } else {
          return {
            level: 'warning',
            message: '⏳ Assigned but not started - Agent should begin work',
            color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700'
          };
        }
      }
    }

    return {
      level: 'info',
      message: '📋 Normal priority',
      color: 'bg-gray-50 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
    };
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-t-lg mb-2"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      {/* Add custom CSS for pulse and blink animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes blink {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>

      {/* Header */}
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate">
            {getHeaderTitle()}
          </h2>
          <div className="flex items-center space-x-4 mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredTickets.length} of {tickets.length} tickets
            </p>
            {lastUpdated && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center">
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatLastUpdated()}
              </p>
            )}
            {autoUpdating && (
              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center">
                <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Auto-updating...
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
          {/* Create Ticket button for agents with permission */}
          {user?.role === 'agent' && user?.permissions?.includes('tickets.create') && onCreateTicket && (
            <button
              onClick={onCreateTicket}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Ticket
            </button>
          )}
          <button
            onClick={onRefresh}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search tickets
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, description, customer name, or company..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      {filteredTickets.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tickets found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No tickets have been created yet.'}
          </p>
        </div>
      ) : (
        <ConfigurableTicketTable
          tickets={filteredTickets}
          onTicketSelect={onTicketSelect}
          onDeleteTicket={handleDeleteTicket}
          onReassignTicket={handleReassignTicket}
          urgencyIndicator={EnhancedUrgencyIndicator}
          getWarningInfo={getWarningInfo}
          getStatusColor={getStatusColor}
          getPriorityColor={getPriorityColor}
          formatDate={formatDate}
          formatRelativeTime={formatRelativeTime}
          getLastCustomerMessage={getLastCustomerMessage}
          getLastAgentMessage={getLastAgentMessage}
          formatStatus={formatStatus}
          getRowStyle={getRowStyle}
          handleUrgencyChange={handleUrgencyChange}
          agents={agents}
          reassignTicketId={reassignTicketId}
          setReassignTicketId={setReassignTicketId}
          reassigning={reassigning}
          deletingTicketId={deletingTicketId}
          exportFilters={{
            searchTerm,
            statusFilter,
            priorityFilter,
            currentView
          }}
        />
      )}
    </div>
  );
};

export default TicketList; 