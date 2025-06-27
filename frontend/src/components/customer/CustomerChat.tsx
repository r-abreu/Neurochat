import React, { useState, useEffect, useRef } from 'react';
import { Message, Category } from '../../types';
import apiService from '../../services/api';
import socketService from '../../services/socket';
import soundService from '../../services/soundService';
import ThemeToggle from '../common/ThemeToggle';
import FileUpload from '../common/FileUpload';
import CountrySelect from '../common/CountrySelect';
import CompanySuggestion from '../common/CompanySuggestion';

interface CustomerInfo {
  name: string;
  email: string;
  company: string;
  phone: string;
  country: string;
}

const CustomerChat: React.FC = () => {
  // Helper functions for localStorage
  const saveCustomerInfo = (info: CustomerInfo) => {
    try {
      localStorage.setItem('neurochat_customer_info', JSON.stringify(info));
    } catch (error) {
      console.warn('Failed to save customer info to localStorage:', error);
    }
  };

  const loadSavedCustomerInfo = (): CustomerInfo => {
    try {
      const saved = localStorage.getItem('neurochat_customer_info');
      if (saved) {
        const parsedInfo = JSON.parse(saved);
        // Validate the structure
        if (parsedInfo && typeof parsedInfo === 'object' && 
            typeof parsedInfo.name === 'string' &&
            typeof parsedInfo.email === 'string' &&
            typeof parsedInfo.company === 'string' &&
            typeof parsedInfo.phone === 'string') {
          return {
            ...parsedInfo,
            country: parsedInfo.country || ''
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load customer info from localStorage:', error);
    }
    return { name: '', email: '', company: '', phone: '', country: '' };
  };

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(loadSavedCustomerInfo());
  const [emailError, setEmailError] = useState('');

  // Clear saved customer info
  const clearSavedCustomerInfo = () => {
    try {
      localStorage.removeItem('neurochat_customer_info');
      setCustomerInfo({ name: '', email: '', company: '', phone: '', country: '' });
      setEmailError('');
    } catch (error) {
      console.warn('Failed to clear saved customer info:', error);
    }
  };
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [currentTicketNumber, setCurrentTicketNumber] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInfoComplete, setIsInfoComplete] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [ticketClosed, setTicketClosed] = useState(false);
  const [closedByTimeout, setClosedByTimeout] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [showResolutionFeedback, setShowResolutionFeedback] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showPersistentSurvey, setShowPersistentSurvey] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState<Array<{name: string; confidence: number; description?: string}>>([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [companyInputTimeout, setCompanyInputTimeout] = useState<NodeJS.Timeout | null>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  // Mobile-specific states
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{url: string, type: string, name: string} | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const currentTicketIdRef = useRef<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Update ref whenever currentTicketId changes
  useEffect(() => {
    currentTicketIdRef.current = currentTicketId;
  }, [currentTicketId]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load system settings
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/system/settings`);
        if (response.ok) {
          const data = await response.json();
          setSystemSettings(data.settings);
        }
      } catch (error) {
        console.error('Error loading system settings:', error);
        // Use default values
        setSystemSettings({
          chatAbandonmentTimeout: 15, // Default 15 minutes
        });
      }
    };
    loadSystemSettings();
  }, []);

  useEffect(() => {
    // Clear any existing authentication tokens for anonymous customer chat
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    
    // Validate loaded email on component mount
    if (customerInfo.email && !validateEmail(customerInfo.email)) {
      setEmailError('Please enter a valid email address');
    }
    
    loadCategories();
    // Connect to Socket.IO without authentication (for anonymous users)
    socketService.connect();

    // Handle browser/tab close to ensure proper disconnect
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentTicketIdRef.current && !ticketClosed) {
        // Add abandonment message before closing
        try {
          // Use sendBeacon for reliable notification on page unload
          navigator.sendBeacon(
            `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/tickets/${currentTicketIdRef.current}/abandon`,
            JSON.stringify({ reason: 'browser_close' })
          );
          
          socketService.leaveTicket(currentTicketIdRef.current);
          // Small delay to allow the message to be sent
          const start = Date.now();
          while (Date.now() - start < 100) {
            // Blocking delay to ensure message is sent
          }
        } catch (error) {
          console.error('Error leaving ticket on page unload:', error);
        }
      }
      socketService.forceDisconnect();
    };

    // Handle visibility change (tab switch/minimize) - disconnect after delay
    let visibilityTimeoutId: NodeJS.Timeout | null = null;
    
    const handleVisibilityChange = () => {
      if (document.hidden && currentTicketIdRef.current && !ticketClosed) {
        // User switched away from tab - set a timer to mark as abandoned after some delay
        visibilityTimeoutId = setTimeout(() => {
          if (document.hidden && currentTicketIdRef.current) {
            console.log('🔴 Customer tab hidden for too long, marking ticket as abandoned');
            // Mark ticket as abandoned
            try {
              fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/tickets/${currentTicketIdRef.current}/abandon`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: 'tab_hidden' })
              });
            } catch (error) {
              console.error('Error marking ticket as abandoned:', error);
            }
            socketService.leaveTicket(currentTicketIdRef.current);
          }
        }, (systemSettings?.chatAbandonmentTimeout || 15) * 60 * 1000); // Use system setting or default 15 minutes
      } else if (!document.hidden && visibilityTimeoutId) {
        // User came back to tab - cancel the abandon timer
        clearTimeout(visibilityTimeoutId);
        visibilityTimeoutId = null;
        
        // Rejoin the ticket if we have one
        if (currentTicketIdRef.current && !socketService.isSocketConnected()) {
          console.log('🟢 Customer tab visible again, reconnecting...');
          socketService.connect();
          setTimeout(() => {
            if (currentTicketIdRef.current) {
              socketService.joinTicket(currentTicketIdRef.current, true);
            }
          }, 1000);
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Clear visibility timeout
      if (visibilityTimeoutId) {
        clearTimeout(visibilityTimeoutId);
      }
      
      // Clear company input timeout
      if (companyInputTimeout) {
        clearTimeout(companyInputTimeout);
      }
      
      // Remove event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Leave ticket room before disconnecting if we have a current ticket
      if (currentTicketIdRef.current) {
        socketService.leaveTicket(currentTicketIdRef.current);
      }
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    const infoComplete = customerInfo.name.trim() && customerInfo.email.trim() && customerInfo.country.trim() && selectedCategory;
    setIsInfoComplete(!!infoComplete);
  }, [customerInfo, selectedCategory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentTicketId) {
      // Join the ticket room for real-time updates (as customer)
      socketService.joinTicket(currentTicketId, true);
      
      // Listen for new messages
      const handleNewMessage = (data: { message: Message }) => {
        console.log('📨 Received new message via Socket.IO:', data.message);
        console.log('📨 Message sender structure:', (data.message as any).sender);
        console.log('📨 Message user structure:', data.message.user);
        
        // Play sound notification for agent messages
        if (data.message.sender?.userType === 'agent') {
          console.log('🔊 Playing sound for agent message');
          soundService.playTicketUpdateSound();
          // Reset inactivity timer when agent responds
          resetInactivityTimer();
        }
        
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === data.message.id)) {
            return prev;
          }
          return [...prev, data.message];
        });
      };

      // Listen for typing indicators
      const handleTyping = (data: { ticketId: string; isTyping: boolean }) => {
        console.log('⌨️ Typing indicator:', data);
        setIsTyping(data.isTyping);
      };

      // Listen for AI ticket details updates
      const handleTicketDetailsUpdated = (data: {
        ticketId: string;
        title: string;
        description: string;
        confidence: number;
        generatedAt: string;
      }) => {
        if (currentTicketId && data.ticketId === currentTicketId) {
          console.log('🤖 Customer received AI ticket details update:', data);
          // For customers, we'll show a subtle notification that AI has analyzed the conversation
          // The title/description update is mainly for agents, but we can still log it
        }
      };

      socketService.on('new_message', handleNewMessage);
      socketService.on('user_typing', handleTyping);
      socketService.on('ticket_details_updated', handleTicketDetailsUpdated);

      return () => {
        socketService.off('new_message', handleNewMessage);
        socketService.off('user_typing', handleTyping);
        socketService.off('ticket_details_updated', handleTicketDetailsUpdated);
        // Leave ticket room when changing tickets
        if (currentTicketId) {
          socketService.leaveTicket(currentTicketId);
        }
      };
    }
  }, [currentTicketId]);

  // Start inactivity timer when ticket is created
  useEffect(() => {
    if (currentTicketId && !ticketClosed) {
      resetInactivityTimer();
    }
    
    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [currentTicketId, ticketClosed]);

  const loadCategories = async () => {
    try {
      // Use the dropdown options API to get categories configured in system settings
      const dropdownOptions = await apiService.getDropdownOptions();
      const activeCategories = dropdownOptions.categories.filter(cat => (cat as any).isActive !== false);
      setCategories(activeCategories);
      if (activeCategories.length > 0) {
        setSelectedCategory(activeCategories[0].id);
      }
    } catch (error) {
      console.error('Error loading categories from dropdown options:', error);
      // Fallback to original method if dropdown options fail
      try {
        const fetchedCategories = await apiService.getCategories();
        setCategories(fetchedCategories);
        if (fetchedCategories.length > 0) {
          setSelectedCategory(fetchedCategories[0].id);
        }
      } catch (fallbackError) {
        console.error('Error loading categories (fallback):', fallbackError);
      }
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      setLoadingMessages(true);
      console.log('📥 Loading messages for ticket:', ticketId);
      const fetchedMessages = await apiService.getMessages(ticketId);
      console.log('📥 Loaded messages:', fetchedMessages);
      setMessages(fetchedMessages || []);
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInfoChange = (field: keyof CustomerInfo, value: string) => {
    const updatedInfo = { ...customerInfo, [field]: value };
    setCustomerInfo(updatedInfo);
    
    // Save to localStorage immediately
    saveCustomerInfo(updatedInfo);
    
    // Real-time email validation
    if (field === 'email') {
      if (value && !validateEmail(value)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError('');
      }
    }

    // Handle company field changes for real-time suggestions
    if (field === 'company') {
      // Clear existing timeout
      if (companyInputTimeout) {
        clearTimeout(companyInputTimeout);
      }

      if (value.trim().length >= 2) {
        // Set a debounced timeout to fetch suggestions
        const timeout = setTimeout(async () => {
          try {
            const response = await apiService.suggestCompanyRealtime(value.trim(), 50);
            if (response.suggestions.length > 0) {
              setCompanySuggestions(response.suggestions);
              setShowCompanySuggestions(true);
            } else {
              setShowCompanySuggestions(false);
            }
          } catch (error) {
            console.error('Error fetching company suggestions:', error);
            setShowCompanySuggestions(false);
          }
        }, 500); // 500ms delay

        setCompanyInputTimeout(timeout);
      } else {
        setShowCompanySuggestions(false);
      }
    }
    
    // Check if all required info is complete
    const isComplete = updatedInfo.name.trim() !== '' && 
                      updatedInfo.email.trim() !== '' && 
                      validateEmail(updatedInfo.email) &&
                      selectedCategory !== '' &&
                      emailError === '';
    setIsInfoComplete(isComplete);
  };

  const handleCompanySelect = (companyName: string) => {
    const updatedInfo = { ...customerInfo, company: companyName };
    setCustomerInfo(updatedInfo);
    saveCustomerInfo(updatedInfo);
    setShowCompanySuggestions(false);
    
    // Check if all required info is complete
    const isComplete = updatedInfo.name.trim() !== '' && 
                      updatedInfo.email.trim() !== '' && 
                      validateEmail(updatedInfo.email) &&
                      selectedCategory !== '' &&
                      emailError === '';
    setIsInfoComplete(isComplete);
  };

  const handleDismissCompanySuggestions = () => {
    setShowCompanySuggestions(false);
  };

  const createTicketFromFirstMessage = async (firstMessage: string) => {
    try {
      console.log('🎫 Creating ticket with customer info:', customerInfo);
      console.log('🎫 Selected category:', selectedCategory);
      console.log('🎫 First message:', firstMessage);
      
      const ticketData = {
        title: `Support Request from ${customerInfo.name}`,
        description: firstMessage,
        priority: 'medium' as const,
        categoryId: selectedCategory
      };

      const customerData = {
        name: customerInfo.name,
        email: customerInfo.email,
        company: customerInfo.company,
        phone: customerInfo.phone,
        country: customerInfo.country
      };

      console.log('🎫 Ticket data:', ticketData);
      console.log('🎫 Customer data:', customerData);

      const ticket = await apiService.createTicket(ticketData, customerData);
      console.log('🎫 Ticket created successfully:', ticket);
      
      setCurrentTicketId(ticket.id);
      setCurrentTicketNumber(ticket.ticketNumber);
      
      // Show persistent survey after chat initiation
      console.log('🔧 DEBUG: Showing persistent survey, current ticket ID:', ticket.id);
      setShowPersistentSurvey(true);
      
      // Load messages for the newly created ticket
      await loadMessages(ticket.id);
      
      return true;
    } catch (error) {
      console.error('❌ Error creating ticket:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      console.error('❌ Full error:', error);
      return false;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || ticketClosed) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    
    // Reset inactivity timer on message send
    resetInactivityTimer();

    if (!currentTicketId) {
      // This is the first message, create a ticket
      setLoading(true);
      const success = await createTicketFromFirstMessage(messageContent);
      setLoading(false);
      
      if (!success) {
        setNewMessage(messageContent); // Restore message on error
        alert('Failed to start conversation. Please try again.');
      }
    } else {
      // Send message to existing ticket
      try {
        console.log('📤 Sending message to ticket:', currentTicketId);
        
        // Send via API (will also broadcast via Socket.IO)
        const sentMessage = await apiService.sendMessage(currentTicketId, messageContent);
        console.log('📤 Message sent successfully:', sentMessage);
        
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
      }
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFileSelect = async (files: FileList) => {
    if (!currentTicketId || ticketClosed) {
      console.log('❌ Cannot upload: no ticket ID or ticket closed', { currentTicketId, ticketClosed });
      return;
    }

    console.log('📎 Starting file upload for ticket:', currentTicketId);
    const fileArray = Array.from(files);
    setUploadingFiles(fileArray);

    try {
      for (const file of fileArray) {
        console.log('📎 Uploading file:', file.name, 'size:', file.size, 'type:', file.type);
        
        const result = await apiService.uploadFile(currentTicketId, file);
        console.log('📎 File uploaded successfully:', result);

        // Add the file message to local state (if not already added by Socket.IO)
        setMessages(prev => {
          if (prev.find(m => m.id === result.message.id)) {
            return prev;
          }
          return [...prev, result.message];
        });
      }
    } catch (error) {
      console.error('❌ Error uploading files:', error);
      alert(`Failed to upload files: ${error instanceof Error ? error.message : String(error)}. Please try again.`);
    } finally {
      setUploadingFiles([]);
      setShowFileUpload(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string, messageType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (messageType === 'image') {
      return (
        <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    
    switch (extension) {
      case 'pdf':
        return (
          <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'doc':
      case 'docx':
        return (
          <svg className="h-4 w-4 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'xls':
      case 'xlsx':
        return (
          <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0V17m0-10a2 2 0 012-2h2a2 2 0 002-2" />
          </svg>
        );
      case 'zip':
      case 'rar':
      case '7z':
        return (
          <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  // Camera functions for mobile
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera by default
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play();
      }
      setShowCameraCapture(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions or try uploading a file instead.');
    }
  };

  const stopCamera = () => {
    if (cameraVideoRef.current && cameraVideoRef.current.srcObject) {
      const stream = cameraVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      cameraVideoRef.current.srcObject = null;
    }
    setShowCameraCapture(false);
  };

  const capturePhoto = () => {
    if (cameraVideoRef.current && cameraCanvasRef.current) {
      const video = cameraVideoRef.current;
      const canvas = cameraCanvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const file = new File([blob], `photo-${timestamp}.jpg`, { type: 'image/jpeg' });
            const fileList = Object.assign(Object.create(FileList.prototype), {
              0: file,
              length: 1,
              item: (index: number) => index === 0 ? file : null
            }) as FileList;
            
            await handleFileSelect(fileList);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  // Enhanced attachment preview for mobile
  const showAttachmentInPreview = (url: string, type: string, name: string) => {
    setPreviewAttachment({ url, type, name });
    setShowAttachmentPreview(true);
  };

  const closeAttachmentPreview = () => {
    setShowAttachmentPreview(false);
    setPreviewAttachment(null);
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    lastActivityRef.current = new Date();
    
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    
    if (currentTicketId && !ticketClosed && systemSettings) {
      inactivityTimeoutRef.current = setTimeout(() => {
        handleTimeoutClose();
      }, (systemSettings?.chatAbandonmentTimeout || 15) * 60 * 1000); // Convert minutes to milliseconds
    }
  };

  // Handle timeout close
  const handleTimeoutClose = async () => {
    if (!currentTicketId || ticketClosed) return;
    
    try {
      await apiService.closeTicket(currentTicketId);
      setTicketClosed(true);
      setClosedByTimeout(true);
      
      // Leave the ticket room
      if (currentTicketId) {
        socketService.leaveTicket(currentTicketId);
      }
      
      // Clear the timeout
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('❌ Error closing ticket due to timeout:', error);
    }
  };

  // Handle initial close ticket confirmation
  const handleInitialCloseTicket = () => {
    setShowCloseConfirmation(false);
    // Only show resolution feedback popup if survey hasn't been completed
    if (!surveyCompleted) {
      setShowResolutionFeedback(true);
    } else {
      // Survey already completed, close directly
      handleCloseTicket();
    }
  };

  // Handle persistent survey feedback (without closing ticket)
  const handlePersistentSurveyFeedback = async (resolution: 'resolved' | 'not_resolved' | 'partially_resolved') => {
    if (!currentTicketId) {
      console.error('❌ No current ticket ID available for feedback');
      alert('No active ticket found. Please try again.');
      return;
    }

    try {
      console.log('🔧 DEBUG: handlePersistentSurveyFeedback called with:', { resolution, currentTicketId });
      
      // Send feedback to backend without closing ticket
      await apiService.submitTicketFeedback(currentTicketId, resolution);
      console.log('🔧 DEBUG: Feedback submitted successfully');
      
      // Mark survey as completed
      setSurveyCompleted(true);
      
      // Show success message
      console.log('✅ Thank you for your feedback!');
      
    } catch (error) {
      console.error('❌ Error submitting feedback:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        currentTicketId,
        resolution
      });
      alert(`Failed to submit feedback: ${error instanceof Error ? error.message : String(error)}. Please try again.`);
    }
  };

  // Handle resolution feedback and close ticket
  const handleResolutionFeedback = async (resolution: 'resolved' | 'not_resolved' | 'partially_resolved') => {
    console.log('🔧 DEBUG: handleResolutionFeedback called with:', { resolution, currentTicketId, ticketClosed });
    
    if (!currentTicketId || ticketClosed) {
      console.error('🔧 DEBUG: Cannot proceed - no ticket ID or ticket already closed:', { currentTicketId, ticketClosed });
      return;
    }
    
    try {
      console.log('🔧 DEBUG: About to call closeTicketWithFeedback with:', { currentTicketId, resolution });
      await apiService.closeTicketWithFeedback(currentTicketId, resolution);
      console.log('🔧 DEBUG: closeTicketWithFeedback succeeded');
      
      setTicketClosed(true);
      setClosedByTimeout(false);
      setShowResolutionFeedback(false);
      
      // Mark survey as completed since feedback was provided via modal
      setSurveyCompleted(true);
      
      // Leave the ticket room
      if (currentTicketId) {
        socketService.leaveTicket(currentTicketId);
      }
      
      // Clear the timeout
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('❌ Error closing ticket with feedback:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        currentTicketId,
        resolution
      });
      alert('Failed to close ticket. Please try again.');
    }
  };

  // Handle manual close ticket (legacy method for timeout)
  const handleCloseTicket = async () => {
    if (!currentTicketId || ticketClosed) return;
    
    try {
      await apiService.closeTicket(currentTicketId);
      setTicketClosed(true);
      setClosedByTimeout(false);
      setShowCloseConfirmation(false);
      
      // Leave the ticket room
      if (currentTicketId) {
        socketService.leaveTicket(currentTicketId);
      }
      
      // Clear the timeout
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('❌ Error closing ticket:', error);
      alert('Failed to close ticket. Please try again.');
    }
  };

  // Start new conversation
  const handleStartNewConversation = () => {
    setCurrentTicketId(null);
    setCurrentTicketNumber(null);
    setMessages([]);
    setTicketClosed(false);
    setClosedByTimeout(false);
    setNewMessage('');
    
    // Reset survey state
    setShowPersistentSurvey(false);
    setSurveyCompleted(false);
    
    // Clear timeout
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header - Mobile Optimized */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <img 
                src="/neurovirtual-logo.png" 
                alt="NeuroVirtual Logo" 
                className={`object-contain mr-2 sm:mr-4 ${isMobile ? 'h-8 w-8' : 'h-12 w-12'}`}
              />
              <div className="min-w-0">
                <h1 className={`font-bold text-gray-900 dark:text-gray-100 ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                  {isMobile ? 'Support' : 'NeuroVirtual Support'}
                </h1>
                <p className={`text-gray-600 dark:text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  {isMobile ? 'Get help' : 'Get help from our support team'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-4xl mx-auto px-3 sm:px-4 ${isMobile ? 'py-4' : 'py-8'}`}>
        <div className={`bg-white dark:bg-gray-800 ${isMobile ? 'rounded-lg shadow-sm' : 'rounded-lg shadow-sm'} border border-gray-200 dark:border-gray-700`}>
          {/* Customer Info Form */}
          {!currentTicketId && (
            <div className={`${isMobile ? 'p-4' : 'p-6'} border-b border-gray-200 dark:border-gray-700`}>
              <h2 className={`font-medium text-gray-900 dark:text-gray-100 mb-4 ${isMobile ? 'text-base' : 'text-lg'}`}>
                Let's get started
              </h2>
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => handleInfoChange('name', e.target.value)}
                    placeholder="John Doe"
                    className={`w-full px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${isMobile ? 'py-3 text-base' : 'py-2'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => handleInfoChange('email', e.target.value)}
                    placeholder="john@company.com"
                    className={`w-full px-3 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${isMobile ? 'py-3 text-base' : 'py-2'} ${
                      emailError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {emailError && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{emailError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => handleInfoChange('phone', e.target.value)}
                    placeholder="+1-555-0123"
                    className={`w-full px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${isMobile ? 'py-3 text-base' : 'py-2'}`}
                  />
                </div>
                              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={customerInfo.company}
                  onChange={(e) => handleInfoChange('company', e.target.value)}
                  placeholder="Company Inc."
                  className={`w-full px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${isMobile ? 'py-3 text-base' : 'py-2'}`}
                />
                {showCompanySuggestions && (
                  <CompanySuggestion
                    suggestions={companySuggestions}
                    onSelect={handleCompanySelect}
                    onDismiss={handleDismissCompanySuggestions}
                  />
                )}
              </div>
              </div>
              
              <div className={`grid gap-4 mt-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Country *
                  </label>
                  <CountrySelect
                    value={customerInfo.country}
                    onChange={(value) => handleInfoChange('country', value)}
                    placeholder="Select your country..."
                    className="text-sm"
                    required={true}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    What can we help you with? *
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      // Update completeness when category changes
                      const isComplete = customerInfo.name.trim() !== '' && 
                                        customerInfo.email.trim() !== '' && 
                                        customerInfo.country.trim() !== '' &&
                                        validateEmail(customerInfo.email) &&
                                        e.target.value !== '' &&
                                        emailError === '';
                      setIsInfoComplete(isComplete);
                    }}
                    className={`w-full px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${isMobile ? 'py-3 text-base' : 'py-2'}`}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Saved Info Indicator and Clear Button */}
              {(customerInfo.name || customerInfo.email || customerInfo.phone || customerInfo.company || customerInfo.country) && (
                <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-blue-800 dark:text-blue-200">
                      Your information is saved for future visits
                    </span>
                  </div>
                  <button
                    onClick={clearSavedCustomerInfo}
                    type="button"
                    className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                  >
                    Clear Saved Info
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chat Area - Mobile Optimized */}
          <div className="flex flex-col" style={{ height: currentTicketId ? (isMobile ? '70vh' : '800px') : (isMobile ? '50vh' : '600px') }}>
            {/* Ticket Header - Show when ticket is created */}
            {currentTicketId && currentTicketNumber && !ticketClosed && (
              <div className={`${isMobile ? 'px-4 py-2' : 'px-6 py-3'} bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className={`font-medium text-green-800 dark:text-green-200 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                        Ticket Created: #{currentTicketNumber}
                      </p>
                      <p className={`text-green-600 dark:text-green-400 ${isMobile ? 'text-xs hidden' : 'text-xs'}`}>
                        {isMobile ? '' : 'Your conversation has started. Our support team will respond shortly.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCloseConfirmation(true)}
                    className={`font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-md transition-colors ${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-xs'}`}
                  >
                    {isMobile ? 'Close' : 'Close Ticket'}
                  </button>
                </div>
              </div>
            )}

            {/* Ticket Closed Message */}
            {ticketClosed && (
              <div className={`px-6 py-4 border-b ${
                closedByTimeout 
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-start space-x-3">
                  <svg className={`h-6 w-6 mt-0.5 ${
                    closedByTimeout 
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${
                      closedByTimeout 
                        ? 'text-yellow-800 dark:text-yellow-200'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {closedByTimeout 
                        ? 'Conversation Closed Due to Inactivity'
                        : 'Conversation Closed'
                      }
                    </p>
                    <p className={`text-xs mt-1 ${
                      closedByTimeout 
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {closedByTimeout 
                        ? 'This conversation was automatically closed after 5 minutes of inactivity. If you need further assistance, please start a new conversation below.'
                        : 'This conversation has been closed. If you need further assistance, please start a new conversation below.'
                      }
                    </p>
                    <button
                      onClick={handleStartNewConversation}
                      className="mt-3 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
                    >
                      Start New Conversation
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Messages */}
            <div className={`flex-1 overflow-y-auto space-y-4 ${isMobile ? 'p-3' : 'p-6'}`} style={{ minHeight: currentTicketId ? '500px' : 'auto' }}>
              {ticketClosed ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <svg className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-medium">
                      {closedByTimeout ? 'Session Timed Out' : 'Conversation Ended'}
                    </p>
                    <p className="text-sm mt-1">
                      Thank you for contacting our support team.
                    </p>
                  </div>
                </div>
              ) : loadingMessages ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : messages.length === 0 && !currentTicketId ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p>Start a conversation with our support team!</p>
                  <p className="text-sm mt-1">Fill in your details above and type your message below.</p>
                </div>
              ) : (
                <>
                  {messages.map((message) => {
                    // Check if this message is from a customer
                    // Backend sends message.sender with userType field
                    const sender = (message as any).sender;
                    
                    // Determine if this is a customer message based on sender.userType
                    const senderUserType = sender?.userType;
                    
                    // Simple and explicit logic
                    let isAgentMessage = false;
                    let isCustomerMessage = false;
                    let isSystemMessage = false;
                    
                    if (senderUserType === 'system' || message.messageType === 'system') {
                      isSystemMessage = true;
                    } else if (senderUserType === 'agent' || senderUserType === 'ai') {
                      isAgentMessage = true;
                    } else if (senderUserType === 'customer' || !sender) {
                      // Customer messages: either explicitly marked as customer or anonymous (no sender)
                      isCustomerMessage = true;
                    } else {
                      // Fallback for unknown types
                      isCustomerMessage = true;
                    }
                    
                    const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : null;
                    
                    // Enhanced debug logging
                    console.log('🔍 DETAILED Message debug:', {
                      messageId: message.id,
                      content: message.content.substring(0, 30) + '...',
                      // Raw message structure
                      fullMessage: message,
                      // Sender analysis
                      sender: sender,
                      senderExists: !!sender,
                      senderUserType: senderUserType,
                      senderUserTypeType: typeof senderUserType,
                      // Classification results
                      isAgentMessage: isAgentMessage,
                      isCustomerMessage: isCustomerMessage,
                      senderName: senderName,
                      // Logic explanation
                      logicCheck: {
                        'sender?.userType': sender?.userType,
                        'senderUserType === "agent"': senderUserType === 'agent',
                        'senderUserType === "customer"': senderUserType === 'customer',
                        '!sender': !sender,
                        'senderUserType === null': senderUserType === null
                      },
                      finalReasoning: `sender.userType='${senderUserType}' → isAgent=${isAgentMessage} → isCustomer=${isCustomerMessage}`
                    });
                    
                    // Also log the raw JSON to see exactly what we're getting
                    console.log('📄 Raw message JSON:', JSON.stringify(message, null, 2));
                    
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
                              {formatTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isCustomerMessage ? 'justify-end' : 'justify-start'} mb-2`}
                      >
                        <div className={`px-4 py-2 rounded-lg ${isMobile ? 'max-w-[85%]' : 'max-w-xs lg:max-w-md'} ${
                          isCustomerMessage
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : isAgentMessage
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 border border-green-200 dark:border-green-800 rounded-bl-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                        }`}>
                          {/* File message rendering */}
                          {(message.messageType === 'file' || message.messageType === 'image') && message.fileName ? (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                {getFileIcon(message.fileName, message.messageType)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate font-medium">{message.fileName}</p>
                                  {message.fileSize && (
                                    <p className={`text-xs ${
                                      isCustomerMessage 
                                        ? 'text-blue-100' 
                                        : isAgentMessage 
                                        ? 'text-green-700 dark:text-green-300'
                                        : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                      {formatFileSize(message.fileSize)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              {/* Image preview */}
                              {message.messageType === 'image' && message.fileUrl && (
                                <div className="mt-2">
                                  <img 
                                    src={`http://localhost:3001${message.fileUrl}`}
                                    alt={message.fileName}
                                    className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => {
                                      if (isMobile) {
                                        showAttachmentInPreview(`http://localhost:3001${message.fileUrl}`, message.messageType || 'image', message.fileName || 'Image');
                                      } else {
                                        window.open(`http://localhost:3001${message.fileUrl}`, '_blank');
                                      }
                                    }}
                                    onError={(e) => {
                                      console.error('Image load error:', e);
                                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%236b7280">Image</text></svg>';
                                    }}
                                  />
                                </div>
                              )}
                              
                              {/* Download button for files */}
                              {message.fileUrl && (
                                <button
                                  onClick={() => window.open(`http://localhost:3001/api/files/${message.fileUrl?.split('/').pop()}`, '_blank')}
                                  className={`text-xs underline hover:no-underline ${
                                    isCustomerMessage 
                                      ? 'text-blue-100 hover:text-blue-200' 
                                      : isAgentMessage 
                                      ? 'text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200'
                                      : 'text-blue-600 dark:text-blue-400'
                                  }`}
                                >
                                  Download
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm">{message.content}</p>
                          )}
                          
                          <p className={`text-xs mt-1 ${
                            isCustomerMessage 
                              ? 'text-blue-100' 
                              : isAgentMessage 
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {(() => {
                              if (senderName) return senderName;
                              if (isCustomerMessage) return 'You';
                              if (sender?.userType === 'ai') return senderName || 'NeuroAI';
                              if (isAgentMessage) return sender?.userType === 'ai' ? (senderName || 'NeuroAI') : 'Support Agent';
                              return 'Support';
                            })()} • {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input - Mobile Optimized */}
            {!ticketClosed && (
              <div className={`border-t border-gray-200 dark:border-gray-700 ${isMobile ? 'p-3' : 'p-4'}`}>
                {/* File Upload Area */}
                {showFileUpload && (
                  <div className="mb-4">
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      disabled={!isInfoComplete || uploadingFiles.length > 0}
                      multiple={true}
                      className="w-full"
                    />
                    {uploadingFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {uploadingFiles.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-600"></div>
                            <span>Uploading {file.name}...</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <div className={`flex ${isMobile ? 'space-x-1' : 'space-x-2'}`}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder={isInfoComplete ? "Type your message..." : "Please fill in your details above first"}
                    disabled={!isInfoComplete || loading || ticketClosed}
                    className={`flex-1 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800 ${isMobile ? 'py-3 text-base' : 'py-2'}`}
                  />
                  
                  {/* Camera Button - Mobile Only */}
                  {isMobile && (
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={!isInfoComplete || loading || ticketClosed}
                      className={`px-3 py-2 rounded-md transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                      title="Take photo"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                  
                  {/* File Upload Button */}
                  <button
                    type="button"
                    onClick={() => setShowFileUpload(!showFileUpload)}
                    disabled={!isInfoComplete || loading || ticketClosed}
                    className={`rounded-md transition-colors ${isMobile ? 'px-2 py-2' : 'px-3 py-2'} ${
                      showFileUpload 
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Attach files"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  
                  <button
                    type="submit"
                    onClick={handleSendMessage}
                    disabled={!isInfoComplete || !newMessage.trim() || loading || ticketClosed}
                    className={`bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isMobile ? 'px-3 py-2' : 'px-4 py-2'}`}
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Persistent Survey Widget - Under Chat Box */}
            {showPersistentSurvey && !ticketClosed && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {surveyCompleted ? 'Thank you for your feedback!' : 'How are we doing?'}
                    </span>
                  </div>
                  
                  {surveyCompleted && (
                    <button
                      onClick={() => setShowPersistentSurvey(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {!surveyCompleted && (
                  <div className="space-y-2">
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                      Please let us know if your problem has been resolved
                    </p>
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => handlePersistentSurveyFeedback('resolved')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Yes, resolved</span>
                      </button>
                      <button
                        onClick={() => handlePersistentSurveyFeedback('partially_resolved')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Partially resolved</span>
                      </button>
                      <button
                        onClick={() => handlePersistentSurveyFeedback('not_resolved')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Not resolved</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close Confirmation Modal */}
      {showCloseConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.308 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Close Conversation
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to close this conversation? This action cannot be undone. 
              If you need further assistance later, you'll need to start a new conversation.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCloseConfirmation(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInitialCloseTicket}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Close Conversation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolution Feedback Modal */}
      {showResolutionFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Was your problem resolved?
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Before we close this conversation, please let us know if your issue was resolved. This helps us improve our support.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleResolutionFeedback('resolved')}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Yes, my problem was resolved</span>
              </button>
              <button
                onClick={() => handleResolutionFeedback('partially_resolved')}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Partially resolved</span>
              </button>
              <button
                onClick={() => handleResolutionFeedback('not_resolved')}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>No, my problem was not resolved</span>
              </button>
              <button
                onClick={() => setShowResolutionFeedback(false)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal - Mobile Only */}
      {showCameraCapture && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full h-full md:w-auto md:h-auto md:max-w-lg md:max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Take Photo
              </h3>
              <button
                onClick={stopCamera}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="relative">
                <video
                  ref={cameraVideoRef}
                  className="w-full max-w-sm rounded-lg"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={cameraCanvasRef}
                  className="hidden"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-center space-x-4">
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={capturePhoto}
                  className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  Capture
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal - Mobile Optimized */}
      {showAttachmentPreview && previewAttachment && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full h-full md:w-auto md:h-auto md:max-w-4xl md:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                {previewAttachment.name}
              </h3>
              <button
                onClick={closeAttachmentPreview}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-4"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
              {previewAttachment.type.startsWith('image/') ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Cannot preview this file type
                  </p>
                  <button
                    onClick={() => window.open(previewAttachment.url, '_blank')}
                    className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-center space-x-4">
                <button
                  onClick={closeAttachmentPreview}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => window.open(previewAttachment.url, '_blank')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  Open in New Tab
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerChat; 