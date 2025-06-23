# Test AI Response for FIRST Message (Initial Ticket Creation)
Write-Host "Testing AI Response for First Message" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

try {
    # Step 1: Create a ticket with first message (this should trigger AI response now)
    Write-Host "`n1. Creating ticket with first message..." -ForegroundColor Yellow
    
    $ticketData = @{
        title = "Support Request - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        description = "Hello, I need help with my NeuroVirtual device. It won't turn on and I've tried everything. Can you help me troubleshoot this issue?"
        categoryId = "software"
        priority = "medium"
        customerInfo = @{
            name = "Test Customer"
            email = "testcustomer@example.com"
            company = "Test Corp"
            phone = "123-456-7890"
            country = "United States"
        }
    } | ConvertTo-Json -Depth 3

    Write-Host "Sending request to: $baseUrl/api/tickets" -ForegroundColor Gray
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -ContentType "application/json"
    
    if ($createResponse.success) {
        $ticketId = $createResponse.data.ticket.id
        $ticketNumber = $createResponse.data.ticket.ticketNumber
        Write-Host "✅ Ticket created successfully: $ticketNumber (ID: $ticketId)" -ForegroundColor Green
        
        # Step 2: Wait for AI to process the initial message and respond
        Write-Host "`n2. Waiting for AI to respond to the first message..." -ForegroundColor Yellow
        Write-Host "   (The AI should automatically respond to the description/first message)" -ForegroundColor Gray
        Start-Sleep -Seconds 8
        
        # Step 3: Check messages in the ticket
        Write-Host "`n3. Checking messages in the ticket..." -ForegroundColor Yellow
        $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
        
        if ($messagesResponse.success) {
            $messages = $messagesResponse.data.messages
            Write-Host "   Total messages found: $($messages.Count)" -ForegroundColor White
            
            Write-Host "`n   Messages in conversation:" -ForegroundColor White
            $aiResponseFound = $false
            $initialMessageFound = $false
            
            foreach ($message in $messages) {
                $senderType = if ($message.sender -and $message.sender.userType) { $message.sender.userType } else { "unknown" }
                $senderName = if ($message.sender) { "$($message.sender.firstName) $($message.sender.lastName)" } else { "System" }
                
                $contentPreview = if ($message.content.Length -gt 80) { 
                    $message.content.Substring(0, 80) + "..." 
                } else { 
                    $message.content 
                }
                
                $color = switch ($senderType) {
                    "ai" { "Cyan" }
                    "customer" { "Yellow" }
                    "system" { "Magenta" }
                    default { "White" }
                }
                
                Write-Host "   - [$senderType] $senderName`: $contentPreview" -ForegroundColor $color
                
                if ($senderType -eq "ai") {
                    $aiResponseFound = $true
                }
                if ($senderType -eq "customer" -or ($senderType -eq "unknown" -and $message.content.Contains("NeuroVirtual device"))) {
                    $initialMessageFound = $true
                }
            }
            
            Write-Host ""
            Write-Host "Results:" -ForegroundColor White
            Write-Host "   - Initial customer message found: $(if ($initialMessageFound) { '✅ Yes' } else { '❌ No' })" -ForegroundColor $(if ($initialMessageFound) { "Green" } else { "Red" })
            Write-Host "   - AI response found: $(if ($aiResponseFound) { '✅ Yes' } else { '❌ No' })" -ForegroundColor $(if ($aiResponseFound) { "Green" } else { "Red" })
            
            if ($initialMessageFound -and $aiResponseFound) {
                Write-Host "`n🎉 SUCCESS: AI responded to the first message!" -ForegroundColor Green
                Write-Host "   The issue has been FIXED. AI now responds to the initial customer message." -ForegroundColor Green
            } elseif ($initialMessageFound -and -not $aiResponseFound) {
                Write-Host "`n❌ ISSUE CONFIRMED: AI did NOT respond to the first message" -ForegroundColor Red
                Write-Host "   The initial message was created but AI didn't respond to it." -ForegroundColor Red
            } else {
                Write-Host "`n⚠️ UNEXPECTED: Could not find the initial message" -ForegroundColor Yellow
            }
            
        } else {
            Write-Host "❌ Failed to get messages" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Failed to create ticket" -ForegroundColor Red
        Write-Host "Response: $($createResponse | ConvertTo-Json)" -ForegroundColor Red
    }

    # Step 4: Quick AI configuration check
    Write-Host "`n4. Checking AI configuration..." -ForegroundColor Yellow
    
    try {
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
            Write-Host "   AI Status: $(if ($config.enabled) { '✅ Enabled' } else { '❌ Disabled' })" -ForegroundColor $(if ($config.enabled) { "Green" } else { "Red" })
            Write-Host "   Agent Name: $($config.agent_name)" -ForegroundColor White
            Write-Host "   Model: $($config.model)" -ForegroundColor White
        }
        
    } catch {
        Write-Host "   ⚠️ Could not check AI configuration" -ForegroundColor Yellow
    }

} catch {
    Write-Host "❌ Test failed with error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "   HTTP Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`n" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Test completed!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan 