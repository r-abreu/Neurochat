import React, { useState, useEffect } from 'react';
import { Ticket } from '../../types';
import soundService from '../../services/soundService';
import { apiService } from '../../services/api';

interface UrgencySettings {
  ai_to_yellow_delay: number;
  yellow_to_red_delay: number;
  unassigned_to_yellow: number;
  unassigned_to_red: number;
  assigned_to_yellow: number;
  assigned_to_red: number;
  green_sound_enabled: boolean;
  yellow_sound_enabled: boolean;
  red_sound_enabled: boolean;
  yellow_sound_repeat_interval: number;
  red_sound_repeat_interval: number;
  green_blink_enabled: boolean;
  yellow_blink_enabled: boolean;
  red_blink_enabled: boolean;
  blink_duration_seconds: number;
}

interface UrgencyState {
  level: 'green' | 'yellow' | 'red';
  message: string;
  isAIHandling: boolean;
  customerRequestedHuman: boolean;
  humanRequestTime?: Date;
  timeInCurrentState: number;
}

interface EnhancedUrgencyIndicatorProps {
  ticket: Ticket;
  onUrgencyChange?: (ticketId: string, urgency: string, message: string) => void;
}

const EnhancedUrgencyIndicator: React.FC<EnhancedUrgencyIndicatorProps> = ({ 
  ticket, 
  onUrgencyChange 
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [previousUrgency, setPreviousUrgency] = useState<string | null>(null);
  const [settings, setSettings] = useState<UrgencySettings>({
    ai_to_yellow_delay: 0,
    yellow_to_red_delay: 3,
    unassigned_to_yellow: 1,
    unassigned_to_red: 3,
    assigned_to_yellow: 5,
    assigned_to_red: 10,
    green_sound_enabled: true,
    yellow_sound_enabled: true,
    red_sound_enabled: true,
    yellow_sound_repeat_interval: 2,
    red_sound_repeat_interval: 2,
    green_blink_enabled: true,
    yellow_blink_enabled: true,
    red_blink_enabled: true,
    blink_duration_seconds: 10,
  });
  const [soundTimers, setSoundTimers] = useState<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load system settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiService.getSystemSettings();
        if (response?.settings) {
          setSettings(prev => ({
            ...prev,
            ...response.settings
          }));
        }
      } catch (error) {
        console.warn('Could not load system settings, using defaults');
      }
    };

    loadSettings();
  }, []);

  // Clean up sound timers when component unmounts
  useEffect(() => {
    return () => {
      Object.values(soundTimers).forEach(timer => clearTimeout(timer));
    };
  }, [soundTimers]);

  const getElapsedTime = () => {
    const createdTime = new Date(ticket.createdAt).getTime();
    const elapsed = Math.floor((currentTime - createdTime) / 1000);
    return elapsed;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if customer has requested human agent
  const hasCustomerRequestedHuman = () => {
    if (!ticket.messages) return false;
    
    const customerMessages = ticket.messages.filter(msg => 
      msg.sender?.userType === 'customer'
    );
    
    return customerMessages.some(msg => {
      const content = msg.content.toLowerCase();
      return content.includes('human') || 
             content.includes('person') || 
             content.includes('agent') ||
             content.includes('representative') ||
             content.includes('speak to someone') ||
             content.includes('talk to someone');
    });
  };

  // Detect if AI is currently handling the ticket
  const isAIHandling = () => {
    return ticket.agentId === 'neuro-ai-agent' || 
           (ticket.messages && ticket.messages.some(msg => 
             msg.sender?.userType === 'ai'
           ));
  };

  const calculateUrgencyState = (): UrgencyState => {
    const elapsed = getElapsedTime();
    const elapsedMinutes = Math.floor(elapsed / 60);
    const isAssigned = !!ticket.agentId;
    const isResolved = ticket.status === 'resolved';
    const isInProgress = ticket.status === 'in_progress';
    const aiHandling = isAIHandling();
    const customerRequestedHuman = hasCustomerRequestedHuman();

    // If ticket is resolved - always green
    if (isResolved) {
      return {
        level: 'green',
        message: '✅ Ticket resolved successfully',
        isAIHandling: false,
        customerRequestedHuman: false,
        timeInCurrentState: elapsed
      };
    }

    // Section 1: Assignment-Based Warnings (AI/Unassigned scenarios)
    if (!isAssigned || aiHandling) {
      // 1. AI Handling – Initial (Green)
      if (aiHandling && !customerRequestedHuman) {
        return {
          level: 'green',
          message: 'AI interaction ongoing',
          isAIHandling: true,
          customerRequestedHuman: false,
          timeInCurrentState: elapsed
        };
      }

      // 2. Customer Requests Human (Yellow)
      if (aiHandling && customerRequestedHuman) {
        if (elapsedMinutes <= settings.ai_to_yellow_delay) {
          return {
            level: 'green',
            message: 'Human agent requested - processing',
            isAIHandling: true,
            customerRequestedHuman: true,
            timeInCurrentState: elapsed
          };
        } else if (elapsedMinutes <= (settings.ai_to_yellow_delay + settings.yellow_to_red_delay)) {
          return {
            level: 'yellow',
            message: 'Human Agent requested, claim ticket now',
            isAIHandling: true,
            customerRequestedHuman: true,
            timeInCurrentState: elapsed
          };
        } else {
          // 3. Ignored Human Request > X Min (Red)
          return {
            level: 'red',
            message: 'Urgent! Human agent must take this ticket NOW',
            isAIHandling: true,
            customerRequestedHuman: true,
            timeInCurrentState: elapsed
          };
        }
      }

      // 4. Unassigned Ticket – Not Even AI (Green → Yellow → Red)
      if (!aiHandling && !isAssigned) {
        if (elapsedMinutes <= settings.unassigned_to_yellow) {
          return {
            level: 'green',
            message: 'Customer waiting for an agent',
            isAIHandling: false,
            customerRequestedHuman: false,
            timeInCurrentState: elapsed
          };
        } else if (elapsedMinutes <= settings.unassigned_to_red) {
          return {
            level: 'yellow',
            message: 'Customer waiting >1 min, claim ticket ASAP',
            isAIHandling: false,
            customerRequestedHuman: false,
            timeInCurrentState: elapsed
          };
        } else {
          return {
            level: 'red',
            message: 'Customer waiting too long, claim ticket NOW!',
            isAIHandling: false,
            customerRequestedHuman: false,
            timeInCurrentState: elapsed
          };
        }
      }
    }

    // Section 2: Status-Based Warnings (Assigned to Human Agent)
    if (isAssigned && !aiHandling) {
      if (isInProgress) {
        if (elapsedMinutes <= settings.assigned_to_yellow) {
          return {
            level: 'green',
            message: 'Support in progress (<5 min)',
            isAIHandling: false,
            customerRequestedHuman: false,
            timeInCurrentState: elapsed
          };
        } else if (elapsedMinutes <= settings.assigned_to_red) {
          return {
            level: 'yellow',
            message: 'Support taking longer than expected (>5 min)',
            isAIHandling: false,
            customerRequestedHuman: false,
            timeInCurrentState: elapsed
          };
        } else {
          return {
            level: 'red',
            message: 'Support taking too long — escalate now!',
            isAIHandling: false,
            customerRequestedHuman: false,
            timeInCurrentState: elapsed
          };
        }
      } else {
        // Just assigned, not in progress yet
        if (elapsedMinutes <= settings.assigned_to_yellow) {
          return {
            level: 'green',
            message: 'Assigned to agent - Customer being helped',
            isAIHandling: false,
            customerRequestedHuman: false,
            timeInCurrentState: elapsed
          };
        } else {
          return {
            level: 'yellow',
            message: 'Assigned but not started - Agent should begin work',
            isAIHandling: false,
            customerRequestedHuman: false,
            timeInCurrentState: elapsed
          };
        }
      }
    }

    // Default fallback
    return {
      level: 'green',
      message: 'Normal priority',
      isAIHandling: false,
      customerRequestedHuman: false,
      timeInCurrentState: elapsed
    };
  };

  const playUrgencySound = async (level: 'green' | 'yellow' | 'red') => {
    const soundEnabledMap = {
      green: settings.green_sound_enabled,
      yellow: settings.yellow_sound_enabled,
      red: settings.red_sound_enabled
    };

    if (!soundEnabledMap[level]) return;

    try {
      switch (level) {
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
    } catch (error) {
      console.warn('Error playing urgency sound:', error);
    }
  };

  const setupRepeatingSound = (level: 'yellow' | 'red') => {
    const intervalMap = {
      yellow: settings.yellow_sound_repeat_interval,
      red: settings.red_sound_repeat_interval
    };

    const intervalMinutes = intervalMap[level];
    if (intervalMinutes <= 0) return;

    const timerId = setInterval(() => {
      playUrgencySound(level);
    }, intervalMinutes * 60 * 1000);

    setSoundTimers(prev => ({
      ...prev,
      [ticket.id]: timerId
    }));
  };

  const clearRepeatingSound = () => {
    if (soundTimers[ticket.id]) {
      clearTimeout(soundTimers[ticket.id]);
      setSoundTimers(prev => {
        const { [ticket.id]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const urgencyState = calculateUrgencyState();
  const currentUrgency = urgencyState.level;

  // Handle urgency changes and trigger sounds/blinking
  useEffect(() => {
    if (previousUrgency && previousUrgency !== currentUrgency) {
      // Play sound for urgency change
      playUrgencySound(currentUrgency);

      // Setup repeating sounds for yellow/red
      clearRepeatingSound();
      if (currentUrgency === 'yellow' || currentUrgency === 'red') {
        setupRepeatingSound(currentUrgency);
      }

      // Trigger blinking if enabled
      const blinkEnabledMap = {
        green: settings.green_blink_enabled,
        yellow: settings.yellow_blink_enabled,
        red: settings.red_blink_enabled
      };

      if (blinkEnabledMap[currentUrgency]) {
        onUrgencyChange?.(ticket.id, currentUrgency, urgencyState.message);
      }
    }

    if (previousUrgency !== currentUrgency) {
      setPreviousUrgency(currentUrgency);
    }
  }, [currentUrgency, previousUrgency, ticket.id, settings]);

  const getUrgencyStyle = () => {
    const baseStyle = {
      color: 'white',
      animation: '',
      showCheckmark: false,
      urgency: currentUrgency
    };

    switch (currentUrgency) {
      case 'red':
        return {
          ...baseStyle,
          backgroundColor: 'rgb(239, 68, 68)', // red-500
          animation: 'pulse 1s infinite',
        };
      case 'yellow':
        return {
          ...baseStyle,
          backgroundColor: 'rgb(245, 158, 11)', // yellow-500
        };
      case 'green':
        if (ticket.status === 'resolved') {
          return {
            ...baseStyle,
            backgroundColor: 'rgb(34, 197, 94)', // green-500
            showCheckmark: true,
          };
        }
        return {
          ...baseStyle,
          backgroundColor: 'rgb(34, 197, 94)', // green-500
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: 'rgb(156, 163, 175)', // gray-400
        };
    }
  };

  const urgencyStyle = getUrgencyStyle();
  
  return (
    <div 
      className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-mono font-bold shadow-sm"
      style={urgencyStyle}
      title={`${urgencyState.message} (${currentUrgency.toUpperCase()})`}
    >
      {(urgencyStyle as any).showCheckmark ? (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        formatTime(getElapsedTime())
      )}
    </div>
  );
};

export default EnhancedUrgencyIndicator; 