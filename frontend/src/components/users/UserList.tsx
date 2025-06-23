import React from 'react';
import { AgentUser, Role } from '../../types';
import ConfigurableTable, { TableColumn } from '../common/ConfigurableTable';

interface UserListProps {
  agents: AgentUser[];
  roles: Role[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (agent: AgentUser) => void;
  onDelete: (id: string, permanent?: boolean) => void;
  onResetPassword: (id: string) => void;
}

const UserList: React.FC<UserListProps> = ({
  agents,
  roles,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onResetPassword,
}) => {
  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'Admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
      case 'Tier2':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200';
      case 'Tier1':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';
      case 'Viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200';
      case 'AI Agent':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200';
    }
  };

  const getStatusBadgeColor = (isActive: boolean, agentStatus: string) => {
    if (!isActive) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
    }
    switch (agentStatus) {
      case 'online':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
      case 'busy':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200';
      case 'offline':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Define table columns
  const columns: TableColumn<AgentUser>[] = [
    {
      id: 'agent',
      label: 'Agent',
      width: 200,
      visible: true,
      resizable: true,
      sortable: true,
      render: (agent) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            {agent.isAIAgent ? (
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {agent.firstName.charAt(0)}{agent.lastName.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
              {agent.firstName} {agent.lastName}
              {agent.isAIAgent && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                  🤖 AI
                </span>
              )}
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
      render: (agent) => (
        <div className="text-sm text-gray-900 dark:text-white break-all">
          {agent.email}
        </div>
      ),
    },
    {
      id: 'role',
      label: 'Role',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      render: (agent) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(agent.roleName)}`}>
          {agent.roleName}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      render: (agent) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(agent.isActive, agent.agentStatus)}`}>
          {!agent.isActive ? 'Inactive' : agent.agentStatus.charAt(0).toUpperCase() + agent.agentStatus.slice(1)}
        </span>
      ),
    },
    {
      id: 'maxTickets',
      label: 'Max Tickets',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      render: (agent) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {agent.maxConcurrentTickets}
        </div>
      ),
    },
    {
      id: 'created',
      label: 'Created',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      render: (agent) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {formatDate(agent.createdAt)}
        </div>
      ),
    },
    {
      id: 'lastLogin',
      label: 'Last Login',
      width: 120,
      visible: true,
      resizable: true,
      sortable: true,
      render: (agent) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {agent.lastLogin ? formatDate(agent.lastLogin) : 'Never'}
        </div>
      ),
    },
  ];

  // Define actions - AI agents should not be editable or deletable
  const actions = [
    ...(canEdit ? [
      {
        label: 'Edit Agent',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
        onClick: onEdit,
        className: 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300',
        show: (agent: AgentUser) => !agent.isAIAgent, // Hide for AI agents
      },
      {
        label: 'Reset Password',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v-2L7.257 13.257A6 6 0 0113 5a2 2 0 012 2z" />
          </svg>
        ),
        onClick: (agent: AgentUser) => onResetPassword(agent.id),
        className: 'text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300',
        show: (agent: AgentUser) => !agent.isAIAgent, // Hide for AI agents
      },
    ] : []),
    ...(canDelete ? [
      {
        label: 'Toggle Active',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        ),
        onClick: (agent: AgentUser) => onDelete(agent.id, false),
        className: 'text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300',
        show: (agent: AgentUser) => !agent.isAIAgent, // Hide for AI agents
      },
      {
        label: 'Delete Permanently',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        onClick: (agent: AgentUser) => onDelete(agent.id, true),
        className: 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300',
        show: (agent: AgentUser) => !agent.isAIAgent, // Hide for AI agents
      },
    ] : []),
  ];

  // Export function
  const handleExport = () => {
    const exportData = agents.map(agent => ({
      'First Name': agent.firstName,
      'Last Name': agent.lastName,
      'Email': agent.email,
      'Role': agent.roleName,
      'Status': !agent.isActive ? 'Inactive' : agent.agentStatus.charAt(0).toUpperCase() + agent.agentStatus.slice(1),
      'Max Concurrent Tickets': agent.maxConcurrentTickets,
      'Created Date': formatDate(agent.createdAt),
      'Last Login': agent.lastLogin ? formatDate(agent.lastLogin) : 'Never',
    }));

    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    
    const filename = `users-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <ConfigurableTable
      data={agents}
      columns={columns}
      loading={false}
      storageKey="agent-user-list-preferences"
      title={`Agents (${agents.length})`}
      onExport={handleExport}
      exportFilename="users-list.xlsx"
      actions={actions}
      emptyState={
        <div className="text-gray-500 dark:text-gray-400">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No agents found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first agent.
          </p>
        </div>
      }
    />
  );
};

export default UserList; 