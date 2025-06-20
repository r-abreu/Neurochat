import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginForm from './components/auth/LoginForm';
import Dashboard from './components/dashboard/Dashboard';
import CustomerChat from './components/customer/CustomerChat';
import CustomerLogin from './components/customer/CustomerLogin';
import AgentLogin from './components/agent/AgentLogin';
import './App.css';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const path = window.location.pathname;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Route handling
  if (path === '/agent') {
    // Check if user is authenticated and is an agent
    if (!isAuthenticated || (user?.userType !== 'agent' && user?.role !== 'agent')) {
      return <AgentLogin />;
    }
    return <Dashboard />;
  }

  if (path === '/customer/login') {
    if (!isAuthenticated || (user?.userType !== 'customer' && user?.role !== 'customer')) {
      return <CustomerLogin />;
    }
    return <Dashboard />;
  }

  // Default route - Customer Chat (always accessible, no login required)
  if (path === '/' || path === '') {
    return <CustomerChat />;
  }

  // Fallback for any other routes
  return <CustomerChat />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
          <AppContent />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
