# Test Jane Admin Message Classification Fix
Write-Host "Testing Jane Admin Message Classification Fix" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

try {
    # Create a test ticket
    $ticketData = @{
        title = "Jane Admin Fix Test"
        description = "Testing if customer messages are correctly classified"
        categoryId = "software"
        priority = "medium"
        customerInfo = @{
            name = "Test Customer"
            email = "test@example.com"
            company = "Test Corp"
            phone = "555-1234"
            country = "United States"
        }
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -ContentType "application/json"
    
    if ($response.success) {
        $ticketId = $response.data.ticket.id
        Write-Host "Ticket created: $ticketId" -ForegroundColor Green
        
        # Send multiple messages quickly
        for ($i = 1; $i -le 3; $i++) {
            $messageData = @{
                content = "Customer message #$i - should NOT show as Jane Admin"
            } | ConvertTo-Json
            
            Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -ContentType "application/json" | Out-Null
            Write-Host "Message $i sent" -ForegroundColor Green
            Start-Sleep -Seconds 1
        }
        
        # Wait for responses
        Start-Sleep -Seconds 5
        
        # Check messages
        $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
        
        if ($messagesResponse.success) {
            $messages = $messagesResponse.data.messages
            Write-Host "Total messages: $($messages.Count)" -ForegroundColor White
            
            $janeAdminCount = 0
            $customerCount = 0
            
            foreach ($message in $messages) {
                $senderName = ""
                if ($message.sender) {
                    $senderName = "$($message.sender.firstName) $($message.sender.lastName)".Trim()
                }
                
                $senderType = ""
                if ($message.sender -and $message.sender.userType) {
                    $senderType = $message.sender.userType
                }
                
                if ($senderName -eq "Jane Admin") {
                    $janeAdminCount++
                    Write-Host "ISSUE: Jane Admin message found" -ForegroundColor Red
                } elseif ($senderType -eq "customer") {
                    $customerCount++
                    Write-Host "OK: Customer message found" -ForegroundColor Green
                }
            }
            
            Write-Host "Customer messages: $customerCount" -ForegroundColor Green
            Write-Host "Jane Admin messages: $janeAdminCount" -ForegroundColor Red
            
            if ($janeAdminCount -eq 0) {
                Write-Host "SUCCESS: No Jane Admin messages found!" -ForegroundColor Green
            } else {
                Write-Host "ISSUE: Still finding Jane Admin messages" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test completed" -ForegroundColor Cyan 