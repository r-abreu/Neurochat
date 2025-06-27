import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import ConfigurableTable, { TableColumn, FilterConfig, ColumnFilter } from '../common/ConfigurableTable';

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
  serviceCount: number;
  lastTicketDate: string | null;
  customers: any[];
  tickets: any[];
  devices: any[];
}

interface CompanyListProps {
  onCompanySelect: (company: Company) => void;
  onCompanyEdit?: (company: Company) => void;
}

const CompanyList: React.FC<CompanyListProps> = ({ onCompanySelect, onCompanyEdit }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; company: Company | null }>({
    show: false,
    company: null
  });
  const [deleting, setDeleting] = useState(false);

  // Create company form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompany, setNewCompany] = useState({
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

  // Available filter options
  const countries = useMemo(() => {
    const countrySet = new Set(companies.map(c => c.country).filter(Boolean) as string[]);
    return Array.from(countrySet).sort();
  }, [companies]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {
        search: searchTerm || undefined,
        country: countryFilter || undefined,
      };

      const response = await apiService.getCompanies(filters);
      setCompanies(response.companies || response);
    } catch (err) {
      console.error('Error loading companies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [searchTerm, countryFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const handleDeleteCompany = (company: Company) => {
    // Check if user has delete permission
    if (!user?.permissions?.includes('companies.delete')) {
      alert('You do not have permission to delete companies.');
      return;
    }
    setDeleteConfirm({ show: true, company });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.company) return;
    
    try {
      setDeleting(true);
      await apiService.deleteCompany(deleteConfirm.company.id);
      setCompanies(companies.filter(c => c.id !== deleteConfirm.company!.id));
      setDeleteConfirm({ show: false, company: null });
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Failed to delete company. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateCompany = async () => {
    try {
      const companyData = {
        ...newCompany,
        aliases: newCompany.aliases.filter(alias => alias.trim() !== '')
      };
      
      await apiService.createCompany(companyData);
      setShowCreateForm(false);
      setNewCompany({
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
      loadCompanies();
    } catch (error) {
      console.error('Error creating company:', error);
      alert('Failed to create company. Please try again.');
    }
  };

  // Define table columns
  const columns: TableColumn<Company>[] = [
    {
      id: 'name',
      label: 'Company Name',
      width: 250,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (company) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {company.name}
          </div>
          {company.aliases && company.aliases.length > 0 && (
            <div className="text-gray-500 dark:text-gray-400 text-xs">
              AKA: {company.aliases.slice(0, 2).join(', ')}
              {company.aliases.length > 2 && ` +${company.aliases.length - 2} more`}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'primaryEmail',
      label: 'Primary Email',
      width: 200,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (company) => (
        <div className="text-sm text-gray-900 dark:text-white break-all">
          {company.primaryEmail || '-'}
        </div>
      ),
    },
    {
      id: 'primaryPhone',
      label: 'Phone',
      width: 150,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (company) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {company.primaryPhone || '-'}
        </div>
      ),
    },
    {
      id: 'city',
      label: 'City',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (company) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {company.city || '-'}
        </div>
      ),
    },
    {
      id: 'country',
      label: 'Country',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      render: (company) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {company.country || '-'}
        </div>
      ),
    },
    {
      id: 'customerCount',
      label: 'Customers',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'number',
      render: (company) => (
        <div className="text-sm text-center">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            company.customerCount > 0 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {company.customerCount}
          </span>
        </div>
      ),
    },
    {
      id: 'ticketCount',
      label: 'Tickets',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'number',
      render: (company) => (
        <div className="text-sm text-center">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            company.ticketCount > 0 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {company.ticketCount}
          </span>
        </div>
      ),
    },
    {
      id: 'lastTicketDate',
      label: 'Last Ticket',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'date',
      render: (company) => (
        <div className="text-sm">
          <div className="text-gray-900 dark:text-white">
            {formatDate(company.lastTicketDate)}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            {formatRelativeTime(company.lastTicketDate)}
          </div>
        </div>
      ),
    },
    {
      id: 'isActive',
      label: 'Status',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' }
      ],
      render: (company) => (
        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
          company.isActive
            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
        }`}>
          {company.isActive ? 'Active' : 'Inactive'}
        </span>
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
      onClick: onCompanySelect,
      className: 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300',
    },
    ...(onCompanyEdit ? [{
      label: 'Edit Company',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: onCompanyEdit,
      className: 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300',
    }] : []),
    ...(user?.permissions?.includes('companies.delete') ? [{
      label: 'Delete Company',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      onClick: handleDeleteCompany,
      className: 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300',
    }] : []),
  ];

  // Export function
  const handleExport = () => {
    const exportData = companies.map(company => ({
      'Company Name': company.name,
      'Aliases': company.aliases?.join(', ') || 'None',
      'Primary Email': company.primaryEmail || '-',
      'Primary Phone': company.primaryPhone || '-',
      'Website': company.website || '-',
      'Address': [company.address, company.city, company.state, company.zipCode, company.country]
        .filter(Boolean).join(', ') || '-',
      'Customer Count': company.customerCount,
      'Ticket Count': company.ticketCount,
      'Device Count': company.deviceCount,
      'Service Count': company.serviceCount,
      'Last Ticket Date': formatDate(company.lastTicketDate),
      'Status': company.isActive ? 'Active' : 'Inactive',
      'Created Date': formatDate(company.createdAt),
      'Description': company.description || '-',
    }));

    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Companies');
    
    const filename = `companies-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Header actions
  const headerActions = (
    <button
      onClick={() => setShowCreateForm(true)}
      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
    >
      Create Company
    </button>
  );

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
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading companies</h3>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={loadCompanies}
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
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      <ConfigurableTable
        data={companies}
        columns={columns}
        loading={loading}
        storageKey="companies-table"
        title="Companies"
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        onRowClick={onCompanySelect}
        onExport={handleExport}
        exportFilename="companies"
        actions={[
          {
            label: 'Edit',
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            ),
            onClick: (company) => onCompanyEdit?.(company),
            show: () => user?.permissions?.includes('companies.edit') || false,
            className: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
          },
          {
            label: 'Delete',
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ),
            onClick: handleDeleteCompany,
            show: () => user?.permissions?.includes('companies.delete') || false,
            className: 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
          }
        ]}
        headerActions={
          user?.permissions?.includes('companies.create') && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Company
            </button>
          )
        }
        emptyState={
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No companies found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || columnFilters.length > 0 ? 'Try adjusting your search or filters.' : 'Get started by creating a new company.'}
            </p>
          </div>
        }
      />

      {/* Create Company Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-96 max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New Company</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name *</label>
                  <input
                    type="text"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea
                    value={newCompany.description}
                    onChange={(e) => setNewCompany({...newCompany, description: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Primary Email</label>
                    <input
                      type="email"
                      value={newCompany.primaryEmail}
                      onChange={(e) => setNewCompany({...newCompany, primaryEmail: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Primary Phone</label>
                    <input
                      type="tel"
                      value={newCompany.primaryPhone}
                      onChange={(e) => setNewCompany({...newCompany, primaryPhone: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
                  <input
                    type="text"
                    value={newCompany.country}
                    onChange={(e) => setNewCompany({...newCompany, country: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCompany}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={!newCompany.name.trim()}
                >
                  Create Company
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-5">Delete Company</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete "{deleteConfirm.company?.name}"? 
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => setDeleteConfirm({ show: false, company: null })}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyList; 