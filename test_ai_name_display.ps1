# Test AI Agent Name Display
Write-Host "Testing AI Agent Name Display" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

try {
    # Create ticket
    Write-Host "`n1. Creating ticket..." -ForegroundColor Yellow
    
    $ticketData = @{
        title = "AI Name Test"
        description = "Test message to check if AI shows as NeuroAI instead of Support"
        categoryId = "software"
        priority = "medium"
        customerInfo = @{
            name = "Test User"
            email = "test@example.com"
            company = "Test Co"
        }
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -ContentType "application/json"
    $ticketId = $response.data.ticket.id
    Write-Host "   Ticket created: $ticketId" -ForegroundColor Green
    
    # Send message
    Write-Host "`n2. Sending message..." -ForegroundColor Yellow
    $messageData = @{ content = "Hello, can you help me?" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -ContentType "application/json"
    
    # Wait and check messages
    Write-Host "`n3. Waiting for AI response..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
    $messages = $messagesResponse.data.messages
    
    Write-Host "`n4. Messages found:" -ForegroundColor Yellow
    foreach ($message in $messages) {
        $senderType = if ($message.sender) { $message.sender.userType } else { "unknown" }
        $senderName = if ($message.sender) { "$($message.sender.firstName) $($message.sender.lastName)" } else { "None" }
        $content = $message.content.Substring(0, [Math]::Min(50, $message.content.Length))
        
        Write-Host "   - [$senderType] $senderName : $content..." -ForegroundColor $(if ($senderType -eq "ai") { "Cyan" } else { "Yellow" })
    }
    
    $aiMessages = $messages | Where-Object { $_.sender.userType -eq "ai" }
    if ($aiMessages.Count -gt 0) {
        Write-Host "`n✅ SUCCESS: AI messages properly identified!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ No AI messages found" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest completed!" -ForegroundColor Cyan 