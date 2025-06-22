import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import CompanyList from './CompanyList';
import CompanyDetail from './CompanyDetail';

interface Company {
  id: string;
  name: string;
  aliases: string[];
  description: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  customerCount: number;
  ticketCount: number;
  deviceCount: number;
  lastTicketDate: string | null;
  customers: any[];
  tickets: any[];
  devices: any[];
}

interface CompanyManagementProps {
  onTicketSelect?: (ticketId: string) => void;
  onCustomerSelect?: (customer: any) => void;
  onDeviceSelect?: (device: any) => void;
}

type ViewType = 'list' | 'detail' | 'customer-detail' | 'device-detail';

const CompanyManagement: React.FC<CompanyManagementProps> = ({ onTicketSelect, onCustomerSelect, onDeviceSelect }) => {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);

  // Check if user has permission to view companies
  if (!user?.permissions?.includes('companies.view')) {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">Access Denied</h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              You do not have permission to view company management. Please contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedCompany(null);
  };

  const handleTicketSelect = (ticketId: string) => {
    if (onTicketSelect) {
      onTicketSelect(ticketId);
    }
  };

  const handleCustomerSelect = (customer: any) => {
    if (onCustomerSelect) {
      onCustomerSelect(customer);
    }
  };

  const handleDeviceSelect = (device: any) => {
    if (onDeviceSelect) {
      onDeviceSelect(device);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'detail':
        if (!selectedCompany) {
          setCurrentView('list');
          return null;
        }
        return (
          <CompanyDetail
            companyId={selectedCompany.id}
            onBack={handleBackToList}
            onTicketSelect={handleTicketSelect}
            onCustomerSelect={handleCustomerSelect}
            onDeviceSelect={handleDeviceSelect}
          />
        );
      case 'list':
      default:
        return (
          <CompanyList
            onCompanySelect={handleCompanySelect}
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

export default CompanyManagement; 