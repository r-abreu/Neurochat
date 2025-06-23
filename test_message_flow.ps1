# Test Message Flow and Classification Issues
Write-Host "Testing Message Flow and Classification" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

try {
    # Step 1: Create a test ticket
    Write-Host "`n1. Creating test ticket..." -ForegroundColor Yellow
    
    $ticketData = @{
        title = "Message Classification Test"
        description = "First customer message - testing if this gets properly classified"
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
        Write-Host "   ✅ Ticket created: $ticketId" -ForegroundColor Green
        
        # Step 2: Send a SECOND message quickly (before AI responds)
        Write-Host "`n2. Sending second message quickly..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        
        $messageData = @{
            content = "This is my second message sent quickly - should show as customer, not Jane Admin"
        } | ConvertTo-Json
        
        $messageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -ContentType "application/json"
        
        if ($messageResponse.success) {
            Write-Host "   ✅ Second message sent" -ForegroundColor Green
            
            # Step 3: Send a THIRD message (before AI responds)
            Write-Host "`n3. Sending third message..." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
            
            $thirdMessageData = @{
                content = "This is my third message - also should be customer, not Jane Admin"
            } | ConvertTo-Json
            
            $thirdMessageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $thirdMessageData -ContentType "application/json"
            
            if ($thirdMessageResponse.success) {
                Write-Host "   ✅ Third message sent" -ForegroundColor Green
                
                # Step 4: Wait a bit and check messages
                Write-Host "`n4. Waiting for any AI responses..." -ForegroundColor Yellow
                Start-Sleep -Seconds 5
                
                # Step 5: Get all messages and check classification
                Write-Host "`n5. Analyzing message classification..." -ForegroundColor Yellow
                $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
                
                if ($messagesResponse.success) {
                    $messages = $messagesResponse.data.messages
                    Write-Host "   Total messages found: $($messages.Count)" -ForegroundColor White
                    
                    Write-Host "`n📋 MESSAGE CLASSIFICATION ANALYSIS:" -ForegroundColor Cyan
                    
                    for ($i = 0; $i -lt $messages.Count; $i++) {
                        $message = $messages[$i]
                        $senderType = if ($message.sender -and $message.sender.userType) { $message.sender.userType } else { "unknown" }
                        $senderName = if ($message.sender) { "$($message.sender.firstName) $($message.sender.lastName)".Trim() } else { "None" }
                        $senderId = if ($message.senderId) { $message.senderId } else { "null" }
                        
                        $contentPreview = if ($message.content.Length -gt 50) { 
                            $message.content.Substring(0, 50) + "..." 
                        } else { 
                            $message.content 
                        }
                        
                        # Color based on sender type
                        $color = switch ($senderType) {
                            "ai" { "Cyan" }
                            "customer" { "Yellow" }
                            "agent" { "Green" }
                            "system" { "Magenta" }
                            default { "White" }
                        }
                        
                        Write-Host "`n   Message $($i + 1):" -ForegroundColor White
                        Write-Host "     - Content: $contentPreview" -ForegroundColor Gray
                        Write-Host "     - Sender Type: [$senderType]" -ForegroundColor $color
                        Write-Host "     - Sender Name: $senderName" -ForegroundColor $color
                        Write-Host "     - Sender ID: $senderId" -ForegroundColor Gray
                        
                        # Check for the Jane Admin issue
                        if ($senderName -eq "Jane Admin" -and $senderType -ne "agent") {
                            Write-Host "     ❌ ISSUE FOUND: Customer message showing as Jane Admin!" -ForegroundColor Red
                        } elseif ($senderName -eq "Jane Admin" -and $senderType -eq "agent") {
                            Write-Host "     ❌ ISSUE FOUND: Customer message incorrectly classified as agent (Jane Admin)!" -ForegroundColor Red
                        } elseif ($senderType -eq "customer") {
                            Write-Host "     ✅ Correctly classified as customer" -ForegroundColor Green
                        }
                    }
                    
                    # Summary
                    $customerMsgs = @($messages | Where-Object { $_.sender -and $_.sender.userType -eq "customer" })
                    $agentMsgs = @($messages | Where-Object { $_.sender -and $_.sender.userType -eq "agent" })
                    $janeAdminMsgs = @($messages | Where-Object { $_.sender -and $_.sender.firstName -eq "Jane" -and $_.sender.lastName -eq "Admin" })
                    
                    Write-Host "`n📊 SUMMARY:" -ForegroundColor Cyan
                    Write-Host "   - Customer messages: $($customerMsgs.Count)" -ForegroundColor Yellow
                    Write-Host "   - Agent messages: $($agentMsgs.Count)" -ForegroundColor Green
                    Write-Host "   - Jane Admin messages: $($janeAdminMsgs.Count)" -ForegroundColor Red
                    
                    if ($janeAdminMsgs.Count -gt 0) {
                        Write-Host "`n❌ ISSUE CONFIRMED: Found $($janeAdminMsgs.Count) messages attributed to Jane Admin" -ForegroundColor Red
                        Write-Host "   These should be customer messages, not agent messages." -ForegroundColor Red
                    } else {
                        Write-Host "`n✅ No Jane Admin issues found" -ForegroundColor Green
                    }
                    
                } else {
                    Write-Host "   ❌ Failed to retrieve messages" -ForegroundColor Red
                }
            } else {
                Write-Host "   ❌ Failed to send third message" -ForegroundColor Red
            }
        } else {
            Write-Host "   ❌ Failed to send second message" -ForegroundColor Red
        }
    } else {
        Write-Host "   ❌ Failed to create ticket" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "Test completed!" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan 