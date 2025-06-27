import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

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

interface CompanyDetailProps {
  companyId: string;
  onBack: () => void;
  onTicketSelect?: (ticketId: string) => void;
  onCustomerSelect?: (customer: any) => void;
  onDeviceSelect?: (device: any) => void;
}

const CompanyDetail: React.FC<CompanyDetailProps> = ({ companyId, onBack, onTicketSelect, onCustomerSelect, onDeviceSelect }) => {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'customers' | 'devices' | 'tickets' | 'services'>('info');
  const [editing, setEditing] = useState(false);
  const [servicesData, setServicesData] = useState<{
    company: { id: string; name: string };
    devices: any[];
    services: any[];
    totalServices: number;
    totalDevices: number;
  } | null>(null);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    aliases: [''],
    description: '',
    primaryEmail: '',
    primaryPhone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  });

  useEffect(() => {
    loadCompany();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCompany = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getCompany(companyId);
      setCompany(response);
      
      // Initialize edit form
      setEditForm({
        name: response.name || '',
        aliases: response.aliases?.length > 0 ? response.aliases : [''],
        description: response.description || '',
        primaryEmail: response.primaryEmail || '',
        primaryPhone: response.primaryPhone || '',
        website: response.website || '',
        address: response.address || '',
        city: response.city || '',
        state: response.state || '',
        zipCode: response.zipCode || '',
        country: response.country || ''
      });
    } catch (err) {
      console.error('Error loading company:', err);
      setError(err instanceof Error ? err.message : 'Failed to load company');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const updateData = {
        ...editForm,
        aliases: editForm.aliases.filter(alias => alias.trim() !== '')
      };
      
      await apiService.updateCompany(companyId, updateData);
      await loadCompany();
      setEditing(false);
    } catch (err) {
      console.error('Error updating company:', err);
      setError(err instanceof Error ? err.message : 'Failed to update company');
    }
  };

  const addAliasField = () => {
    setEditForm(prev => ({
      ...prev,
      aliases: [...prev.aliases, '']
    }));
  };

  const removeAliasField = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      aliases: prev.aliases.filter((_, i) => i !== index)
    }));
  };

  const updateAlias = (index: number, value: string) => {
    setEditForm(prev => ({
      ...prev,
      aliases: prev.aliases.map((alias, i) => i === index ? value : alias)
    }));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const loadCompanyServices = async () => {
    try {
      setServicesLoading(true);
      const response = await apiService.getCompanyServices(companyId);
      setServicesData(response);
    } catch (err) {
      console.error('Error loading company services:', err);
      setError(err instanceof Error ? err.message : 'Failed to load company services');
    } finally {
      setServicesLoading(false);
    }
  };

  const formatServiceDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getWorkflowStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'on_hold':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    }
  };

  const getTicketStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as any);
    if (tabId === 'services' && !servicesData) {
      loadCompanyServices();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-red-800 dark:text-red-200 font-medium">Error</h3>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Company not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Companies
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{company.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {company.customerCount} customers • {company.ticketCount} tickets • {company.deviceCount} devices
            </p>
          </div>
        </div>
        
        {user?.permissions?.includes('companies.edit') && (
          <div className="flex space-x-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/30"
              >
                Edit Company
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'info', label: 'Company Info' },
            { id: 'customers', label: `Customers (${company.customerCount})` },
            { id: 'devices', label: `Devices (${company.deviceCount})` },
            { id: 'tickets', label: `Tickets (${company.ticketCount})` },
            { id: 'services', label: `Services (${servicesData?.totalServices || '?'})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'info' && (
          <div className="space-y-6">
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Primary Email
                  </label>
                  <input
                    type="email"
                    value={editForm.primaryEmail}
                    onChange={(e) => setEditForm(prev => ({ ...prev, primaryEmail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Aliases
                  </label>
                  {editForm.aliases.map((alias, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        value={alias}
                        onChange={(e) => updateAlias(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                        placeholder="Company alias"
                      />
                      {editForm.aliases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAliasField(index)}
                          className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addAliasField}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                  >
                    + Add another alias
                  </button>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editForm.primaryPhone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, primaryPhone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={editForm.website}
                    onChange={(e) => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State/Province
                  </label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ZIP/Postal Code
                  </label>
                  <input
                    type="text"
                    value={editForm.zipCode}
                    onChange={(e) => setEditForm(prev => ({ ...prev, zipCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={editForm.country}
                    onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Basic Information</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Company Name</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">{company.name}</dd>
                    </div>
                    {company.aliases && company.aliases.length > 0 && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Aliases</dt>
                        <dd className="text-sm text-gray-900 dark:text-gray-100">
                          {company.aliases.join(', ')}
                        </dd>
                      </div>
                    )}
                    {company.description && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
                        <dd className="text-sm text-gray-900 dark:text-gray-100">{company.description}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">{formatDate(company.createdAt)}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Contact Information</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">
                        {company.primaryEmail || 'Not provided'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">
                        {company.primaryPhone || 'Not provided'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Website</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">
                        {company.website ? (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            {company.website}
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">
                        {[company.address, company.city, company.state, company.zipCode, company.country]
                          .filter(Boolean)
                          .join(', ') || 'Not provided'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'customers' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Associated Customers</h3>
            {company.customers && company.customers.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {company.customers.map((customer: any) => (
                    <li key={customer.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {customer.firstName && customer.lastName 
                                ? `${customer.firstName} ${customer.lastName}` 
                                : customer.name || customer.email}
                            </p>
                            {customer.customerType && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                                {customer.customerType}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center space-x-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              📧 {customer.email}
                            </p>
                            {customer.phone && (
                              <>
                                <span className="text-sm text-gray-300 dark:text-gray-600">•</span>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  📞 {customer.phone}
                                </p>
                              </>
                            )}
                            {customer.country && (
                              <>
                                <span className="text-sm text-gray-300 dark:text-gray-600">•</span>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  🌍 {customer.country}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="mt-1 flex items-center space-x-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Joined {formatDate(customer.createdAt)}
                            </p>
                            {customer.lastLogin && (
                              <>
                                <span className="text-sm text-gray-300 dark:text-gray-600">•</span>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Last login: {formatDate(customer.lastLogin)}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => onCustomerSelect && onCustomerSelect(customer)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            View Profile
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No customers associated with this company.</p>
            )}
          </div>
        )}

        {activeTab === 'devices' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Associated Devices</h3>
            {company.devices && company.devices.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {company.devices.map((device: any) => (
                    <li key={device.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {device.model} - {device.serialNumber}
                            </p>
                          </div>
                          <div className="mt-1 flex items-center space-x-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              S/N: {device.serialNumber}
                            </p>
                            {device.warrantyExpires && (
                              <>
                                <span className="text-sm text-gray-300 dark:text-gray-600">•</span>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Warranty: {new Date(device.warrantyExpires) > new Date() ? 'Active' : 'Expired'}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Added {formatDate(device.createdAt)}
                            </p>
                          </div>
                          <button
                            onClick={() => onDeviceSelect && onDeviceSelect(device)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No devices associated with this company.</p>
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Company Tickets</h3>
            {company.tickets && company.tickets.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {company.tickets.map((ticket: any) => (
                    <li key={ticket.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              #{ticket.ticketNumber || ticket.id}
                            </p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              ticket.status === 'open' || ticket.status === 'new' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                              ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                              ticket.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                              ticket.status === 'closed' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' :
                              'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            }`}>
                              {ticket.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {ticket.priority && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                ticket.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                                ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              }`}>
                                {ticket.priority.toUpperCase()} PRIORITY
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 font-medium">
                            {ticket.title || ticket.subject || 'No subject'}
                          </p>
                          <div className="mt-1 flex items-center space-x-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              👤 {ticket.customerName || ticket.customerEmail || 'Unknown Customer'}
                            </p>
                            <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              📅 Created {formatDate(ticket.createdAt)}
                            </p>
                            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
                              <>
                                <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  🔄 Updated {formatDate(ticket.updatedAt)}
                                </p>
                              </>
                            )}
                          </div>
                          {ticket.assignedAgent && (
                            <div className="mt-1">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                👨‍💼 Assigned to: {ticket.assignedAgent}
                              </p>
                            </div>
                          )}
                          {ticket.category && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                                {ticket.category}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {onTicketSelect && (
                            <button
                              onClick={() => onTicketSelect(ticket.id)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Ticket
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No tickets found for this company.</p>
            )}
          </div>
        )}

        {activeTab === 'services' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Company Services</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  All service workflows for devices belonging to this company
                </p>
              </div>
              {servicesData && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {servicesData.totalServices} services across {servicesData.totalDevices} devices
                </div>
              )}
            </div>

            {servicesLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : servicesData && servicesData.services.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Workflow #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Device
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Ticket
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Current Step
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Agent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Started
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {servicesData.services.map((service) => {
                        const currentStep = service.steps?.find((step: any) => step.status === 'in_progress') || 
                                           service.steps?.filter((step: any) => step.status === 'completed').pop() ||
                                           service.steps?.[0];
                        
                        return (
                          <tr key={service.workflowId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                #{service.workflowNumber}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {service.workflowId.substring(0, 8)}...
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">
                                <div className="font-medium">{service.deviceModel}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  S/N: {service.deviceSerialNumber}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">
                                {service.customerName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">
                                <div className="font-medium">#{service.ticketNumber}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-32">
                                  {service.ticketTitle}
                                </div>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTicketStatusColor(service.ticketStatus)}`}>
                                {service.ticketStatus.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkflowStatusColor(service.status)}`}>
                                {service.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">
                                {currentStep ? (
                                  <>
                                    <div className="font-medium">
                                      Step {currentStep.stepOrder}: {currentStep.stepDefinition?.name || 'Unknown Step'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {currentStep.status === 'completed' ? 
                                        `✅ Completed ${formatServiceDate(currentStep.completedAt)}` :
                                        currentStep.status === 'in_progress' ? 
                                        `🔄 In Progress` :
                                        `⏳ ${currentStep.status}`
                                      }
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">No steps</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">
                                {service.assignedAgentName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {formatServiceDate(service.initiatedAt)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : servicesData ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.713-3.714M14 40v-4c0-1.313.253-2.566.713-3.714m0 0A9.971 9.971 0 0122 34c3.292 0 6.16 1.595 7.287 4.286" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No services found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  No service workflows have been created for devices belonging to this company.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDetail;
