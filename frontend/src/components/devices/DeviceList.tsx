import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import ConfigurableTable, { TableColumn, FilterConfig, ColumnFilter } from '../common/ConfigurableTable';

interface Device {
  id: string;
  customerId: string;
  model: string;
  serialNumber: string;
  warrantyExpires: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  comments: string | null;
  customerName: string;
  customerEmail: string;
  customerCountry: string | null;
  companyName: string;
  ticketCount: number;
  serviceCount: number;
  linkedTickets: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface DeviceListProps {
  onDeviceSelect: (device: Device) => void;
}

const DeviceList: React.FC<DeviceListProps> = ({ onDeviceSelect }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);

  const deviceModels = ['BWIII', 'BWMini', 'Compass', 'Maxxi'];
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active Warranty' },
    { value: 'expired', label: 'Expired Warranty' },
    { value: 'expiring-soon', label: 'Expiring Soon (30 days)' },
    { value: 'no-warranty', label: 'No Warranty Info' }
  ];

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {
        search,
        model: modelFilter,
        status: statusFilter
      };

      const response = await apiService.getDevices(filters);
      
      setDevices(response.devices || response);
    } catch (error: any) {
      console.error('Error loading devices:', error);
      setError(error.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [search, modelFilter, statusFilter]);

  const getWarrantyStatus = (warrantyExpires: string | null): { status: string; color: string } => {
    if (!warrantyExpires) return { status: 'No Info', color: 'text-gray-500' };
    
    const now = new Date();
    const warrantyDate = new Date(warrantyExpires);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    if (warrantyDate <= now) {
      return { status: 'Expired', color: 'text-red-600' };
    } else if (warrantyDate <= thirtyDaysFromNow) {
      return { status: 'Expiring Soon', color: 'text-yellow-600' };
    } else {
      return { status: 'Active', color: 'text-green-600' };
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  // Define table columns
  const columns: TableColumn<Device>[] = [
    {
      id: 'model',
      label: 'Device Model',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: deviceModels.map(model => ({ value: model, label: model })),
      render: (device) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {device.model}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs font-mono">
            {device.serialNumber}
          </div>
        </div>
      ),
    },
    {
      id: 'customerName',
      label: 'Customer',
      width: 200,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (device) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {device.customerName}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs break-all">
            {device.customerEmail}
          </div>
        </div>
      ),
    },
    {
      id: 'companyName',
      label: 'Company',
      width: 180,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (device) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {device.companyName || 'No Company'}
          </div>
        </div>
      ),
    },
    {
      id: 'customerCountry',
      label: 'Country',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      render: (device) => (
        <div className="text-sm">
          <div className="text-gray-900 dark:text-white">
            {device.customerCountry || '-'}
          </div>
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
      render: (device) => (
        <div className="text-sm text-center">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            device.ticketCount > 0 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {device.ticketCount}
          </span>
        </div>
      ),
    },
    {
      id: 'serviceCount',
      label: 'Services',
      width: 100,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'number',
      render: (device) => (
        <div className="text-sm text-center">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            device.serviceCount > 0 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {device.serviceCount}
          </span>
        </div>
      ),
    },
    {
      id: 'warrantyExpires',
      label: 'Warranty Status',
      width: 140,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'active', label: 'Active' },
        { value: 'expired', label: 'Expired' },
        { value: 'expiring-soon', label: 'Expiring Soon' },
        { value: 'no-warranty', label: 'No Info' }
      ],
      render: (device) => {
        const { status, color } = getWarrantyStatus(device.warrantyExpires);
        return (
          <div className="text-sm">
            <div className={`font-medium ${color}`}>
              {status}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">
              {formatDate(device.warrantyExpires)}
            </div>
          </div>
        );
      },
    },
    {
      id: 'invoiceNumber',
      label: 'Invoice',
      width: 130,
      visible: true,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (device) => (
        <div className="text-sm">
          <div className="text-gray-900 dark:text-white font-mono">
            {device.invoiceNumber || '-'}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            {formatDate(device.invoiceDate)}
          </div>
        </div>
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      width: 120,
      visible: false,
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'date',
      render: (device) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {formatDate(device.createdAt)}
        </div>
      ),
    },
  ];

  // Define filters
  const filters: FilterConfig[] = [
    {
      key: 'model',
      label: 'All Models',
      type: 'select',
      value: modelFilter,
      onChange: setModelFilter,
      options: deviceModels.map(model => ({ value: model, label: model })),
    },
    {
      key: 'status',
      label: 'All Statuses',
      type: 'select',
      value: statusFilter,
      onChange: setStatusFilter,
      options: statusOptions.slice(1), // Remove the "All Statuses" option since it's in the label
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
      onClick: onDeviceSelect,
      className: 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300',
    },
  ];

  // Export function
  const handleExport = () => {
    const exportData = devices.map(device => {
      const warranty = getWarrantyStatus(device.warrantyExpires);
      return {
        'Device Model': device.model,
        'Serial Number': device.serialNumber,
        'Customer Name': device.customerName,
        'Customer Email': device.customerEmail,
        'Company Name': device.companyName || 'No Company',
        'Country': device.customerCountry || '-',
        'Ticket Count': device.ticketCount,
        'Service Count': device.serviceCount,
        'Warranty Status': warranty.status,
        'Warranty Expires': formatDate(device.warrantyExpires),
        'Invoice Number': device.invoiceNumber || '-',
        'Invoice Date': formatDate(device.invoiceDate),
        'Comments': device.comments || '-',
        'Added Date': formatDate(device.createdAt),
      };
    });

    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Devices');
    
    const filename = `devices-${new Date().toISOString().split('T')[0]}.xlsx`;
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
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading devices</h3>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={loadDevices}
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
        data={devices}
        columns={columns}
        loading={loading}
        storageKey="devices-table"
        title="Devices"
        searchTerm={search}
        onSearchChange={setSearch}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        onRowClick={onDeviceSelect}
        onExport={handleExport}
        exportFilename="devices"
        emptyState={
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No devices found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {search || columnFilters.length > 0 ? 'Try adjusting your search or filters.' : 'No devices to display.'}
            </p>
          </div>
        }
      />
    </div>
  );
};

export default DeviceList;