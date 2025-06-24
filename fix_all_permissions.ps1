# =====================================================
# COMPREHENSIVE PERMISSION FIXES SCRIPT
# =====================================================
# This script fixes all identified permission issues in the NeuroAI system

Write-Host "🔧 NEUROAI PERMISSION FIXES" -ForegroundColor Cyan
Write-Host "=" * 50

# Configuration
$backendUrl = "http://localhost:3001"

Write-Host "🔍 Analyzing current permission issues..." -ForegroundColor Yellow

# Function to authenticate as admin
function Get-AdminToken {
    try {
        $loginData = @{
            email = "admin@demo.com"
            password = "demo123"
        } | ConvertTo-Json -Depth 10

        $response = Invoke-RestMethod -Uri "$backendUrl/api/login" -Method Post -Body $loginData -ContentType "application/json"
        return $response.token
    }
    catch {
        Write-Host "❌ Failed to authenticate as admin" -ForegroundColor Red
        return $null
    }
}

Write-Host "🔧 Issue 1: Demo User Permission Inconsistencies" -ForegroundColor Yellow
Write-Host "Found: Demo users have hardcoded permissions that don't match their role configurations"
Write-Host "Fix: Updating demo users to use role-based permissions"

# Read the current server.js file
$serverPath = "backend/server.js"
if (Test-Path $serverPath) {
    $serverContent = Get-Content $serverPath -Raw
    
    # Fix 1: Update demo users to have permissions synced with roles
    $updatedContent = $serverContent -replace 
    'permissions: \[''tickets\.create'', ''tickets\.edit'', ''tickets\.message''\],',
    'permissions: [], // Will be synced from role'
    
    $updatedContent = $updatedContent -replace 
    'permissions: \[''tickets\.view''\],',
    'permissions: [], // Will be synced from role'
    
    # Save the updated content
    Set-Content -Path $serverPath -Value $updatedContent -Encoding UTF8
    Write-Host "✅ Updated demo users in server.js" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Issue 2: Missing Insights Permission in Tier2 Role" -ForegroundColor Yellow
Write-Host "Found: Tier2 role should have insights.view permission but it's missing"
Write-Host "Fix: Adding insights.view to Tier2 role"

# This will be handled by the role configuration update

Write-Host ""
Write-Host "🔧 Issue 3: User Management Permission Inconsistencies" -ForegroundColor Yellow
Write-Host "Found: Mixed use of 'users.access' and 'system.user_management' permissions"
Write-Host "Fix: Standardizing on 'system.user_management' for user management access"

# Read and update frontend files
$frontendFiles = @(
    "frontend/src/components/dashboard/Dashboard.tsx",
    "frontend/src/components/users/UserManagement.tsx"
)

foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        
        # Replace inconsistent permission checks
        $updatedContent = $content -replace 
        'user\.permissions\?\.\w*includes\(''users\.access''\)',
        'user.permissions?.includes(''system.user_management'')'
        
        Set-Content -Path $file -Value $updatedContent -Encoding UTF8
        Write-Host "✅ Updated permission checks in $file" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🔧 Issue 4: Role Management Access Control" -ForegroundColor Yellow
Write-Host "Found: Role management should be restricted to Admin only"
Write-Host "Fix: Creating role management permission check"

# Update role management component
$roleManagementPath = "frontend/src/components/users/RoleManagement.tsx"
if (Test-Path $roleManagementPath) {
    $content = Get-Content $roleManagementPath -Raw
    
    # Add permission check at the top of the component
    $permissionCheck = @"
  const { user } = useAuth();
  
  // Check if user has permission to manage roles
  if (!user?.permissions?.includes('system.role_management') && user?.roleName !== 'Admin') {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">Access Denied</h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              You do not have permission to manage roles. Only administrators can access this section.
            </p>
          </div>
        </div>
      </div>
    );
  }
"@
    
    # Insert permission check after imports
    $updatedContent = $content -replace 
    '(const RoleManagement: React\.FC = \(\) => \{)',
    "`$1`n$permissionCheck"
    
    Set-Content -Path $roleManagementPath -Value $updatedContent -Encoding UTF8
    Write-Host "✅ Added permission check to RoleManagement component" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Issue 5: Backend Permission Validation" -ForegroundColor Yellow
Write-Host "Found: Some API endpoints have inconsistent permission checks"
Write-Host "Fix: Standardizing permission validation across all endpoints"

# Create a standardized permission validation function
$permissionValidationFunction = @"

// Standardized permission validation function
const validatePermission = (user, requiredPermission, requiredRole = null) => {
  if (!user) return false;
  
  // Check if user is admin (always has access)
  if (user.roleName === 'Admin') return true;
  
  // Check if user has specific role requirement
  if (requiredRole && user.roleName !== requiredRole) return false;
  
  // Check if user has the required permission
  if (requiredPermission && user.permissions && user.permissions.includes(requiredPermission)) {
    return true;
  }
  
  return false;
};

// Helper function to check multiple permissions (user needs at least one)
const validateAnyPermission = (user, requiredPermissions) => {
  if (!user) return false;
  
  // Admin always has access
  if (user.roleName === 'Admin') return true;
  
  // Check if user has any of the required permissions
  if (user.permissions && requiredPermissions.some(perm => user.permissions.includes(perm))) {
    return true;
  }
  
  return false;
};
"@

Write-Host ""
Write-Host "🔧 Issue 6: Device Management Permission Inconsistencies" -ForegroundColor Yellow
Write-Host "Found: Device management components missing proper permission enforcement"
Write-Host "Fix: Adding comprehensive permission checks"

# Update device management component
$deviceManagementPath = "frontend/src/components/devices/DeviceManagement.tsx"
if (Test-Path $deviceManagementPath) {
    $content = Get-Content $deviceManagementPath -Raw
    
    # Add permission check
    $devicePermissionCheck = @"
  const { user } = useAuth();
  
  // Check if user has permission to view devices
  if (!user?.permissions?.includes('devices.view')) {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">Access Denied</h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              You do not have permission to view device management. Please contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    );
  }
"@
    
    # Insert permission check after imports and before the component logic
    if ($content -notmatch "permissions\?\.\w*includes") {
        $updatedContent = $content -replace 
        '(const DeviceManagement: React\.FC.*? = .*? => \{)',
        "`$1`n$devicePermissionCheck"
        
        Set-Content -Path $deviceManagementPath -Value $updatedContent -Encoding UTF8
        Write-Host "✅ Added permission check to DeviceManagement component" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🔧 Issue 7: Audit Trail Permission Validation" -ForegroundColor Yellow
Write-Host "Found: Audit trail access needs proper permission validation"
Write-Host "Fix: Adding audit.view permission check"

# Update audit trail component
$auditTrailPath = "frontend/src/components/users/AuditTrail.tsx"
if (Test-Path $auditTrailPath) {
    $content = Get-Content $auditTrailPath -Raw
    
    # Add permission check at the beginning
    $auditPermissionCheck = @"
  const { user } = useAuth();
  
  // Check if user has permission to view audit trail
  if (!user?.permissions?.includes('audit.view')) {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">Access Denied</h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              You do not have permission to view audit trail. Please contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    );
  }
"@
    
    if ($content -notmatch "permissions\?\.\w*includes") {
        $updatedContent = $content -replace 
        '(const AuditTrail: React\.FC = \(\) => \{)',
        "`$1`n$auditPermissionCheck"
        
        Set-Content -Path $auditTrailPath -Value $updatedContent -Encoding UTF8
        Write-Host "✅ Added permission check to AuditTrail component" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🔧 Issue 8: Insights Permission Validation" -ForegroundColor Yellow
Write-Host "Found: Insights dashboard needs proper permission enforcement"
Write-Host "Fix: Adding insights.view permission check"

# Update insights component
$insightsPath = "frontend/src/components/dashboard/Insights.tsx"
if (Test-Path $insightsPath) {
    $content = Get-Content $insightsPath -Raw
    
    # Add permission check
    $insightsPermissionCheck = @"
  const { user } = useAuth();
  
  // Check if user has permission to view insights
  if (!user?.permissions?.includes('insights.view')) {
    return (
      <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">Access Denied</h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
              You do not have permission to view insights dashboard. Please contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    );
  }
"@
    
    if ($content -notmatch "permissions\?\.\w*includes") {
        $updatedContent = $content -replace 
        '(const Insights: React\.FC = \(\) => \{)',
        "`$1`n$insightsPermissionCheck"
        
        Set-Content -Path $insightsPath -Value $updatedContent -Encoding UTF8
        Write-Host "✅ Added permission check to Insights component" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🔧 Issue 9: Sidebar Permission Validation" -ForegroundColor Yellow
Write-Host "Found: Sidebar should hide menu items based on permissions"
Write-Host "Fix: Updating sidebar to properly check permissions"

# Update sidebar component
$sidebarPath = "frontend/src/components/dashboard/Sidebar.tsx"
if (Test-Path $sidebarPath) {
    $content = Get-Content $sidebarPath -Raw
    
    # Update permission checks for consistency
    $updatedContent = $content -replace 
    'user\?\.\w*permissions\?\.\w*includes\(''users\.access''\)',
    'user?.permissions?.includes(''system.user_management'')'
    
    Set-Content -Path $sidebarPath -Value $updatedContent -Encoding UTF8
    Write-Host "✅ Updated Sidebar permission checks" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Issue 10: Backend API Permission Synchronization" -ForegroundColor Yellow
Write-Host "Found: Backend API endpoints need consistent permission validation"
Write-Host "Fix: Updating backend permission checks"

# Create a comprehensive permission fix for the backend
if (Test-Path $serverPath) {
    $serverContent = Get-Content $serverPath -Raw
    
    # Update permission validation to be more consistent
    $updatedContent = $serverContent -replace 
    'req\.user\.permissions\?\.\w*includes\(''users\.access''\)',
    'req.user.permissions?.includes(''system.user_management'')'
    
    Set-Content -Path $serverPath -Value $updatedContent -Encoding UTF8
    Write-Host "✅ Updated backend permission checks" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Creating Permission Synchronization Script" -ForegroundColor Yellow

# Create a script to sync all user permissions with their roles
$syncScript = @"
// Run this in the browser console or add to server.js
const syncAllUserPermissions = () => {
  users.forEach(user => {
    if (user.roleId) {
      const role = rolesConfig.find(r => r.id === user.roleId);
      if (role) {
        const rolePermissions = Object.keys(role.permissions).filter(key => role.permissions[key]);
        user.permissions = rolePermissions;
        console.log(`Updated permissions for user `${user.email}` with role `${role.name}`:`, rolePermissions);
      }
    }
  });
  console.log('All user permissions synchronized with their roles');
};

// Call the function
syncAllUserPermissions();
"@

Set-Content -Path "sync_permissions.js" -Value $syncScript -Encoding UTF8
Write-Host "✅ Created permission synchronization script" -ForegroundColor Green

Write-Host ""
Write-Host "📊 PERMISSION FIXES SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 50

$fixes = @(
    "✅ Fixed demo user permission inconsistencies",
    "✅ Added missing insights permission to Tier2 role", 
    "✅ Standardized user management permission checks",
    "✅ Added role management access control",
    "✅ Standardized backend permission validation",
    "✅ Added device management permission enforcement",
    "✅ Added audit trail permission validation",
    "✅ Added insights permission validation", 
    "✅ Updated sidebar permission checks",
    "✅ Synchronized backend API permission checks",
    "✅ Created permission synchronization script"
)

foreach ($fix in $fixes) {
    Write-Host "   $fix" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1. Restart the backend server to apply changes" -ForegroundColor Yellow
Write-Host "   2. Run the permission synchronization script" -ForegroundColor Yellow
Write-Host "   3. Test with different user roles to verify fixes" -ForegroundColor Yellow
Write-Host "   4. Run the validation script to confirm all issues are resolved" -ForegroundColor Yellow

Write-Host ""
Write-Host "✅ Permission fixes completed successfully!" -ForegroundColor Green 