# Simple Auto-Claim Test Script
# This script tests the core functionality step by step

Write-Host "=== Simple Auto-Claim Test ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:3001"

# Test 1: Agent Login
Write-Host "🔍 Step 1: Testing Agent Login" -ForegroundColor Yellow
try {
    $agentLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body (@{
        email = "agent@demo.com"
        password = "demo123"
    } | ConvertTo-Json) -ContentType 'application/json'
    
    Write-Host "✅ Agent login successful" -ForegroundColor Green
    Write-Host "   ID: $($agentLogin.user.id)" -ForegroundColor White
    Write-Host "   Name: $($agentLogin.user.firstName) $($agentLogin.user.lastName)" -ForegroundColor White
    Write-Host "   Role: $($agentLogin.user.role)" -ForegroundColor White
    Write-Host "   Permissions: $($agentLogin.user.permissions -join ', ')" -ForegroundColor White
    
    # Check permissions
    if ($agentLogin.user.permissions -contains "tickets.edit") {
        Write-Host "✅ Agent has 'tickets.edit' permission" -ForegroundColor Green
    } else {
        Write-Host "❌ Agent MISSING 'tickets.edit' permission - Auto-claim will fail!" -ForegroundColor Red
    }
    
    $agentToken = $agentLogin.token
    $agentId = $agentLogin.user.id
    
} catch {
    Write-Host "❌ Agent login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Create Test Ticket
Write-Host "🔍 Step 2: Creating Test Ticket" -ForegroundColor Yellow
try {
    $customerLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body (@{
        email = "customer@demo.com"
        password = "demo123"
    } | ConvertTo-Json) -ContentType 'application/json'
    
    $newTicket = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Headers @{
        'Authorization' = "Bearer $($customerLogin.token)"
    } -Body (@{
        title = "Auto-Claim Test Ticket"
        description = "This ticket is for testing auto-claim functionality"
        priority = "medium"
        categoryId = "1"
        customerName = "Test Customer"
        customerEmail = "customer@demo.com"
    } | ConvertTo-Json) -ContentType 'application/json'
    
    $ticketId = $newTicket.data.ticket.id
    $ticketNumber = $newTicket.data.ticket.ticketNumber
    
    Write-Host "✅ Test ticket created successfully" -ForegroundColor Green
    Write-Host "   Number: $ticketNumber" -ForegroundColor White
    Write-Host "   ID: $ticketId" -ForegroundColor White
    Write-Host "   Status: $($newTicket.data.ticket.status)" -ForegroundColor White
    Write-Host "   Current Agent: $(if ($newTicket.data.ticket.agentId) { $newTicket.data.ticket.agentId } else { 'Unassigned' })" -ForegroundColor White
    
} catch {
    Write-Host "❌ Ticket creation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Manual Claim Test (for comparison)
Write-Host "🔍 Step 3: Testing Manual Claim (for comparison)" -ForegroundColor Yellow
try {
    $claimResult = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/claim" -Method POST -Headers @{
        'Authorization' = "Bearer $agentToken"
    }
    
    Write-Host "✅ Manual claim successful" -ForegroundColor Green
    Write-Host "   Ticket is now assigned to agent" -ForegroundColor White
    
    # Release the ticket for auto-claim testing
    Write-Host "🔄 Releasing ticket for auto-claim test..." -ForegroundColor Yellow
    $releaseResult = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/release" -Method POST -Headers @{
        'Authorization' = "Bearer $agentToken"
    }
    Write-Host "✅ Ticket released successfully" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Manual claim failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "This might indicate a permissions issue" -ForegroundColor Yellow
}

Write-Host ""

# Test 4: Instructions for Auto-Claim Testing
Write-Host "🔍 Step 4: Auto-Claim Testing Instructions" -ForegroundColor Yellow
Write-Host ""
Write-Host "Now test the auto-claim functionality manually:" -ForegroundColor White
Write-Host ""
Write-Host "1. Open your browser and navigate to: http://localhost:3000" -ForegroundColor Cyan
Write-Host "2. Login as agent: agent@demo.com / demo123" -ForegroundColor Cyan
Write-Host "3. Open browser DevTools (F12) and watch the Console" -ForegroundColor Cyan
Write-Host "4. Navigate to the test ticket: $ticketNumber" -ForegroundColor Cyan
Write-Host "5. Click in the message input field and start typing" -ForegroundColor Cyan
Write-Host ""

Write-Host "Expected Console Messages (Frontend):" -ForegroundColor Green
Write-Host "  - '🚀 Dashboard: Joining agent dashboard for: ...' " -ForegroundColor Gray
Write-Host "  - '✅ agent_dashboard_join event emitted successfully'" -ForegroundColor Gray
Write-Host "  - '🔤 Agent started typing, emitting typing_start'" -ForegroundColor Gray
Write-Host ""

Write-Host "Expected Console Messages (Backend):" -ForegroundColor Green
Write-Host "  - '🔧 BACKEND: Received agent_dashboard_join event: ...'" -ForegroundColor Gray
Write-Host "  - '👨‍💼 Agent [Name] ([ID]) joined dashboard'" -ForegroundColor Gray
Write-Host "  - '⌨️ Agent typing started: ...'" -ForegroundColor Gray
Write-Host "  - '🤖 Typing detected from agent: [ID]'" -ForegroundColor Gray
Write-Host "  - '🚀 Auto-claiming ticket due to agent typing...'" -ForegroundColor Gray
Write-Host "  - '🎉 Auto-claim completed successfully'" -ForegroundColor Gray
Write-Host ""

Write-Host "If you don't see these messages, check:" -ForegroundColor Yellow
Write-Host "❓ Is the agent properly connected to the dashboard socket?" -ForegroundColor Red
Write-Host "❓ Is the typing event being triggered?" -ForegroundColor Red
Write-Host "❓ Is the socketToAgentMap populated?" -ForegroundColor Red
Write-Host ""

Write-Host "💡 Troubleshooting Tips:" -ForegroundColor Cyan
Write-Host "- Refresh the page and try again" -ForegroundColor White
Write-Host "- Check if both frontend and backend are running" -ForegroundColor White
Write-Host "- Make sure you're logged in as an agent (not customer)" -ForegroundColor White
Write-Host "- Try manually claiming and releasing the ticket first" -ForegroundColor White
Write-Host ""

Write-Host "Test ticket details:" -ForegroundColor Green
Write-Host "  Number: $ticketNumber" -ForegroundColor White
Write-Host "  ID: $ticketId" -ForegroundColor White
Write-Host "  Agent ID: $agentId" -ForegroundColor White
Write-Host ""

Write-Host "🎯 Happy Testing!" -ForegroundColor Green 