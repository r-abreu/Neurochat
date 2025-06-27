# Debug Auto-Claim Functionality
# This script helps identify why auto-claim is not working

Write-Host "=== Auto-Claim Debugging Script ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:3001"
$agentEmail = "agent@demo.com"
$agentPassword = "demo123"

# Function to make API requests with error handling
function Invoke-ApiRequest {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            $params.Headers['Content-Type'] = 'application/json'
        }
        
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        Write-Host "❌ API Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            try {
                $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
                Write-Host "   Details: $($errorObj.error.message)" -ForegroundColor Red
            } catch {
                Write-Host "   Raw Error: $($_.ErrorDetails.Message)" -ForegroundColor Red
            }
        }
        return $null
    }
}

Write-Host "🔍 Step 1: Testing Agent Login and Permissions" -ForegroundColor Yellow
$agentLogin = Invoke-ApiRequest -Uri "$baseUrl/api/auth/login" -Method POST -Body @{
    email = $agentEmail
    password = $agentPassword
}

if (-not $agentLogin) {
    Write-Host "❌ Agent login failed!" -ForegroundColor Red
    exit 1
}

$agentToken = $agentLogin.token
$agentId = $agentLogin.user.id
$agentName = "$($agentLogin.user.firstName) $($agentLogin.user.lastName)"
$agentRole = $agentLogin.user.role
$agentPermissions = $agentLogin.user.permissions -join ", "

Write-Host "✅ Agent login successful" -ForegroundColor Green
Write-Host "   ID: $agentId" -ForegroundColor White
Write-Host "   Name: $agentName" -ForegroundColor White
Write-Host "   Role: $agentRole" -ForegroundColor White
Write-Host "   Permissions: $agentPermissions" -ForegroundColor White

# Check if agent has tickets.edit permission
if ($agentLogin.user.permissions -contains "tickets.edit") {
    Write-Host "✅ Agent has 'tickets.edit' permission" -ForegroundColor Green
} else {
    Write-Host "❌ Agent MISSING 'tickets.edit' permission - Auto-claim will fail!" -ForegroundColor Red
}

Write-Host "`n🔍 Step 2: Testing Ticket Creation" -ForegroundColor Yellow
$customerLogin = Invoke-ApiRequest -Uri "$baseUrl/api/auth/login" -Method POST -Body @{
    email = "customer@demo.com"
    password = "demo123"
}

if (-not $customerLogin) {
    Write-Host "❌ Customer login failed!" -ForegroundColor Red
    exit 1
}

$customerToken = $customerLogin.token
$newTicket = Invoke-ApiRequest -Uri "$baseUrl/api/tickets" -Method POST -Headers @{
    'Authorization' = "Bearer $customerToken"
} -Body @{
    title = "Debug Auto-Claim Test"
    description = "Testing auto-claim debugging"
    priority = "medium"
    categoryId = "1"
    customerName = "Debug Customer"
    customerEmail = "customer@demo.com"
}

if (-not $newTicket) {
    Write-Host "❌ Ticket creation failed!" -ForegroundColor Red
    exit 1
}

$ticketId = $newTicket.data.ticket.id
$ticketNumber = $newTicket.data.ticket.ticketNumber
Write-Host "✅ Test ticket created: $ticketNumber (ID: $ticketId)" -ForegroundColor Green
Write-Host "   Status: $($newTicket.data.ticket.status)" -ForegroundColor White
Write-Host "   Agent: $(if ($newTicket.data.ticket.agentId) { $newTicket.data.ticket.agentId } else { 'Unassigned' })" -ForegroundColor White

Write-Host "`n🔍 Step 3: Debugging Checklist" -ForegroundColor Yellow
Write-Host "Please check the following manually:" -ForegroundColor White
Write-Host ""

Write-Host "📋 Frontend Requirements:" -ForegroundColor Cyan
Write-Host "1. Open browser dev tools (F12)" -ForegroundColor White
Write-Host "2. Navigate to NeuroChat frontend (http://localhost:3000)" -ForegroundColor White
Write-Host "3. Login as agent: $agentEmail / $agentPassword" -ForegroundColor White
Write-Host "4. Check Console for messages like:" -ForegroundColor White
Write-Host "   - '🚀 Dashboard: Joining agent dashboard for: ...' " -ForegroundColor Gray
Write-Host "   - '✅ agent_dashboard_join event emitted successfully'" -ForegroundColor Gray
Write-Host "   - '👨‍💼 Emitting agent_dashboard_join event: ...'" -ForegroundColor Gray
Write-Host ""

Write-Host "📋 Backend Socket Tracking:" -ForegroundColor Cyan
Write-Host "5. Check backend console for messages like:" -ForegroundColor White
Write-Host "   - '🔧 BACKEND: Received agent_dashboard_join event: ...'" -ForegroundColor Gray
Write-Host "   - '👨‍💼 Agent [Name] ([ID]) joined dashboard'" -ForegroundColor Gray
Write-Host "   - '🔧 BACKEND: Agent sessions after join: ...'" -ForegroundColor Gray
Write-Host "   - '🔧 BACKEND: Socket to agent map: ...'" -ForegroundColor Gray
Write-Host ""

Write-Host "📋 Auto-Claim Testing:" -ForegroundColor Cyan
Write-Host "6. Navigate to the test ticket: $ticketNumber" -ForegroundColor White
Write-Host "7. Start typing in the message input field" -ForegroundColor White
Write-Host "8. Check Console for messages like:" -ForegroundColor White
Write-Host "   - '🔤 Agent started typing, emitting typing_start'" -ForegroundColor Gray
Write-Host "   - '⌨️ Agent typing started: ...'" -ForegroundColor Gray
Write-Host "   - '🤖 Typing detected from agent: [ID]'" -ForegroundColor Gray
Write-Host "   - '🎫 Found ticket for auto-claim check: ...'" -ForegroundColor Gray
Write-Host "   - '🚀 Auto-claiming ticket due to agent typing...'" -ForegroundColor Gray
Write-Host "   - '✅ Agent has permission to claim tickets, proceeding with auto-claim'" -ForegroundColor Gray
Write-Host ""

Write-Host "📋 Expected Results:" -ForegroundColor Cyan
Write-Host "9. Ticket should auto-claim and status should change to 'in_progress'" -ForegroundColor White
Write-Host "10. You should see notifications about the auto-claim" -ForegroundColor White
Write-Host ""

Write-Host "🔧 Common Issues and Solutions:" -ForegroundColor Yellow
Write-Host ""
Write-Host "❌ Issue: No 'agent_dashboard_join' events in backend console" -ForegroundColor Red
Write-Host "   Solution: Check if agent is properly logging into dashboard" -ForegroundColor White
Write-Host "   - Make sure to navigate to dashboard after login" -ForegroundColor White
Write-Host "   - Check browser console for socket connection errors" -ForegroundColor White
Write-Host ""

Write-Host "❌ Issue: 'agent_dashboard_join' events seen but no socketToAgentMap entries" -ForegroundColor Red
Write-Host "   Solution: Check socket connection status" -ForegroundColor White
Write-Host "   - Verify WebSocket connection is established" -ForegroundColor White
Write-Host "   - Check for network issues or firewall blocking" -ForegroundColor White
Write-Host ""

Write-Host "❌ Issue: 'typing_start' events seen but no auto-claim" -ForegroundColor Red
Write-Host "   Solution: Check agent permissions and ticket status" -ForegroundColor White
Write-Host "   - Verify agent has 'tickets.edit' permission" -ForegroundColor White
Write-Host "   - Ensure ticket is unassigned or assigned to AI" -ForegroundColor White
Write-Host "   - Check if socketToAgentMap contains the agent" -ForegroundColor White
Write-Host ""

Write-Host "❌ Issue: Auto-claim logic runs but doesn't persist" -ForegroundColor Red
Write-Host "   Solution: Check backend ticket update logic" -ForegroundColor White
Write-Host "   - Verify ticket object is being modified correctly" -ForegroundColor White
Write-Host "   - Check if socket events are being emitted" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Advanced Debugging Commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "To check agent permissions:" -ForegroundColor White
Write-Host "curl -H 'Authorization: Bearer $agentToken' $baseUrl/api/auth/me" -ForegroundColor Gray
Write-Host ""
Write-Host "To check ticket status:" -ForegroundColor White
Write-Host "curl -H 'Authorization: Bearer $agentToken' $baseUrl/api/tickets/$ticketId" -ForegroundColor Gray
Write-Host ""
Write-Host "To manually claim ticket (for comparison):" -ForegroundColor White
Write-Host "curl -X POST -H 'Authorization: Bearer $agentToken' $baseUrl/api/tickets/$ticketId/claim" -ForegroundColor Gray
Write-Host ""

Write-Host "✨ Happy Debugging! Follow the checklist above to identify the issue." -ForegroundColor Green 