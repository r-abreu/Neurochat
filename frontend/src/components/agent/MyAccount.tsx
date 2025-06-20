import React, { useState, useEffect } from 'react';
import { User } from '../../types';

interface MyAccountProps {
  user: User;
  onClose: () => void;
  onProfileUpdate: (updatedUser: User) => void;
}

interface ProfileUpdateData {
  firstName: string;
  lastName: string;
  avatarUrl: string;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const MyAccount: React.FC<MyAccountProps> = ({ user, onClose, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile form state
  const [profileData, setProfileData] = useState<ProfileUpdateData>({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    avatarUrl: user.avatarUrl || ''
  });

  // Password form state
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Avatar preview
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatarUrl || '');

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      setError('First name and last name are required');
      setLoading(false);
      return;
    }

    try {
      console.log('🔧 Frontend: Making profile update request...');
      console.log('  - URL:', `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/profile`);
      console.log('  - Token:', localStorage.getItem('auth_token') ? 'Present' : 'Missing');
      console.log('  - Data:', { 
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        avatarUrl: profileData.avatarUrl.trim() || null
      });

      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          firstName: profileData.firstName.trim(),
          lastName: profileData.lastName.trim(),
          avatarUrl: profileData.avatarUrl.trim() || null
        })
      });

      console.log('🔧 Frontend: Response status:', response.status);
      console.log('🔧 Frontend: Response headers:', response.headers);

      if (!response.ok) {
        console.log('🔧 Frontend: Response not OK, trying to parse error...');
        try {
          const errorData = await response.json();
          console.log('🔧 Frontend: Error data:', errorData);
          throw new Error(errorData.message || 'Failed to update profile');
        } catch (parseError) {
          console.log('🔧 Frontend: Failed to parse error response:', parseError);
          const errorText = await response.text();
          console.log('🔧 Frontend: Raw error response:', errorText);
          throw new Error(`Server error (${response.status}): ${response.statusText}`);
        }
      }

      const updatedUser = await response.json();
      
      // Update the user in the parent component
      onProfileUpdate({
        ...user,
        ...updatedUser,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`
      });

      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('All password fields are required');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/profile/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
      }

      setSuccess('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUrlChange = (url: string) => {
    setProfileData(prev => ({ ...prev, avatarUrl: url }));
    setAvatarPreview(url);
  };

  const getAvatarDisplay = () => {
    if (avatarPreview) {
      return (
        <img 
          src={avatarPreview} 
          alt="Avatar" 
          className="w-20 h-20 rounded-full object-cover"
          onError={() => setAvatarPreview('')}
        />
      );
    }
    
    return (
      <div className="w-20 h-20 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          {profileData.firstName.charAt(0)}{profileData.lastName.charAt(0)}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">My Account</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              activeTab === 'profile'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              activeTab === 'password'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Password
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded-md text-sm">
              {success}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate}>
              {/* Avatar Section */}
              <div className="mb-6 text-center">
                <div className="flex justify-center mb-4">
                  {getAvatarDisplay()}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={profileData.avatarUrl}
                    onChange={(e) => handleAvatarUrlChange(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Enter a URL to an image or leave blank for initials
                  </p>
                </div>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Email (readonly) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-md font-medium transition-colors"
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    minLength={6}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-md font-medium transition-colors"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyAccount; 