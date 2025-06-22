import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

interface CustomerDetailProps {
  customerId: string;
  onBack: () => void;
  onTicketSelect: (ticketId: string) => void;
}

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
  tickets: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    category: { name: string } | string;
    createdAt: string;
    updatedAt: string;
    agent?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    messageCount: number;
    lastMessageAt: string;
  }>;
}

const CustomerDetail: React.FC<CustomerDetailProps> = ({ customerId, onBack, onTicketSelect }) => {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerTypes, setCustomerTypes] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    company: '',
    country: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    customerType: ''
  });

  useEffect(() => {
    loadCustomer();
    loadDropdownOptions();
  }, [customerId]);

  useEffect(() => {
    if (customer && !isEditing) {
      setEditForm({
        name: customer.name || '',
        phone: customer.phone || '',
        company: customer.company || '',
        country: customer.country || '',
        streetAddress: customer.streetAddress || '',
        city: customer.city || '',
        state: customer.state || '',
        zipCode: customer.zipCode || '',
        customerType: customer.customerType || 'Standard'
      });
    }
  }, [customer, isEditing]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      setError(null);
      const customerData = await apiService.getCustomer(customerId);
      setCustomer(customerData);
    } catch (err) {
      console.error('Error loading customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  const loadDropdownOptions = async () => {
    try {
      const dropdownOptions = await apiService.getDropdownOptions();
      const activeCustomerTypes = dropdownOptions.customerTypes.filter(type => type.isActive !== false);
      setCustomerTypes(activeCustomerTypes);
    } catch (error) {
      console.error('Error loading dropdown options:', error);
      setCustomerTypes([
        { id: 'standard', name: 'Standard' },
        { id: 'vip', name: 'VIP' },
        { id: 'distributor', name: 'Distributor' }
      ]);
    }
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = async () => {
    if (!customer) return;

    try {
      setSaving(true);
      const updatedCustomer = await apiService.updateCustomer(customer.id, editForm);
      setCustomer(updatedCustomer);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return 'Invalid Date';
    }
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
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Create device pairs by matching models with serial numbers
  const getDevicePairs = () => {
    const pairs = [];
    const maxLength = Math.max(customer?.deviceModels.length || 0, customer?.deviceSerialNumbers.length || 0);
    
    for (let i = 0; i < maxLength; i++) {
      const model = customer?.deviceModels[i] || 'Unknown Model';
      const serial = customer?.deviceSerialNumbers[i] || 'No Serial';
      pairs.push({ model, serial, display: `${model} | ${serial}` });
    }
    
    return pairs;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Customer not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Customer Details
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Details
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start space-x-6">
          <div className="flex-shrink-0">
            <div className="h-16 w-16 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
              <span className="text-2xl font-medium text-gray-700 dark:text-gray-300">
                {customer.name ? customer.name.charAt(0).toUpperCase() : customer.email.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Personal Information</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          name="name"
                          value={editForm.name}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        customer.name || 'Not provided'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{customer.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          name="phone"
                          value={editForm.phone}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        customer.phone || 'Not provided'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Company</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          name="company"
                          value={editForm.company}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        customer.company || 'Not provided'
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Customer Type</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <select
                          name="customerType"
                          value={editForm.customerType}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {customerTypes.map((type) => (
                            <option key={type.id} value={type.name}>
                              {type.name}
                            </option>
                          ))}
                          {customerTypes.length === 0 && (
                            <>
                              <option value="Standard">Standard</option>
                              <option value="VIP">VIP</option>
                              <option value="Distributor">Distributor</option>
                            </>
                          )}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          customer.customerType === 'VIP' 
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            : customer.customerType === 'Distributor'
                            ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {customer.customerType || 'Standard'}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Address & Contact</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Street Address</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          name="streetAddress"
                          value={editForm.streetAddress}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        customer.streetAddress || 'Not provided'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">City</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          name="city"
                          value={editForm.city}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        customer.city || 'Not provided'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">State</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          name="state"
                          value={editForm.state}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        customer.state || 'Not provided'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ZIP Code</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          name="zipCode"
                          value={editForm.zipCode}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        customer.zipCode || 'Not provided'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          name="country"
                          value={editForm.country}
                          onChange={handleEditFormChange}
                          className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        customer.country || 'Not provided'
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Device Information */}
      {(customer.deviceModels.length > 0 || customer.deviceSerialNumbers.length > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Device Information</h3>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Registered Devices</dt>
            <dd className="text-sm text-gray-900 dark:text-gray-100">
              {getDevicePairs().length > 0 ? (
                <div className="space-y-2">
                  {getDevicePairs().map((device, index) => (
                    <div 
                      key={index} 
                      className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 mr-3 mb-2"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {device.display}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">No devices registered</p>
              )}
            </dd>
          </div>
        </div>
      )}

      {/* Ticket Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Ticket Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customer.ticketCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Tickets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {customer.tickets.filter(t => t.status === 'resolved').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {customer.tickets.filter(t => t.status !== 'resolved').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Open</div>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Customer Tickets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ticket
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {customer.tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {ticket.title}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {typeof ticket.category === 'string' ? ticket.category : ticket.category?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {ticket.agent ? `${ticket.agent.firstName} ${ticket.agent.lastName}` : 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatDate(ticket.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onTicketSelect(ticket.id)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      View Ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {customer.tickets.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No tickets found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                This customer has not submitted any tickets yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetail; 