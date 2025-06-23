import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions?: {
    'tickets.create': boolean;
    'tickets.edit': boolean;
    'tickets.delete': boolean;
    'tickets.message': boolean;
    'users.access': boolean;
    'audit.view': boolean;
    'insights.view': boolean;
    'customers.view': boolean;
    'devices.view': boolean;
    'devices.create': boolean;
    'devices.edit': boolean;
    'devices.delete': boolean;
    'companies.view': boolean;
    'companies.create': boolean;
    'companies.edit': boolean;
    'companies.delete': boolean;
    'system.settings': boolean;
    'system.ai_settings': boolean;
  };
}

const RoleManagement: React.FC = () => {
  const { token } = useAuth();
  const { isDarkMode } = useTheme();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {
      'tickets.create': false,
      'tickets.edit': false,
      'tickets.delete': false,
      'tickets.message': false,
      'users.access': false,
      'audit.view': false,
      'insights.view': false,
      'customers.view': false,
      'devices.view': false,
      'devices.create': false,
      'devices.edit': false,
      'devices.delete': false,
      'companies.view': false,
      'companies.create': false,
      'companies.edit': false,
      'companies.delete': false,
      'system.settings': false,
      'system.ai_settings': false,
    }
  });

  const fetchRoles = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/roles', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }

      const data = await response.json();
      console.log('Roles API response:', data);
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [token]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create role');
        } else {
          const errorText = await response.text();
          console.error('Non-JSON response:', errorText);
          throw new Error(`Server error (${response.status}): ${response.statusText}`);
        }
      }

      await fetchRoles();
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    console.log('Updating role:', editingRole.id, 'with data:', formData);
    console.log('Token:', token);
    console.log('Full URL:', `http://localhost:3001/api/roles/${editingRole.id}`);

    try {
      const response = await fetch(`http://localhost:3001/api/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      console.log('Update response status:', response.status);
      console.log('Update response headers:', response.headers);

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update role');
        } else {
          const errorText = await response.text();
          console.error('Non-JSON response:', errorText);
          throw new Error(`Server error (${response.status}): ${response.statusText}`);
        }
      }

      await fetchRoles();
      setEditingRole(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete role');
      }

      await fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: {
        'tickets.create': false,
        'tickets.edit': false,
        'tickets.delete': false,
        'tickets.message': false,
        'users.access': false,
        'audit.view': false,
        'insights.view': false,
        'customers.view': false,
        'devices.view': false,
        'devices.create': false,
        'devices.edit': false,
        'devices.delete': false,
        'companies.view': false,
        'companies.create': false,
        'companies.edit': false,
        'companies.delete': false,
        'system.settings': false,
        'system.ai_settings': false,
      }
    });
  };

  const startEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: {
        'tickets.create': role.permissions?.['tickets.create'] || false,
        'tickets.edit': role.permissions?.['tickets.edit'] || false,
        'tickets.delete': role.permissions?.['tickets.delete'] || false,
        'tickets.message': role.permissions?.['tickets.message'] || false,
        'users.access': role.permissions?.['users.access'] || false,
        'audit.view': role.permissions?.['audit.view'] || false,
        'insights.view': role.permissions?.['insights.view'] || false,
        'customers.view': role.permissions?.['customers.view'] || false,
        'devices.view': role.permissions?.['devices.view'] || false,
        'devices.create': role.permissions?.['devices.create'] || false,
        'devices.edit': role.permissions?.['devices.edit'] || false,
        'devices.delete': role.permissions?.['devices.delete'] || false,
        'companies.view': role.permissions?.['companies.view'] || false,
        'companies.create': role.permissions?.['companies.create'] || false,
        'companies.edit': role.permissions?.['companies.edit'] || false,
        'companies.delete': role.permissions?.['companies.delete'] || false,
        'system.settings': role.permissions?.['system.settings'] || false,
        'system.ai_settings': role.permissions?.['system.ai_settings'] || false,
      }
    });
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setShowCreateForm(false);
    resetForm();
  };

  if (loading) return <div className="p-4">Loading roles...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  const isDefaultRole = (roleId: string) => ['1', '2', '3', '4'].includes(roleId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Role Management</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Create New Role
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingRole) && (
        <div className={`p-6 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className="text-lg font-medium mb-4">
            {editingRole ? 'Edit Role' : 'Create New Role'}
          </h3>
          <form onSubmit={editingRole ? handleUpdateRole : handleCreateRole} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Role Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
                disabled={editingRole ? isDefaultRole(editingRole.id) : false}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Permissions</label>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-2">Tickets</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'tickets.create', label: 'Create' },
                      { key: 'tickets.edit', label: 'Edit' },
                      { key: 'tickets.delete', label: 'Delete' },
                      { key: 'tickets.message', label: 'Send Messages' },
                    ].map(perm => (
                      <label key={perm.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.permissions[perm.key as keyof typeof formData.permissions]}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [perm.key]: e.target.checked
                            }
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">User Management</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions['users.access']}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            'users.access': e.target.checked
                          }
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">Access User Management</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions['audit.view']}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            'audit.view': e.target.checked
                          }
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">View Audit Trail</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions['insights.view']}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            'insights.view': e.target.checked
                          }
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">View Insights Dashboard</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions['customers.view']}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            'customers.view': e.target.checked
                          }
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">View Customer Management</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Device Management</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'devices.view', label: 'View Devices' },
                      { key: 'devices.create', label: 'Create Devices' },
                      { key: 'devices.edit', label: 'Edit Devices' },
                      { key: 'devices.delete', label: 'Delete Devices' },
                    ].map(perm => (
                      <label key={perm.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.permissions[perm.key as keyof typeof formData.permissions]}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [perm.key]: e.target.checked
                            }
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Company Management</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'companies.view', label: 'View Companies' },
                      { key: 'companies.create', label: 'Create Companies' },
                      { key: 'companies.edit', label: 'Edit Companies' },
                      { key: 'companies.delete', label: 'Delete Companies' },
                    ].map(perm => (
                      <label key={perm.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.permissions[perm.key as keyof typeof formData.permissions]}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [perm.key]: e.target.checked
                            }
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">System Management</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'system.settings', label: 'System Settings' },
                      { key: 'system.ai_settings', label: 'AI Agent Settings' },
                    ].map(perm => (
                      <label key={perm.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.permissions[perm.key as keyof typeof formData.permissions]}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [perm.key]: e.target.checked
                            }
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                {editingRole ? 'Update Role' : 'Create Role'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className={`px-4 py-2 rounded-lg border ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roles Table */}
      <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tickets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Admin & System
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Device Management
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Company Management
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  System Management
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {roles.map((role) => (
                <tr key={role.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium">{role.name}</div>
                      <div className="text-sm text-gray-500">{role.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions?.['tickets.create'] && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Create</span>
                      )}
                      {role.permissions?.['tickets.edit'] && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Edit</span>
                      )}
                      {role.permissions?.['tickets.delete'] && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Delete</span>
                      )}
                      {role.permissions?.['tickets.message'] && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">Message</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {role.permissions?.['users.access'] ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">User Mgmt</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">No Access</span>
                      )}
                      {role.permissions?.['audit.view'] && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded ml-1">Audit</span>
                      )}
                      {role.permissions?.['insights.view'] && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded ml-1">Insights</span>
                      )}
                      {role.permissions?.['customers.view'] && (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded ml-1">Customers</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions?.['devices.view'] && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">View</span>
                      )}
                      {role.permissions?.['devices.create'] && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Create</span>
                      )}
                      {role.permissions?.['devices.edit'] && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Edit</span>
                      )}
                      {role.permissions?.['devices.delete'] && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Delete</span>
                      )}
                      {!role.permissions?.['devices.view'] && !role.permissions?.['devices.create'] && !role.permissions?.['devices.edit'] && !role.permissions?.['devices.delete'] && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">No Access</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions?.['companies.view'] && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">View</span>
                      )}
                      {role.permissions?.['companies.create'] && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Create</span>
                      )}
                      {role.permissions?.['companies.edit'] && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Edit</span>
                      )}
                      {role.permissions?.['companies.delete'] && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Delete</span>
                      )}
                      {!role.permissions?.['companies.view'] && !role.permissions?.['companies.create'] && !role.permissions?.['companies.edit'] && !role.permissions?.['companies.delete'] && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">No Access</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions?.['system.settings'] && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">System Settings</span>
                      )}
                      {role.permissions?.['system.ai_settings'] && (
                        <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">AI Settings</span>
                      )}
                      {!role.permissions?.['system.settings'] && !role.permissions?.['system.ai_settings'] && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">No Access</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(role)}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        Edit
                      </button>
                      {!isDefaultRole(role.id) && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RoleManagement; 