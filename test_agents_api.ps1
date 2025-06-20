# Test script for agents API with presence indicators

# Function to get auth token
function Get-AuthToken {
    $loginData = @{
        email = "admin@demo.com"
        password = "demo123"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
        return $response.data.tokens.accessToken
    } catch {
        Write-Host "Login failed: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Function to test agents API
function Test-AgentsAPI {
    $token = Get-AuthToken
    if (-not $token) {
        return
    }

    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    try {
        Write-Host "Testing Agents API..." -ForegroundColor Cyan
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/agents" -Method GET -Headers $headers
        
        Write-Host "Agent API Response:" -ForegroundColor Green
        $response.data.agents | ForEach-Object {
            $status = if ($_.isOnline) { "ONLINE" } else { "OFFLINE" }
            Write-Host "  - $($_.firstName) $($_.lastName) ($($_.roleName)) - $status" -ForegroundColor White
            Write-Host "    Email: $($_.email)" -ForegroundColor Gray
            Write-Host "    Last Login: $($_.lastLogin)" -ForegroundColor Gray
            Write-Host "    Last Seen: $($_.lastSeen)" -ForegroundColor Gray
            Write-Host "" 
        }
        
        Write-Host "Summary:" -ForegroundColor Yellow
        $onlineCount = ($response.data.agents | Where-Object { $_.isOnline }).Count
        $totalCount = $response.data.agents.Count
        Write-Host "  Online Agents: $onlineCount / $totalCount" -ForegroundColor White
        
    } catch {
        Write-Host "Agents API failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Run the test
Test-AgentsAPI 