import React, { useState, useEffect } from 'react';
import { Category, Ticket } from '../../types';
import apiService from '../../services/api';

interface CreateTicketProps {
  onBack: () => void;
  onTicketCreated: () => void;
}

interface TicketFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  customerAddress: string;
}

const CreateTicket: React.FC<CreateTicketProps> = ({ onBack, onTicketCreated }) => {
  const [formData, setFormData] = useState<TicketFormData>({
    title: '',
    description: '',
    priority: 'medium',
    category: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerCompany: '',
    customerAddress: '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const fetchedCategories = await apiService.getCategories();
      setCategories(fetchedCategories);
      if (fetchedCategories.length > 0) {
        setFormData(prev => ({ ...prev, category: fetchedCategories[0].id }));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setFormData(prev => ({ ...prev, customerEmail: email }));
    
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');

    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Please fill in both title and description');
      return;
    }

    if (!formData.customerName.trim() || !formData.customerEmail.trim()) {
      setError('Please provide your name and email address');
      return;
    }

    // Validate email format
    if (!validateEmail(formData.customerEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      console.log('Creating ticket with form data:', formData);
      
      // Transform formData to match backend expectations
      const ticketData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        categoryId: formData.category,
        customerInfo: {
          name: formData.customerName,
          email: formData.customerEmail,
          phone: formData.customerPhone,
          company: formData.customerCompany,
          address: formData.customerAddress
        }
      };
      
      console.log('Sending ticket data to API:', ticketData);
      await apiService.createTicket(ticketData);
      onTicketCreated();
    } catch (err: any) {
      console.error('Error creating ticket:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'priority' ? value as 'low' | 'medium' | 'high' : value,
    }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to tickets
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
          <p className="mt-1 text-sm text-gray-500">
            Describe your issue and we'll get back to you as soon as possible.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="Brief description of your issue"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              rows={6}
              required
              value={formData.description}
              onChange={handleChange}
              placeholder="Please provide detailed information about your issue..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
            />
          </div>

          {/* Customer Information */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="customerName"
                  name="customerName"
                  required
                  value={formData.customerName}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="customerEmail"
                  name="customerEmail"
                  required
                  value={formData.customerEmail}
                  onChange={handleEmailChange}
                  placeholder="your.email@example.com"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                    emailError ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {emailError && (
                  <p className="mt-1 text-sm text-red-600">{emailError}</p>
                )}
              </div>

              <div>
                <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="customerPhone"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="customerCompany" className="block text-sm font-medium text-gray-700 mb-2">
                  Company
                </label>
                <input
                  type="text"
                  id="customerCompany"
                  name="customerCompany"
                  value={formData.customerCompany}
                  onChange={handleChange}
                  placeholder="Your company name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                />
              </div>

            </div>

            {/* Address Field - Full Width */}
            <div className="mt-6">
              <label htmlFor="customerAddress" className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                id="customerAddress"
                name="customerAddress"
                rows={3}
                value={formData.customerAddress}
                onChange={handleChange}
                placeholder="Your full address (street, city, state, zip code)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-end space-x-4">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || emailError !== ''}
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  'Create Ticket'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket; 