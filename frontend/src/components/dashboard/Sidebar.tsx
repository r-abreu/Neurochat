import React, { useState } from 'react';
import { User } from '../../types';
import MyAccount from '../agent/MyAccount';

interface SidebarProps {
  user: User | null;
  currentView: string;
  onViewChange: (view: string) => void;
  onCreateTicket: () => void;
  onLogout: () => void;
  onProfileUpdate?: (user: User) => void;
  isMobile?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  currentView,
  onViewChange,
  onCreateTicket,
  onLogout,
  onProfileUpdate,
  isMobile = false,
  onClose,
  collapsed = false,
  onToggleCollapse
}) => {
  const [showMyAccount, setShowMyAccount] = useState(false);
  // Base navigation for customers
  const navigation = [];

  if (user?.role === 'agent') {
    // Agent navigation in the requested order
    navigation.push(
      {
        name: 'All Open Tickets',
        id: 'all-open-tickets',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        name: 'My Open Tickets',
        id: 'my-open-tickets',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        name: 'Unassigned',
        id: 'unassigned',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        name: 'All Tickets',
        id: 'tickets',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
      },
      {
        name: 'My Tickets',
        id: 'my-tickets',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
      {
        name: 'Resolved',
        id: 'resolved',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      }
    );

    // Add Insights section for agents with proper permissions
    if (user?.role === 'agent' && user?.permissions?.includes('insights.view')) {
      navigation.push({
        name: 'Insights',
        id: 'insights',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      });
    }

    // Add Customer Management section for agents with proper permissions
    if (user?.role === 'agent' && user?.permissions?.includes('customers.view')) {
      navigation.push({
        name: 'Customers',
        id: 'customers',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      });
    }

    // Add Device Management section for agents with proper permissions
    console.log('🔧 Device permission check:', {
      userRole: user?.role,
      userPermissions: user?.permissions,
      hasDevicesView: user?.permissions?.includes('devices.view')
    });
    
    if (user?.role === 'agent' && user?.permissions?.includes('devices.view')) {
      console.log('✅ Adding Devices navigation item');
      navigation.push({
        name: 'Devices',
        id: 'devices',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 002 2v10a2 2 0 002 2z" />
          </svg>
        ),
      });
    } else {
      console.log('❌ Not adding Devices navigation item');
    }

    // Add Company Management section for agents with proper permissions
    if (user?.role === 'agent' && user?.permissions?.includes('companies.view')) {
      navigation.push({
        name: 'Companies',
        id: 'companies',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      });
    }


  } else {
    // Customer navigation (simplified)
    navigation.push(
      {
        name: 'All Tickets',
        id: 'tickets',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
      },
      {
        name: 'My Tickets',
        id: 'my-tickets',
        icon: (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      }
    );
  }

  const handleItemClick = (itemId: string) => {
    onViewChange(itemId);
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${collapsed && !isMobile ? 'w-16' : 'w-full'}`}>
      {/* Close button for mobile */}
      {isMobile && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Menu</h2>
          <button
            onClick={onClose}
            className="rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Collapse toggle button for desktop */}
      {!isMobile && onToggleCollapse && (
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className={`h-5 w-5 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Logo and title */}
      {!collapsed && !isMobile && (
        <div className="flex items-center px-4 py-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <img 
              src="/neurovirtual-logo.png" 
              alt="NeuroVirtual Logo" 
              className="h-10 w-10 object-contain"
            />
            <div className="ml-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">NeuroVirtual</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Support Platform</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed logo */}
      {collapsed && !isMobile && (
        <div className="flex items-center justify-center py-6 border-b border-gray-200 dark:border-gray-700">
          <img 
            src="/neurovirtual-logo.png" 
            alt="NeuroVirtual Logo" 
            className="h-8 w-8 object-contain"
            title="NeuroVirtual"
          />
        </div>
      )}

      {/* User profile */}
      {user && !collapsed && (
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            {user.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt="Profile" 
                className="h-10 w-10 rounded-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center ${user.avatarUrl ? 'hidden' : ''}`}>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
              {user.role === 'agent' && user.roleName && (
                <p className="text-xs text-gray-400 dark:text-gray-500">{user.roleName}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed user avatar */}
      {user && collapsed && !isMobile && (
        <div className="flex items-center justify-center py-4 border-b border-gray-200 dark:border-gray-700">
          {user.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt="Profile" 
              className="h-8 w-8 rounded-full object-cover"
              onError={(e) => {
                // Fallback to initials if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center ${user.avatarUrl ? 'hidden' : ''}`}>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {/* Create ticket button */}
        {user?.role === 'customer' && (
          <button
            onClick={() => {
              onCreateTicket();
              if (isMobile && onClose) onClose();
            }}
            className={`w-full group flex items-center ${collapsed && !isMobile ? 'justify-center' : 'px-2'} py-2 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors`}
            title={collapsed ? "New Ticket" : ""}
          >
            <svg className={`h-5 w-5 ${collapsed && !isMobile ? '' : 'mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {!collapsed && "New Ticket"}
          </button>
        )}

        {/* Navigation items */}
        {navigation.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            className={`w-full group flex items-center ${collapsed && !isMobile ? 'justify-center' : 'px-2'} py-2 text-sm font-medium rounded-md transition-colors ${
              currentView === item.id
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 border-r-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
            title={collapsed ? item.name : ""}
          >
            <span className={`h-5 w-5 ${collapsed && !isMobile ? '' : 'mr-3'} ${currentView === item.id ? 'text-primary-600' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'}`}>
              {item.icon}
            </span>
            {!collapsed && item.name}
          </button>
        ))}
      </nav>

      {/* Audit Trail, User Management, My Account and Logout buttons */}
      <div className="px-2 pb-4 space-y-1">
        {/* Audit Trail button - only for agents with audit.view permission */}
        {user?.role === 'agent' && user.permissions?.includes('audit.view') && (
          <button
            onClick={() => handleItemClick('audit')}
            className={`w-full group flex items-center ${collapsed && !isMobile ? 'justify-center' : 'px-2'} py-2 text-sm font-medium rounded-md transition-colors ${
              currentView === 'audit'
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 border-r-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
            title={collapsed ? "Audit Trail" : ""}
          >
            <svg className={`h-5 w-5 ${collapsed && !isMobile ? '' : 'mr-3'} ${currentView === 'audit' ? 'text-primary-600' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {!collapsed && "Audit Trail"}
          </button>
        )}

        {/* User Management button - only for agents with access */}
        {user?.role === 'agent' && user.permissions?.includes('users.access') && (
          <button
            onClick={() => handleItemClick('users')}
            className={`w-full group flex items-center ${collapsed && !isMobile ? 'justify-center' : 'px-2'} py-2 text-sm font-medium rounded-md transition-colors ${
              currentView === 'users'
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 border-r-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
            title={collapsed ? "User Management" : ""}
          >
            <svg className={`h-5 w-5 ${collapsed && !isMobile ? '' : 'mr-3'} ${currentView === 'users' ? 'text-primary-600' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            {!collapsed && "User Management"}
          </button>
        )}

        {/* My Account button - only for agents */}
        {user?.role === 'agent' && (
          <button
            onClick={() => setShowMyAccount(true)}
            className={`w-full group flex items-center ${collapsed && !isMobile ? 'justify-center' : 'px-2'} py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors`}
            title={collapsed ? "My Account" : ""}
          >
            <svg className={`h-5 w-5 ${collapsed && !isMobile ? '' : 'mr-3'} text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {!collapsed && "My Account"}
          </button>
        )}
        
        {/* Logout button */}
        <button
          onClick={onLogout}
          className={`w-full group flex items-center ${collapsed && !isMobile ? 'justify-center' : 'px-2'} py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors`}
          title={collapsed ? "Sign out" : ""}
        >
          <svg className={`h-5 w-5 ${collapsed && !isMobile ? '' : 'mr-3'} text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && "Sign out"}
        </button>
      </div>

      {/* My Account Modal */}
      {showMyAccount && user && onProfileUpdate && (
        <MyAccount
          user={user}
          onClose={() => setShowMyAccount(false)}
          onProfileUpdate={onProfileUpdate}
        />
      )}
    </div>
  );
};

export default Sidebar; 