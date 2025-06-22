import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { generateExportFilename } from '../../utils/excelExport';
import apiService from '../../services/api';
import * as XLSX from 'xlsx';

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

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  width?: string;
}

interface CustomerListPreferences {
  columnVisibility: Record<string, boolean>;
}

const STORAGE_KEY = 'agent-customer-list-preferences';

const CustomerList: React.FC<CustomerListProps> = ({ onCustomerSelect, onCustomerEdit }) => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; customer: Customer | null }>({
    show: false,
    customer: null
  });
  const [deleting, setDeleting] = useState(false);

  // Create default column configuration
  const createDefaultColumns = (): ColumnConfig[] => [
    { key: 'name', label: 'Name', visible: true, sortable: true, width: '200px' },
    { key: 'email', label: 'Email', visible: true, sortable: true, width: '250px' },
    { key: 'phone', label: 'Phone', visible: true, sortable: false, width: '150px' },
    { key: 'company', label: 'Company', visible: true, sortable: true, width: '200px' },
    { key: 'country', label: 'Country', visible: true, sortable: true, width: '120px' },
    { key: 'city', label: 'City', visible: false, sortable: true, width: '120px' },
    { key: 'state', label: 'State', visible: false, sortable: true, width: '100px' },
    { key: 'customerType', label: 'Type', visible: true, sortable: true, width: '120px' },
    { key: 'deviceModels', label: 'Devices', visible: true, sortable: false, width: '200px' },
    { key: 'ticketCount', label: 'Tickets', visible: true, sortable: true, width: '100px' },
    { key: 'lastTicketDate', label: 'Last Ticket', visible: true, sortable: true, width: '130px' },
    { key: 'isRegistered', label: 'Status', visible: true, sortable: true, width: '100px' },
    { key: 'createdAt', label: 'Created', visible: false, sortable: true, width: '130px' },
    { key: 'actions', label: 'Actions', visible: true, sortable: false, width: '150px' }
  ];

  // Load preferences from localStorage
  const loadPreferences = (): CustomerListPreferences => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading customer list preferences:', error);
    }
    return {
      columnVisibility: {},
    };
  };

  // Save preferences to localStorage
  const savePreferences = (preferences: CustomerListPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving customer list preferences:', error);
    }
  };

  // Initialize preferences and columns
  const [preferences, setPreferences] = useState<CustomerListPreferences>(loadPreferences);
  
  // Apply preferences to columns
  const columns = useMemo(() => {
    const defaultColumns = createDefaultColumns();
    return defaultColumns.map(col => ({
      ...col,
      visible: preferences.columnVisibility[col.key] !== undefined 
        ? preferences.columnVisibility[col.key] 
        : col.visible
    }));
  }, [preferences]);

  // Available filter options
  const countries = useMemo(() => {
    const countrySet = new Set(customers.map(c => c.country).filter(Boolean));
    return Array.from(countrySet).sort();
  }, [customers]);

  const customerTypes = useMemo(() => {
    const typeSet = new Set(customers.map(c => c.customerType).filter(Boolean));
    return Array.from(typeSet).sort();
  }, [customers]);

  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {
        search: searchTerm || undefined,
        country: countryFilter || undefined,
        customerType: customerTypeFilter || undefined,
        sortBy,
        sortOrder,
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
  }, [searchTerm, countryFilter, customerTypeFilter, sortBy, sortOrder]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleColumnToggle = (columnKey: string) => {
    const newPreferences = {
      ...preferences,
      columnVisibility: {
        ...preferences.columnVisibility,
        [columnKey]: !(preferences.columnVisibility[columnKey] ?? 
          createDefaultColumns().find(col => col.key === columnKey)?.visible ?? true)
      }
    };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const resetColumnsToDefault = () => {
    const defaultPreferences = {
      columnVisibility: {},
    };
    setPreferences(defaultPreferences);
    savePreferences(defaultPreferences);
  };

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

  const handleExportToCSV = () => {
    try {
      // Create CSV data with all visible columns
      const csvData = customers.map(customer => {
        const row: any = {};
        
        visibleColumns.forEach(col => {
          switch (col.key) {
            case 'name':
              row['Customer Name'] = customer.name || 'Unknown';
              break;
            case 'email':
              row['Email'] = customer.email;
              break;
            case 'phone':
              row['Phone'] = customer.phone || '';
              break;
            case 'company':
              row['Company'] = customer.company || '';
              break;
            case 'country':
              row['Country'] = customer.country || '';
              break;
            case 'city':
              row['City'] = customer.city || '';
              break;
            case 'state':
              row['State'] = customer.state || '';
              break;
            case 'customerType':
              row['Customer Type'] = customer.customerType || 'Standard';
              break;
            case 'deviceModels':
              row['Device Models'] = customer.deviceModels.join(', ');
              row['Device Serial Numbers'] = customer.deviceSerialNumbers.join(', ');
              break;
            case 'ticketCount':
              row['Total Tickets'] = customer.ticketCount;
              break;
            case 'lastTicketDate':
              row['Last Ticket Date'] = customer.lastTicketDate ? formatDate(customer.lastTicketDate) : 'Never';
              break;
            case 'isRegistered':
              row['Account Status'] = customer.isRegistered ? 'Registered' : 'Anonymous';
              break;
            case 'createdAt':
              row['Account Created'] = customer.createdAt ? formatDate(customer.createdAt) : 'N/A';
              break;
          }
        });
        
        return row;
      });

      // Generate filename with current filters
      const filename = generateExportFilename({
        searchTerm,
        statusFilter: countryFilter,
        priorityFilter: customerTypeFilter,
        currentView: 'customers'
      }).replace('.xlsx', '.csv');

      // Create CSV content
      if (csvData.length === 0) {
        alert('No data to export');
        return;
      }

      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma or quote
            const stringValue = String(value || '');
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
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

  const renderCellContent = (customer: Customer, columnKey: string) => {
    switch (columnKey) {
      case 'name':
        return (
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {customer.name ? customer.name.charAt(0).toUpperCase() : customer.email.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {customer.name || 'Unknown'}
              </div>
            </div>
          </div>
        );
      
      case 'email':
        return (
          <div>
            <div className="text-sm text-gray-900 dark:text-gray-100">{customer.email}</div>
          </div>
        );
      
      case 'phone':
        return <span className="text-sm text-gray-900 dark:text-gray-100">{customer.phone || '-'}</span>;
      
      case 'company':
        return customer.company ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            {customer.company}
          </span>
        ) : <span className="text-gray-400">-</span>;
      
      case 'country':
        return <span className="text-sm text-gray-900 dark:text-gray-100">{customer.country || '-'}</span>;
      
      case 'city':
        return <span className="text-sm text-gray-900 dark:text-gray-100">{customer.city || '-'}</span>;
      
      case 'state':
        return <span className="text-sm text-gray-900 dark:text-gray-100">{customer.state || '-'}</span>;
      
      case 'customerType':
        return customer.customerType ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            customer.customerType === 'VIP' 
              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
              : customer.customerType === 'Distributor'
              ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
          }`}>
            {customer.customerType}
          </span>
        ) : <span className="text-gray-400">Standard</span>;
      
      case 'deviceModels':
        return customer.deviceModels.length > 0 ? (
          <div className="space-y-1">
            {customer.deviceModels.slice(0, 2).map((model, index) => {
              const serial = customer.deviceSerialNumbers[index] || 'No Serial';
              return (
                <div key={index} className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                  {model} | {serial}
                </div>
              );
            })}
            {customer.deviceModels.length > 2 && (
              <div className="text-xs text-gray-500">+{customer.deviceModels.length - 2} more</div>
            )}
          </div>
        ) : <span className="text-gray-400">None</span>;
      
      case 'ticketCount':
        return <span className="font-medium text-sm">{customer.ticketCount}</span>;
      
      case 'lastTicketDate':
        return (
          <div>
            <div className="text-sm text-gray-900 dark:text-gray-100">{formatDate(customer.lastTicketDate)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(customer.lastTicketDate)}
            </div>
          </div>
        );
      
      case 'isRegistered':
        return customer.isRegistered ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            Registered
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            Anonymous
          </span>
        );
      
      case 'createdAt':
        return <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(customer.createdAt)}</span>;
      
      case 'actions':
        return (
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCustomerSelect(customer);
              }}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm"
              title="View Details"
            >
              View
            </button>
            {onCustomerEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCustomerEdit(customer);
                }}
                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 text-sm"
                title="Edit Customer"
              >
                Edit
              </button>
            )}
            {user?.roleName === 'Admin' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCustomer(customer);
                }}
                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 text-sm"
                title="Delete Customer"
              >
                Delete
              </button>
            )}
          </div>
        );
      
      default:
        return null;
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Management</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowColumnConfig(!showColumnConfig)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Columns ({visibleColumns.filter(col => col.key !== 'actions').length}/{columns.filter(col => col.key !== 'actions').length})</span>
          </button>
          <button
            onClick={handleExportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Export Success Message */}
      {showExportSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-green-800 dark:text-green-200">Customer data exported successfully!</p>
          </div>
        </div>
      )}

      {/* Column Configuration Panel */}
      {showColumnConfig && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Configure Columns</h3>
            <button
              onClick={resetColumnsToDefault}
              className="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded"
            >
              Reset to Default
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {columns.filter(col => col.key !== 'actions').map((column) => (
              <label key={column.key} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => handleColumnToggle(column.key)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Countries</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Customer Type</label>
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Types</option>
              {customerTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setCountryFilter('');
                setCustomerTypeFilter('');
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''
                    }`}
                    style={{ width: column.width }}
                    onClick={() => column.sortable ? handleSort(column.key) : undefined}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {column.sortable && sortBy === column.key && (
                        <span className="text-blue-500">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => onCustomerSelect(customer)}
                >
                  {visibleColumns.map((column) => (
                    <td key={column.key} className="px-4 py-4 whitespace-nowrap">
                      {renderCellContent(customer, column.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {customers.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No customers found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm || countryFilter || customerTypeFilter
                  ? 'Try adjusting your search criteria.'
                  : 'No customers have submitted tickets yet.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Results Summary */}
      {customers.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {customers.length} customer{customers.length !== 1 ? 's' : ''} • {visibleColumns.filter(col => col.key !== 'actions').length} of {columns.filter(col => col.key !== 'actions').length} columns visible
        </div>
      )}

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
    </div>
  );
};

export default CustomerList; 