# Test AI Response for Customer Messages
Write-Host "Testing AI Response System" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

try {
    # Step 1: Create an anonymous ticket (as customer would)
    Write-Host "`n1. Creating test ticket..." -ForegroundColor Yellow
    
    $ticketData = @{
        subject = "Test AI Response"
        description = "Hello, I need help with my account login"
        categoryId = "software"
        customerName = "Test Customer"
        customerEmail = "test@example.com"
        customerCompany = "Test Corp"
        customerPhone = "123-456-7890"
        isAnonymous = $true
    } | ConvertTo-Json

    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/create" -Method POST -Body $ticketData -ContentType "application/json"
    
    if ($createResponse.success) {
        $ticketId = $createResponse.data.ticket.id
        $ticketNumber = $createResponse.data.ticket.ticketNumber
        Write-Host "✅ Ticket created successfully: $ticketNumber (ID: $ticketId)" -ForegroundColor Green
        
        # Step 2: Send a customer message to trigger AI response
        Write-Host "`n2. Sending customer message to trigger AI..." -ForegroundColor Yellow
        
        $messageData = @{
            content = "Hi, I'm having trouble logging into my account. Can you please help me?"
            messageType = "text"
        } | ConvertTo-Json

        # Wait a moment for the ticket to be fully processed
        Start-Sleep -Seconds 1
        
        $messageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -ContentType "application/json"
        
        if ($messageResponse.success) {
            Write-Host "✅ Message sent successfully" -ForegroundColor Green
            
            # Step 3: Wait for AI response and check messages
            Write-Host "`n3. Waiting for AI response..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            
            # Get messages for the ticket
            $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
            
            if ($messagesResponse.success) {
                $messages = $messagesResponse.data.messages
                                 Write-Host "`nMessages in ticket:" -ForegroundColor White
                
                $aiResponseFound = $false
                foreach ($message in $messages) {
                    $senderType = if ($message.sender -and $message.sender.userType) { $message.sender.userType } else { "unknown" }
                    $senderName = if ($message.sender) { "$($message.sender.firstName) $($message.sender.lastName)" } else { "System" }
                    
                                         $contentPreview = $message.content.Substring(0, [Math]::Min(50, $message.content.Length))
                     $color = if ($senderType -eq "ai") { "Cyan" } elseif ($senderType -eq "customer") { "Yellow" } else { "White" }
                     Write-Host "  - [$senderType] $senderName`: $contentPreview..." -ForegroundColor $color
                    
                    if ($senderType -eq "ai") {
                        $aiResponseFound = $true
                    }
                }
                
                if ($aiResponseFound) {
                    Write-Host "`n✅ AI RESPONSE FOUND! The AI is working properly." -ForegroundColor Green
                } else {
                    Write-Host "`n❌ NO AI RESPONSE FOUND! This confirms the issue." -ForegroundColor Red
                    Write-Host "   Debugging information:" -ForegroundColor Yellow
                    Write-Host "   - Total messages: $($messages.Count)" -ForegroundColor White
                    Write-Host "   - AI should respond to customer messages automatically" -ForegroundColor White
                }
            } else {
                Write-Host "❌ Failed to get messages" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ Failed to send message" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Failed to create ticket" -ForegroundColor Red
    }

    # Step 4: Check AI configuration
    Write-Host "`n4. Checking AI agent configuration..." -ForegroundColor Yellow
    
    try {
        # Try to get AI config (might need admin token)
        $loginData = @{
            email = "admin@demo.com"
            password = "demo123"
        } | ConvertTo-Json

        $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
        $token = $loginResponse.data.tokens.accessToken

        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }

        $aiConfigResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/config" -Method GET -Headers $headers
        
        if ($aiConfigResponse.success) {
            $config = $aiConfigResponse.data.config
            Write-Host "   AI Agent Configuration:" -ForegroundColor White
            Write-Host "   - Enabled: $($config.enabled)" -ForegroundColor $(if ($config.enabled) { "Green" } else { "Red" })
            Write-Host "   - Agent Name: $($config.agent_name)" -ForegroundColor White
            Write-Host "   - Model: $($config.model)" -ForegroundColor White
            Write-Host "   - Confidence Threshold: $($config.confidence_threshold)" -ForegroundColor White
        }
        
        # Check AI stats
        $aiStatsResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/stats" -Method GET -Headers $headers
        if ($aiStatsResponse.success) {
            $stats = $aiStatsResponse.data.stats
            Write-Host "`n   AI Agent Statistics:" -ForegroundColor White
            Write-Host "   - Total Responses: $($stats.totalResponses)" -ForegroundColor White
            Write-Host "   - Documents Count: $($stats.documentsCount)" -ForegroundColor White
            Write-Host "   - Average Confidence: $([Math]::Round($stats.averageConfidence, 2))" -ForegroundColor White
        }
        
    } catch {
        Write-Host "   ⚠️ Could not get AI configuration (might need admin access)" -ForegroundColor Yellow
    }

} catch {
    Write-Host "❌ Test failed with error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Full error: $($_.Exception)" -ForegroundColor Red
}

Write-Host "`nTest completed!" -ForegroundColor Cyan 