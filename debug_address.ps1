# Debug script for address field issue
Write-Host "=== DEBUGGING ADDRESS FIELD ISSUE ==="

# 1. Login
Write-Host "`n1. LOGIN TEST"
$loginBody = @{ email = 'agent@demo.com'; password = 'demo123' } | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
$token = $loginResponse.data.tokens.accessToken
Write-Host "Token obtained: $($token.Substring(0,30))..."

# 2. Get tickets and examine their structure
Write-Host "`n2. TICKETS ANALYSIS"
$headers = @{ 'Authorization' = "Bearer $token"; 'Content-Type' = 'application/json' }
$ticketsResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/tickets' -Method GET -Headers $headers
$tickets = $ticketsResponse.data.tickets

Write-Host "Total tickets: $($tickets.Count)"
Write-Host "`nExamining each ticket for address field:"

foreach ($ticket in $tickets) {
    Write-Host "  Ticket $($ticket.id):"
    Write-Host "    - customerAddress: '$($ticket.customerAddress)'"
    Write-Host "    - customerName: '$($ticket.customerName)'"
    Write-Host "    - customerPhone: '$($ticket.customerPhone)'"
    Write-Host "    - customerCompany: '$($ticket.customerCompany)'"
    Write-Host "    - Has customerAddress: $($null -ne $ticket.customerAddress)"
    Write-Host "    - Address length: $($ticket.customerAddress.Length)"
    Write-Host ""
}

# 3. Pick first ticket and test update
$testTicket = $tickets[0]
Write-Host "3. TESTING UPDATE ON TICKET: $($testTicket.id)"
Write-Host "Original address: '$($testTicket.customerAddress)'"

# 4. Test address update
$newAddress = "TEST UPDATE ADDRESS - Line 1`nLine 2`nLine 3"
$updateData = @{
    customerAddress = $newAddress
    title = $testTicket.title
    description = $testTicket.description
    priority = $testTicket.priority
    status = $testTicket.status
    customerName = $testTicket.customerName
    customerEmail = $testTicket.customerEmail
    customerPhone = $testTicket.customerPhone
    customerCompany = $testTicket.customerCompany
}

Write-Host "`n4. SENDING UPDATE REQUEST"
Write-Host "Update data being sent:"
$updateData.GetEnumerator() | ForEach-Object { Write-Host "  $($_.Key): '$($_.Value)'" }

$updateBody = $updateData | ConvertTo-Json
Write-Host "`nJSON body: $updateBody"

try {
    $updateResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/tickets/$($testTicket.id)" -Method PUT -Body $updateBody -Headers $headers
    
    Write-Host "`n5. UPDATE RESPONSE ANALYSIS"
    Write-Host "Update successful!"
    Write-Host "Response ticket id: $($updateResponse.data.ticket.id)"
    Write-Host "Response customerAddress: '$($updateResponse.data.ticket.customerAddress)'"
    Write-Host "Response customerName: '$($updateResponse.data.ticket.customerName)'"
    Write-Host "Response customerPhone: '$($updateResponse.data.ticket.customerPhone)'"
    Write-Host "Response customerCompany: '$($updateResponse.data.ticket.customerCompany)'"
    
    Write-Host "`n6. VERIFICATION - GET TICKET AGAIN"
    $verifyResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/tickets/$($testTicket.id)" -Method GET -Headers $headers
    Write-Host "Verified customerAddress: '$($verifyResponse.data.ticket.customerAddress)'"
    
    if ($verifyResponse.data.ticket.customerAddress -eq $newAddress) {
        Write-Host "SUCCESS: Address was saved correctly!"
    } else {
        Write-Host "PROBLEM: Address was not saved correctly"
        Write-Host "Expected: '$newAddress'"
        Write-Host "Got: '$($verifyResponse.data.ticket.customerAddress)'"
    }
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Response: $($_.Exception.Response | ConvertTo-Json)"
}

Write-Host "`n=== DEBUG COMPLETE ===" 