import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../common/ThemeToggle';

const AgentLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Redirect will be handled by AuthContext
    } catch (err: any) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (email: string) => {
    setError('');
    setLoading(true);
    
    try {
      await login(email, 'demo123');
    } catch (err: any) {
      setError('Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="/neurovirtual-logo.png" 
              alt="NeuroVirtual Logo" 
              className="h-16 w-16 object-contain"
            />
          </div>
          <div className="flex justify-center mb-4">
            <ThemeToggle />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            NeuroVirtual Agent Portal
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to access the support dashboard
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200 dark:border-gray-700">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Demo Account</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleDemoLogin('admin@demo.com')}
                disabled={loading}
                className="w-full inline-flex justify-center py-2 px-4 border border-red-300 dark:border-red-600 rounded-md shadow-sm bg-red-50 dark:bg-red-900/20 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                Login as Admin (Full Access)
              </button>
              <button
                onClick={() => handleDemoLogin('tier2@demo.com')}
                disabled={loading}
                className="w-full inline-flex justify-center py-2 px-4 border border-purple-300 dark:border-purple-600 rounded-md shadow-sm bg-purple-50 dark:bg-purple-900/20 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50"
              >
                Login as Tier2 (User Management)
              </button>
              <button
                onClick={() => handleDemoLogin('agent@demo.com')}
                disabled={loading}
                className="w-full inline-flex justify-center py-2 px-4 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm bg-blue-50 dark:bg-blue-900/20 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                Login as Tier1 Agent
              </button>
              <button
                onClick={() => handleDemoLogin('viewer@demo.com')}
                disabled={loading}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Login as Viewer (Read-only)
              </button>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                All demo passwords: demo123
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ← Back to Customer Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default AgentLogin; 