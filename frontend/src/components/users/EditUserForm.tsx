import React, { useState, useEffect } from 'react';
import { AgentUser, Role, UpdateAgentRequest } from '../../types';

interface EditUserFormProps {
  agent: AgentUser;
  roles: Role[];
  onSubmit: (updateData: UpdateAgentRequest) => void;
  onCancel: () => void;
}

const EditUserForm: React.FC<EditUserFormProps> = ({
  agent,
  roles,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<UpdateAgentRequest>({
    firstName: agent.firstName,
    lastName: agent.lastName,
    roleId: agent.roleId,
    isActive: agent.isActive,
    maxConcurrentTickets: agent.maxConcurrentTickets,
    agentStatus: agent.agentStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Max tickets validation
    if (formData.maxConcurrentTickets && (formData.maxConcurrentTickets < 1 || formData.maxConcurrentTickets > 50)) {
      newErrors.maxConcurrentTickets = 'Max concurrent tickets must be between 1 and 50';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Only send fields that have changed
      const updateData: UpdateAgentRequest = {};
      
      if (formData.firstName !== agent.firstName) {
        updateData.firstName = formData.firstName;
      }
      if (formData.lastName !== agent.lastName) {
        updateData.lastName = formData.lastName;
      }
      if (formData.roleId !== agent.roleId) {
        updateData.roleId = formData.roleId;
      }
      if (formData.isActive !== agent.isActive) {
        updateData.isActive = formData.isActive;
      }
      if (formData.maxConcurrentTickets !== agent.maxConcurrentTickets) {
        updateData.maxConcurrentTickets = formData.maxConcurrentTickets;
      }
      if (formData.agentStatus !== agent.agentStatus) {
        updateData.agentStatus = formData.agentStatus;
      }

      await onSubmit(updateData);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof UpdateAgentRequest, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Agent</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{agent.email}</p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={agent.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                value={formData.firstName || ''}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="John"
              />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                value={formData.lastName || ''}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Doe"
              />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>

            {/* Role */}
            <div>
              <label htmlFor="roleId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                id="roleId"
                value={formData.roleId || ''}
                onChange={(e) => handleInputChange('roleId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} - {role.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Agent Status */}
            <div>
              <label htmlFor="agentStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Agent Status
              </label>
              <select
                id="agentStatus"
                value={formData.agentStatus || 'offline'}
                onChange={(e) => handleInputChange('agentStatus', e.target.value as 'online' | 'busy' | 'offline')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="online">Online</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {/* Max Concurrent Tickets */}
            <div>
              <label htmlFor="maxConcurrentTickets" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Concurrent Tickets
              </label>
              <input
                type="number"
                id="maxConcurrentTickets"
                min="1"
                max="50"
                value={formData.maxConcurrentTickets || 5}
                onChange={(e) => handleInputChange('maxConcurrentTickets', parseInt(e.target.value) || 1)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.maxConcurrentTickets ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.maxConcurrentTickets && <p className="text-red-500 text-xs mt-1">{errors.maxConcurrentTickets}</p>}
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive ?? true}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Active (agent can login and handle tickets)
              </label>
            </div>

            {/* Account Info */}
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Account Information</h3>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>Created: {new Date(agent.createdAt).toLocaleDateString()}</div>
                <div>Last Login: {agent.lastLogin ? new Date(agent.lastLogin).toLocaleDateString() : 'Never'}</div>
                <div>Current Role: {agent.roleName}</div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditUserForm; 