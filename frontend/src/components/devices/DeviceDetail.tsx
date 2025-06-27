import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

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
  companyName?: string;
  ticketCount: number;
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

interface DeviceService {
  workflowId: string;
  workflowNumber: string;
  ticketId: string;
  ticketNumber: string;
  ticketTitle: string;
  ticketStatus: string;
  currentStep: number;
  status: string;
  initiatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  initiatedByName: string;
  initiatedByEmail: string;
  stepDetails: Array<{
    stepNumber: number;
    stepName: string;
    status: string;
    completedAt: string | null;
    agentName: string;
  }>;
}

interface DeviceDetailProps {
  device: Device;
  onBack: () => void;
  onTicketSelect: (ticketId: string) => void;
}

const DeviceDetail: React.FC<DeviceDetailProps> = ({ device: initialDevice, onBack, onTicketSelect }) => {
  const { user } = useAuth();
  const [device, setDevice] = useState<Device>(initialDevice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [services, setServices] = useState<DeviceService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    warrantyExpires: device.warrantyExpires || '',
    invoiceNumber: device.invoiceNumber || '',
    invoiceDate: device.invoiceDate || '',
    comments: device.comments || ''
  });

  const canEdit = user?.permissions?.includes('devices.edit');

  const loadDeviceDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const deviceData = await apiService.getDevice(device.id);
      setDevice(deviceData);
    } catch (error: any) {
      console.error('Error loading device details:', error);
      setError(error.message || 'Failed to load device details');
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceServices = async () => {
    try {
      setServicesLoading(true);
      setServicesError(null);
      
      const servicesData = await apiService.getDeviceServices(device.id);
      setServices(servicesData.services);
    } catch (error: any) {
      console.error('Error loading device services:', error);
      setServicesError(error.message || 'Failed to load device services');
    } finally {
      setServicesLoading(false);
    }
  };

  useEffect(() => {
    loadDeviceDetails();
    loadDeviceServices();
  }, [device.id]);

  const handleEdit = () => {
    setEditForm({
      warrantyExpires: device.warrantyExpires || '',
      invoiceNumber: device.invoiceNumber || '',
      invoiceDate: device.invoiceDate || '',
      comments: device.comments || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const updatedDevice = await apiService.updateDevice(device.id, editForm);
      setDevice(updatedDevice);
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating device:', error);
      setError(error.message || 'Failed to update device');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({
      warrantyExpires: device.warrantyExpires || '',
      invoiceNumber: device.invoiceNumber || '',
      invoiceDate: device.invoiceDate || '',
      comments: device.comments || ''
    });
  };

  const getWarrantyStatus = (warrantyExpires: string | null): { status: string; color: string; bgColor: string } => {
    if (!warrantyExpires) return { status: 'No Info', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    
    const now = new Date();
    const warrantyDate = new Date(warrantyExpires);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    if (warrantyDate <= now) {
      return { status: 'Expired', color: 'text-red-700', bgColor: 'bg-red-100' };
    } else if (warrantyDate <= thirtyDaysFromNow) {
      return { status: 'Expiring Soon', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
    } else {
      return { status: 'Active', color: 'text-green-700', bgColor: 'bg-green-100' };
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDatetime = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWorkflowStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
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

  const getStepName = (stepNumber: number): string => {
    const stepNames = {
      1: 'Request Device',
      2: 'Ship Loaner',
      3: 'Inspection',
      4: 'Analysis',
      5: 'Quote & Approval',
      6: 'Repair',
      7: 'Final Approval',
      8: 'Return Device',
      9: 'Post-Service',
      10: 'Return Loaner'
    };
    return stepNames[stepNumber as keyof typeof stepNames] || `Step ${stepNumber}`;
  };

  const warrantyStatus = getWarrantyStatus(device.warrantyExpires);

  if (loading && !isEditing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Devices
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {device.model} - {device.serialNumber}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Device Details and History
            </p>
          </div>
        </div>
        {canEdit && !isEditing && (
          <button
            onClick={handleEdit}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Device
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Information Card */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Device Information</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{device.model}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Serial Number</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">{device.serialNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Warranty Status</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${warrantyStatus.bgColor} ${warrantyStatus.color}`}>
                      {warrantyStatus.status}
                    </span>
                    {device.warrantyExpires && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Expires: {formatDate(device.warrantyExpires)}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Linked Tickets</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {device.ticketCount} tickets
                    </span>
                  </p>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Warranty Expires
                      </label>
                      <input
                        type="date"
                        value={editForm.warrantyExpires}
                        onChange={(e) => setEditForm(prev => ({ ...prev, warrantyExpires: e.target.value }))}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        value={editForm.invoiceNumber}
                        onChange={(e) => setEditForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                        placeholder="Enter invoice number"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      value={editForm.invoiceDate}
                      onChange={(e) => setEditForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                      className="mt-1 block w-full md:w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Comments
                    </label>
                    <textarea
                      value={editForm.comments}
                      onChange={(e) => setEditForm(prev => ({ ...prev, comments: e.target.value }))}
                      rows={3}
                      placeholder="Add any comments or notes about this device"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleCancel}
                      disabled={loading}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Number</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{device.invoiceNumber || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Date</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(device.invoiceDate)}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comments</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{device.comments || 'No comments added'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Information Card */}
        <div>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Customer Information</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{device.customerName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{device.customerEmail}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{device.companyName || 'No Company'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{device.customerCountry || '-'}</p>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Device Added</label>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatDatetime(device.createdAt)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Updated</label>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatDatetime(device.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Tickets */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Linked Tickets ({device.linkedTickets.length})
          </h3>
        </div>
        {device.linkedTickets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ticket #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {device.linkedTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {ticket.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(ticket.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => onTicketSelect(ticket.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                      >
                        View Ticket
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No linked tickets</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This device has no tickets associated with it yet.
            </p>
          </div>
        )}
      </div>

      {/* Device Services */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Device Services ({services.length})
          </h3>
        </div>
        {servicesLoading ? (
          <div className="px-6 py-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Loading services...</h3>
          </div>
        ) : servicesError ? (
          <div className="px-6 py-8 text-center">
            <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{servicesError}</p>
          </div>
        ) : services.length > 0 ? (
                     <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
               <thead className="bg-gray-50 dark:bg-gray-700">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Service #
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Related Ticket
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Service Status
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Current Step
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Initiated By
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Service Date
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                     Actions
                   </th>
                 </tr>
               </thead>
               <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                 {services.map((service) => (
                   <tr key={service.workflowId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                           {service.workflowNumber}
                         </span>
                         <span className="text-xs text-gray-500 dark:text-gray-400">
                           ID: {service.workflowId.substring(0, 8)}...
                         </span>
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                           {service.ticketNumber}
                         </span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                           {service.ticketTitle}
                         </span>
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkflowStatusColor(service.status)}`}>
                         {service.status.replace('_', ' ').toUpperCase()}
                       </span>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                         <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                           Step {service.currentStep}
                         </span>
                         <span className="text-xs text-gray-500 dark:text-gray-400">
                           {getStepName(service.currentStep)}
                         </span>
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                         <span className="text-sm text-gray-900 dark:text-gray-100">
                           {service.initiatedByName}
                         </span>
                         <span className="text-xs text-gray-500 dark:text-gray-400">
                           {service.initiatedByEmail}
                         </span>
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                         <span className="text-sm text-gray-900 dark:text-gray-100">
                           {formatServiceDate(service.initiatedAt)}
                         </span>
                         {service.completedAt && (
                           <span className="text-xs text-green-600 dark:text-green-400">
                             Completed: {formatServiceDate(service.completedAt)}
                           </span>
                         )}
                         {service.cancelledAt && (
                           <span className="text-xs text-red-600 dark:text-red-400">
                             Cancelled: {formatServiceDate(service.cancelledAt)}
                           </span>
                         )}
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                       <div className="flex space-x-2">
                         <button
                           onClick={() => onTicketSelect(service.ticketId)}
                           className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                         >
                           View Ticket
                         </button>
                         {/* Future: Add service workflow view button when available */}
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No services</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This device has no services associated with it yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetail; 