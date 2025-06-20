import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../common/ThemeToggle';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    console.log('Attempting login with:', { email: formData.email, password: '***' });

    try {
      await login(formData.email, formData.password);
      console.log('Login successful!');
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.message || err.response?.data?.message || 'Login failed. Please try again.';
      setError(errorMessage);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const tryDemoAccount = (role: 'customer' | 'agent') => {
    const demoCredentials = {
      customer: { email: 'customer@demo.com', password: 'demo123' },
      agent: { email: 'agent@demo.com', password: 'demo123' }
    };
    
    setFormData(demoCredentials[role]);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <ThemeToggle />
          </div>
          <div className="flex justify-center mb-4">
            <img 
              src="/neurovirtual-logo.png" 
              alt="NeuroVirtual Logo" 
              className="h-20 w-20 object-contain"
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Welcome to NeuroVirtual</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your support account
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                <strong>Error:</strong> {error}
                <br />
                <small className="text-xs mt-1 block">Check the browser console for more details.</small>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm transition-colors"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm transition-colors"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            <div className="flex items-center justify-center space-x-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">Try demo accounts:</p>
              <button
                type="button"
                onClick={() => tryDemoAccount('customer')}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-medium"
              >
                Customer
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                type="button"
                onClick={() => tryDemoAccount('agent')}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-medium"
              >
                Agent
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300"
              >
                Don't have an account? Sign up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm; 