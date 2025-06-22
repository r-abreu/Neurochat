import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface DropdownOption {
  id: string;
  name: string;
  description?: string;
  colorCode?: string;
  isActive?: boolean;
  displayOrder?: number;
  type: 'category' | 'deviceModel' | 'customerType';
}

interface DropdownOptionsManagerProps {
  onOptionsUpdate?: () => void;
}

const DropdownOptionsManager: React.FC<DropdownOptionsManagerProps> = ({ onOptionsUpdate }) => {
  const [options, setOptions] = useState<{
    categories: DropdownOption[];
    deviceModels: DropdownOption[];
    customerTypes: DropdownOption[];
  }>({
    categories: [],
    deviceModels: [],
    customerTypes: []
  });
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'deviceModels' | 'customerTypes'>('categories');
  const [editingItem, setEditingItem] = useState<DropdownOption | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      setLoading(true);
      setMessage(''); // Clear any previous error messages
      console.log('DropdownOptionsManager: Starting to load options...');
      
      const data = await apiService.getDropdownOptions();
      console.log('DropdownOptionsManager: Successfully loaded data:', data);
      
      setOptions({
        categories: data.categories.map(c => ({ ...c, type: 'category' as const })),
        deviceModels: data.deviceModels.map(d => ({ ...d, type: 'deviceModel' as const })),
        customerTypes: data.customerTypes.map(c => ({ ...c, type: 'customerType' as const }))
      });
      
      console.log('DropdownOptionsManager: Options set successfully');
    } catch (error) {
      console.error('DropdownOptionsManager: Error loading dropdown options:', error);
      const errorMessage = (error as Error).message;
      console.log('DropdownOptionsManager: Error message:', errorMessage);
      
      if (errorMessage.includes('Authentication failed') || errorMessage.includes('401')) {
        setMessage('Authentication failed. Please log in again.');
      } else if (errorMessage.includes('403') || errorMessage.includes('Admin access required')) {
        setMessage('Access denied. Only administrators can manage dropdown options.');
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
        setMessage('Network error. Please check if the backend server is running.');
      } else {
        setMessage(`Failed to load dropdown options: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCategoriesDirectly = async () => {
    try {
      console.log('Testing direct categories API call...');
      const data = await apiService.getCategories();
      console.log('Categories loaded successfully:', data);
      
      setOptions(prev => ({
        ...prev,
        categories: data.map(c => ({ ...c, type: 'category' as const }))
      }));
      
      setMessage('Categories loaded successfully using direct API call!');
    } catch (error) {
      console.error('Direct categories call failed:', error);
      setMessage(`Direct categories call failed: ${(error as Error).message}`);
    }
  };

  const handleCreate = async (data: Partial<DropdownOption>) => {
    try {
      switch (activeTab) {
        case 'categories':
          await apiService.createCategory({
            name: data.name!,
            description: data.description || '',
            colorCode: data.colorCode || '#6c757d'
          });
          break;
        case 'deviceModels':
          await apiService.createDeviceModel({
            name: data.name!,
            description: data.description || '',
            isActive: data.isActive ?? true,
            displayOrder: data.displayOrder || 0
          });
          break;
        case 'customerTypes':
          await apiService.createCustomerType({
            name: data.name!,
            description: data.description || '',
            colorCode: data.colorCode || '#6c757d',
            isActive: data.isActive ?? true,
            displayOrder: data.displayOrder || 0
          });
          break;
      }

      setMessage(`${data.name} created successfully!`);
      setShowAddForm(false);
      loadOptions();
      onOptionsUpdate?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to create item');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleUpdate = async (id: string, data: Partial<DropdownOption>) => {
    try {
      switch (activeTab) {
        case 'categories':
          await apiService.updateCategory(id, {
            name: data.name,
            description: data.description,
            colorCode: data.colorCode
          });
          break;
        case 'deviceModels':
          await apiService.updateDeviceModel(id, {
            name: data.name,
            description: data.description,
            isActive: data.isActive,
            displayOrder: data.displayOrder
          });
          break;
        case 'customerTypes':
          await apiService.updateCustomerType(id, {
            name: data.name,
            description: data.description,
            colorCode: data.colorCode,
            isActive: data.isActive,
            displayOrder: data.displayOrder
          });
          break;
      }

      setMessage(`${data.name} updated successfully!`);
      setEditingItem(null);
      loadOptions();
      onOptionsUpdate?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to update item');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      switch (activeTab) {
        case 'categories':
          await apiService.deleteCategory(id);
          break;
        case 'deviceModels':
          await apiService.deleteDeviceModel(id);
          break;
        case 'customerTypes':
          await apiService.deleteCustomerType(id);
          break;
      }

      setMessage(`${name} deleted successfully!`);
      loadOptions();
      onOptionsUpdate?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to delete item');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const getCurrentOptions = () => {
    return options[activeTab] || [];
  };

  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'categories': return 'Ticket Categories';
      case 'deviceModels': return 'Device Models';
      case 'customerTypes': return 'Customer Types';
      default: return tab;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Dropdown Options Management
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Configure the options available in dropdown menus throughout the system
        </p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.includes('success') 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['categories', 'deviceModels', 'customerTypes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setEditingItem(null);
                setShowAddForm(false);
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {getTabLabel(tab)}
            </button>
          ))}
        </nav>
      </div>

      {/* Add Button */}
      <div className="mb-4 flex justify-between items-center">
        <h4 className="text-md font-medium text-gray-900 dark:text-white">
          {getTabLabel(activeTab)}
        </h4>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
        >
          Add New {getTabLabel(activeTab).slice(0, -1)}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <AddEditForm
          type={activeTab}
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Options List */}
      <div className="space-y-3">
        {getCurrentOptions().map((option) => (
          <div
            key={option.id}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
          >
            {editingItem?.id === option.id ? (
              <AddEditForm
                type={activeTab}
                initialData={editingItem}
                onSave={(data) => handleUpdate(option.id, data)}
                onCancel={() => setEditingItem(null)}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        {option.name}
                      </h5>
                      {option.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {option.description}
                        </p>
                      )}
                    </div>
                    {option.colorCode && (
                      <div
                        className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: option.colorCode }}
                      />
                    )}
                    {option.isActive !== undefined && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        option.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {option.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingItem(option)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(option.id, option.name)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {getCurrentOptions().length === 0 && !message && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No {getTabLabel(activeTab).toLowerCase()} found. Add one to get started.
        </div>
      )}

      {message && getCurrentOptions().length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500 dark:text-gray-400 mb-4">
            Unable to load {getTabLabel(activeTab).toLowerCase()}.
          </div>
          <div className="space-x-2">
            <button
              onClick={loadOptions}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
            >
              Retry
            </button>
            <button
              onClick={loadCategoriesDirectly}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md"
            >
              Test Categories API
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Add/Edit Form Component
interface AddEditFormProps {
  type: 'categories' | 'deviceModels' | 'customerTypes';
  initialData?: DropdownOption;
  onSave: (data: Partial<DropdownOption>) => void;
  onCancel: () => void;
}

const AddEditForm: React.FC<AddEditFormProps> = ({ type, initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    colorCode: initialData?.colorCode || '#6c757d',
    isActive: initialData?.isActive ?? true,
    displayOrder: initialData?.displayOrder || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  const showColorPicker = type === 'categories' || type === 'customerTypes';
  const showActiveToggle = type === 'deviceModels' || type === 'customerTypes';
  const showDisplayOrder = type === 'deviceModels' || type === 'customerTypes';

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        {showColorPicker && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Color
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={formData.colorCode}
                onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
                className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded-md"
              />
              <input
                type="text"
                value={formData.colorCode}
                onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
        {showDisplayOrder && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Order
            </label>
            <input
              type="number"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        )}
        {showActiveToggle && (
          <div className="flex items-center">
            <input
              id="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900 dark:text-white">
              Active
            </label>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
        >
          {initialData ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

export default DropdownOptionsManager; 