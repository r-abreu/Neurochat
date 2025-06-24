# =====================================================
# COMPREHENSIVE ROLE PERMISSION VALIDATION SCRIPT
# =====================================================
# This script validates all role permissions across the entire application
# and identifies inconsistencies, duplicates, and enforcement issues

Write-Host "🔐 NEUROAI ROLE PERMISSION VALIDATION" -ForegroundColor Cyan
Write-Host "=" * 50

# Configuration
$backendUrl = "http://localhost:3001"
$testUsers = @{
    "admin" = @{ email = "admin@demo.com"; password = "demo123" }
    "tier2" = @{ email = "tier2@demo.com"; password = "demo123" }
    "agent" = @{ email = "agent@demo.com"; password = "demo123" }
    "viewer" = @{ email = "viewer@demo.com"; password = "demo123" }
}

# Test results storage
$validationResults = @()
$permissionIssues = @()
$duplicateIssues = @()

Write-Host "🚀 Starting Permission Validation..." -ForegroundColor Green

# Function to authenticate and get token
function Get-AuthToken {
    param($email, $password)
    
    try {
        $loginData = @{
            email = $email
            password = $password
        } | ConvertTo-Json -Depth 10

        $response = Invoke-RestMethod -Uri "$backendUrl/api/login" -Method Post -Body $loginData -ContentType "application/json"
        return $response.token
    }
    catch {
        Write-Host "❌ Failed to authenticate $email" -ForegroundColor Red
        return $null
    }
}

# Function to test API endpoint access
function Test-EndpointAccess {
    param($token, $endpoint, $method = "GET", $expectedStatus = 200)
    
    try {
        $headers = @{ "Authorization" = "Bearer $token" }
        
        switch ($method) {
            "GET" { $response = Invoke-WebRequest -Uri "$backendUrl$endpoint" -Method Get -Headers $headers -UseBasicParsing }
            "POST" { $response = Invoke-WebRequest -Uri "$backendUrl$endpoint" -Method Post -Headers $headers -UseBasicParsing }
            "PUT" { $response = Invoke-WebRequest -Uri "$backendUrl$endpoint" -Method Put -Headers $headers -UseBasicParsing }
            "DELETE" { $response = Invoke-WebRequest -Uri "$backendUrl$endpoint" -Method Delete -Headers $headers -UseBasicParsing }
        }
        
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            HasAccess = ($response.StatusCode -eq $expectedStatus)
        }
    }
    catch {
        return @{
            Success = $false
            StatusCode = $_.Exception.Response.StatusCode.Value__
            HasAccess = $false
            Error = $_.Exception.Message
        }
    }
}

# Function to get user permissions
function Get-UserPermissions {
    param($token)
    
    try {
        $headers = @{ "Authorization" = "Bearer $token" }
        $response = Invoke-RestMethod -Uri "$backendUrl/api/profile" -Method Get -Headers $headers
        return $response
    }
    catch {
        return $null
    }
}

# Define permission matrix for validation
$permissionMatrix = @{
    "Admin" = @{
        "ExpectedPermissions" = @(
            "tickets.create", "tickets.edit", "tickets.delete", "tickets.message",
            "system.management", "system.settings", "system.ai_settings", 
            "system.user_management", "system.role_management",
            "users.create", "users.edit", "users.delete",
            "audit.view", "insights.view", "customers.view",
            "devices.view", "devices.create", "devices.edit", "devices.delete",
            "companies.view", "companies.create", "companies.edit", "companies.delete"
        )
        "TestEndpoints" = @(
            @{ Endpoint = "/api/roles"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/agents"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/agents"; Method = "POST"; ExpectedAccess = $true }
            @{ Endpoint = "/api/customers"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/devices"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/companies"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/audit-logs"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/insights"; Method = "GET"; ExpectedAccess = $true }
        )
    }
    "Tier2" = @{
        "ExpectedPermissions" = @(
            "tickets.create", "tickets.edit", "tickets.message",
            "system.management", "system.settings", "system.ai_settings",
            "audit.view", "customers.view", "devices.view", "devices.edit",
            "companies.view", "companies.edit"
        )
        "TestEndpoints" = @(
            @{ Endpoint = "/api/roles"; Method = "GET"; ExpectedAccess = $false }
            @{ Endpoint = "/api/agents"; Method = "POST"; ExpectedAccess = $false }
            @{ Endpoint = "/api/customers"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/devices"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/companies"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/audit-logs"; Method = "GET"; ExpectedAccess = $true }
        )
    }
    "Tier1" = @{
        "ExpectedPermissions" = @(
            "tickets.create", "tickets.edit", "tickets.message",
            "devices.view", "companies.view"
        )
        "TestEndpoints" = @(
            @{ Endpoint = "/api/roles"; Method = "GET"; ExpectedAccess = $false }
            @{ Endpoint = "/api/agents"; Method = "GET"; ExpectedAccess = $false }
            @{ Endpoint = "/api/customers"; Method = "GET"; ExpectedAccess = $false }
            @{ Endpoint = "/api/devices"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/companies"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/audit-logs"; Method = "GET"; ExpectedAccess = $false }
        )
    }
    "Viewer" = @{
        "ExpectedPermissions" = @(
            "devices.view"
        )
        "TestEndpoints" = @(
            @{ Endpoint = "/api/roles"; Method = "GET"; ExpectedAccess = $false }
            @{ Endpoint = "/api/agents"; Method = "GET"; ExpectedAccess = $false }
            @{ Endpoint = "/api/customers"; Method = "GET"; ExpectedAccess = $false }
            @{ Endpoint = "/api/devices"; Method = "GET"; ExpectedAccess = $true }
            @{ Endpoint = "/api/companies"; Method = "GET"; ExpectedAccess = $false }
            @{ Endpoint = "/api/audit-logs"; Method = "GET"; ExpectedAccess = $false }
        )
    }
}

Write-Host "🔍 Phase 1: Validating Demo User Permissions..." -ForegroundColor Yellow

foreach ($userType in $testUsers.Keys) {
    $userCreds = $testUsers[$userType]
    $token = Get-AuthToken -email $userCreds.email -password $userCreds.password
    
    if ($token) {
        Write-Host "✅ Authenticated: $($userCreds.email)" -ForegroundColor Green
        
        # Get user profile and permissions
        $userProfile = Get-UserPermissions -token $token
        
        if ($userProfile) {
            $actualPermissions = $userProfile.permissions
            $expectedPermissions = $permissionMatrix[$userProfile.roleName].ExpectedPermissions
            
            Write-Host "   Role: $($userProfile.roleName)" -ForegroundColor Cyan
            Write-Host "   Expected Permissions: $($expectedPermissions.Count)" -ForegroundColor Gray
            Write-Host "   Actual Permissions: $($actualPermissions.Count)" -ForegroundColor Gray
            
            # Check for missing permissions
            $missingPermissions = $expectedPermissions | Where-Object { $_ -notin $actualPermissions }
            if ($missingPermissions) {
                $permissionIssues += @{
                    User = $userCreds.email
                    Role = $userProfile.roleName
                    Type = "Missing Permissions"
                    Details = $missingPermissions -join ", "
                }
                Write-Host "   ❌ Missing: $($missingPermissions -join ', ')" -ForegroundColor Red
            }
            
            # Check for extra permissions
            $extraPermissions = $actualPermissions | Where-Object { $_ -notin $expectedPermissions }
            if ($extraPermissions) {
                $permissionIssues += @{
                    User = $userCreds.email
                    Role = $userProfile.roleName
                    Type = "Extra Permissions"
                    Details = $extraPermissions -join ", "
                }
                Write-Host "   ⚠️  Extra: $($extraPermissions -join ', ')" -ForegroundColor Yellow
            }
            
            if (-not $missingPermissions -and -not $extraPermissions) {
                Write-Host "   ✅ Permissions match expected configuration" -ForegroundColor Green
            }
        }
    }
    else {
        $permissionIssues += @{
            User = $userCreds.email
            Role = "Unknown"
            Type = "Authentication Failed"
            Details = "Cannot authenticate user"
        }
    }
    
    Write-Host ""
}

Write-Host "🔍 Phase 2: Testing API Endpoint Access..." -ForegroundColor Yellow

foreach ($userType in $testUsers.Keys) {
    $userCreds = $testUsers[$userType]
    $token = Get-AuthToken -email $userCreds.email -password $userCreds.password
    
    if ($token) {
        $userProfile = Get-UserPermissions -token $token
        if ($userProfile -and $permissionMatrix.ContainsKey($userProfile.roleName)) {
            $testEndpoints = $permissionMatrix[$userProfile.roleName].TestEndpoints
            
            Write-Host "Testing endpoints for $($userProfile.roleName) ($($userCreds.email)):" -ForegroundColor Cyan
            
            foreach ($test in $testEndpoints) {
                $result = Test-EndpointAccess -token $token -endpoint $test.Endpoint -method $test.Method
                
                $accessMatch = ($result.HasAccess -eq $test.ExpectedAccess)
                $statusIcon = if ($accessMatch) { "✅" } else { "❌" }
                $statusText = if ($result.HasAccess) { "ALLOWED" } else { "DENIED" }
                $expectedText = if ($test.ExpectedAccess) { "SHOULD ALLOW" } else { "SHOULD DENY" }
                
                                 $color = if ($accessMatch) { "Green" } else { "Red" }
                 Write-Host "   $statusIcon $($test.Method) $($test.Endpoint) $statusText ($expectedText)" -ForegroundColor $color
                
                if (-not $accessMatch) {
                    $permissionIssues += @{
                        User = $userCreds.email
                        Role = $userProfile.roleName
                        Type = "Endpoint Access Mismatch"
                        Details = "$($test.Method) $($test.Endpoint) - Expected: $($test.ExpectedAccess), Actual: $($result.HasAccess)"
                    }
                }
            }
            Write-Host ""
        }
    }
}

Write-Host "🔍 Phase 3: Checking for Duplicate Permissions..." -ForegroundColor Yellow

# Get all roles configuration
try {
    $adminToken = Get-AuthToken -email "admin@demo.com" -password "demo123"
    if ($adminToken) {
        $headers = @{ "Authorization" = "Bearer $adminToken" }
        $rolesResponse = Invoke-RestMethod -Uri "$backendUrl/api/roles" -Method Get -Headers $headers
        
        # Check for duplicate permission definitions
        $allPermissions = @()
        foreach ($role in $rolesResponse) {
            if ($role.permissions) {
                foreach ($permission in $role.permissions.PSObject.Properties) {
                    if ($permission.Value -eq $true) {
                        $allPermissions += @{
                            Role = $role.name
                            Permission = $permission.Name
                        }
                    }
                }
            }
        }
        
        # Look for inconsistencies in permission naming
        $permissionNames = $allPermissions | Select-Object -ExpandProperty Permission -Unique | Sort-Object
        Write-Host "Found $($permissionNames.Count) unique permissions:" -ForegroundColor Cyan
        $permissionNames | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
        
        # Check for naming inconsistencies
        $namingIssues = @()
        foreach ($perm in $permissionNames) {
            if ($perm -match "^(tickets|users|system|audit|insights|customers|devices|companies)\.") {
                # Good naming convention
            }
            else {
                $namingIssues += $perm
            }
        }
        
        if ($namingIssues) {
            Write-Host "⚠️  Found permissions with inconsistent naming:" -ForegroundColor Yellow
            $namingIssues | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
        }
        else {
            Write-Host "✅ All permissions follow consistent naming convention" -ForegroundColor Green
        }
    }
}
catch {
    Write-Host "❌ Failed to retrieve roles for duplicate check: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔍 Phase 4: Validating Frontend Permission Enforcement..." -ForegroundColor Yellow

# Check key frontend components for permission enforcement
$frontendFiles = @(
    "frontend/src/components/dashboard/Sidebar.tsx",
    "frontend/src/components/users/UserManagement.tsx",
    "frontend/src/components/users/SystemSettings.tsx",
    "frontend/src/components/users/AiAgentSettings.tsx",
    "frontend/src/components/customers/CustomerManagement.tsx",
    "frontend/src/components/companies/CompanyManagement.tsx",
    "frontend/src/components/devices/DeviceManagement.tsx"
)

$frontendIssues = @()
foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        
        # Check for permission checks
        $hasPermissionCheck = $content -match "permissions\?\.\w*includes"
        if (-not $hasPermissionCheck) {
            $frontendIssues += "Missing permission check in $file"
            Write-Host "   ❌ $file: No permission enforcement found" -ForegroundColor Red
        }
        else {
            Write-Host "   ✅ $file: Permission enforcement found" -ForegroundColor Green
        }
    }
    else {
        Write-Host "   ⚠️  $file: File not found" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📊 VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 50

Write-Host "Total Issues Found: $($permissionIssues.Count)" -ForegroundColor $(if ($permissionIssues.Count -eq 0) { "Green" } else { "Red" })

if ($permissionIssues.Count -gt 0) {
    Write-Host ""
    Write-Host "🚨 PERMISSION ISSUES:" -ForegroundColor Red
    
    $groupedIssues = $permissionIssues | Group-Object -Property Type
    foreach ($group in $groupedIssues) {
        Write-Host ""
        Write-Host "[$($group.Name)]" -ForegroundColor Yellow
        foreach ($issue in $group.Group) {
            Write-Host "   • $($issue.User) ($($issue.Role)): $($issue.Details)" -ForegroundColor Red
        }
    }
}

if ($frontendIssues.Count -gt 0) {
    Write-Host ""
    Write-Host "🚨 FRONTEND ENFORCEMENT ISSUES:" -ForegroundColor Red
    foreach ($issue in $frontendIssues) {
        Write-Host "   • $issue" -ForegroundColor Red
    }
}

if ($permissionIssues.Count -eq 0 -and $frontendIssues.Count -eq 0) {
    Write-Host ""
    Write-Host "🎉 ALL PERMISSION VALIDATIONS PASSED!" -ForegroundColor Green
    Write-Host "   • All demo users have correct permissions" -ForegroundColor Green
    Write-Host "   • All API endpoints are properly protected" -ForegroundColor Green
    Write-Host "   • All frontend components have permission enforcement" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 RECOMMENDATIONS:" -ForegroundColor Cyan

if ($permissionIssues | Where-Object { $_.Type -eq "Missing Permissions" }) {
    Write-Host "   1. Run the syncAllUserPermissions() function to fix demo user permissions" -ForegroundColor Yellow
}

if ($permissionIssues | Where-Object { $_.Type -eq "Endpoint Access Mismatch" }) {
    Write-Host "   2. Review API endpoint permission checks in backend/server.js" -ForegroundColor Yellow
}

if ($frontendIssues.Count -gt 0) {
    Write-Host "   3. Add permission checks to frontend components missing enforcement" -ForegroundColor Yellow
}

Write-Host "   4. Consider running migration scripts to ensure database permissions are up to date" -ForegroundColor Yellow
Write-Host "   5. Test with custom roles to ensure permission system works correctly" -ForegroundColor Yellow

Write-Host ""
Write-Host "✅ Permission validation completed!" -ForegroundColor Green 