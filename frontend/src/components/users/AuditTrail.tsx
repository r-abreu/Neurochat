import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string | null;
  userName: string | null;
  userType: 'customer' | 'agent' | 'system';
  action: string;
  ticketNumber: string | null;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  details: string | null;
  status: 'success' | 'failed' | 'warning';
}

interface AuditResponse {
  logs: AuditLog[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface AuditStats {
  total: number;
  last24h: number;
  last7d: number;
  byUserType: {
    agent: number;
    customer: number;
    system: number;
  };
  byStatus: {
    success: number;
    failed: number;
    warning: number;
  };
  topActions: { action: string; count: number }[];
}

const AuditTrail: React.FC = () => {
  const { token } = useAuth();
  const { isDarkMode } = useTheme();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Search filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUserType, setSelectedUserType] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const fetchAuditLogs = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(searchTerm && { search: searchTerm }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(selectedUserType && { userType: selectedUserType }),
        ...(selectedAction && { action: selectedAction }),
        ...(selectedStatus && { status: selectedStatus }),
      });

      const response = await fetch(`http://localhost:3001/api/audit?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data: AuditResponse = await response.json();
      setLogs(data.logs);
      setCurrentPage(data.pagination.currentPage);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/audit/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit stats');
      }

      const data: AuditStats = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching audit stats:', err);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchAuditStats();
  }, [token]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchAuditLogs(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedUserType('');
    setSelectedAction('');
    setSelectedStatus('');
    setCurrentPage(1);
    fetchAuditLogs(1);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionColor = (action: string) => {
    if (action.includes('login_failed') || action.includes('deleted') || action.includes('access_denied')) {
      return 'text-red-600 bg-red-50';
    }
    if (action.includes('login_success') || action.includes('created')) {
      return 'text-green-600 bg-green-50';
    }
    if (action.includes('updated') || action.includes('claimed')) {
      return 'text-blue-600 bg-blue-50';
    }
    return 'text-gray-600 bg-gray-50';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'agent': return 'text-blue-600 bg-blue-50';
      case 'customer': return 'text-green-600 bg-green-50';
      case 'system': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading && logs.length === 0) {
    return <div className="p-4">Loading audit logs...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Audit Trail</h2>
        <button
          onClick={() => fetchAuditLogs(currentPage)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white border'}`}>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Events</div>
          </div>
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white border'}`}>
            <div className="text-2xl font-bold text-green-600">{stats.last24h}</div>
            <div className="text-sm text-gray-500">Last 24 Hours</div>
          </div>
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white border'}`}>
            <div className="text-2xl font-bold text-yellow-600">{stats.last7d}</div>
            <div className="text-sm text-gray-500">Last 7 Days</div>
          </div>
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white border'}`}>
            <div className="text-2xl font-bold text-red-600">{stats.byStatus.failed}</div>
            <div className="text-sm text-gray-500">Failed Events</div>
          </div>
        </div>
      )}

      {/* Search Filters */}
      <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border'}`}>
        <h3 className="text-lg font-medium mb-4">Search & Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="User, action, ticket..."
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">User Type</label>
            <select
              value={selectedUserType}
              onChange={(e) => setSelectedUserType(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
            >
              <option value="">All Types</option>
              <option value="agent">Agent</option>
              <option value="customer">Customer</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300'
              }`}
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSearch}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Search
            </button>
            <button
              onClick={handleClearFilters}
              className={`px-4 py-2 rounded-lg text-sm border ${
                isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white border'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {logs.map((log) => (
                <tr key={log.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{log.userName || 'Unknown'}</div>
                      <div className={`text-xs px-2 py-1 rounded inline-block ${getUserTypeColor(log.userType)}`}>
                        {log.userType}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.ticketNumber && (
                      <span className="font-mono text-blue-600">{log.ticketNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs">
                    <div className="truncate" title={log.details || ''}>
                      {log.details}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-medium ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  const newPage = currentPage - 1;
                  setCurrentPage(newPage);
                  fetchAuditLogs(newPage);
                }
              }}
              disabled={currentPage === 1}
              className={`px-3 py-2 rounded-lg text-sm ${
                currentPage === 1
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  const newPage = currentPage + 1;
                  setCurrentPage(newPage);
                  fetchAuditLogs(newPage);
                }
              }}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 rounded-lg text-sm ${
                currentPage === totalPages
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditTrail; 