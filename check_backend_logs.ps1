# Check backend process and logs

Write-Host "Checking backend process..." -ForegroundColor Cyan

# Check if node process is running
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found Node.js processes running:" -ForegroundColor Green
    foreach ($process in $nodeProcesses) {
        Write-Host "  PID: $($process.Id) - Started: $($process.StartTime)" -ForegroundColor White
    }
    
    # Test the API again
    Write-Host "`nTesting API after potential agent connection..." -ForegroundColor Yellow
    
    try {
        # Login and check agents
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
        
        Write-Host "Current agent status:" -ForegroundColor White
        foreach ($agent in $agentsResponse.data.agents) {
            $status = if ($agent.isOnline) { "ONLINE" } else { "OFFLINE" }
            $color = if ($agent.isOnline) { "Green" } else { "Red" }
            Write-Host "  - $($agent.firstName) $($agent.lastName) - $status" -ForegroundColor $color
        }
        
        $onlineCount = ($agentsResponse.data.agents | Where-Object { $_.isOnline }).Count
        Write-Host "`nOnline agents: $onlineCount / $($agentsResponse.data.agents.Count)" -ForegroundColor $(if ($onlineCount -gt 0) { "Green" } else { "Yellow" })
        
    } catch {
        Write-Host "Error testing API: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} else {
    Write-Host "No Node.js processes found. Backend may not be running." -ForegroundColor Red
    Write-Host "Please start the backend with 'npm start' in the backend directory." -ForegroundColor Yellow
}

Write-Host "`nNote: If you just refreshed the browser, wait a few seconds and run this script again to see if agents come online." -ForegroundColor Cyan 