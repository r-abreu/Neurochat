# Test NeuroAI Agent Creation
Write-Host "🤖 NEUROAI AGENT TEST" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Login as admin to get token
Write-Host "`n1. Logging in as admin..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "admin@demo.com"
        password = "demo123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $adminToken = $loginResponse.data.tokens.accessToken
    Write-Host "   ✅ Admin login successful" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check agents list
Write-Host "`n2. Checking agents list..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    $agentsResponse = Invoke-RestMethod -Uri "$baseUrl/api/agents" -Method GET -Headers $headers
    $agents = $agentsResponse.data.agents
    
    Write-Host "   Found $($agents.Count) agents:" -ForegroundColor White
    foreach ($agent in $agents) {
        $statusColor = if ($agent.isOnline) { "Green" } else { "Red" }
        $aiIndicator = if ($agent.isAIAgent) { " 🤖 (AI AGENT)" } else { "" }
        $status = if ($agent.isOnline) { "ONLINE" } else { "OFFLINE" }
        
        Write-Host "   - $($agent.firstName) $($agent.lastName) ($($agent.roleName)) - $status$aiIndicator" -ForegroundColor $statusColor
        Write-Host "     Email: $($agent.email)" -ForegroundColor Gray
        if ($agent.isAIAgent) {
            Write-Host "     Agent Status: $($agent.agentStatus)" -ForegroundColor Cyan
            Write-Host "     Max Concurrent Tickets: $($agent.maxConcurrentTickets)" -ForegroundColor Cyan
        }
    }
    
    # Check if NeuroAI agent exists
    $neuroAI = $agents | Where-Object { $_.isAIAgent -eq $true -or $_.firstName -eq "NeuroAI" }
    if ($neuroAI) {
        Write-Host "`n   ✅ NeuroAI agent found!" -ForegroundColor Green
        Write-Host "      ID: $($neuroAI.id)" -ForegroundColor White
        Write-Host "      Name: $($neuroAI.firstName) $($neuroAI.lastName)" -ForegroundColor White
        Write-Host "      Status: $($neuroAI.agentStatus)" -ForegroundColor White
        Write-Host "      Online: $($neuroAI.isOnline)" -ForegroundColor White
    } else {
        Write-Host "`n   ❌ NeuroAI agent not found!" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Failed to get agents: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check AI configuration
Write-Host "`n3. Checking AI configuration..." -ForegroundColor Yellow
try {
    $aiConfigResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/config" -Method GET -Headers $headers
    $aiConfig = $aiConfigResponse.data.config
    
    Write-Host "   AI Configuration:" -ForegroundColor White
    Write-Host "   - Enabled: $($aiConfig.enabled)" -ForegroundColor $(if ($aiConfig.enabled) { "Green" } else { "Red" })
    Write-Host "   - Agent Name: $($aiConfig.agent_name)" -ForegroundColor White
    Write-Host "   - Model: $($aiConfig.model)" -ForegroundColor White
    Write-Host "   - Confidence Threshold: $($aiConfig.confidence_threshold)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Failed to get AI config: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🏁 Test completed!" -ForegroundColor Cyan 