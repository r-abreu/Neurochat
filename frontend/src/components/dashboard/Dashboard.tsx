import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import TicketList from '../tickets/TicketList';
import CreateTicket from '../tickets/CreateTicket';
import TicketDetail from '../tickets/TicketDetail';
import UserManagement from '../users/UserManagement';
import AuditTrail from '../users/AuditTrail';
import Insights from './Insights';
import CustomerManagement from '../customers/CustomerManagement';
import DeviceManagement from '../devices/DeviceManagement';
import CompanyManagement from '../companies/CompanyManagement';
import ThemeToggle from '../common/ThemeToggle';
import CompanyMatchNotification from '../common/CompanyMatchNotification';
import { Ticket, User } from '../../types';
import apiService from '../../services/api';
import socketService from '../../services/socket';
import soundService from '../../services/soundService';

type ViewType = 'tickets' | 'my-tickets' | 'my-open-tickets' | 'all-open-tickets' | 'unassigned' | 'resolved' | 'create' | 'detail' | 'users' | 'audit' | 'insights' | 'customers' | 'devices' | 'companies';

const Dashboard: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  
  // Debug log to confirm Dashboard component is loading
  console.log('🔥 DASHBOARD COMPONENT LOADED - User:', user);
  const [currentView, setCurrentView] = useState<ViewType>(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const soundSettingsRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [messageBlinkingTickets, setMessageBlinkingTickets] = useState<Set<string>>(new Set());
  const [companyMatchNotifications, setCompanyMatchNotifications] = useState<any[]>([]);

  // Close sound settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (soundSettingsRef.current && !soundSettingsRef.current.contains(event.target as Node)) {
        setShowSoundSettings(false);
      }
    };

    if (showSoundSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSoundSettings]);

  // Helper function to determine urgency level
  const getTicketUrgencyLevel = (ticket: Ticket): 'green' | 'yellow' | 'red' => {
    const elapsed = Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / 1000);
    const isAssigned = !!ticket.agentId;
    const isResolved = ticket.status === 'resolved';
    const isInProgress = ticket.status === 'in_progress';

    if (isResolved) {
      return 'green';
    } else if (isInProgress) {
      const elapsedMinutes = Math.floor(elapsed / 60);
      if (elapsedMinutes > 20) return 'red';
      if (elapsedMinutes > 10) return 'yellow';
      return 'green';
    } else if (isAssigned) {
      return 'green';
    } else if (elapsed > 120) {
      return 'red';
    } else if (elapsed > 60) {
      return 'yellow';
    } else {
      return 'green';
    }
  };

  // Play sound based on urgency changes
  const playUrgencySound = async (ticket: Ticket, isNewTicket: boolean = false) => {
    if (!soundEnabled) return;

    const urgencyLevel = getTicketUrgencyLevel(ticket);
    
    try {
      if (isNewTicket) {
        // For new tickets, play sound based on initial urgency
        switch (urgencyLevel) {
          case 'green':
            await soundService.playNewTicketSound();
            break;
          case 'yellow':
            await soundService.playYellowTicketSound();
            break;
          case 'red':
            await soundService.playRedTicketSound();
            break;
        }
      } else {
        // For updates, play update sound
        await soundService.playTicketUpdateSound();
      }
    } catch (error) {
      console.warn('Error playing sound:', error);
    }
  };

  // Check for urgency changes and play sounds
  const checkUrgencyChanges = (oldTickets: Ticket[], newTickets: Ticket[]) => {
    if (!soundEnabled || oldTickets.length === 0) return;

    newTickets.forEach(newTicket => {
      const oldTicket = oldTickets.find(t => t.id === newTicket.id);
      
      if (!oldTicket) {
        // This is a new ticket
        playUrgencySound(newTicket, true);
      } else {
        // Check if urgency level changed
        const oldUrgency = getTicketUrgencyLevel(oldTicket);
        const newUrgency = getTicketUrgencyLevel(newTicket);
        
        if (oldUrgency !== newUrgency && newUrgency !== 'green') {
          // Urgency increased (only play for yellow/red)
          playUrgencySound(newTicket, false);
        }
      }
    });
  };

  // Handle customer message to start blue blinking
  const handleCustomerMessage = (ticketId: string) => {
    setMessageBlinkingTickets(prev => {
      const updated = new Set(prev);
      updated.add(ticketId);
      return updated;
    });
  };

  // Handle agent reply to stop blue blinking
  const handleAgentReply = (ticketId: string) => {
    setMessageBlinkingTickets(prev => {
      const updated = new Set(prev);
      updated.delete(ticketId);
      return updated;
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('🔥 DASHBOARD useEffect TRIGGERED - User role:', user?.role, 'User ID:', user?.id);
    
    const initializeDashboard = async () => {
      console.log('🔥 DASHBOARD initializeDashboard function started');
      loadTickets();
      
      try {
        // Connect to Socket.IO for real-time updates and wait for connection
        console.log('🚀 Dashboard: Connecting to Socket.IO...');
        await socketService.connect();
        console.log('✅ Dashboard: Socket.IO connected successfully');
        
        // Join agent dashboard if user is an agent
        if (user?.role === 'agent' && user?.id) {
          const agentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown Agent';
          console.log('🚀 Dashboard: Joining agent dashboard for:', { agentId: user.id, agentName });
          socketService.joinAgentDashboard(user.id, agentName);
        } else {
          console.log('🔥 DASHBOARD: User is not an agent or missing ID:', { role: user?.role, id: user?.id });
        }
      } catch (error) {
        console.error('❌ Dashboard: Failed to connect to Socket.IO:', error);
        // Still continue with dashboard functionality even if socket fails
      }
    };

    initializeDashboard();
    
    // Handle browser/tab close to ensure proper disconnect
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Leave agent dashboard before disconnecting
      if (user?.role === 'agent' && user?.id) {
        const agentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown Agent';
        socketService.leaveAgentDashboard(user.id, agentName);
      }
      socketService.disconnect();
    };

    // Add event listener for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Listen for new tickets
    const handleNewTicket = (data: { ticket: any }) => {
      console.log('🎫 New ticket received via Socket.IO:', data.ticket);
      // Play new ticket sound immediately
      if (soundEnabled) {
        playUrgencySound(data.ticket, true);
      }
      loadTickets(true); // Auto-update
    };
    
    // Listen for ticket updates
    const handleTicketUpdate = (data: any) => {
      console.log('🔄 Ticket update received via Socket.IO:', data);
      loadTickets(true); // Auto-update
    };

    // Listen for ticket deletions
    const handleTicketDelete = (data: { ticketId: string; deletedBy: string; deletedAt: string }) => {
      console.log('🗑️ Ticket deletion received via Socket.IO:', data);
      
      // If the currently selected ticket was deleted, go back to list
      if (selectedTicket && selectedTicket.id === data.ticketId) {
        setSelectedTicket(null);
        setCurrentView(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
      }
      
      loadTickets(true); // Auto-update
    };

    // Listen for new messages
    const handleNewMessage = (data: { message: any }) => {
      console.log('📨 Dashboard received new message via Socket.IO:', data.message);
      
      // Check if this is a customer message
      if (data.message.sender?.userType === 'customer') {
        console.log('🔵 Customer message received, starting blue blink for ticket:', data.message.ticketId);
        handleCustomerMessage(data.message.ticketId);
      } else if (data.message.sender?.userType === 'agent') {
        console.log('👨‍💼 Agent message received, stopping blue blink for ticket:', data.message.ticketId);
        handleAgentReply(data.message.ticketId);
      }
      
      // Refresh tickets to update message timestamps
      loadTickets(true);
    };

    // Listen for company match suggestions
    const handleCompanyMatchSuggestion = (data: any) => {
      console.log('🏢 Company match suggestion received:', data);
      
      // Add to notifications if user has permission to assign companies
      if (user?.permissions?.includes('companies.assign')) {
        setCompanyMatchNotifications(prev => [...prev, {
          id: data.pendingMatchId,
          ticketId: data.ticketId,
          ticketNumber: data.ticketNumber,
          customerName: data.customerName,
          inputCompanyName: data.inputCompanyName,
          suggestedCompany: {
            id: data.suggestedCompany,
            name: data.suggestedCompany
          },
          confidence: data.confidence,
          message: data.message
        }]);
      }
    };
    
    socketService.on('new_ticket', handleNewTicket);
    socketService.on('ticket_updated', handleTicketUpdate);
    socketService.on('ticket_deleted', handleTicketDelete);
    socketService.on('new_message', handleNewMessage);
    socketService.on('company_match_suggestion', handleCompanyMatchSuggestion);
    
    // Set up periodic auto-refresh as fallback (every 30 seconds)
    const autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing ticket list...');
      loadTickets(true); // Auto-update
    }, 30000); // 30 seconds
    
    return () => {
      // Leave agent dashboard if user is an agent
      if (user?.role === 'agent' && user?.id) {
        const agentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown Agent';
        socketService.leaveAgentDashboard(user.id, agentName);
      }
      
      // Remove event listener
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socketService.off('new_ticket', handleNewTicket);
      socketService.off('ticket_updated', handleTicketUpdate);
      socketService.off('ticket_deleted', handleTicketDelete);
      socketService.off('new_message', handleNewMessage);
      socketService.off('company_match_suggestion', handleCompanyMatchSuggestion);
      clearInterval(autoRefreshInterval);
      socketService.disconnect();
    };
  }, []);

  const loadTickets = async (isAutoUpdate = false) => {
    try {
      if (isAutoUpdate) {
        setAutoUpdating(true);
      } else {
        setLoading(true);
      }
      
      const oldTickets = [...tickets];
      const fetchedTickets = await apiService.getTickets();
      setTickets(fetchedTickets);
      setLastUpdated(new Date());
      
      // Check for urgency changes and play sounds
      if (isAutoUpdate) {
        checkUrgencyChanges(oldTickets, fetchedTickets);
      }
      
      // Update selected ticket if it exists in the refreshed list
      if (selectedTicket) {
        const updatedTicket = fetchedTickets.find(t => t.id === selectedTicket.id);
        if (updatedTicket) {
          setSelectedTicket(updatedTicket);
        }
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
      setAutoUpdating(false);
    }
  };

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setCurrentView('detail');
  };

  const handleTicketCreate = () => {
    setCurrentView('create');
  };

  const handleProfileUpdate = (updatedUser: User) => {
    updateUser(updatedUser);
  };

  const handleBackToList = () => {
    setCurrentView(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
    setSelectedTicket(null);
    loadTickets(); // Refresh tickets
  };

  const toggleSound = () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    soundService.setEnabled(newSoundEnabled);
    
    if (newSoundEnabled) {
      // Test sound when enabling
      soundService.playNewTicketSound();
    }
  };

  const testIndividualSound = async (soundType: 'green' | 'yellow' | 'red' | 'update') => {
    switch (soundType) {
      case 'green':
        await soundService.playNewTicketSound();
        break;
      case 'yellow':
        await soundService.playYellowTicketSound();
        break;
      case 'red':
        await soundService.playRedTicketSound();
        break;
      case 'update':
        await soundService.playTicketUpdateSound();
        break;
    }
  };

  // Company match notification handlers
  const handleApproveCompanyMatch = async (matchId: string) => {
    try {
      await apiService.reviewCompanyMatch(matchId, 'approve');
      // Remove notification after successful approval
      setCompanyMatchNotifications(prev => prev.filter(n => n.id !== matchId));
      // Refresh tickets to show updated company assignment
      loadTickets();
    } catch (error) {
      console.error('Error approving company match:', error);
    }
  };

  const handleRejectCompanyMatch = async (matchId: string) => {
    try {
      await apiService.reviewCompanyMatch(matchId, 'reject');
      // Remove notification after successful rejection
      setCompanyMatchNotifications(prev => prev.filter(n => n.id !== matchId));
    } catch (error) {
      console.error('Error rejecting company match:', error);
    }
  };

  const handleDismissCompanyMatch = (matchId: string) => {
    // Just remove the notification without taking action
    setCompanyMatchNotifications(prev => prev.filter(n => n.id !== matchId));
  };

  const renderContent = () => {
    switch (currentView) {
      case 'create':
        return (
          <CreateTicket 
            onBack={handleBackToList}
            onTicketCreated={handleBackToList}
          />
        );
      case 'detail':
        return selectedTicket ? (
          <TicketDetail 
            ticket={selectedTicket}
            onBack={handleBackToList}
            onTicketUpdate={loadTickets}
          />
        ) : null;
      case 'users':
        // Check if user has permission to access user management
        if (user?.role === 'agent' && (user.permissions?.includes('users.access') || user.permissions?.includes('system.user_management') || user.permissions?.includes('system.management') || user.roleName === 'Admin')) {
          return <UserManagement />;
        } else {
          // Redirect to default view if no permission
          setCurrentView(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
          return null;
        }
      case 'audit':
        // Check if user has permission to access audit trail
        if (user?.role === 'agent' && user.permissions?.includes('audit.view')) {
          return <AuditTrail />;
        } else {
          // Redirect to default view if no permission
          setCurrentView(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
          return null;
        }
      case 'insights':
        // Check if user has permission to access insights
        if (user?.role === 'agent' && user.permissions?.includes('insights.view')) {
          return <Insights />;
        } else {
          // Redirect to default view if no permission
          setCurrentView(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
          return null;
        }
      case 'customers':
        // Check if user has permission to access customer management
        if (user?.role === 'agent' && user.permissions?.includes('customers.view')) {
          return <CustomerManagement onTicketSelect={(ticketId: string) => {
            // Find the ticket by ID and select it
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket) {
              handleTicketSelect(ticket);
            }
          }} />;
        } else {
          // Redirect to default view if no permission
          setCurrentView(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
          return null;
        }
      case 'devices':
        // Check if user has permission to access device management
        if (user?.role === 'agent' && user.permissions?.includes('devices.view')) {
          return <DeviceManagement onTicketSelect={(ticketId: string) => {
            // Find the ticket by ID and select it
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket) {
              handleTicketSelect(ticket);
            }
          }} />;
        } else {
          // Redirect to default view if no permission
          setCurrentView(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
          return null;
        }
      case 'companies':
        // Check if user has permission to access company management
        if (user?.role === 'agent' && user.permissions?.includes('companies.view')) {
          return <CompanyManagement 
            onTicketSelect={(ticketId: string) => {
              // Find the ticket by ID and select it
              const ticket = tickets.find(t => t.id === ticketId);
              if (ticket) {
                handleTicketSelect(ticket);
              }
            }}
            onCustomerSelect={(customer: any) => {
              // Switch to customers view and trigger customer selection
              setCurrentView('customers');
              // We need to update CustomerManagement to handle this properly
            }}
            onDeviceSelect={(device: any) => {
              // Switch to devices view and trigger device selection
              setCurrentView('devices');
              // We need to update DeviceManagement to handle this properly
            }}
          />;
        } else {
          // Redirect to default view if no permission
          setCurrentView(user?.role === 'agent' ? 'all-open-tickets' : 'tickets');
          return null;
        }
      case 'tickets':
      case 'my-tickets':
      case 'my-open-tickets':
      case 'all-open-tickets':
      case 'unassigned':
      case 'resolved':
      default:
        return (
          <TicketList 
            tickets={tickets}
            loading={loading}
            onTicketSelect={handleTicketSelect}
            onRefresh={loadTickets}
            onCreateTicket={handleTicketCreate}
            currentView={currentView}
            lastUpdated={lastUpdated}
            autoUpdating={autoUpdating}
            onCustomerMessage={handleCustomerMessage}
            onAgentReply={handleAgentReply}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800">
                    <Sidebar 
          user={user}
          currentView={currentView}
          onViewChange={(view: string) => {
            // Check permissions before allowing view change
            if (view === 'users' && !(user?.role === 'agent' && (user.permissions?.includes('users.access') || user.permissions?.includes('system.user_management') || user.permissions?.includes('system.management') || user.roleName === 'Admin'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'audit' && !(user?.role === 'agent' && user.permissions?.includes('audit.view'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'insights' && !(user?.role === 'agent' && user.permissions?.includes('insights.view'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'customers' && !(user?.role === 'agent' && user.permissions?.includes('customers.view'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'devices' && !(user?.role === 'agent' && user.permissions?.includes('devices.view'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'companies' && !(user?.role === 'agent' && user.permissions?.includes('companies.view'))) {
              return; // Don't allow view change if no permission
            }
            setCurrentView(view as ViewType);
          }}
          onCreateTicket={handleTicketCreate}
          onLogout={logout}
          onProfileUpdate={handleProfileUpdate}
          isMobile={true}
          onClose={() => setSidebarOpen(false)}
        />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 transition-all duration-300 ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'}`}>
        <Sidebar 
          user={user}
          currentView={currentView}
          onViewChange={(view: string) => {
            // Check permissions before allowing view change
            if (view === 'users' && !(user?.role === 'agent' && (user.permissions?.includes('users.access') || user.permissions?.includes('system.user_management') || user.permissions?.includes('system.management') || user.roleName === 'Admin'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'audit' && !(user?.role === 'agent' && user.permissions?.includes('audit.view'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'insights' && !(user?.role === 'agent' && user.permissions?.includes('insights.view'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'customers' && !(user?.role === 'agent' && user.permissions?.includes('customers.view'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'devices' && !(user?.role === 'agent' && user.permissions?.includes('devices.view'))) {
              return; // Don't allow view change if no permission
            }
            if (view === 'companies' && !(user?.role === 'agent' && user.permissions?.includes('companies.view'))) {
              return; // Don't allow view change if no permission
            }
            setCurrentView(view as ViewType);
          }}
          onCreateTicket={handleTicketCreate}
          onLogout={logout}
          onProfileUpdate={handleProfileUpdate}
          isMobile={false}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main content */}
      <div className={`flex flex-col flex-1 transition-all duration-300 ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'}`}>
        {/* Top header */}
        <div className="sticky top-0 z-10 pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="md:hidden -ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-4 pr-4 pb-3">
              {autoUpdating && (
                <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Auto-updating...
                </div>
              )}
              
              {/* Sound Settings Dropdown */}
              <div className="relative" ref={soundSettingsRef}>
                <button
                  onClick={() => setShowSoundSettings(!showSoundSettings)}
                  className={`p-2 rounded-md transition-colors ${
                    soundEnabled
                      ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title="Sound settings"
                >
                  {soundEnabled ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 106 0v-1a3 3 0 00-6 0v1z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5a3 3 0 000 6h3v6a3 3 0 106 0V9a3 3 0 00-3-3H9z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </button>

                {/* Sound Settings Dropdown Panel */}
                {showSoundSettings && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Sound Notifications</h3>
                      
                      {/* Master Toggle */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Enable Sounds</span>
                        <button
                          onClick={toggleSound}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                            soundEnabled ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                              soundEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Sound Tests */}
                      {soundEnabled && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Test Sounds</h4>
                          
                          <button
                            onClick={() => testIndividualSound('green')}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                          >
                            <span>New/Resolved Ticket</span>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </button>
                          
                          <button
                            onClick={() => testIndividualSound('yellow')}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                          >
                            <span>Attention Needed</span>
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          </button>
                          
                          <button
                            onClick={() => testIndividualSound('red')}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <span>Urgent Ticket</span>
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          </button>
                          
                          <button
                            onClick={() => testIndividualSound('update')}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <span>Ticket Update</span>
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Company Match Notifications */}
        {companyMatchNotifications.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <div className="px-6 py-4">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
                Company Match Suggestions ({companyMatchNotifications.length})
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {companyMatchNotifications.map((match) => (
                  <CompanyMatchNotification
                    key={match.id}
                    match={match}
                    onApprove={handleApproveCompanyMatch}
                    onReject={handleRejectCompanyMatch}
                    onDismiss={handleDismissCompanyMatch}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main content area */}
        <main className="flex-1">
          <div className="py-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard; 