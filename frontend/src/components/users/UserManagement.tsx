import React, { useState, useEffect } from 'react';
import { AgentUser, Role, CreateAgentRequest, UpdateAgentRequest } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import UserList from './UserList';
import CreateUserForm from './CreateUserForm';
import EditUserForm from './EditUserForm';
import RoleManagement from './RoleManagement';
import AuditTrail from './AuditTrail';
import SystemSettings from './SystemSettings';
import AiAgentSettings from './AiAgentSettings';

interface UserManagementProps {}

const UserManagement: React.FC<UserManagementProps> = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'agents' | 'roles' | 'audit' | 'settings' | 'ai-agent'>('agents');
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentUser | null>(null);

  // Check if user has access to system management functions
  const hasSystemAccess = user?.permissions?.includes('system.management') ?? false;
  const hasUserManagementAccess = (user?.permissions?.includes('system.user_management') || user?.roleName === 'Admin') ?? false;
  const hasRoleManagementAccess = (user?.permissions?.includes('system.role_management') || user?.roleName === 'Admin') ?? false;
  const canCreateUsers = (user?.permissions?.includes('users.create') || user?.roleName === 'Admin') ?? false;
  const canEditUsers = (user?.permissions?.includes('users.edit') || user?.roleName === 'Admin') ?? false;
  const canDeleteUsers = (user?.permissions?.includes('users.delete') || user?.roleName === 'Admin') ?? false;
  const canViewAudit = (user?.permissions?.includes('audit.view') || user?.roleName === 'Admin') ?? false;
  const hasSystemSettings = (user?.permissions?.includes('system.settings') || user?.permissions?.includes('system.management') || user?.roleName === 'Admin') ?? false;
  const hasAiSettings = (user?.permissions?.includes('system.ai_settings') || user?.permissions?.includes('system.management') || user?.roleName === 'Admin') ?? false;
  const isAdmin = user?.roleName === 'Admin';

  useEffect(() => {
    if (hasSystemAccess || hasUserManagementAccess || isAdmin) {
      fetchAgents();
      fetchRoles();
    }
  }, [hasSystemAccess, hasUserManagementAccess, isAdmin]);

  const fetchAgents = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/agents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      console.log('Fetched agents data:', data);
      
      // The backend returns { success: true, data: { agents: [...] } }
      if (data.success && data.data && Array.isArray(data.data.agents)) {
        setAgents(data.data.agents);
      } else {
        console.error('Expected agents array but got:', typeof data, data);
        setError('Invalid data format received from server');
        setAgents([]);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      setAgents([]); // Ensure agents is always an array
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }

      const data = await response.json();
      setRoles(data);
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  const handleCreateAgent = async (agentData: CreateAgentRequest) => {
    try {
      const response = await fetch('http://localhost:3001/api/agents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create agent');
      }

      const newAgent = await response.json();
      setAgents([...agents, newAgent]);
      setShowCreateForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    }
  };

  const handleUpdateAgent = async (id: string, updateData: UpdateAgentRequest) => {
    try {
      const response = await fetch(`http://localhost:3001/api/agents/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update agent');
      }

      const updatedAgent = await response.json();
      setAgents(agents.map(agent => agent.id === id ? updatedAgent : agent));
      setEditingAgent(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    }
  };

  const handleDeleteAgent = async (id: string, permanent: boolean = false) => {
    if (!window.confirm(permanent ? 'Are you sure you want to permanently delete this agent?' : 'Are you sure you want to deactivate this agent?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/agents/${id}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete agent');
      }

      if (permanent) {
        setAgents(agents.filter(agent => agent.id !== id));
      } else {
        setAgents(agents.map(agent => 
          agent.id === id ? { ...agent, isActive: false } : agent
        ));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  };

  const handleResetPassword = async (id: string, sendEmail: boolean = true) => {
    try {
      const response = await fetch(`http://localhost:3001/api/agents/${id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sendEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset password');
      }

      const result = await response.json();
      
      if (result.temporaryPassword) {
        alert(`Password reset successfully. Temporary password: ${result.temporaryPassword}`);
      } else {
        alert('Password reset email sent successfully');
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  if (!hasSystemAccess && !hasUserManagementAccess && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to access user management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage agent accounts, roles, and system settings</p>
        </div>
        {activeTab === 'agents' && canCreateUsers && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Agent
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {hasUserManagementAccess && (
            <button
              onClick={() => setActiveTab('agents')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'agents'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              User Management
            </button>
          )}
          {hasRoleManagementAccess && (
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'roles'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Role Management
            </button>
          )}
          {canViewAudit && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'audit'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Audit Trail
            </button>
          )}
          {hasSystemSettings && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              System Settings
            </button>
          )}
          {hasAiSettings && (
            <button
              onClick={() => setActiveTab('ai-agent')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'ai-agent'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              AI Agent Settings
            </button>
          )}
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'agents' && hasUserManagementAccess && (
        <>
          {showCreateForm && (
            <CreateUserForm
              roles={roles}
              onSubmit={handleCreateAgent}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {editingAgent && (
            <EditUserForm
              agent={editingAgent}
              roles={roles}
              onSubmit={(updateData: UpdateAgentRequest) => handleUpdateAgent(editingAgent.id, updateData)}
              onCancel={() => setEditingAgent(null)}
            />
          )}

          <UserList
            agents={agents}
            roles={roles}
            canEdit={canEditUsers}
            canDelete={canDeleteUsers}
            onEdit={setEditingAgent}
            onDelete={handleDeleteAgent}
            onResetPassword={handleResetPassword}
          />
        </>
      )}

      {activeTab === 'roles' && hasRoleManagementAccess && (
        <RoleManagement />
      )}

      {activeTab === 'audit' && canViewAudit && (
        <AuditTrail />
      )}

      {activeTab === 'settings' && hasSystemSettings && (
        <SystemSettings />
      )}

      {activeTab === 'ai-agent' && hasAiSettings && (
        <AiAgentSettings />
      )}
    </div>
  );
};

export default UserManagement; 