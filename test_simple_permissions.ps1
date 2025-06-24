# Simple permissions test
Write-Host "Testing Permissions..." -ForegroundColor Cyan

# Test Admin
Write-Host "`nTesting Admin..." -ForegroundColor Yellow
try {
    $adminLogin = @{ email = "admin@demo.com"; password = "demo123" } | ConvertTo-Json
    $adminAuth = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $adminLogin -ContentType "application/json"
    $adminHeaders = @{ "Authorization" = "Bearer $($adminAuth.data.tokens.accessToken)" }
    
    # Test agents
    try {
        $agents = Invoke-RestMethod -Uri "http://localhost:3001/api/agents" -Headers $adminHeaders
        Write-Host "Admin Agents: SUCCESS - $($agents.data.agents.Count) agents" -ForegroundColor Green
    } catch {
        Write-Host "Admin Agents: FAILED - $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
    
    # Test roles
    try {
        $roles = Invoke-RestMethod -Uri "http://localhost:3001/api/roles" -Headers $adminHeaders
        Write-Host "Admin Roles: SUCCESS - $($roles.Count) roles" -ForegroundColor Green
    } catch {
        Write-Host "Admin Roles: FAILED - $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "Admin login failed" -ForegroundColor Red
}

# Test Tier2
Write-Host "`nTesting Tier2..." -ForegroundColor Yellow
try {
    $tier2Login = @{ email = "mike@demo.com"; password = "demo123" } | ConvertTo-Json
    $tier2Auth = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $tier2Login -ContentType "application/json"
    $tier2Headers = @{ "Authorization" = "Bearer $($tier2Auth.data.tokens.accessToken)" }
    
    Write-Host "Tier2 permissions: $($tier2Auth.data.user.permissions -join ', ')" -ForegroundColor Gray
    
    # Test agents
    try {
        $agents = Invoke-RestMethod -Uri "http://localhost:3001/api/agents" -Headers $tier2Headers
        Write-Host "Tier2 Agents: UNEXPECTED ACCESS - $($agents.data.agents.Count) agents" -ForegroundColor Red
    } catch {
        Write-Host "Tier2 Agents: CORRECTLY BLOCKED - $($_.Exception.Response.StatusCode)" -ForegroundColor Green
    }
    
    # Test roles
    try {
        $roles = Invoke-RestMethod -Uri "http://localhost:3001/api/roles" -Headers $tier2Headers
        Write-Host "Tier2 Roles: UNEXPECTED ACCESS - $($roles.Count) roles" -ForegroundColor Red
    } catch {
        Write-Host "Tier2 Roles: CORRECTLY BLOCKED - $($_.Exception.Response.StatusCode)" -ForegroundColor Green
    }
} catch {
    Write-Host "Tier2 login failed" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Cyan 