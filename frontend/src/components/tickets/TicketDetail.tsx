import React, { useState, useEffect, useRef } from 'react';
import { Ticket, Message, InternalComment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import socketService from '../../services/socket';
import soundService from '../../services/soundService';
import CountrySelect from '../common/CountrySelect';
import ServiceWorkflow from '../service/ServiceWorkflow';

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
    customerCity: initialTicket?.customerCity || '',
    customerState: initialTicket?.customerState || '',
    customerZipCode: initialTicket?.customerZipCode || '',
    customerCountry: initialTicket?.customerCountry || '',
    customerType: initialTicket?.customerType || 'Standard',
    deviceModel: initialTicket?.deviceModel || '',
    deviceSerialNumber: initialTicket?.deviceSerialNumber || '',
  });
  const [saving, setSaving] = useState(false);
  const [customerTypes, setCustomerTypes] = useState<any[]>([]);
  const [deviceModels, setDeviceModels] = useState<any[]>([]);
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
  // AI related state
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [aiToggling, setAiToggling] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<{
    enabled: boolean;
    reason: string | null;
    changedBy: string | null;
    disabledAt: string | null;
  }>({
    enabled: true,
    reason: null,
    changedBy: null,
    disabledAt: null
  });
  const [showServiceWorkflow, setShowServiceWorkflow] = useState(false);
  const [workflow, setWorkflow] = useState<any>(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  
  // Dropdown states for clickable badges
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAssignmentDropdown, setShowAssignmentDropdown] = useState(false);

  // Add typing state and timer for agent typing detection
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update local ticket state when prop changes
  useEffect(() => {
    console.log('🔧 Debug - useEffect triggered with initialTicket:', initialTicket);
    setTicket(initialTicket);
    if (initialTicket) {
      // Initialize AI status from ticket
      const ticketAiEnabled = initialTicket.aiEnabled !== false;
      setAiEnabled(ticketAiEnabled);
      setAiStatus({
        enabled: ticketAiEnabled,
        reason: initialTicket.aiDisabledReason || null,
        changedBy: initialTicket.aiDisabledBy || null,
        disabledAt: initialTicket.aiDisabledAt || null
      });
      
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
        customerCity: initialTicket.customerCity || '',
        customerState: initialTicket.customerState || '',
        customerZipCode: initialTicket.customerZipCode || '',
        customerCountry: initialTicket.customerCountry || '',
        customerType: initialTicket.customerType || 'Standard',
        deviceModel: initialTicket.deviceModel || '',
        deviceSerialNumber: initialTicket.deviceSerialNumber || '',
      });
    }
  }, [initialTicket]);

  useEffect(() => {
    // Don't run effects if ticket is not loaded
    if (!ticket) return;
    
    loadMessages();
    loadAgents();
    loadDropdownOptions();
    loadWorkflow();
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
      
      // Handle auto-claim notifications
      if (updatedTicket.autoClaimed) {
        console.log('🤖 Auto-claim detected:', updatedTicket);
        // You can add a toast notification here if needed
      }
      
      // If we have a locally generated summary, preserve it to prevent overwrite
      if (ticket?.resolutionSummary && updatedTicket?.resolutionSummary !== ticket.resolutionSummary) {
        console.log('📝 Preserving local summary during ticket update');
        return; // Don't refresh to preserve local summary
      }
      
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

    // Listen for AI status changes
    const handleAiStatusChange = (data: { ticketId: string; enabled: boolean; reason?: string; changedBy: string }) => {
      if (ticket?.id && data.ticketId === ticket.id) {
        console.log('🤖 AI status changed:', data);
        setAiEnabled(data.enabled);
        setAiStatus({
          enabled: data.enabled,
          reason: data.reason || null,
          changedBy: data.changedBy,
          disabledAt: data.enabled ? null : new Date().toISOString()
        });
      }
    };

    // Listen for AI summary generation events
    const handleSummaryGenerated = (data: { 
      ticketId: string; 
      summary: string; 
      generatedAt: string; 
      modelVersion: string; 
      confidence: number; 
    }) => {
      if (ticket?.id && data.ticketId === ticket.id) {
        console.log('📝 AI summary generated via socket:', data);
        setTicket(prev => {
          if (!prev) return prev;
          console.log('📝 Updating ticket with summary:', data.summary);
          return {
            ...prev,
            resolutionSummary: data.summary,
            resolutionSummaryGeneratedAt: data.generatedAt,
            resolutionSummaryModelVersion: data.modelVersion
          };
        });
        
        // Reset the generating state to ensure UI is properly updated
        setGeneratingSummary(false);
        
        // Don't call onTicketUpdate() here as it overwrites local state
        // The socket event already updated the local state, no need to refresh from parent
        console.log('📝 Summary updated via socket, skipping parent refresh to prevent overwrite');
      }
    };

    // Listen for AI ticket details updates
    const handleTicketDetailsUpdated = (data: {
      ticketId: string;
      title: string;
      description: string;
      confidence: number;
      generatedAt: string;
    }) => {
      if (ticket?.id && data.ticketId === ticket.id) {
        console.log('🤖 AI ticket details updated via socket:', data);
        setTicket(prev => {
          if (!prev) return prev;
          console.log('🤖 Updating ticket title and description:', {
            oldTitle: prev.title,
            newTitle: data.title,
            oldDescription: prev.description,
            newDescription: data.description
          });
          return {
            ...prev,
            title: data.title,
            description: data.description,
            aiGeneratedDetails: {
              confidence: data.confidence,
              generatedAt: data.generatedAt
            }
          };
        });

        // Update the edit form if it's open
        setEditForm((prev: any) => ({
          ...prev,
          title: data.title,
          description: data.description
        }));
        
        // Refresh parent component
        setTimeout(() => {
          console.log('🤖 Refreshing parent after AI details update');
          onTicketUpdate();
        }, 500);
      }
    };

    // Listen for workflow updates
    const handleWorkflowUpdate = (data: { ticketId: string; workflowId: string; workflow: any; updatedStep: any; updatedBy: any; updatedAt: string }) => {
      if (ticket?.id && data.ticketId === ticket.id) {
        console.log('🔄 Workflow update received:', data);
        setWorkflow(data.workflow);
      }
    };

    // Listen for ticket claimed events (including auto-claims)
    const handleTicketClaimed = (data: { ticketId: string; agent: any; claimedAt: string; handoffFromAI?: boolean; autoClaimed?: boolean }) => {
      if (ticket?.id && data.ticketId === ticket.id) {
        console.log('👤 Ticket claimed:', data);
        
        if (data.autoClaimed) {
          console.log('🤖 Auto-claim notification:', `${data.agent.firstName} ${data.agent.lastName} auto-claimed this ticket`);
          // You could show a toast notification here
        }
        
        // Refresh the ticket to show updated assignment
        setTimeout(() => {
          onTicketUpdate();
        }, 100);
      }
    };

    socketService.on('new_message', handleNewMessage);
    socketService.on('user_typing', handleTyping);
    socketService.on('ticket_updated', handleTicketUpdate);
    socketService.on('ticket_claimed', handleTicketClaimed);
    socketService.on('customer_status_changed', handleCustomerStatusChange);
    socketService.on('agent_status_changed', handleAgentStatusChange);
    socketService.on('ai_status_changed', handleAiStatusChange);
    socketService.on('ticket_summary_generated', handleSummaryGenerated);
    socketService.on('ticket_details_updated', handleTicketDetailsUpdated);
    socketService.on('workflow_updated', handleWorkflowUpdate);

    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('user_typing', handleTyping);
      socketService.off('ticket_updated', handleTicketUpdate);
      socketService.off('ticket_claimed', handleTicketClaimed);
      socketService.off('customer_status_changed', handleCustomerStatusChange);
      socketService.off('agent_status_changed', handleAgentStatusChange);
      socketService.off('ai_status_changed', handleAiStatusChange);
      socketService.off('ticket_summary_generated', handleSummaryGenerated);
      socketService.off('ticket_details_updated', handleTicketDetailsUpdated);
      socketService.off('workflow_updated', handleWorkflowUpdate);
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



  const loadDropdownOptions = async () => {
    try {
      const dropdownOptions = await apiService.getDropdownOptions();
      
      // Load customer types and device models from dropdown options
      const activeCustomerTypes = dropdownOptions.customerTypes.filter(type => type.isActive !== false);
      const activeDeviceModels = dropdownOptions.deviceModels.filter(model => model.isActive !== false);
      
      setCustomerTypes(activeCustomerTypes);
      setDeviceModels(activeDeviceModels);
    } catch (error) {
      console.error('Error loading dropdown options:', error);
      // Set default fallback options if API fails
      setCustomerTypes([
        { id: 'standard', name: 'Standard' },
        { id: 'vip', name: 'VIP' },
        { id: 'distributor', name: 'Distributor' }
      ]);
      setDeviceModels([
        { id: 'bwiii', name: 'BWIII' },
        { id: 'bwmini', name: 'BWMini' },
        { id: 'compass', name: 'Compass' },
        { id: 'maxxi', name: 'Maxxi' }
      ]);
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

  const loadWorkflow = async () => {
    if (!ticket?.id) return;
    
    try {
      setLoadingWorkflow(true);
      console.log('🔧 Loading workflow for ticket:', ticket.id);
      
      // First, get list of workflows for this ticket
      const workflowsResponse = await apiService.get(`/tickets/${ticket.id}/service-workflows`);
      console.log('🔧 Workflows response:', workflowsResponse);
      
      if (workflowsResponse && Array.isArray(workflowsResponse) && workflowsResponse.length > 0) {
        // Get the full workflow details for the first workflow
        const workflowId = workflowsResponse[0].workflowId;
        console.log('🔧 Loading workflow details for:', workflowId);
        
        const workflowDetails = await apiService.get(`/service-workflows/${workflowId}`);
        console.log('🔧 Workflow details:', workflowDetails);
        
        setWorkflow(workflowDetails);
      } else {
        setWorkflow(null);
      }
    } catch (error: any) {
      console.error('🔧 Error loading workflow:', error);
      // Don't show error for 404 - just means no workflow exists
      if (error.response?.status !== 404) {
        console.error('🔧 Unexpected error loading workflow:', error);
      }
      setWorkflow(null);
    } finally {
      setLoadingWorkflow(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle message input change with typing detection
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Only trigger typing for agents
    if (user?.role === 'agent' || user?.userType === 'agent') {
      // Start typing if not already typing
      if (!isAgentTyping && value.length > 0) {
        setIsAgentTyping(true);
        if (ticket?.id) {
          console.log('🔤 Agent started typing, emitting typing_start');
          socketService.startTyping(ticket.id);
        }
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (isAgentTyping) {
          setIsAgentTyping(false);
          if (ticket?.id) {
            console.log('🔤 Agent stopped typing, emitting typing_stop');
            socketService.stopTyping(ticket.id);
          }
        }
      }, 2000);
    }
  };

  // Stop typing when message is sent
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ticket?.id) return;

    // Clear typing state immediately when sending
    if (isAgentTyping) {
      setIsAgentTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socketService.stopTyping(ticket.id);
    }

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      setSendingMessage(true);
      console.log('📤 Sending message to ticket:', ticket.id);
      await apiService.sendMessage(ticket.id, messageContent);
      console.log('📤 Message sent successfully');
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSendingMessage(false);
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

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
      
      // Auto-generate summary when ticket is resolved (only if no summary exists)
      if (newStatus === 'resolved' && user?.permissions?.includes('tickets.edit') && !ticket?.resolutionSummary) {
        console.log('🎯 Ticket resolved, auto-generating summary...');
        setTimeout(() => {
          handleGenerateSummary();
        }, 2000); // Delay to ensure ticket is fully updated
      }
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

  const handleToggleAi = async (enabled: boolean, reason?: string) => {
    if (!ticket?.id) return;
    
    try {
      setAiToggling(true);
      console.log(`🤖 ${enabled ? 'Enabling' : 'Disabling'} AI for ticket ${ticket.ticketNumber}`);
      
      await apiService.toggleTicketAi(ticket.id, enabled, reason);
      
      // The socket event will update the state, but we can also update locally for immediate feedback
      setAiEnabled(enabled);
      console.log(`✅ AI ${enabled ? 'enabled' : 'disabled'} for ticket ${ticket.ticketNumber}`);
      
    } catch (error) {
      console.error('Error toggling AI:', error);
      alert(`Failed to ${enabled ? 'enable' : 'disable'} AI. Please try again.`);
      // Revert local state on error
      setAiEnabled(!enabled);
    } finally {
      setAiToggling(false);
    }
  };

  const handleGenerateSummary = async () => {
    console.log('🔴 [DEBUG] handleGenerateSummary called');
    console.log('🔴 [DEBUG] ticket:', ticket);
    console.log('🔴 [DEBUG] ticket.id:', ticket?.id);
    console.log('🔴 [DEBUG] user permissions:', user?.permissions);
    console.log('🔴 [DEBUG] generatingSummary state:', generatingSummary);
    
    if (!ticket?.id) {
      console.error('🔴 [DEBUG] No ticket ID available');
      alert('Error: No ticket ID available');
      return;
    }
    
    // Prevent multiple simultaneous generation attempts
    if (generatingSummary) {
      console.log('🔴 [DEBUG] Summary generation already in progress, skipping');
      return;
    }
    
    try {
      console.log('🔴 [DEBUG] Setting generatingSummary to true');
      setGeneratingSummary(true);
      console.log(`📝 Generating summary for ticket ${ticket.ticketNumber} (ID: ${ticket.id})`);
      
      console.log('🔴 [DEBUG] Calling apiService.generateTicketSummary...');
      const summaryData = await apiService.generateTicketSummary(ticket.id);
      console.log('✅ Summary generated successfully:', summaryData);
      
      // Update local ticket state with new summary
      setTicket(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          resolutionSummary: summaryData.summary,
          resolutionSummaryGeneratedAt: summaryData.generatedAt,
          resolutionSummaryModelVersion: summaryData.modelVersion,
          resolutionSummaryGeneratedBy: summaryData.generatedBy
        };
        console.log('🔴 [DEBUG] Updated ticket state:', updated);
        return updated;
      });
      
      // Don't call onTicketUpdate() immediately to avoid race condition
      // The Socket.IO event 'ticket_summary_generated' will handle real-time updates for all users
      console.log('🔴 [DEBUG] Summary updated locally, waiting for socket event confirmation');
      
      // The socket event will handle further updates, no need to refresh parent
      
    } catch (error: any) {
      console.error('❌ Error generating summary:', error);
      console.error('🔴 [DEBUG] Error type:', typeof error);
      console.error('🔴 [DEBUG] Error constructor:', error.constructor.name);
      console.error('🔴 [DEBUG] Error message:', error.message);
      console.error('🔴 [DEBUG] Error stack:', error.stack);
      
      // More detailed error handling
      let errorMessage = 'Failed to generate summary. ';
      
      // Check if it's a fetch error or API error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage += 'Network error. Please check if the backend server is running.';
      } else if (error.message.includes('Authentication failed')) {
        errorMessage += 'Authentication failed. Please login again.';
      } else if (error.message.includes('HTTP error')) {
        errorMessage += `Server error: ${error.message}`;
      } else {
        errorMessage += `${error.message || 'Please try again or contact support.'}`;
      }
      
      alert(errorMessage);
      console.error('📋 Full error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        error: error
      });
    } finally {
      console.log('🔴 [DEBUG] Setting generatingSummary to false');
      setGeneratingSummary(false);
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
      console.log('🔧 About to send customerType:', editForm.customerType);
      console.log('🔧 About to send deviceSerialNumber:', editForm.deviceSerialNumber);
      
              // Prepare update data with proper typing for deviceModel
        const updateData: Partial<Ticket> = {
          ...editForm,
          deviceModel: (editForm.deviceModel as 'BWIII' | 'BWMini' | 'Compass' | 'Maxxi') || undefined,
        };
        
        const updatedTicket = await apiService.updateTicket(ticketToUpdate.id, updateData);
      console.log('🔧 Update successful, received ticket:', updatedTicket);
      console.log('🔧 Received customerAddress:', updatedTicket.customerAddress);
      console.log('🔧 Received customerType:', updatedTicket.customerType);
      console.log('🔧 Received deviceSerialNumber:', updatedTicket.deviceSerialNumber);
      
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
          customerCity: updatedTicket.customerCity || '',
          customerState: updatedTicket.customerState || '',
          customerZipCode: updatedTicket.customerZipCode || '',
          customerCountry: updatedTicket.customerCountry || '',
          customerType: updatedTicket.customerType || 'Standard',
          deviceModel: updatedTicket.deviceModel || '',
          deviceSerialNumber: updatedTicket.deviceSerialNumber || '',
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
        customerCity: currentTicket.customerCity || '',
        customerState: currentTicket.customerState || '',
        customerZipCode: currentTicket.customerZipCode || '',
        customerCountry: currentTicket.customerCountry || '',
        customerType: currentTicket.customerType || 'Standard',
        deviceModel: currentTicket.deviceModel || '',
        deviceSerialNumber: currentTicket.deviceSerialNumber || '',
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

  const handleManageWorkflow = () => {
    setShowServiceWorkflow(true);
  };

  const handleCloseWorkflow = () => {
    setShowServiceWorkflow(false);
    // Reload workflow data in case it was created or modified
    loadWorkflow();
  };

  // Available dropdown options
  const statusOptions = [
    { value: 'new', label: 'New', color: getStatusColor('new') },
    { value: 'in_progress', label: 'In Progress', color: getStatusColor('in_progress') },
    { value: 'resolved', label: 'Resolved', color: getStatusColor('resolved') }
  ];
  
  const priorityOptions = [
    { value: 'low', label: 'Low', color: getPriorityColor('low') },
    { value: 'medium', label: 'Medium', color: getPriorityColor('medium') },
    { value: 'high', label: 'High', color: getPriorityColor('high') }
  ];
  
  const categoryOptions = ['General', 'Technical', 'Billing', 'Support', 'Feature Request', 'Bug Report'];

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowStatusDropdown(false);
    setShowPriorityDropdown(false);
    setShowCategoryDropdown(false);
    setShowAssignmentDropdown(false);
  };

  // Handlers for dropdown selections
  const handleStatusChange = async (newStatus: string) => {
    if (newStatus !== ticket.status && user?.permissions?.includes('tickets.edit')) {
      await handleStatusUpdate(newStatus);
    }
    closeAllDropdowns();
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (newPriority !== ticket.priority && user?.permissions?.includes('tickets.edit')) {
      try {
        const priorityValue = newPriority as 'low' | 'medium' | 'high';
        const response = await apiService.updateTicket(ticket.id, { priority: priorityValue });
        if (response) {
          setTicket(prev => ({ ...prev, priority: priorityValue }));
          onTicketUpdate();
        }
      } catch (error) {
        console.error('Error updating priority:', error);
      }
    }
    closeAllDropdowns();
  };

  const handleCategoryChange = async (newCategory: string) => {
    if (newCategory !== ticket.category && user?.permissions?.includes('tickets.edit')) {
      try {
        const response = await apiService.updateTicket(ticket.id, { category: newCategory });
        if (response) {
          setTicket(prev => ({ ...prev, category: newCategory }));
          onTicketUpdate();
        }
      } catch (error) {
        console.error('Error updating category:', error);
      }
    }
    closeAllDropdowns();
  };

  const handleAssignmentChange = async (agentId: string) => {
    await handleReassignTicket(agentId);
    closeAllDropdowns();
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

      <div className="space-y-6">
        {/* Ticket Details - Full width at top */}
        <div>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">#{ticket.ticketNumber}</h1>
                  
                  {/* Date Badge - Next to ticket number */}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    {formatDate(ticket.createdAt)}
                  </span>

                  {/* Service Workflow Badge - Shows when workflow exists */}
                  {workflow && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      Service
                    </span>
                  )}

                  {/* Status Badge - Clickable */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => {
                        if (user?.permissions?.includes('tickets.edit')) {
                          closeAllDropdowns();
                          setShowStatusDropdown(!showStatusDropdown);
                        }
                      }}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${getStatusColor(ticket.status)} ${user?.permissions?.includes('tickets.edit') ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} transition-opacity`}
                      disabled={!user?.permissions?.includes('tickets.edit')}
                    >
                      {formatStatus(ticket.status)}
                      {user?.permissions?.includes('tickets.edit') && (
                        <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {showStatusDropdown && user?.permissions?.includes('tickets.edit') && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10">
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleStatusChange(option.value)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${option.value === ticket.status ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                          >
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${option.color}`}>
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Priority Badge - Clickable */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => {
                        if (user?.permissions?.includes('tickets.edit')) {
                          closeAllDropdowns();
                          setShowPriorityDropdown(!showPriorityDropdown);
                        }
                      }}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 ${user?.permissions?.includes('tickets.edit') ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} transition-opacity`}
                      disabled={!user?.permissions?.includes('tickets.edit')}
                    >
                      {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                      {user?.permissions?.includes('tickets.edit') && (
                        <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {showPriorityDropdown && user?.permissions?.includes('tickets.edit') && (
                      <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10">
                        {priorityOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handlePriorityChange(option.value)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${option.value === ticket.priority ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                          >
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200`}>
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Badge - Clickable */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => {
                        if (user?.permissions?.includes('tickets.edit')) {
                          closeAllDropdowns();
                          setShowCategoryDropdown(!showCategoryDropdown);
                        }
                      }}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ${user?.permissions?.includes('tickets.edit') ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} transition-opacity`}
                      disabled={!user?.permissions?.includes('tickets.edit')}
                    >
                      {ticket.category}
                      {user?.permissions?.includes('tickets.edit') && (
                        <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {showCategoryDropdown && user?.permissions?.includes('tickets.edit') && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10">
                        {categoryOptions.map((category) => (
                          <button
                            key={category}
                            onClick={() => handleCategoryChange(category)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${category === ticket.category ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Agent Assignment Badge - Clickable */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => {
                        if (user?.permissions?.includes('tickets.edit')) {
                          closeAllDropdowns();
                          setShowAssignmentDropdown(!showAssignmentDropdown);
                        }
                      }}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ${user?.permissions?.includes('tickets.edit') ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} transition-opacity`}
                      disabled={!user?.permissions?.includes('tickets.edit')}
                    >
                      {ticket.agentId ? (ticket.agent?.name || 'Unknown') : 'Unassigned'}
                      {user?.permissions?.includes('tickets.edit') && (
                        <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {showAssignmentDropdown && user?.permissions?.includes('tickets.edit') && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10">
                        {ticket.agentId && (
                          <button
                            onClick={() => handleAssignmentChange('')}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            ⊘ Unassign Ticket
                          </button>
                        )}
                        {agents.map(agent => {
                          const isOnline = agent.isOnline || agentPresence.get(agent.id) || false;
                          const statusIndicator = isOnline ? '🟢' : '🔴';
                          return (
                            <button
                              key={agent.id}
                              onClick={() => handleAssignmentChange(agent.id)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${agent.id === ticket.agentId ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                            >
                              {statusIndicator} {agent.roleName || 'Unknown Role'} - {agent.name || `${agent.firstName} ${agent.lastName}`}
                              {agent.id === ticket.agentId ? ' (Current)' : ''}
                              {agent.id === user?.id ? ' (You)' : ''}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="ml-6">
                {user?.role === 'agent' && user?.permissions?.includes('tickets.edit') && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Edit Ticket
                  </button>
                )}
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
                    <div>
                      <label htmlFor="customerCity" className="block text-xs font-medium text-gray-400 dark:text-gray-500">City</label>
                      <input
                        type="text"
                        id="customerCity"
                        name="customerCity"
                        value={editForm.customerCity}
                        onChange={handleEditFormChange}
                        className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Los Angeles"
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
                      <label htmlFor="customerType" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Customer Type</label>
                      <select
                        id="customerType"
                        name="customerType"
                        value={editForm.customerType}
                        onChange={handleEditFormChange}
                        className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select customer type...</option>
                        {customerTypes.map((type) => (
                          <option key={type.id} value={type.name}>
                            {type.name}
                          </option>
                        ))}
                        {/* Fallback options if no dropdown options are loaded */}
                        {customerTypes.length === 0 && (
                          <>
                            <option value="Standard">Standard</option>
                            <option value="VIP">VIP</option>
                            <option value="Distributor">Distributor</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="deviceModel" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Device Model</label>
                        <select
                          id="deviceModel"
                          name="deviceModel"
                          value={editForm.deviceModel}
                          onChange={handleEditFormChange}
                          className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select model...</option>
                          {deviceModels.map((model) => (
                            <option key={model.id} value={model.name}>
                              {model.name}
                            </option>
                          ))}
                          {/* Fallback options if no dropdown options are loaded */}
                          {deviceModels.length === 0 && (
                            <>
                              <option value="BWIII">BWIII</option>
                              <option value="BWMini">BWMini</option>
                              <option value="Compass">Compass</option>
                              <option value="Maxxi">Maxxi</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="deviceSerialNumber" className="block text-xs font-medium text-gray-400 dark:text-gray-500">Serial Number</label>
                        <input
                          type="text"
                          id="deviceSerialNumber"
                          name="deviceSerialNumber"
                          value={editForm.deviceSerialNumber}
                          onChange={handleEditFormChange}
                          className="mt-1 w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter serial number"
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
              /* Display Mode - Compact Layout */
              <div className="space-y-3">
                {/* Title and Description - Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Title</span>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{ticket.title}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Description</span>
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                </div>



                                  {/* Customer Information - Compact Grid */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Customer & Device Info</h3>
                  
                  {/* Customer Basic Info */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Name</span>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customer?.name || ticket.customerName || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Email</span>
                      <p className="text-sm text-gray-900 dark:text-gray-100 truncate" title={ticket.customer?.email || ticket.customerEmail || 'Not provided'}>
                        {ticket.customer?.email || ticket.customerEmail || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Phone</span>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customerPhone || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  {/* Company, Type, Address, and Country */}
                  <div className="grid grid-cols-4 gap-4 mb-3">
                    <div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Company</span>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customerCompany || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Type</span>
                      <div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          ticket.customerType === 'VIP' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          ticket.customerType === 'Distributor' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {ticket.customerType || 'Standard'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Address</span>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {(() => {
                          const addressParts = [];
                          if (ticket.customerStreetAddress) addressParts.push(ticket.customerStreetAddress);
                          if (ticket.customerCity) addressParts.push(ticket.customerCity);
                          if (ticket.customerState) addressParts.push(ticket.customerState);
                          if (ticket.customerZipCode) addressParts.push(ticket.customerZipCode);
                          
                          if (addressParts.length > 0) {
                            return <p className="truncate" title={addressParts.join(', ')}>{addressParts.join(', ')}</p>;
                          } else if (ticket.customerAddress) {
                            return <p className="whitespace-pre-wrap truncate" title={ticket.customerAddress}>{ticket.customerAddress}</p>;
                          } else {
                            return <p className="text-gray-500 dark:text-gray-400">No address provided</p>;
                          }
                        })()}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Country</span>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {ticket.customerCountry || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  {/* Device Info - Separated Section */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Device Model</span>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {ticket.deviceModel || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Serial Number</span>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {ticket.deviceSerialNumber || 'Not provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}



            {/* Actions - Horizontal Layout */}
            {user?.role === 'agent' && (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                {!ticket.agentId && user?.permissions?.includes('tickets.edit') && (
                  <button
                    onClick={handleClaimTicket}
                    className="w-full bg-primary-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    Claim Ticket
                  </button>
                )}

                {ticket.agentId === user.id && user?.permissions?.includes('tickets.edit') && ticket.status !== 'resolved' && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleStatusUpdate('in_progress')}
                      disabled={ticket.status === 'in_progress'}
                      className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50"
                    >
                      Mark In Progress
                    </button>
                    <button
                      onClick={() => handleStatusUpdate('resolved')}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Mark Resolved
                    </button>
                    {user?.permissions?.includes('tickets.edit') && (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI</span>
                        <div className={`w-2 h-2 rounded-full ${aiEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <button
                          onClick={() => handleToggleAi(!aiEnabled, aiEnabled ? 'manual' : undefined)}
                          disabled={aiToggling}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            aiEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                          } ${aiToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              aiEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {ticket.agentId === user.id && user?.permissions?.includes('tickets.edit') && ticket.status === 'resolved' && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleStatusUpdate('in_progress')}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Reopen Ticket
                    </button>
                    {user?.permissions?.includes('tickets.edit') && (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI</span>
                        <div className={`w-2 h-2 rounded-full ${aiEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <button
                          onClick={() => handleToggleAi(!aiEnabled, aiEnabled ? 'manual' : undefined)}
                          disabled={aiToggling}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            aiEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                          } ${aiToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              aiEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Status Indicator */}
                {user?.permissions?.includes('tickets.edit') && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {aiEnabled ? (
                      <span className="text-green-600 dark:text-green-400">✓ AI will respond to customer messages</span>
                    ) : (
                      <div>
                        <span className="text-red-600 dark:text-red-400">✗ AI responses disabled</span>
                        {aiStatus.disabledAt && (
                          <span className="ml-1">
                            (Disabled {aiStatus.reason === 'escalation' ? 'due to escalation' : 'manually'}
                            {aiStatus.changedBy && ` by ${aiStatus.changedBy}`})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat - Full width below ticket details */}
        <div>
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
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2`}
                          >
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              isOwnMessage
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : (sender?.userType === 'customer')
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100 border border-orange-200 dark:border-orange-800 rounded-bl-sm'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 border border-green-200 dark:border-green-800 rounded-bl-sm'
                            }`}>
                              <p className="text-sm">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                isOwnMessage 
                                  ? 'text-blue-100' 
                                  : (sender?.userType === 'customer')
                                  ? 'text-orange-700 dark:text-orange-300'
                                  : 'text-green-700 dark:text-green-300'
                              }`}>
                                {(() => {
                                  if (senderName) return senderName;
                                  if (isOwnMessage) return 'You';
                                  if (sender?.userType === 'ai') return senderName || 'NeuroAI'; 
                                  if (sender?.userType === 'customer' || sender?.role === 'customer') return 'Customer';
                                  return 'Support Agent';
                                })()} • {formatMessageTime(message.createdAt)}
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
                        onChange={handleMessageInputChange}
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

        {/* AI Summary Section - Smaller, below chat */}
        <div>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">AI Summary</h3>
              {user?.permissions?.includes('tickets.edit') && (
                <button
                  onClick={() => {
                    console.log('🔵 [DEBUG] Button clicked!');
                    console.log('🔵 [DEBUG] Current generatingSummary state:', generatingSummary);
                    handleGenerateSummary();
                  }}
                  disabled={generatingSummary}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingSummary ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Generating...</span>
                    </div>
                  ) : ticket.resolutionSummary ? (
                    'Regenerate'
                  ) : (
                    'Generate Summary'
                  )}
                </button>
              )}
            </div>
            
            {ticket.resolutionSummary ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{ticket.resolutionSummary}</p>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                  <span>
                    Generated {ticket.resolutionSummaryGeneratedAt ? 
                      new Date(ticket.resolutionSummaryGeneratedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Unknown'}
                  </span>
                  {ticket.resolutionSummaryModelVersion && (
                    <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">
                      {ticket.resolutionSummaryModelVersion}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 mb-2">No AI summary available</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                  {user?.permissions?.includes('tickets.edit') 
                    ? 'Click "Generate Summary" to create an AI-powered summary of this ticket'
                    : 'Summaries are automatically generated when tickets are resolved'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Service Workflow Section - Smaller, at bottom */}
        <div>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Service Workflow</h3>
              {user?.permissions?.includes('tickets.edit') && ticket.deviceSerialNumber && (
                <button 
                  onClick={handleManageWorkflow}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  {workflow ? 'Manage Workflow' : 'Create Workflow'}
                </button>
              )}
            </div>
            
            {loadingWorkflow ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading workflow...</p>
              </div>
            ) : workflow ? (
              <div className="space-y-4">
                {/* Workflow Info */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Workflow #</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{workflow.workflowNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      workflow.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      workflow.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {workflow.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Device Serial</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{workflow.deviceSerialNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Current Step</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{workflow.currentStep} / {workflow.steps?.length || 0}</p>
                  </div>
                </div>

                {/* Workflow Steps */}
                {workflow.steps && workflow.steps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Steps Progress</p>
                    <div className="space-y-1">
                      {workflow.steps.map((step: any, index: number) => (
                        <div key={step.stepId} className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                            step.status === 'completed' ? 'bg-green-500 text-white' :
                            step.status === 'in_progress' ? 'bg-blue-500 text-white' :
                            step.status === 'skipped' ? 'bg-yellow-500 text-white' :
                            'bg-gray-300 text-gray-600'
                          }`}>
                            {step.status === 'completed' ? '✓' : 
                             step.status === 'skipped' ? '-' : 
                             step.stepNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {step.stepName}
                            </p>
                            {step.agentName && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Assigned to: {step.agentName}
                              </p>
                            )}
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            step.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            step.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            step.status === 'skipped' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {step.status.replace('_', ' ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${workflow.steps ? 
                        (workflow.steps.filter((s: any) => s.status === 'completed').length / workflow.steps.length) * 100 
                        : 0}%` 
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Progress</span>
                  <span>
                    {workflow.steps ? 
                      `${workflow.steps.filter((s: any) => s.status === 'completed').length} / ${workflow.steps.length} completed`
                      : '0 / 0 completed'
                    }
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No Service Workflow</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {ticket.deviceSerialNumber 
                    ? 'Click "Create Workflow" to create a service workflow for device tracking'
                    : 'Add device information to enable service workflow management'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Service Workflow Modal */}
      {showServiceWorkflow && (
        <ServiceWorkflow
          ticketId={ticket.id}
          deviceSerialNumber={ticket.deviceSerialNumber}
          onClose={handleCloseWorkflow}
        />
      )}
    </div>
  );
};

export default TicketDetail; 