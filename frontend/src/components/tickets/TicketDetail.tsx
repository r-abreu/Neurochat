import React, { useState, useEffect, useRef } from 'react';
import { Ticket, Message, InternalComment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import socketService from '../../services/socket';
import soundService from '../../services/soundService';
import CountrySelect from '../common/CountrySelect';

interface TicketDetailProps {
  ticket: Ticket;
  onBack: () => void;
  onTicketUpdate: () => void;
}

const TicketDetail: React.FC<TicketDetailProps> = ({ ticket: initialTicket, onBack, onTicketUpdate }) => {
  console.log('🔧 Debug - TicketDetail rendered with initialTicket:', initialTicket);
  
  const { user } = useAuth();
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState<Message[]>([]);
  const [internalComments, setInternalComments] = useState<InternalComment[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [showReassignDropdown, setShowReassignDropdown] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [activeTab, setActiveTab] = useState<'messages' | 'comments' | 'files'>('messages');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: initialTicket?.title || '',
    description: initialTicket?.description || '',
    priority: initialTicket?.priority || 'medium',
    status: initialTicket?.status || 'new',
    customerName: initialTicket?.customerName || '',
    customerEmail: initialTicket?.customerEmail || '',
    customerPhone: initialTicket?.customerPhone || '',
    customerCompany: initialTicket?.customerCompany || '',
    customerAddress: initialTicket?.customerAddress || '', // Keep for backward compatibility
    customerStreetAddress: initialTicket?.customerStreetAddress || '',
    customerState: initialTicket?.customerState || '',
    customerZipCode: initialTicket?.customerZipCode || '',
    customerCountry: initialTicket?.customerCountry || '',
  });
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [customerStatus, setCustomerStatus] = useState<{
    isOnline: boolean;
    lastSeen: string | null;
    hasEverConnected: boolean;
  }>({
    isOnline: false,
    lastSeen: null,
    hasEverConnected: false
  });
  const [agentPresence, setAgentPresence] = useState<Map<string, boolean>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  // Update local ticket state when prop changes
  useEffect(() => {
    console.log('🔧 Debug - useEffect triggered with initialTicket:', initialTicket);
    setTicket(initialTicket);
    if (initialTicket) {
      setEditForm({
        title: initialTicket.title,
        description: initialTicket.description,
        priority: initialTicket.priority,
        status: initialTicket.status,
        customerName: initialTicket.customerName || '',
        customerEmail: initialTicket.customerEmail || '',
        customerPhone: initialTicket.customerPhone || '',
        customerCompany: initialTicket.customerCompany || '',
        customerAddress: initialTicket.customerAddress || '',
        customerStreetAddress: initialTicket.customerStreetAddress || '',
        customerState: initialTicket.customerState || '',
        customerZipCode: initialTicket.customerZipCode || '',
        customerCountry: initialTicket.customerCountry || '',
      });
    }
  }, [initialTicket]);

  useEffect(() => {
    // Don't run effects if ticket is not loaded
    if (!ticket) return;
    
    loadMessages();
    loadAgents();
    loadCategories();
    if (user?.role === 'agent' || user?.userType === 'agent') {
      loadInternalComments();
      loadCustomerStatus();
      loadFiles();
    }
    
    // Join the ticket room for real-time updates
    socketService.joinTicket(ticket.id);
    
    // Listen for new messages
    const handleNewMessage = (data: { message: Message }) => {
      console.log('📨 Agent received new message via Socket.IO:', data.message);
      
      // Play sound notification for customer messages
      if (data.message.sender?.userType === 'customer') {
        console.log('🔊 Playing sound for customer message');
        soundService.playTicketUpdateSound();
      }
      
      setMessages(prev => {
        // Avoid duplicates
        if (prev.find(m => m.id === data.message.id)) {
          return prev;
        }
        return [...prev, data.message];
      });

      // If this is a file message, refresh the files list
      if (data.message.messageType === 'file' || data.message.messageType === 'image') {
        console.log('📁 File message received, refreshing files list');
        loadFiles();
      }
    };

    // Listen for typing indicators
    const handleTyping = (data: { ticketId: string; isTyping: boolean }) => {
      if (ticket?.id && data.ticketId === ticket.id) {
        console.log('⌨️ Agent received typing indicator:', data);
        setIsTyping(data.isTyping);
      }
    };

    // Listen for ticket updates
    const handleTicketUpdate = (updatedTicket: any) => {
      console.log('🎫 Ticket updated:', updatedTicket);
      onTicketUpdate();
    };

    // Listen for customer status changes
    const handleCustomerStatusChange = (data: { ticketId: string; isOnline: boolean; lastSeen: string }) => {
      if (ticket?.id && data.ticketId === ticket.id) {
        console.log('👤 Customer status changed:', data);
        setCustomerStatus(prev => ({
          ...prev,
          isOnline: data.isOnline,
          lastSeen: data.lastSeen,
          hasEverConnected: true
        }));
      }
    };

    // Listen for agent status changes
    const handleAgentStatusChange = (data: { agentId: string; isOnline: boolean; lastSeen: string }) => {
      console.log('🔧 TicketDetail: Agent status changed:', data);
      console.log('🔧 TicketDetail: Current agents before update:', agents);
      
      setAgentPresence(prev => {
        const updated = new Map(prev);
        updated.set(data.agentId, data.isOnline);
        console.log('🔧 TicketDetail: Updated agent presence map:', Array.from(updated.entries()));
        return updated;
      });
      
      // Also update the agents list with real-time status
      setAgents(prev => {
        const updated = prev.map(agent => 
          agent.id === data.agentId 
            ? { ...agent, isOnline: data.isOnline, lastSeen: data.lastSeen }
            : agent
        );
        console.log('🔧 TicketDetail: Updated agents list:', updated);
        return updated;
      });
    };

    socketService.on('new_message', handleNewMessage);
    socketService.on('user_typing', handleTyping);
    socketService.on('ticket_updated', handleTicketUpdate);
    socketService.on('customer_status_changed', handleCustomerStatusChange);
    socketService.on('agent_status_changed', handleAgentStatusChange);

    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('user_typing', handleTyping);
      socketService.off('ticket_updated', handleTicketUpdate);
      socketService.off('customer_status_changed', handleCustomerStatusChange);
      socketService.off('agent_status_changed', handleAgentStatusChange);
      if (ticket?.id) {
        socketService.leaveTicket(ticket.id);
      }
    };
  }, [ticket?.id, user?.role]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!ticket?.id) return;
    
    try {
      setLoading(true);
      console.log('📥 Loading messages for ticket:', ticket.id);
      const fetchedMessages = await apiService.getMessages(ticket.id);
      console.log('📥 Received messages:', fetchedMessages);
      setMessages(fetchedMessages || []);
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      setMessages([]); // Ensure messages is always an array
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      console.log('🔍 Current user:', user);
      console.log('🔍 User role:', user?.role);
      console.log('🔍 User permissions:', user?.permissions);
      
      if (user?.role === 'agent' || user?.userType === 'agent') {
        console.log('🔍 Loading agents for reassign dropdown...');
        const fetchedAgents = await apiService.getAgents();
        console.log('🔍 Fetched agents:', fetchedAgents);
        console.log('🔍 Agent count:', fetchedAgents.length);
        setAgents(fetchedAgents);
      } else {
        console.log('🔍 User is not an agent, skipping agent loading');
      }
    } catch (error) {
      console.error('❌ Error loading agents:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    }
  };

  const loadCategories = async () => {
    try {
      const fetchedCategories = await apiService.getCategories();
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('❌ Error loading categories:', error);
    }
  };

  const loadInternalComments = async () => {
    if (!ticket?.id) return;
    
    try {
      const fetchedComments = await apiService.getInternalComments(ticket.id);
      setInternalComments(fetchedComments || []);
    } catch (error) {
      console.error('❌ Error loading internal comments:', error);
      setInternalComments([]);
    }
  };

  const loadCustomerStatus = async () => {
    if (!ticket?.id) return;
    
    try {
      const status = await apiService.getCustomerStatus(ticket.id);
      console.log('🔍 TicketDetail: Received customer status:', status);
      
      setCustomerStatus({
        isOnline: status.isOnline,
        lastSeen: status.lastSeen,
        hasEverConnected: status.customerId !== null || status.lastSeen !== null
      });
      
      console.log('🔍 TicketDetail: Updated customerStatus state:', {
        isOnline: status.isOnline,
        lastSeen: status.lastSeen,
        hasEverConnected: status.customerId !== null || status.lastSeen !== null
      });
    } catch (error) {
      console.error('❌ Error loading customer status:', error);
    }
  };

  const loadFiles = async () => {
    if (!ticket?.id) {
      console.log('📁 Cannot load files: ticket.id is missing', { ticket });
      return;
    }
    
    try {
      console.log('📁 Loading files for ticket:', ticket.id);
      console.log('📁 User context:', { user: user, role: user?.role, userType: user?.userType });
      const ticketFiles = await apiService.getTicketFiles(ticket.id);
      console.log('📁 Loaded files response:', ticketFiles);
      console.log('📁 Files count:', ticketFiles?.length || 0);
      setFiles(ticketFiles || []);
    } catch (error) {
      console.error('❌ Error loading files:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        ticketId: ticket?.id,
        userRole: user?.role,
        userType: user?.userType
      });
      setFiles([]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ticket?.id) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      setSendingMessage(true);
      console.log('📤 Agent sending message to ticket:', ticket.id);
      const sentMessage = await apiService.sendMessage(ticket.id, messageContent);
      console.log('📤 Agent message sent successfully:', sentMessage);
      
      // Add message to local state (if not already added by Socket.IO)
      setMessages(prev => {
        if (prev.find(m => m.id === sentMessage.id)) {
          return prev;
        }
        return [...prev, sentMessage];
      });
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setNewMessage(messageContent); // Restore message on error
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !ticket?.id) return;

    const commentContent = newComment.trim();
    setNewComment('');

    try {
      setAddingComment(true);
      console.log('💬 Agent adding internal comment to ticket:', ticket.id);
      console.log('💬 Comment content:', commentContent);
      console.log('💬 Current user:', user);
      
      const addedComment = await apiService.addInternalComment(ticket.id, commentContent);
      console.log('💬 Internal comment added successfully:', addedComment);
      
      // Add comment to local state
      setInternalComments(prev => [...prev, addedComment]);
    } catch (error) {
      console.error('❌ Error adding internal comment:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        ticketId: ticket?.id,
        commentContent,
        user
      });
      setNewComment(commentContent); // Restore comment on error
      
      // Show more specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to add comment: ${errorMessage}`);
    } finally {
      setAddingComment(false);
    }
  };

  const handleClaimTicket = async () => {
    if (!ticket?.id) return;
    
    try {
      await apiService.claimTicket(ticket.id);
      // Add a small delay to ensure backend processes the update
      setTimeout(() => {
        onTicketUpdate();
      }, 100);
    } catch (error) {
      console.error('Error claiming ticket:', error);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!ticket?.id) return;
    
    try {
      await apiService.updateTicket(ticket.id, { status: newStatus as any });
      // Add a small delay to ensure backend processes the update
      setTimeout(() => {
        onTicketUpdate();
      }, 100);
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const handleReassignTicket = async (newAgentId: string) => {
    if (!ticket?.id) return;
    
    try {
      setReassigning(true);
      await apiService.reassignTicket(ticket.id, newAgentId);
      setShowReassignDropdown(false);
      // Add a small delay to ensure backend processes the update
      setTimeout(() => {
        onTicketUpdate();
      }, 100);
    } catch (error) {
      console.error('Error reassigning ticket:', error);
      alert('Failed to reassign ticket. Please try again.');
    } finally {
      setReassigning(false);
    }
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'customerAddress') {
      console.log('🔧 Address field changed:');
      console.log('  - name:', name);
      console.log('  - value:', value);
      console.log('  - value type:', typeof value);
      console.log('  - value length:', value.length);
    }
    
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (name === 'customerAddress') {
      console.log('🔧 EditForm updated, new state will have customerAddress:', value);
    }

    // Real-time email validation
    if (name === 'customerEmail') {
      if (value && !validateEmail(value)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError('');
      }
    }
  };

  const handleSaveEdit = async () => {
    setError('');
    setEmailError('');

    // Validate email if provided
    if (editForm.customerEmail && !validateEmail(editForm.customerEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    console.log('🔧 Debug - handleSaveEdit called');
    console.log('🔧 Debug - ticket:', ticket);
    console.log('🔧 Debug - initialTicket:', initialTicket);
    console.log('🔧 Debug - editForm:', editForm);
    console.log('🔧 Debug - editForm.customerAddress:', editForm.customerAddress);
    console.log('🔧 Debug - customerAddress type:', typeof editForm.customerAddress);
    console.log('🔧 Debug - customerAddress length:', editForm.customerAddress?.length);
    
    // Use initialTicket as fallback if local ticket state is undefined
    const ticketToUpdate = ticket || initialTicket;
    
    if (!ticketToUpdate?.id) {
      console.error('Cannot save edit: ticket ID is missing');
      console.error('ticket:', ticket);
      console.error('initialTicket:', initialTicket);
      alert('Error: Ticket ID is missing. Please refresh the page and try again.');
      return;
    }
    
    try {
      setSaving(true);
      console.log('🔧 Updating ticket with ID:', ticketToUpdate.id);
      console.log('🔧 Update data:', editForm);
      console.log('🔧 About to send customerAddress:', editForm.customerAddress);
      
      const updatedTicket = await apiService.updateTicket(ticketToUpdate.id, editForm);
      console.log('🔧 Update successful, received ticket:', updatedTicket);
      console.log('🔧 Received customerAddress:', updatedTicket.customerAddress);
      
      // Update the local ticket state immediately with the response from the server
      setTicket(updatedTicket);
      
      // Update the edit form to match the updated ticket (in case server modified any values)
      setEditForm({
        title: updatedTicket.title,
        description: updatedTicket.description,
        priority: updatedTicket.priority,
        status: updatedTicket.status,
        customerName: updatedTicket.customerName || '',
        customerEmail: updatedTicket.customerEmail || '',
        customerPhone: updatedTicket.customerPhone || '',
        customerCompany: updatedTicket.customerCompany || '',
        customerAddress: updatedTicket.customerAddress || '',
        customerStreetAddress: updatedTicket.customerStreetAddress || '',
        customerState: updatedTicket.customerState || '',
        customerZipCode: updatedTicket.customerZipCode || '',
        customerCountry: updatedTicket.customerCountry || '',
      });
      
      console.log('🔧 Updated editForm with new customerAddress:', updatedTicket.customerAddress);
      
      // Exit edit mode
      setIsEditing(false);
      
      // Notify parent component to refresh the ticket list
      console.log('🔧 Calling onTicketUpdate to refresh parent');
      onTicketUpdate();
      
      // Show success message
      console.log('🔧 Ticket update completed successfully');
      
    } catch (error) {
      console.error('❌ Error updating ticket:', error);
      alert(`Failed to update ticket: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Use current ticket or initialTicket as fallback
    const currentTicket = ticket || initialTicket;
    
    if (!currentTicket) {
      console.error('Cannot cancel edit: no ticket data available');
      setIsEditing(false);
      return;
    }
    
    // Reset form to current ticket values
    setEditForm({
      title: currentTicket.title,
      description: currentTicket.description,
      priority: currentTicket.priority,
      status: currentTicket.status,
      customerName: currentTicket.customerName || '',
      customerEmail: currentTicket.customerEmail || '',
      customerPhone: currentTicket.customerPhone || '',
      customerCompany: currentTicket.customerCompany || '',
      customerAddress: currentTicket.customerAddress || '',
      customerStreetAddress: currentTicket.customerStreetAddress || '',
      customerState: currentTicket.customerState || '',
      customerZipCode: currentTicket.customerZipCode || '',
      customerCountry: currentTicket.customerCountry || '',
    });
    setIsEditing(false);
  };

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
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
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

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Don't render if ticket is not loaded yet
  if (!ticket) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to tickets
          </button>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Loading ticket details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to tickets
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket Details */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Ticket Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">#{ticket.ticketNumber}</p>
              </div>
              <div className="flex items-center space-x-2">
                {user?.role === 'agent' && user?.permissions?.includes('tickets.edit') && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 border border-blue-300 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                  >
                    Edit
                  </button>
                )}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                  {formatStatus(ticket.status)}
                </span>
              </div>
            </div>

            {isEditing && user?.permissions?.includes('tickets.edit') ? (
              /* Edit Form */
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-500 dark:text-gray-400">Title</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={editForm.title}
                    onChange={handleEditFormChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    value={editForm.description}
                    onChange={handleEditFormChange}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-500 dark:text-gray-400">Priority</label>
                    <select
                      id="priority"
                      name="priority"
                      value={editForm.priority}
                      onChange={handleEditFormChange}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                    <select
                      id="status"
                      name="status"
                      value={editForm.status}
                      onChange={handleEditFormChange}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Created (Read Only)</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(ticket.createdAt)}</p>
                </div>

                {/* Customer Information Edit */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Customer Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="customerName" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Name</label>
                      <input
                        type="text"
                        id="customerName"
                        name="customerName"
                        value={editForm.customerName}
                        onChange={handleEditFormChange}
                        className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="customerEmail" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Email</label>
                      <input
                        type="email"
                        id="customerEmail"
                        name="customerEmail"
                        value={editForm.customerEmail}
                        onChange={handleEditFormChange}
                        className={`mt-1 w-full px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          emailError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {emailError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{emailError}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="customerPhone" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Phone</label>
                      <input
                        type="tel"
                        id="customerPhone"
                        name="customerPhone"
                        value={editForm.customerPhone}
                        onChange={handleEditFormChange}
                        className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="customerCompany" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Company</label>
                      <input
                        type="text"
                        id="customerCompany"
                        name="customerCompany"
                        value={editForm.customerCompany}
                        onChange={handleEditFormChange}
                        className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="customerStreetAddress" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Street Address</label>
                      <input
                        type="text"
                        id="customerStreetAddress"
                        name="customerStreetAddress"
                        value={editForm.customerStreetAddress}
                        onChange={handleEditFormChange}
                        className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="customerState" className="block text-xs font-medium text-gray-400 dark:text-gray-500">State/Province</label>
                        <input
                          type="text"
                          id="customerState"
                          name="customerState"
                          value={editForm.customerState}
                          onChange={handleEditFormChange}
                          className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="CA"
                        />
                      </div>
                      <div>
                        <label htmlFor="customerZipCode" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Zip/Postal Code</label>
                        <input
                          type="text"
                          id="customerZipCode"
                          name="customerZipCode"
                          value={editForm.customerZipCode}
                          onChange={handleEditFormChange}
                          className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="90210"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="customerCountry" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Country</label>
                      <div className="mt-1">
                        <CountrySelect
                          id="customerCountry"
                          name="customerCountry"
                          value={editForm.customerCountry}
                          onChange={(value) => handleEditFormChange({ target: { name: 'customerCountry', value } } as any)}
                          placeholder="Select a country..."
                          className="text-sm px-3 py-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save/Cancel Buttons */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-3">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Display Mode */
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Title</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{ticket.title}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{ticket.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Priority</h3>
                    <p className={`mt-1 text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</h3>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{ticket.category}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(ticket.createdAt)}</p>
                </div>

                {/* Customer Information */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Customer Information</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500">Name</h4>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customer?.name || ticket.customerName || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500">Email</h4>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customer?.email || ticket.customerEmail || 'Not provided'}
                      </p>
                    </div>
                    {/* Temporarily show all fields for debugging */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500">Phone</h4>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customerPhone || 'No phone provided'}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500">Company</h4>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customerCompany || 'No company provided'}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500">Country</h4>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customerCountry || 'No country provided'}
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500">Address</h4>
                      <div className="mt-1 text-sm text-gray-900 dark:text-gray-100 space-y-1">
                        {ticket.customerStreetAddress && (
                          <p>{ticket.customerStreetAddress}</p>
                        )}
                        {(ticket.customerState || ticket.customerZipCode) && (
                          <p>
                            {ticket.customerState && ticket.customerZipCode 
                              ? `${ticket.customerState}, ${ticket.customerZipCode}`
                              : ticket.customerState || ticket.customerZipCode
                            }
                          </p>
                        )}
                        {!ticket.customerStreetAddress && !ticket.customerState && !ticket.customerZipCode && ticket.customerAddress && (
                          <p className="whitespace-pre-wrap">{ticket.customerAddress}</p>
                        )}
                        {!ticket.customerStreetAddress && !ticket.customerState && !ticket.customerZipCode && !ticket.customerAddress && (
                          <p className="text-gray-500 dark:text-gray-400">No address provided</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Assigned Agent - Always show this section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Assigned Agent</h3>
                {user?.role === 'agent' && user?.permissions?.includes('tickets.edit') && ticket.status !== 'resolved' && (
                  <button
                    onClick={() => setShowReassignDropdown(!showReassignDropdown)}
                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    disabled={reassigning}
                  >
                    {reassigning ? 'Reassigning...' : ticket.agentId ? 'Reassign' : 'Assign'}
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {ticket.agentId ? (ticket.agent?.name || 'Unknown Agent') : 'Unassigned'}
              </p>
              
              {showReassignDropdown && user?.role === 'agent' && ticket.status !== 'resolved' && (
                <div className="mt-2 relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value !== ticket.agentId) {
                        if (e.target.value === 'unassign') {
                          handleReassignTicket('');
                        } else if (e.target.value) {
                          handleReassignTicket(e.target.value);
                        }
                      }
                    }}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={reassigning}
                    defaultValue=""
                  >
                    <option value="">Select agent...</option>
                    {ticket.agentId && (
                      <option value="unassign">⊘ Unassign Ticket</option>
                    )}
                    {(() => {
                      console.log('🔍 Dropdown rendering - all agents:', agents);
                      console.log('🔍 Current ticket agentId:', ticket.agentId);
                      console.log('🔍 All agents for dropdown (including current):', agents);
                      console.log('🔍 Agent presence map:', Array.from(agentPresence.entries()));
                      return agents.map(agent => {
                        const isOnline = agent.isOnline || agentPresence.get(agent.id) || false;
                        const statusIndicator = isOnline ? '🟢' : '🔴';
                        return (
                          <option key={agent.id} value={agent.id}>
                            {statusIndicator} {agent.roleName || 'Unknown Role'} - {agent.name || `${agent.firstName} ${agent.lastName}`}
                            {agent.id === ticket.agentId ? ' (Current)' : ''}
                            {agent.id === user?.id ? ' (You)' : ''}
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            {user?.role === 'agent' && (
              <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
                {!ticket.agentId && user?.permissions?.includes('tickets.edit') && (
                  <button
                    onClick={handleClaimTicket}
                    className="w-full bg-primary-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    Claim Ticket
                  </button>
                )}

                {ticket.agentId === user.id && user?.permissions?.includes('tickets.edit') && ticket.status !== 'resolved' && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleStatusUpdate('in_progress')}
                      disabled={ticket.status === 'in_progress'}
                      className="w-full bg-yellow-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50"
                    >
                      Mark In Progress
                    </button>
                    <button
                      onClick={() => handleStatusUpdate('resolved')}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}

                {ticket.agentId === user.id && user?.permissions?.includes('tickets.edit') && ticket.status === 'resolved' && (
                  <button
                    onClick={() => handleStatusUpdate('in_progress')}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Reopen Ticket
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg flex flex-col" style={{ height: '600px' }}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {activeTab === 'messages' ? 'Conversation' : 'Internal Comments'}
                  </h2>
                  {/* Customer Status Indicator - Only show for agents and in messages tab */}
                  {user?.role === 'agent' && activeTab === 'messages' && (
                    <div className="flex items-center space-x-2">
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                        customerStatus.isOnline 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : customerStatus.hasEverConnected
                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          customerStatus.isOnline 
                            ? 'bg-green-500'
                            : customerStatus.hasEverConnected
                              ? 'bg-gray-500'
                              : 'bg-yellow-500'
                        }`}></div>
                        <span>
                          {customerStatus.isOnline 
                            ? 'Customer Online'
                            : customerStatus.hasEverConnected
                              ? `Offline (${customerStatus.lastSeen ? new Date(customerStatus.lastSeen).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown'})`
                              : 'Never Connected'
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>
{(user?.role === 'agent' || user?.userType === 'agent') && (
                  <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setActiveTab('messages')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'messages'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      Messages
                    </button>
                    <button
                      onClick={() => setActiveTab('comments')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'comments'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      Comments ({internalComments.length})
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('files');
                        // Force reload files when clicking the tab
                        console.log('📁 Files tab clicked, forcing reload...');
                        loadFiles();
                      }}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'files'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      Files ({files.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {activeTab === 'messages' ? (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {loading ? (
                    <div className="flex justify-center items-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : !messages || messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    <>
                      {(messages || []).map((message) => {
                        // Check message sender using both old and new API structure
                        const sender = (message as any).sender || message.user;
                        
                        // Check if this is a system message
                        const isSystemMessage = sender?.userType === 'system' || message.messageType === 'system';
                        
                        // Determine if this is the current user's message
                        let isOwnMessage = false;
                        if (sender?.id === user?.id) {
                          isOwnMessage = true;
                        } else if (message.userId === user?.id) {
                          isOwnMessage = true;
                        } else if (sender && user) {
                          // Additional check: compare by user type and ID
                          isOwnMessage = sender.userType === user.role && sender.id === user.id;
                        }
                        
                        const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() || sender.name : null;
                        
                        // Debug logging
                        console.log('🔍 Agent Message debug:', {
                          messageId: message.id,
                          content: message.content.substring(0, 20) + '...',
                          sender: sender,
                          userId: user?.id,
                          isOwnMessage: isOwnMessage,
                          isSystemMessage: isSystemMessage,
                          senderName: senderName
                        });
                        
                        // Handle system messages differently
                        if (isSystemMessage) {
                          return (
                            <div key={message.id} className="flex justify-center my-2">
                              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-2 max-w-md">
                                <div className="flex items-center space-x-2">
                                  <svg className="h-4 w-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <p className="text-sm text-yellow-800 dark:text-yellow-200">{message.content}</p>
                                </div>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 text-center">
                                  {formatMessageTime(message.createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              isOwnMessage
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              <p className="text-sm">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                isOwnMessage ? 'text-primary-100' : 'text-gray-500'
                              }`}>
                                {senderName || (isOwnMessage ? 'You' : (sender?.userType === 'customer' || sender?.role === 'customer' ? 'Customer' : 'Support'))} • {formatMessageTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                {user?.permissions?.includes('tickets.message') ? (
                  <div className="p-4 border-t border-gray-200">
                    <form onSubmit={handleSendMessage} className="flex space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        disabled={sendingMessage}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !newMessage.trim()}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sendingMessage ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          'Send'
                        )}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="p-4 border-t border-gray-200 bg-gray-50 dark:bg-gray-800">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <p className="text-sm">You don't have permission to send messages</p>
                    </div>
                  </div>
                )}
              </>
            ) : activeTab === 'comments' ? (
              <>
                {/* Internal Comments */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {internalComments.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012 2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1.586l-4.414 4.414z" />
                      </svg>
                      <p>No internal comments yet. Add one to start tracking progress!</p>
                    </div>
                  ) : (
                    internalComments.map((comment) => (
                      <div key={comment.id} className="flex justify-start">
                        <div className="max-w-full px-4 py-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{comment.content}</p>
                          <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{comment.agentName}</span> • {formatDate(comment.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <form onSubmit={handleAddComment} className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add an internal comment (not visible to customer)..."
                      disabled={addingComment}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Internal comments are only visible to agents
                      </p>
                      <button
                        type="submit"
                        disabled={addingComment || !newComment.trim()}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {addingComment ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          'Add Comment'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <>
                {/* Files */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {files.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <p>No files uploaded yet.</p>
                      <button
                        onClick={() => {
                          console.log('🔄 Manual refresh files button clicked');
                          loadFiles();
                        }}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        🔄 Refresh Files
                      </button>
                      <div className="mt-2 text-xs text-gray-400">
                        Ticket ID: {ticket?.id}<br/>
                        Files count: {files.length}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {files.map((file) => {
                        const getFileIcon = (messageType: string, fileName: string) => {
                          if (messageType === 'image') {
                            return (
                              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            );
                          }
                          
                          const extension = fileName.split('.').pop()?.toLowerCase();
                          switch (extension) {
                            case 'pdf':
                              return (
                                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              );
                            case 'doc':
                            case 'docx':
                              return (
                                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              );
                            case 'xls':
                            case 'xlsx':
                            case 'csv':
                              return (
                                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              );
                            case 'zip':
                            case 'rar':
                            case '7z':
                              return (
                                <svg className="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              );
                            default:
                              return (
                                <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              );
                          }
                        };

                        const formatFileSize = (bytes: number) => {
                          if (bytes === 0) return '0 Bytes';
                          const k = 1024;
                          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                          const i = Math.floor(Math.log(bytes) / Math.log(k));
                          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                        };

                        return (
                          <div key={file.id} className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex-shrink-0 mr-4">
                              {getFileIcon(file.messageType, file.fileName)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {file.fileName}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(file.fileSize)} • Uploaded by{' '}
                                    <span className="font-medium">
                                      {file.sender.firstName} {file.sender.lastName}
                                    </span>{' '}
                                    ({file.sender.userType}) • {formatDate(file.uploadedAt)}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {file.messageType === 'image' && (
                                    <button
                                      onClick={() => window.open(`http://localhost:3001${file.fileUrl}`, '_blank')}
                                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                                    >
                                      Preview
                                    </button>
                                  )}
                                  <a
                                    href={`http://localhost:3001/api/files/${file.filePath.split('/').pop()}`}
                                    download={file.fileName}
                                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                                  >
                                    Download
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetail; 