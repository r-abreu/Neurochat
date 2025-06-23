import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import DropdownOptionsManager from './DropdownOptionsManager';

interface SystemConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  sessionTimeout: number;
  maxLoginAttempts: number;
  enableFileUpload: boolean;
  systemNotifications: boolean;
  maintenanceMode: boolean;
  // Chat-related settings
  chatAbandonmentTimeout: number; // in minutes
  
  // Enhanced Ticket Timing Rules
  ai_to_yellow_delay: number; // Time (min) after human request before yellow
  yellow_to_red_delay: number; // Time (min) in yellow before turning red
  unassigned_to_yellow: number; // Time before ticket with no AI or agent turns yellow
  unassigned_to_red: number; // Time before yellow unassigned ticket turns red
  assigned_to_yellow: number; // Assigned ticket delay before yellow
  assigned_to_red: number; // Assigned ticket delay before red
  
  // Sound + Blink Configuration
  green_sound_enabled: boolean; // Sound when turning green
  yellow_sound_enabled: boolean; // Sound when turning yellow
  red_sound_enabled: boolean; // Sound when turning red
  yellow_sound_repeat_interval: number; // Time between yellow alert sounds (minutes)
  red_sound_repeat_interval: number; // Time between red alert sounds (minutes)
  green_blink_enabled: boolean; // Blink row when turning green
  yellow_blink_enabled: boolean; // Blink row when turning yellow
  red_blink_enabled: boolean; // Blink row when turning red
  blink_duration_seconds: number; // Length of blinking transition animation
}

const SystemSettings: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<SystemConfig>({
    maxFileSize: 10,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png', 'xls', 'xlsx'],
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    enableFileUpload: true,
    systemNotifications: true,
    maintenanceMode: false,
    // New timing defaults
    chatAbandonmentTimeout: 15,
    // Enhanced Ticket Timing Rules
    ai_to_yellow_delay: 0,
    yellow_to_red_delay: 3,
    unassigned_to_yellow: 1,
    unassigned_to_red: 3,
    assigned_to_yellow: 5,
    assigned_to_red: 10,
    // Sound + Blink Configuration
    green_sound_enabled: true,
    yellow_sound_enabled: true,
    red_sound_enabled: true,
    yellow_sound_repeat_interval: 2,
    red_sound_repeat_interval: 2,
    green_blink_enabled: true,
    yellow_blink_enabled: true,
    red_blink_enabled: true,
    blink_duration_seconds: 10
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const hasSystemSettingsPermission = user?.permissions?.includes('system.settings');

  useEffect(() => {
    if (hasSystemSettingsPermission) {
      loadSystemConfig();
    }
  }, [hasSystemSettingsPermission]);

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

  const validatePositiveInteger = (value: string, min: number = 1): number => {
    const parsed = parseInt(value) || min;
    return Math.max(parsed, min);
  };

  if (!hasSystemSettingsPermission) {
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
                You do not have permission to access system settings. Please contact your administrator for the required permissions.
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


        {/* Chat Configuration */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Chat Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Chat Abandonment Timeout
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  (Time in minutes after which an inactive chat is considered abandoned)
                </span>
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={config.chatAbandonmentTimeout}
                onChange={(e) => handleInputChange('chatAbandonmentTimeout', validatePositiveInteger(e.target.value, 1))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="15"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Default: 15 minutes
              </p>
            </div>
          </div>
        </div>



        {/* Ticket Timing Rules - Comprehensive Urgency System */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            🎯 Ticket Timing Rules - Urgency System
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Configure color, sound, and blink notifications for dynamic ticket urgency management
          </p>
          
          {/* Duration Configuration */}
          <div className="mb-8">
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="mr-2">⏱️</span> Duration Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  AI to Yellow Delay
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                    Time (min) after human request before yellow
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={config.ai_to_yellow_delay}
                  onChange={(e) => handleInputChange('ai_to_yellow_delay', validatePositiveInteger(e.target.value, 0))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 0 min</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Yellow to Red Delay
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                    Time (min) in yellow before turning red
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.yellow_to_red_delay}
                  onChange={(e) => handleInputChange('yellow_to_red_delay', validatePositiveInteger(e.target.value, 1))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="3"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 3 min</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Unassigned to Yellow
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                    Time before ticket with no AI/agent turns yellow
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.unassigned_to_yellow}
                  onChange={(e) => handleInputChange('unassigned_to_yellow', validatePositiveInteger(e.target.value, 1))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 1 min</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Unassigned to Red
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                    Time before yellow unassigned ticket turns red
                  </span>
                </label>
                <input
                  type="number"
                  min="2"
                  max="60"
                  value={config.unassigned_to_red}
                  onChange={(e) => handleInputChange('unassigned_to_red', validatePositiveInteger(e.target.value, 2))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="3"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 3 min</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assigned to Yellow
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                    Assigned ticket delay before yellow
                  </span>
                </label>
                <input
                  type="number"
                  min="3"
                  max="60"
                  value={config.assigned_to_yellow}
                  onChange={(e) => handleInputChange('assigned_to_yellow', validatePositiveInteger(e.target.value, 3))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="5"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 5 min</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assigned to Red
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                    Assigned ticket delay before red
                  </span>
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={config.assigned_to_red}
                  onChange={(e) => handleInputChange('assigned_to_red', validatePositiveInteger(e.target.value, 5))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="10"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 10 min</p>
              </div>
            </div>
          </div>

          {/* Sound + Blink Configuration */}
          <div className="mb-8">
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="mr-2">🔊</span> Sound + Blink Configuration
            </h4>
            
            {/* Sound Settings */}
            <div className="mb-6">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Sound Notifications</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    id="green_sound_enabled"
                    type="checkbox"
                    checked={config.green_sound_enabled}
                    onChange={(e) => handleInputChange('green_sound_enabled', e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="green_sound_enabled" className="flex items-center text-sm text-gray-900 dark:text-white">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    Green Sound
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    id="yellow_sound_enabled"
                    type="checkbox"
                    checked={config.yellow_sound_enabled}
                    onChange={(e) => handleInputChange('yellow_sound_enabled', e.target.checked)}
                    className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                  />
                  <label htmlFor="yellow_sound_enabled" className="flex items-center text-sm text-gray-900 dark:text-white">
                    <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                    Yellow Sound
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    id="red_sound_enabled"
                    type="checkbox"
                    checked={config.red_sound_enabled}
                    onChange={(e) => handleInputChange('red_sound_enabled', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <label htmlFor="red_sound_enabled" className="flex items-center text-sm text-gray-900 dark:text-white">
                    <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                    Red Sound
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Yellow Sound Repeat Interval
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                      Time between yellow alert sounds (minutes)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={config.yellow_sound_repeat_interval}
                    onChange={(e) => handleInputChange('yellow_sound_repeat_interval', validatePositiveInteger(e.target.value, 1))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="2"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 2 min</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Red Sound Repeat Interval
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                      Time between red alert sounds (minutes)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={config.red_sound_repeat_interval}
                    onChange={(e) => handleInputChange('red_sound_repeat_interval', validatePositiveInteger(e.target.value, 1))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="2"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 2 min</p>
                </div>
              </div>
            </div>
            
            {/* Blink Settings */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Blink Notifications</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    id="green_blink_enabled"
                    type="checkbox"
                    checked={config.green_blink_enabled}
                    onChange={(e) => handleInputChange('green_blink_enabled', e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="green_blink_enabled" className="flex items-center text-sm text-gray-900 dark:text-white">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    Green Blink
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    id="yellow_blink_enabled"
                    type="checkbox"
                    checked={config.yellow_blink_enabled}
                    onChange={(e) => handleInputChange('yellow_blink_enabled', e.target.checked)}
                    className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                  />
                  <label htmlFor="yellow_blink_enabled" className="flex items-center text-sm text-gray-900 dark:text-white">
                    <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                    Yellow Blink
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    id="red_blink_enabled"
                    type="checkbox"
                    checked={config.red_blink_enabled}
                    onChange={(e) => handleInputChange('red_blink_enabled', e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <label htmlFor="red_blink_enabled" className="flex items-center text-sm text-gray-900 dark:text-white">
                    <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                    Red Blink
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Blink Duration
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                      Length of blinking (seconds)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={config.blink_duration_seconds}
                    onChange={(e) => handleInputChange('blink_duration_seconds', validatePositiveInteger(e.target.value, 5))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 10 sec</p>
                </div>
              </div>
            </div>
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  How the Urgency System Works
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Green:</strong> Normal state - AI handling or agent assigned</li>
                    <li><strong>Yellow:</strong> Attention needed - customer waiting or service taking longer</li>
                    <li><strong>Red:</strong> Urgent action required - critical delays detected</li>
                    <li><strong>Sounds:</strong> Play when urgency level changes (if enabled)</li>
                    <li><strong>Blinking:</strong> Visual alert for specified duration when urgency changes</li>
                  </ul>
                </div>
              </div>
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
                onChange={(e) => handleInputChange('maxFileSize', validatePositiveInteger(e.target.value, 1))}
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
                onChange={(e) => handleInputChange('sessionTimeout', validatePositiveInteger(e.target.value, 5))}
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
                onChange={(e) => handleInputChange('maxLoginAttempts', validatePositiveInteger(e.target.value, 3))}
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

        {/* Dropdown Options Management */}
        <DropdownOptionsManager />

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