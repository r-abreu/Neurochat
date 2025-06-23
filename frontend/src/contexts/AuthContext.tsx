import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';
import apiService from '../services/api';
import socketService from '../services/socket';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: { user: User; token: string } }
  | { type: 'CLEAR_USER' };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'CLEAR_USER':
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
};

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [sessionTimeout, setSessionTimeout] = React.useState<number>(60); // Default 60 minutes
  const sessionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = React.useRef<Date>(new Date());

  // Load system settings on mount
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/system/settings`);
        if (response.ok) {
          const data = await response.json();
          setSessionTimeout(data.settings?.sessionTimeout || 60);
        }
      } catch (error) {
        console.error('Error loading system settings for session timeout:', error);
      }
    };
    loadSystemSettings();
  }, []);

  const logout = (): void => {
    // Clear timeout first
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    
    // Disconnect socket
    socketService.disconnect();
    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    // Clear state
    dispatch({ type: 'CLEAR_USER' });
  };

  // Reset session timeout on activity
  const resetSessionTimeout = React.useCallback(() => {
    if (!state.isAuthenticated) return;
    
    lastActivityRef.current = new Date();
    
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    
    sessionTimeoutRef.current = setTimeout(() => {
      console.log('Session timeout reached - logging out user');
      logout();
      alert('Your session has expired due to inactivity. Please log in again.');
    }, sessionTimeout * 60 * 1000); // Convert minutes to milliseconds
  }, [state.isAuthenticated, sessionTimeout]);

  // Set up activity listeners
  useEffect(() => {
    if (state.isAuthenticated) {
      const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      const handleActivity = () => {
        resetSessionTimeout();
      };
      
      // Add event listeners
      activityEvents.forEach(event => {
        document.addEventListener(event, handleActivity, true);
      });
      
      // Start initial timeout
      resetSessionTimeout();
      
      return () => {
        // Remove event listeners
        activityEvents.forEach(event => {
          document.removeEventListener(event, handleActivity, true);
        });
        
        // Clear timeout
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
        }
      };
    }
  }, [state.isAuthenticated, resetSessionTimeout]);

  useEffect(() => {
    // Check for existing auth token on app load
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        dispatch({ type: 'SET_USER', payload: { user, token } });
        // Connect socket with existing token
        socketService.connect(token);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    }

    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    console.log('AuthContext: Starting login for', email);
    
    try {
      const { user, token } = await apiService.login(email, password);
      console.log('AuthContext: Login successful, received user:', user);
      console.log('AuthContext: User role:', user.role, 'userType:', user.userType);
      
      dispatch({ type: 'SET_USER', payload: { user, token } });
      console.log('AuthContext: User state updated');
      
      // Connect socket after successful login
      socketService.connect(token);
      console.log('AuthContext: Socket connected');
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { user, token } = await apiService.register(name, email, password);
      dispatch({ type: 'SET_USER', payload: { user, token } });
      // Connect socket after successful registration
      socketService.connect(token);
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const updateUser = (updatedUser: User): void => {
    if (state.token) {
      // Update local storage
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      // Update state
      dispatch({ type: 'SET_USER', payload: { user: updatedUser, token: state.token } });
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 