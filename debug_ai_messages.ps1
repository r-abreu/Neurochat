# Debug AI Messages Structure and Display
Write-Host "🔍 DEBUG: AI MESSAGES STRUCTURE AND DISPLAY" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

try {
    # Step 1: Create a test ticket with AI response
    Write-Host "`n1. Creating test ticket..." -ForegroundColor Yellow
    
    $ticketData = @{
        title = "AI Name Display Test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        description = "This is a test to see if AI messages show the correct agent name (NeuroAI) instead of 'Support'."
        categoryId = "software"
        priority = "medium"
        customerInfo = @{
            name = "Debug Customer"
            email = "debug@example.com"
            company = "Debug Corp"
            phone = "555-1234"
            country = "United States"
        }
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -ContentType "application/json"
    
    if ($response.success) {
        $ticketId = $response.data.ticket.id
        Write-Host "   ✅ Ticket created: $ticketId" -ForegroundColor Green
        
        # Step 2: Wait for AI to respond to first message
        Write-Host "`n2. Waiting for AI response to first message..." -ForegroundColor Yellow
        Start-Sleep -Seconds 8
        
        # Step 3: Send a follow-up message to trigger another AI response
        Write-Host "`n3. Sending follow-up message..." -ForegroundColor Yellow
        $messageData = @{
            content = "Can you help me troubleshoot my device further?"
        } | ConvertTo-Json
        
        $messageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -ContentType "application/json"
        
        if ($messageResponse.success) {
            Write-Host "   ✅ Follow-up message sent" -ForegroundColor Green
            
            # Step 4: Wait for AI response to follow-up
            Write-Host "`n4. Waiting for AI response to follow-up..." -ForegroundColor Yellow
            Start-Sleep -Seconds 8
            
            # Step 5: Get all messages and analyze structure
            Write-Host "`n5. Analyzing message structure..." -ForegroundColor Yellow
            $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
            
            if ($messagesResponse.success) {
                $messages = $messagesResponse.data.messages
                Write-Host "   Total messages found: $($messages.Count)" -ForegroundColor White
                
                Write-Host "`n📋 DETAILED MESSAGE ANALYSIS:" -ForegroundColor Cyan
                $customerCount = 0
                $aiCount = 0
                $agentCount = 0
                $systemCount = 0
                
                for ($i = 0; $i -lt $messages.Count; $i++) {
                    $message = $messages[$i]
                    $senderType = if ($message.sender -and $message.sender.userType) { $message.sender.userType } else { "unknown" }
                    $senderName = if ($message.sender) { "$($message.sender.firstName) $($message.sender.lastName)".Trim() } else { "None" }
                    $senderId = if ($message.senderId) { $message.senderId } else { "null" }
                    
                    $contentPreview = if ($message.content.Length -gt 60) { 
                        $message.content.Substring(0, 60) + "..." 
                    } else { 
                        $message.content 
                    }
                    
                    $color = switch ($senderType) {
                        "ai" { "Cyan" }
                        "customer" { "Yellow" }
                        "agent" { "Green" }
                        "system" { "Magenta" }
                        default { "White" }
                    }
                    
                    Write-Host "   Message $($i + 1):" -ForegroundColor White
                    Write-Host "     - Type: [$senderType]" -ForegroundColor $color
                    Write-Host "     - Sender Name: $senderName" -ForegroundColor $color
                    Write-Host "     - Sender ID: $senderId" -ForegroundColor Gray
                    Write-Host "     - Message Type: $($message.messageType)" -ForegroundColor Gray
                    Write-Host "     - Content: $contentPreview" -ForegroundColor Gray
                    Write-Host "     - Created: $($message.createdAt)" -ForegroundColor Gray
                    
                    # Count by type
                    switch ($senderType) {
                        "ai" { $aiCount++ }
                        "customer" { $customerCount++ }
                        "agent" { $agentCount++ }
                        "system" { $systemCount++ }
                    }
                    
                    Write-Host ""
                }
                
                Write-Host "📊 MESSAGE SUMMARY:" -ForegroundColor Cyan
                Write-Host "   - Customer messages: $customerCount" -ForegroundColor Yellow
                Write-Host "   - AI messages: $aiCount" -ForegroundColor Cyan
                Write-Host "   - Agent messages: $agentCount" -ForegroundColor Green
                Write-Host "   - System messages: $systemCount" -ForegroundColor Magenta
                
                if ($aiCount -gt 0) {
                    Write-Host "`n✅ SUCCESS: AI messages are properly identified!" -ForegroundColor Green
                    Write-Host "   The AI agent name should now appear as 'NeuroAI' in both agent and customer views." -ForegroundColor Green
                } else {
                    Write-Host "`n❌ ISSUE: No AI messages found or they are not properly identified." -ForegroundColor Red
                    Write-Host "   All messages are showing as customer type instead of ai." -ForegroundColor Red
                }
                
            } else {
                Write-Host "   ❌ Failed to retrieve messages" -ForegroundColor Red
            }
        } else {
            Write-Host "   ❌ Failed to send follow-up message" -ForegroundColor Red
        }
    } else {
        Write-Host "   ❌ Failed to create ticket" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "Debug completed!" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan 