import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoginForm from './components/auth/LoginForm';
import Dashboard from './components/dashboard/Dashboard';
import CustomerChat from './components/customer/CustomerChat';
import CustomerLogin from './components/customer/CustomerLogin';
import AgentLogin from './components/agent/AgentLogin';
import CustomerManagement from './components/customers/CustomerManagement';
import CustomerDetail from './components/customers/CustomerDetail';
import './App.css';

// Wrapper component for CustomerDetail to handle URL parameters
const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/customers');
  };

  const handleTicketSelect = (ticketId: string) => {
    // Navigate to ticket detail or open ticket in dashboard
    navigate(`/agent?ticket=${ticketId}`);
  };

  if (!id) {
    return <Navigate to="/customers" replace />;
  }

  return (
    <CustomerDetail 
      customerId={id} 
      onBack={handleBack} 
      onTicketSelect={handleTicketSelect} 
    />
  );
};

// Protected Route Component for Agents
const ProtectedAgentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  console.log('ProtectedAgentRoute check:', {
    isLoading,
    isAuthenticated,
    user: user ? {
      id: user.id,
      email: user.email,
      role: user.role,
      userType: user.userType,
      roleName: user.roleName
    } : null
  });
  
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

  // Check if user is authenticated and is an agent
  if (!isAuthenticated || !user || (user.userType !== 'agent' && user.role !== 'agent')) {
    console.log('Redirecting to AgentLogin - not authenticated or not an agent');
    return <AgentLogin />;
  }

  console.log('User is authenticated agent, showing Dashboard');
  return <>{children}</>;
};

// Protected Route Component for Customers
const ProtectedCustomerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  
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

  if (!isAuthenticated || (user?.userType !== 'customer' && user?.role !== 'customer')) {
    return <CustomerLogin />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  return (
    <Routes>
      {/* Agent routes */}
      <Route 
        path="/agent" 
        element={
          <ProtectedAgentRoute>
            <Dashboard />
          </ProtectedAgentRoute>
        } 
      />
      
      {/* Customer management routes for agents */}
      <Route 
        path="/customers" 
        element={
          <ProtectedAgentRoute>
            <CustomerManagement />
          </ProtectedAgentRoute>
        } 
      />
      
      <Route 
        path="/customers/:id" 
        element={
          <ProtectedAgentRoute>
            <CustomerDetailPage />
          </ProtectedAgentRoute>
        } 
      />
      
      {/* Customer login route - shows customer dashboard after login */}
      <Route 
        path="/customer/login" 
        element={<CustomerLogin />}
      />
      
      {/* Protected customer route - for logged in customers */}
      <Route 
        path="/customer/dashboard" 
        element={
          <ProtectedCustomerRoute>
            <CustomerChat />
          </ProtectedCustomerRoute>
        } 
      />
      
      {/* Default route - Customer Chat (always accessible, no login required) */}
      <Route path="/" element={<CustomerChat />} />
      
      {/* Fallback for any other routes - redirect to customer chat */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppContent />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
