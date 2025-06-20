import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface SystemConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  sessionTimeout: number;
  maxLoginAttempts: number;
  enableRegistration: boolean;
  enableFileUpload: boolean;
  defaultUserRole: string;
  systemNotifications: boolean;
  maintenanceMode: boolean;
  organizationName: string;
  supportEmail: string;
  maxTicketsPerUser: number;
}

const SystemSettings: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<SystemConfig>({
    maxFileSize: 10,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png', 'xls', 'xlsx'],
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    enableRegistration: true,
    enableFileUpload: true,
    defaultUserRole: 'Customer',
    systemNotifications: true,
    maintenanceMode: false,
    organizationName: 'NeuroChat Support',
    supportEmail: 'support@neurochat.com',
    maxTicketsPerUser: 10
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isAdmin = user?.roleName === 'Admin';

  useEffect(() => {
    if (isAdmin) {
      loadSystemConfig();
    }
  }, [isAdmin]);

  const loadSystemConfig = async () => {
    try {
      const response = await apiService.getSystemSettings();
      if (response && response.settings) {
        setConfig(response.settings);
      }
    } catch (error) {
      console.log('Using default configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveSystemConfig = async () => {
    setSaving(true);
    try {
      await apiService.updateSystemSettings(config);
      setMessage('System configuration saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to save system configuration.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof SystemConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileTypesChange = (value: string) => {
    const types = value.split(',').map(type => type.trim().toLowerCase()).filter(type => type);
    setConfig(prev => ({
      ...prev,
      allowedFileTypes: types
    }));
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Access Denied
              </h3>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                You do not have permission to access system settings. Only administrators can modify these settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Configure system-wide settings and behavior</p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${message.includes('success') 
          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">General Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={config.organizationName}
                onChange={(e) => handleInputChange('organizationName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Support Email
              </label>
              <input
                type="email"
                value={config.supportEmail}
                onChange={(e) => handleInputChange('supportEmail', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* File Upload Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">File Upload Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="enableFileUpload"
                type="checkbox"
                checked={config.enableFileUpload}
                onChange={(e) => handleInputChange('enableFileUpload', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enableFileUpload" className="ml-2 block text-sm text-gray-900 dark:text-white">
                Enable File Upload
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum File Size (MB)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.maxFileSize}
                onChange={(e) => handleInputChange('maxFileSize', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Allowed File Types (comma-separated)
              </label>
              <input
                type="text"
                value={config.allowedFileTypes.join(', ')}
                onChange={(e) => handleFileTypesChange(e.target.value)}
                placeholder="pdf, doc, docx, txt, jpg, png"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Security Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="480"
                value={config.sessionTimeout}
                onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value) || 60)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Login Attempts
              </label>
              <input
                type="number"
                min="3"
                max="10"
                value={config.maxLoginAttempts}
                onChange={(e) => handleInputChange('maxLoginAttempts', parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* User Settings */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">User Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="enableRegistration"
                type="checkbox"
                checked={config.enableRegistration}
                onChange={(e) => handleInputChange('enableRegistration', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enableRegistration" className="ml-2 block text-sm text-gray-900 dark:text-white">
                Enable User Registration
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default User Role
              </label>
              <select
                value={config.defaultUserRole}
                onChange={(e) => handleInputChange('defaultUserRole', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Customer">Customer</option>
                <option value="Agent">Agent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Tickets Per User
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.maxTicketsPerUser}
                onChange={(e) => handleInputChange('maxTicketsPerUser', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="systemNotifications"
                type="checkbox"
                checked={config.systemNotifications}
                onChange={(e) => handleInputChange('systemNotifications', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="systemNotifications" className="ml-2 block text-sm text-gray-900 dark:text-white">
                Enable System Notifications
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="maintenanceMode"
                type="checkbox"
                checked={config.maintenanceMode}
                onChange={(e) => handleInputChange('maintenanceMode', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="maintenanceMode" className="ml-2 block text-sm text-gray-900 dark:text-white">
                Maintenance Mode
              </label>
            </div>
            {config.maintenanceMode && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Maintenance mode will prevent non-admin users from accessing the system.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSystemConfig}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings; 