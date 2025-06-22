import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import ConfigurableTable, { TableColumn, FilterConfig } from '../common/ConfigurableTable';

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

interface CustomerListProps {
  onCustomerSelect: (customer: Customer) => void;
  onCustomerEdit?: (customer: Customer) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ onCustomerSelect, onCustomerEdit }) => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('');

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; customer: Customer | null }>({
    show: false,
    customer: null
  });
  const [deleting, setDeleting] = useState(false);

  // Available filter options
  const countries = useMemo(() => {
    const countrySet = new Set(customers.map(c => c.country).filter(Boolean));
    return Array.from(countrySet).sort();
  }, [customers]);

  const customerTypes = useMemo(() => {
    const typeSet = new Set(customers.map(c => c.customerType).filter(Boolean));
    return Array.from(typeSet).sort();
  }, [customers]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {
        search: searchTerm || undefined,
        country: countryFilter || undefined,
        customerType: customerTypeFilter || undefined,
      };

      const customerData = await apiService.getCustomers(filters);
      setCustomers(customerData);
    } catch (err) {
      console.error('Error loading customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [searchTerm, countryFilter, customerTypeFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
      }
    } catch {
      return 'Invalid Date';
    }
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setDeleteConfirm({ show: true, customer });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.customer) return;
    
    try {
      setDeleting(true);
      await apiService.deleteCustomer(deleteConfirm.customer.id);
      
      // Refresh the customer list
      await loadCustomers();
      
      setDeleteConfirm({ show: false, customer: null });
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      alert(error.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  // Define table columns
  const columns: TableColumn<Customer>[] = [
    {
      id: 'name',
      label: 'Name',
      width: 200,
      visible: true,
      resizable: true,
      sortable: true,
      render: (customer) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {customer.name ? customer.name.charAt(0).toUpperCase() : customer.email.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {customer.name || 'Unknown'}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      width: 250,
      visible: true,
      resizable: true,
      sortable: true,
      render: (customer) => (
        <div className="text-sm text-gray-900 dark:text-white break-all">
          {customer.email}
        </div>
      ),
    },
    {
      id: 'phone',
      label: 'Phone',
      width: 150,
      visible: true,
      resizable: true,
      sortable: false,
      render: (customer) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {customer.phone || '-'}
        </div>
      ),
    },
    {
      id: 'company',
      label: 'Company',
      width: 200,
      visible: true,
      resizable: true,
      sortable: true,
      render: (customer) => (
        customer.company ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            {customer.company}
          </span>
        ) : <span className="text-gray-400">-</span>
      ),
    },
    {
      id: 'country',
      label: 'Country',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      render: (customer) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {customer.country || '-'}
        </div>
      ),
    },
    {
      id: 'city',
      label: 'City',
      width: 120,
      visible: false,
      resizable: true,
      sortable: true,
      render: (customer) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {customer.city || '-'}
        </div>
      ),
    },
    {
      id: 'state',
      label: 'State',
      width: 100,
      visible: false,
      resizable: true,
      sortable: true,
      render: (customer) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {customer.state || '-'}
        </div>
      ),
    },
    {
      id: 'customerType',
      label: 'Type',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      render: (customer) => (
        customer.customerType ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            customer.customerType === 'VIP' 
              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
              : customer.customerType === 'Distributor'
              ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
          }`}>
            {customer.customerType}
          </span>
        ) : <span className="text-gray-400">Standard</span>
      ),
    },
    {
      id: 'deviceModels',
      label: 'Devices',
      width: 200,
      visible: true,
      resizable: true,
      sortable: false,
      render: (customer) => {
        const deviceModels = customer.deviceModels || [];
        const deviceSerialNumbers = customer.deviceSerialNumbers || [];
        
        return deviceModels.length > 0 ? (
          <div className="space-y-1">
            {deviceModels.slice(0, 2).map((model, index) => {
              const serial = deviceSerialNumbers[index] || 'No Serial';
              return (
                <div key={index} className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                  {model} | {serial}
                </div>
              );
            })}
            {deviceModels.length > 2 && (
              <div className="text-xs text-gray-500">+{deviceModels.length - 2} more</div>
            )}
          </div>
        ) : <span className="text-gray-400">None</span>;
      },
    },
    {
      id: 'ticketCount',
      label: 'Tickets',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      render: (customer) => (
        <div className="text-center">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            customer.ticketCount > 0 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {customer.ticketCount}
          </span>
        </div>
      ),
    },
    {
      id: 'lastTicketDate',
      label: 'Last Ticket',
      width: 130,
      visible: true,
      resizable: true,
      sortable: true,
      render: (customer) => (
        <div className="text-sm">
          <div className="text-gray-900 dark:text-white">
            {formatDate(customer.lastTicketDate)}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            {formatRelativeTime(customer.lastTicketDate)}
          </div>
        </div>
      ),
    },
    {
      id: 'isRegistered',
      label: 'Status',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      render: (customer) => (
        customer.isRegistered ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            Registered
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            Anonymous
          </span>
        )
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      width: 130,
      visible: false,
      resizable: true,
      sortable: true,
      render: (customer) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {formatDate(customer.createdAt)}
        </div>
      ),
    },
  ];

  // Define filters
  const filters: FilterConfig[] = [
    {
      key: 'country',
      label: 'All Countries',
      type: 'select',
      value: countryFilter,
      onChange: setCountryFilter,
      options: countries.map(country => ({ value: country, label: country })),
    },
    {
      key: 'customerType',
      label: 'All Types',
      type: 'select',
      value: customerTypeFilter,
      onChange: setCustomerTypeFilter,
      options: customerTypes.map(type => ({ value: type, label: type })),
    },
  ];

  // Define actions
  const actions = [
    {
      label: 'View Details',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      onClick: onCustomerSelect,
      className: 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300',
    },
    ...(onCustomerEdit ? [{
      label: 'Edit Customer',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: onCustomerEdit,
      className: 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300',
    }] : []),
    ...(user?.roleName === 'Admin' ? [{
      label: 'Delete Customer',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      onClick: handleDeleteCustomer,
      className: 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300',
    }] : []),
  ];

  // Export function
  const handleExport = () => {
    const exportData = customers.map(customer => ({
      'Name': `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || customer.email,
      'Email': customer.email,
      'Phone': customer.phone || '-',
      'Company': customer.company || '-',
      'Country': customer.country || '-',
      'City': customer.city || '-',
      'State': customer.state || '-',
      'Customer Type': customer.customerType || 'Standard',
      'Device Models': (customer.deviceModels || []).join(', ') || 'None',
      'Device Serial Numbers': (customer.deviceSerialNumbers || []).join(', ') || 'None',
      'Ticket Count': customer.ticketCount || 0,
      'Last Ticket Date': formatDate(customer.lastTicketDate),
      'Status': customer.isRegistered ? 'Registered' : 'Anonymous',
      'Created Date': formatDate(customer.createdAt),
    }));

    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    
    const filename = `customers-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading customers</h3>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={loadCustomers}
              className="mt-2 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 px-3 py-1 rounded text-sm text-red-800 dark:text-red-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfigurableTable
        data={customers}
        columns={columns}
        loading={loading}
        storageKey="agent-customer-list-preferences"
        title={`Customers (${customers.length})`}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filters}
        onRowClick={onCustomerSelect}
        onExport={handleExport}
        exportFilename="customers-list.xlsx"
        actions={actions}
        emptyState={
          <div className="text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No customers found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || countryFilter || customerTypeFilter
                ? 'Try adjusting your search criteria or filters.' 
                : 'Get started by creating your first customer.'
              }
            </p>
          </div>
        }
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.customer && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <svg className="w-16 h-16 text-red-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mt-4">Delete Customer</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete <strong>{deleteConfirm.customer.name || deleteConfirm.customer.email}</strong>? 
                  This will permanently remove the customer and all associated data.
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => setDeleteConfirm({ show: false, customer: null })}
                  disabled={deleting}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerList; 