import React from 'react';
import { AgentUser, Role } from '../../types';

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

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Agents ({agents.length})
        </h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Max Tickets
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {agent.firstName.charAt(0)}{agent.lastName.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {agent.firstName} {agent.lastName}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {agent.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(agent.roleName)}`}>
                    {agent.roleName}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(agent.isActive, agent.agentStatus)}`}>
                    {!agent.isActive ? 'Inactive' : agent.agentStatus.charAt(0).toUpperCase() + agent.agentStatus.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {agent.maxConcurrentTickets}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatDate(agent.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {agent.lastLogin ? formatDate(agent.lastLogin) : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => onEdit(agent)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit Agent"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onResetPassword(agent.id)}
                          className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                          title="Reset Password"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v-2L7.257 13.257A6 6 0 0113 5a2 2 0 012 2z" />
                          </svg>
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <>
                        <button
                          onClick={() => onDelete(agent.id, false)}
                          className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                          title={agent.isActive ? "Deactivate Agent" : "Reactivate Agent"}
                        >
                          {agent.isActive ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => onDelete(agent.id, true)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Permanently Delete Agent"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {agents.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No agents found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new agent.</p>
        </div>
      )}
    </div>
  );
};

export default UserList; 