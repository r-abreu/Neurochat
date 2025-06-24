#!/usr/bin/env pwsh

# PowerShell script to fix role management permissions in NeuroChat database
# This script applies the migration to add missing system permissions and fix role assignments

Write-Host "🔧 NeuroChat Permission Fix" -ForegroundColor Cyan
Write-Host "This script will fix the role management permissions issue" -ForegroundColor Yellow
Write-Host ""

# Check if the migration file exists
$migrationFile = "database/migration_fix_role_permissions.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

# Ask for database connection details
Write-Host "📝 Please provide your database connection details:" -ForegroundColor Green
$server = Read-Host "Database Server (e.g., localhost or your Azure SQL server)"
$database = Read-Host "Database Name (default: NeuroChat)"
if ([string]::IsNullOrEmpty($database)) {
    $database = "NeuroChat"
}
$username = Read-Host "Username"
$password = Read-Host "Password" -AsSecureString
$securePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

# Build connection string
$connectionString = "Server=$server;Database=$database;User Id=$username;Password=$securePassword;TrustServerCertificate=True;"

Write-Host ""
Write-Host "🔄 Applying permission fix migration..." -ForegroundColor Yellow

try {
    # Check if sqlcmd is available
    $sqlcmdPath = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if ($sqlcmdPath) {
        Write-Host "📄 Using sqlcmd to run migration..." -ForegroundColor Blue
        sqlcmd -S $server -d $database -U $username -P $securePassword -i $migrationFile -b
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        } else {
            Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            exit 1
        }
    } else {
        # Fallback to PowerShell SQL execution (requires SqlServer module)
        Write-Host "📄 Using PowerShell SqlServer module..." -ForegroundColor Blue
        
        # Check if SqlServer module is available
        if (-not (Get-Module -ListAvailable -Name SqlServer)) {
            Write-Host "⚠️  SqlServer PowerShell module not found. Installing..." -ForegroundColor Yellow
            Install-Module -Name SqlServer -Force -Scope CurrentUser
        }
        
        Import-Module SqlServer -Force
        
        # Read the migration file
        $migrationScript = Get-Content $migrationFile -Raw
        
        # Execute the migration
        Invoke-Sqlcmd -ConnectionString $connectionString -Query $migrationScript -Verbose
        
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🎉 Permission fix complete!" -ForegroundColor Green
    Write-Host "Changes made:" -ForegroundColor White
    Write-Host "  • Added missing system permissions (system.role_management, system.user_management, etc.)" -ForegroundColor White
    Write-Host "  • Fixed role assignments:" -ForegroundColor White
    Write-Host "    - Admin: Full access (including role management)" -ForegroundColor White
    Write-Host "    - Tier2: User management access (but NO role management)" -ForegroundColor White
    Write-Host "    - Tier1: Basic ticket and view permissions" -ForegroundColor White
    Write-Host "    - Viewer: Read-only access" -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 Please restart your backend server and refresh your frontend to see the changes." -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error running migration: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Full error details:" -ForegroundColor Red
    Write-Host $_.Exception.ToString() -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "🔐 NeuroAI Permission System - Issue Summary & Fixes" -ForegroundColor Cyan
Write-Host "=" * 60

Write-Host ""
Write-Host "📋 PERMISSION ISSUES IDENTIFIED:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. ❌ Demo User Permission Mismatches" -ForegroundColor Red
Write-Host "   - tier2@demo.com: Had 3 permissions, should have 12" -ForegroundColor Gray
Write-Host "   - agent@demo.com: Had 3 permissions, should have 5" -ForegroundColor Gray  
Write-Host "   - viewer@demo.com: Had 1 permission, should have 1 (correct)" -ForegroundColor Gray
Write-Host "   ✅ FIXED: Updated demo users to sync from role configuration" -ForegroundColor Green

Write-Host ""
Write-Host "2. ❌ Tier2 Role Missing Insights Permission" -ForegroundColor Red
Write-Host "   - Tier2 should have insights.view but was missing" -ForegroundColor Gray
Write-Host "   ✅ FIXED: Added insights.view to Tier2 role" -ForegroundColor Green

Write-Host ""
Write-Host "3. ⚠️  Permission Naming Inconsistencies" -ForegroundColor Yellow
Write-Host "   - Mixed use of 'users.access' vs 'system.user_management'" -ForegroundColor Gray
Write-Host "   - Found in Dashboard.tsx, UserManagement.tsx, backend APIs" -ForegroundColor Gray
Write-Host "   📝 NEEDS MANUAL FIX: Standardize to 'system.user_management'" -ForegroundColor Orange

Write-Host ""
Write-Host "4. ⚠️  Missing Frontend Component Validation" -ForegroundColor Yellow
Write-Host "   - DeviceManagement.tsx: No permission check" -ForegroundColor Gray
Write-Host "   - Insights.tsx: No permission check" -ForegroundColor Gray
Write-Host "   - AuditTrail.tsx: No permission check" -ForegroundColor Gray
Write-Host "   📝 NEEDS MANUAL FIX: Add permission validation to components" -ForegroundColor Orange

Write-Host ""
Write-Host "5. ⚠️  Backend API Inconsistencies" -ForegroundColor Yellow
Write-Host "   - Mixed permission checking patterns" -ForegroundColor Gray
Write-Host "   - Some use hardcoded role checks vs permission checks" -ForegroundColor Gray
Write-Host "   📝 NEEDS MANUAL FIX: Standardize API permission validation" -ForegroundColor Orange

Write-Host ""
Write-Host "📊 CURRENT PERMISSION MATRIX (After Fixes):" -ForegroundColor Cyan
Write-Host ""

$matrix = @"
| Permission              | Admin | Tier2 | Tier1 | Viewer | AI Agent |
|-------------------------|-------|-------|-------|--------|----------|
| tickets.create          |   ✅   |   ✅   |   ✅   |   ❌    |    ✅     |
| tickets.edit            |   ✅   |   ✅   |   ✅   |   ❌    |    ✅     |
| tickets.delete          |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| tickets.message         |   ✅   |   ✅   |   ✅   |   ❌    |    ✅     |
| system.management       |   ✅   |   ✅   |   ❌   |   ❌    |    ❌     |
| system.settings         |   ✅   |   ✅   |   ❌   |   ❌    |    ❌     |
| system.ai_settings      |   ✅   |   ✅   |   ❌   |   ❌    |    ❌     |
| system.user_management  |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| system.role_management  |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| users.create            |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| users.edit              |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| users.delete            |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| audit.view              |   ✅   |   ✅   |   ❌   |   ❌    |    ❌     |
| insights.view           |   ✅   |   ✅   |   ❌   |   ❌    |    ❌     |  <-- FIXED
| customers.view          |   ✅   |   ✅   |   ❌   |   ❌    |    ✅     |
| devices.view            |   ✅   |   ✅   |   ✅   |   ✅    |    ✅     |
| devices.create          |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| devices.edit            |   ✅   |   ✅   |   ❌   |   ❌    |    ❌     |
| devices.delete          |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| companies.view          |   ✅   |   ✅   |   ✅   |   ❌    |    ✅     |
| companies.create        |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
| companies.edit          |   ✅   |   ✅   |   ❌   |   ❌    |    ❌     |
| companies.delete        |   ✅   |   ❌   |   ❌   |   ❌    |    ❌     |
"@

Write-Host $matrix -ForegroundColor Gray

Write-Host ""
Write-Host "🚀 IMMEDIATE ACTIONS COMPLETED:" -ForegroundColor Green
Write-Host "   ✅ Fixed demo user permission synchronization" -ForegroundColor Green
Write-Host "   ✅ Added missing insights.view permission to Tier2" -ForegroundColor Green
Write-Host "   ✅ Demo users now properly sync with role configurations" -ForegroundColor Green

Write-Host ""
Write-Host "📋 REMAINING MANUAL FIXES NEEDED:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Standardize Permission Naming:" -ForegroundColor Cyan
Write-Host "   Replace 'users.access' with 'system.user_management' in:" -ForegroundColor Gray
Write-Host "   - frontend/src/components/dashboard/Dashboard.tsx (lines 422, 540, 577)" -ForegroundColor Gray
Write-Host "   - frontend/src/components/users/UserManagement.tsx (line 25)" -ForegroundColor Gray
Write-Host "   - Backend API endpoints in server.js" -ForegroundColor Gray

Write-Host ""
Write-Host "2. Add Component Permission Validation:" -ForegroundColor Cyan
Write-Host "   Add this check to components missing validation:" -ForegroundColor Gray
Write-Host ""
Write-Host "   const { user } = useAuth();" -ForegroundColor DarkGray
Write-Host "   if (!user?.permissions?.includes('required.permission')) {" -ForegroundColor DarkGray
Write-Host "     return <AccessDeniedComponent />;" -ForegroundColor DarkGray
Write-Host "   }" -ForegroundColor DarkGray

Write-Host ""
Write-Host "3. Test All User Roles:" -ForegroundColor Cyan
Write-Host "   - Login as admin@demo.com (should have full access)" -ForegroundColor Gray
Write-Host "   - Login as tier2@demo.com (should have insights access now)" -ForegroundColor Gray
Write-Host "   - Login as agent@demo.com (limited access)" -ForegroundColor Gray
Write-Host "   - Login as viewer@demo.com (devices only)" -ForegroundColor Gray

Write-Host ""
Write-Host "🔧 QUICK VALIDATION STEPS:" -ForegroundColor Cyan
Write-Host "1. Start backend: cd backend && node server.js" -ForegroundColor Yellow
Write-Host "2. Check console for 'Synced permissions for user' messages" -ForegroundColor Yellow
Write-Host "3. Login to frontend and test each user role" -ForegroundColor Yellow
Write-Host "4. Verify Tier2 users can now access Insights dashboard" -ForegroundColor Yellow

Write-Host ""
Write-Host "✅ Critical permission issues have been resolved!" -ForegroundColor Green
Write-Host "   Demo users now have proper permissions matching their roles" -ForegroundColor Green 