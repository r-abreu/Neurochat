# Test backend server status and agent sessions

Write-Host "Testing Backend Server..." -ForegroundColor Cyan

try {
    # Test if server is running
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/categories" -Method GET -TimeoutSec 5
    Write-Host "Backend server is running!" -ForegroundColor Green
    
    # Test agents API
    Write-Host "Testing agents API..." -ForegroundColor Yellow
    
    # Login first
    $loginData = @{
        email = "admin@demo.com"
        password = "demo123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $token = $loginResponse.data.tokens.accessToken
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $agentsResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/agents" -Method GET -Headers $headers
    
    Write-Host "Agents found:" -ForegroundColor White
    foreach ($agent in $agentsResponse.data.agents) {
        $status = if ($agent.isOnline) { "ONLINE" } else { "OFFLINE" }
        Write-Host "  - $($agent.firstName) $($agent.lastName) - $status" -ForegroundColor $(if ($agent.isOnline) { "Green" } else { "Red" })
    }
    
} catch {
    Write-Host "Backend server is NOT running or there's an error:" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Make sure to run 'npm start' in the backend directory" -ForegroundColor Yellow
} 