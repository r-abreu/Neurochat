# Test Auto-Claim Functionality When Agent Types
# This script tests that tickets are automatically claimed when an agent starts typing

Write-Host "=== Testing Auto-Claim on Agent Typing ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:3001"
$agentEmail = "agent@demo.com"
$agentPassword = "demo123"
$customerEmail = "customer@demo.com"
$customerPassword = "demo123"

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
            $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "   Details: $($errorObj.error.message)" -ForegroundColor Red
        }
        return $null
    }
}

# Step 1: Login as customer to create a ticket
Write-Host "👤 Logging in as customer..." -ForegroundColor Yellow
$customerLogin = Invoke-ApiRequest -Uri "$baseUrl/api/auth/login" -Method POST -Body @{
    email = $customerEmail
    password = $customerPassword
}

if (-not $customerLogin) {
    Write-Host "❌ Failed to login as customer" -ForegroundColor Red
    exit 1
}

$customerToken = $customerLogin.token
Write-Host "✅ Customer login successful" -ForegroundColor Green

# Step 2: Create a new ticket (should be unassigned)
Write-Host "🎫 Creating a new ticket..." -ForegroundColor Yellow
$newTicket = Invoke-ApiRequest -Uri "$baseUrl/api/tickets" -Method POST -Headers @{
    'Authorization' = "Bearer $customerToken"
} -Body @{
    title = "Auto-Claim Test Ticket"
    description = "This ticket will be used to test auto-claim functionality when agent starts typing"
    priority = "medium"
    categoryId = "1"
    customerName = "Test Customer"
    customerEmail = $customerEmail
}

if (-not $newTicket) {
    Write-Host "❌ Failed to create ticket" -ForegroundColor Red
    exit 1
}

$ticketId = $newTicket.data.ticket.id
$ticketNumber = $newTicket.data.ticket.ticketNumber
Write-Host "✅ Ticket created: $ticketNumber (ID: $ticketId)" -ForegroundColor Green
Write-Host "   Status: $($newTicket.data.ticket.status)" -ForegroundColor White
Write-Host "   Agent: $(if ($newTicket.data.ticket.agentId) { $newTicket.data.ticket.agentId } else { 'Unassigned' })" -ForegroundColor White

# Step 3: Login as agent
Write-Host "`n👨‍💼 Logging in as agent..." -ForegroundColor Yellow
$agentLogin = Invoke-ApiRequest -Uri "$baseUrl/api/auth/login" -Method POST -Body @{
    email = $agentEmail
    password = $agentPassword
}

if (-not $agentLogin) {
    Write-Host "❌ Failed to login as agent" -ForegroundColor Red
    exit 1
}

$agentToken = $agentLogin.token
$agentId = $agentLogin.user.id
$agentName = "$($agentLogin.user.firstName) $($agentLogin.user.lastName)"
Write-Host "✅ Agent login successful: $agentName (ID: $agentId)" -ForegroundColor Green

# Step 4: Check ticket status before auto-claim
Write-Host "`n🔍 Checking ticket status before auto-claim..." -ForegroundColor Yellow
$ticketBefore = Invoke-ApiRequest -Uri "$baseUrl/api/tickets/$ticketId" -Headers @{
    'Authorization' = "Bearer $agentToken"
}

if ($ticketBefore) {
    Write-Host "✅ Ticket status before auto-claim:" -ForegroundColor Green
    Write-Host "   Status: $($ticketBefore.data.ticket.status)" -ForegroundColor White
    Write-Host "   Agent: $(if ($ticketBefore.data.ticket.agentId) { $ticketBefore.data.ticket.agentId } else { 'Unassigned' })" -ForegroundColor White
} else {
    Write-Host "❌ Failed to get ticket details" -ForegroundColor Red
    exit 1
}

# Step 5: Instructions for manual testing
Write-Host "`n🔧 MANUAL TESTING REQUIRED:" -ForegroundColor Cyan
Write-Host "To test the auto-claim functionality, you need to:" -ForegroundColor White
Write-Host "1. Open the NeuroChat frontend (http://localhost:3000)" -ForegroundColor White
Write-Host "2. Login as agent: $agentEmail / $agentPassword" -ForegroundColor White
Write-Host "3. Navigate to ticket: $ticketNumber" -ForegroundColor White
Write-Host "4. Start typing in the message input field" -ForegroundColor White
Write-Host "5. The ticket should auto-claim to the agent and status should change to 'in_progress'" -ForegroundColor White

Write-Host "`n📋 Expected Behavior:" -ForegroundColor Cyan
Write-Host "• When agent starts typing, ticket should auto-claim" -ForegroundColor White
Write-Host "• Ticket status should change from 'new' to 'in_progress'" -ForegroundColor White
Write-Host "• Agent should be assigned to the ticket" -ForegroundColor White
Write-Host "• Other users in the ticket should see the auto-claim notification" -ForegroundColor White

# Step 6: Provide verification endpoint
Write-Host "`n🔍 To verify auto-claim worked, check the ticket again:" -ForegroundColor Yellow
Write-Host "curl -H 'Authorization: Bearer $agentToken' $baseUrl/api/tickets/$ticketId" -ForegroundColor Gray

Write-Host "`n✨ Test setup complete! Please perform manual testing steps above." -ForegroundColor Green 