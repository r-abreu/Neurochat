# Test script for user permissions
Write-Host "Testing User Permissions System..." -ForegroundColor Cyan

# Function to test permissions for a user
function Test-UserPermissions {
    param($email, $password, $userType)
    
    Write-Host "`n=== Testing $userType ($email) ===" -ForegroundColor Yellow
    
    try {
        # Login
        $loginData = @{
            email = $email
            password = $password
        }
        $loginJson = $loginData | ConvertTo-Json
        $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $loginJson -ContentType "application/json" -TimeoutSec 10
        
        if ($loginResponse.data -and $loginResponse.data.tokens -and $loginResponse.data.tokens.accessToken) {
            $token = $loginResponse.data.tokens.accessToken
            Write-Host "✅ Login successful" -ForegroundColor Green
            Write-Host "   Role: $($loginResponse.data.user.roleName)" -ForegroundColor White
            Write-Host "   Permissions: $($loginResponse.data.user.permissions -join ', ')" -ForegroundColor Gray
            
            $headers = @{
                "Authorization" = "Bearer $token"
                "Content-Type" = "application/json"
            }
            
            # Test Agents API
            Write-Host "`n1. Testing Agents API..." -ForegroundColor Cyan
            try {
                $agentsResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/agents" -Method GET -Headers $headers -TimeoutSec 10
                Write-Host "   ✅ Agents API accessible - Found $($agentsResponse.data.agents.Count) agents" -ForegroundColor Green
            } catch {
                if ($_.Exception.Response.StatusCode -eq 403) {
                    Write-Host "   🚫 Agents API blocked (403 Forbidden) - CORRECT" -ForegroundColor Yellow
                } else {
                    Write-Host "   ❌ Agents API error: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
            
            # Test Roles API
            Write-Host "2. Testing Roles API..." -ForegroundColor Cyan
            try {
                $rolesResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/roles" -Method GET -Headers $headers -TimeoutSec 10
                Write-Host "   ✅ Roles API accessible - Found $($rolesResponse.Count) roles" -ForegroundColor Green
            } catch {
                if ($_.Exception.Response.StatusCode -eq 403) {
                    Write-Host "   🚫 Roles API blocked (403 Forbidden) - CORRECT" -ForegroundColor Yellow
                } else {
                    Write-Host "   ❌ Roles API error: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
            
        } else {
            Write-Host "❌ Login failed for $email" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Error testing $email : $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Wait for server to start
Start-Sleep 5

# Test Admin user
Test-UserPermissions -email "admin@demo.com" -password "demo123" -userType "Admin"

# Test Tier2 user  
Test-UserPermissions -email "mike@demo.com" -password "demo123" -userType "Tier2"

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "✅ Admin should have access to both Agents and Roles API" -ForegroundColor Green
Write-Host "🚫 Tier2 should be blocked from both Agents and Roles API (403 Forbidden)" -ForegroundColor Yellow
Write-Host "`nTest completed." -ForegroundColor Cyan 