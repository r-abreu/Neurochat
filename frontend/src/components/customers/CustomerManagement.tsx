import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import CustomerList from './CustomerList';
import CustomerDetail from './CustomerDetail';

interface Customer {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  customerType: string;
  deviceModels: string[];
  deviceSerialNumbers: string[];
  ticketCount: number;
  lastTicketDate: string | null;
  isRegistered: boolean;
  createdAt: string | null;
}

type ViewType = 'list' | 'detail';

interface CustomerManagementProps {
  onTicketSelect?: (ticketId: string) => void;
}

const CustomerManagement: React.FC<CustomerManagementProps> = ({ onTicketSelect }) => {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Check if user has permission to view customers
  if (!user?.permissions?.includes('customers.view')) {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">Access Denied</h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              You do not have permission to view customer management. Please contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedCustomer(null);
  };

  const handleTicketSelect = (ticketId: string) => {
    if (onTicketSelect) {
      onTicketSelect(ticketId);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'detail':
        if (!selectedCustomer) {
          setCurrentView('list');
          return null;
        }
        return (
          <CustomerDetail
            customerId={selectedCustomer.id}
            onBack={handleBackToList}
            onTicketSelect={handleTicketSelect}
          />
        );
      case 'list':
      default:
        return (
          <CustomerList
            onCustomerSelect={handleCustomerSelect}
          />
        );
    }
  };

  return (
    <div className="h-full">
      {renderContent()}
    </div>
  );
};

export default CustomerManagement; 