# Test script to verify address field functionality
Write-Host "Testing NeuroChat Address Field Issue"

# 1. Test login
Write-Host "`n1. Testing login..."
$loginBody = @{
    email = 'agent@demo.com'
    password = 'demo123'
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
    $token = $loginResponse.data.tokens.accessToken
    Write-Host "Login successful! Token: $($token.Substring(0,20))..."
} catch {
    Write-Host "Login failed: $($_.Exception.Message)"
    exit 1
}

# 2. Get tickets to find one with address
Write-Host "`n2. Getting tickets..."
$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

try {
    $ticketsResponse = Invoke-RestMethod -Uri 'http://localhost:3001/api/tickets' -Method GET -Headers $headers
    $tickets = $ticketsResponse.data.tickets
    Write-Host "Retrieved $($tickets.Count) tickets"
    
    # Find ticket with address
    $ticketWithAddress = $tickets | Where-Object { $_.customerAddress }
    if ($ticketWithAddress) {
        Write-Host "Found ticket with address: $($ticketWithAddress[0].id)"
        Write-Host "   Current address: $($ticketWithAddress[0].customerAddress)"
        $testTicketId = $ticketWithAddress[0].id
    } else {
        Write-Host "No tickets with address found, using first ticket"
        $testTicketId = $tickets[0].id
    }
} catch {
    Write-Host "Failed to get tickets: $($_.Exception.Message)"
    exit 1
}

# 3. Test updating address field
Write-Host "`n3. Testing address field update..."
$newAddress = "NEW TEST ADDRESS`n456 Updated Street`nTest City, TX 12345"
$updateBody = @{
    customerAddress = $newAddress
} | ConvertTo-Json

Write-Host "Updating ticket $testTicketId with new address:"
Write-Host "   New address: $newAddress"

try {
    $updateResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/tickets/$testTicketId" -Method PUT -Body $updateBody -Headers $headers
    Write-Host "Update request successful!"
    Write-Host "Response address: $($updateResponse.data.ticket.customerAddress)"
    
    if ($updateResponse.data.ticket.customerAddress -eq $newAddress) {
        Write-Host "Address field updated correctly!"
    } else {
        Write-Host "Address field mismatch!"
        Write-Host "   Expected: $newAddress"
        Write-Host "   Got: $($updateResponse.data.ticket.customerAddress)"
    }
} catch {
    Write-Host "Update failed: $($_.Exception.Message)"
}

Write-Host "`nTest completed!"

$ticketId = "2730b4ed-b8b7-47ac-ba7c-578c5c89cb10"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzZWI5MzIxYS1mYjJlLTQzNjctOGI1YS1jMmEyNzY2YWY4MjciLCJlbWFpbCI6InRpZXIyQGRlbW8uY29tIiwiaWF0IjoxNzM3MzUxMzE1LCJleHAiOjE3MzczNTQ5MTV9.gE7TdQGr6oj7Gu0dJGJxjJfqJtl3Y8CWwYT5_8bRmkY"
$url = "http://localhost:3001/api/tickets/$ticketId/files"

Write-Host "Testing Files API Endpoint"
Write-Host "URL: $url"
Write-Host "Ticket ID: $ticketId"
Write-Host ""

try {
    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json'
    }
    
    $response = Invoke-WebRequest -Uri $url -Headers $headers -Method GET
    Write-Host "✅ Success! Status: $($response.StatusCode)"
    Write-Host "Response Content:"
    Write-Host $response.Content
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
        Write-Host "Status Description: $($_.Exception.Response.StatusDescription)"
    }
} 