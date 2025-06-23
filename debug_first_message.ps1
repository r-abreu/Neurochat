# Debug First Message AI Response
Write-Host "DEBUG: Testing First Message AI Response" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Test 1: Simple ticket creation
Write-Host "`n1. Creating ticket..." -ForegroundColor Yellow

$ticketData = @{
    title = "Debug Test - AI First Message"
    description = "Hello, I need help with my NeuroVirtual device. It won't turn on."
    categoryId = "software"
    priority = "medium"
    customerInfo = @{
        name = "Debug Customer"
        email = "debug@test.com"
        company = "Debug Corp"
        phone = "555-1234"
        country = "United States"
    }
} | ConvertTo-Json -Depth 3

try {
    Write-Host "Sending POST to: $baseUrl/api/tickets" -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -ContentType "application/json" -Verbose
    
    Write-Host "✅ Response received:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor White
    
    if ($response.success) {
        $ticketId = $response.data.ticket.id
        Write-Host "`n2. Ticket created successfully: $ticketId" -ForegroundColor Green
        
        # Wait and check messages
        Write-Host "`n3. Waiting 10 seconds for AI response..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        
        Write-Host "`n4. Checking messages..." -ForegroundColor Yellow
        $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
        
        Write-Host "Messages response:" -ForegroundColor White
        Write-Host ($messagesResponse | ConvertTo-Json -Depth 5) -ForegroundColor White
        
    } else {
        Write-Host "❌ Ticket creation failed" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Full exception: $($_.Exception)" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Cyan 