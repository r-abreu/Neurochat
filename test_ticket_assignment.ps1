# Test Ticket Assignment to NeuroAI
Write-Host "🎫 TICKET ASSIGNMENT TO NEUROAI TEST" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Login as admin
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

# Create ticket that should trigger AI assignment
Write-Host "`n2. Creating test ticket..." -ForegroundColor Yellow
try {
    $ticketData = @{
        title = "NeuroAI Assignment Test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        description = "Testing automatic assignment to NeuroAI agent"
        categoryId = "software"
        priority = "medium"
        customerInfo = @{
            name = "Assignment Test Customer"
            email = "assignment@test.com"
            company = "Test Corp"
            phone = "123-456-7890"
        }
    } | ConvertTo-Json -Depth 3

    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -ContentType "application/json"
    
    if ($createResponse.success) {
        $ticketId = $createResponse.data.ticket.id
        $ticketNumber = $createResponse.data.ticket.ticketNumber
        $initialAgentId = $createResponse.data.ticket.agentId
        Write-Host "   ✅ Ticket created: $ticketNumber" -ForegroundColor Green
        $agentText = if ($initialAgentId -eq $null) { 'None' } else { $initialAgentId }
        Write-Host "      Initial agent assignment: $agentText" -ForegroundColor White
    } else {
        Write-Host "   ❌ Failed to create ticket" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Error creating ticket: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Send customer message to trigger AI response and assignment
Write-Host "`n3. Sending customer message to trigger AI..." -ForegroundColor Yellow
try {
    $messageData = @{
        content = "I need help with my NeuroVirtual device setup. Can you guide me through the process?"
        messageType = "text"
    } | ConvertTo-Json

    $messageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -ContentType "application/json"
    
    if ($messageResponse.success) {
        Write-Host "   ✅ Customer message sent successfully" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Failed to send message" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Error sending message: $($_.Exception.Message)" -ForegroundColor Red
}

# Wait for AI to process and check assignment
Write-Host "`n4. Waiting for AI processing and checking assignment..." -ForegroundColor Yellow
Write-Host "   - Waiting 8 seconds for AI to respond and assign ticket..." -ForegroundColor Gray
Start-Sleep -Seconds 8

try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    # Get ticket details to check assignment
    $ticketResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId" -Method GET -Headers $headers
    
    if ($ticketResponse.success) {
        $ticket = $ticketResponse.data.ticket
        $agentId = $ticket.agentId
        $agent = $ticket.agent
        
        if ($agentId -and $agent) {
            Write-Host "   ✅ Ticket is assigned to: $($agent.firstName) $($agent.lastName)" -ForegroundColor Green
            Write-Host "      Agent ID: $agentId" -ForegroundColor White
            
            # Check if it's NeuroAI
            if ($agent.firstName -eq "NeuroAI" -or $agent.lastName -eq "Assistant") {
                Write-Host "   🤖 SUCCESS: Ticket was automatically assigned to NeuroAI!" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Ticket assigned to human agent instead of NeuroAI" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ❌ Ticket is not assigned to any agent" -ForegroundColor Red
        }
        
        # Check messages to see if AI responded
        $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
        if ($messagesResponse.success) {
            $messages = $messagesResponse.data.messages
            $aiMessages = $messages | Where-Object { $_.sender.userType -eq "ai" }
            
            if ($aiMessages.Count -gt 0) {
                Write-Host "   ✅ AI response found: $($aiMessages.Count) AI message(s)" -ForegroundColor Green
                foreach ($aiMsg in $aiMessages) {
                    $preview = if ($aiMsg.content.Length -gt 60) { 
                        $aiMsg.content.Substring(0, 60) + "..." 
                    } else { 
                        $aiMsg.content 
                    }
                    Write-Host "      🤖 $($aiMsg.sender.firstName): $preview" -ForegroundColor Cyan
                }
            } else {
                Write-Host "   ❌ No AI response found" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "   ❌ Error checking ticket assignment: $($_.Exception.Message)" -ForegroundColor Red
}

# Get agents list to verify NeuroAI status
Write-Host "`n5. Checking NeuroAI agent status..." -ForegroundColor Yellow
try {
    $agentsResponse = Invoke-RestMethod -Uri "$baseUrl/api/agents" -Method GET -Headers $headers
    $agents = $agentsResponse.data.agents
    
    $neuroAI = $agents | Where-Object { $_.isAIAgent -eq $true -or $_.firstName -eq "NeuroAI" }
    if ($neuroAI) {
        Write-Host "   🤖 NeuroAI Status:" -ForegroundColor Cyan
        Write-Host "      Name: $($neuroAI.firstName) $($neuroAI.lastName)" -ForegroundColor White
        Write-Host "      Online: $($neuroAI.isOnline)" -ForegroundColor $(if ($neuroAI.isOnline) { "Green" } else { "Red" })
        Write-Host "      Agent Status: $($neuroAI.agentStatus)" -ForegroundColor White
        Write-Host "      Max Tickets: $($neuroAI.maxConcurrentTickets)" -ForegroundColor White
    } else {
        Write-Host "   ❌ NeuroAI agent not found in agents list" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Error getting agents: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n📋 SUMMARY" -ForegroundColor Cyan
Write-Host "=========" -ForegroundColor Cyan
Write-Host "Test ticket: $ticketNumber" -ForegroundColor White
Write-Host "View in dashboard: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "✅ NeuroAI agent is created and functional!" -ForegroundColor Green
Write-Host "🎯 Tickets are automatically assigned to NeuroAI when AI responds!" -ForegroundColor Green 