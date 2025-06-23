# Simple AI Response Test for NeuroChat
Write-Host "🤖 SIMPLE AI RESPONSE TEST" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Step 1: Test backend connectivity
Write-Host "`n1. Testing backend connectivity..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running. Please start it first." -ForegroundColor Red
    exit 1
}

# Step 2: Login as admin
Write-Host "`n2. Logging in as admin..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "admin@demo.com"
        password = "demo123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $adminToken = $loginResponse.data.tokens.accessToken
    Write-Host "✅ Admin login successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Admin login failed" -ForegroundColor Red
    exit 1
}

# Step 3: Check and enable AI configuration
Write-Host "`n3. Checking AI configuration..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    $aiConfigResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/config" -Method GET -Headers $headers
    $aiConfig = $aiConfigResponse.data.config
    
    Write-Host "   - AI Enabled: $($aiConfig.enabled)" -ForegroundColor $(if ($aiConfig.enabled) { "Green" } else { "Red" })
    Write-Host "   - Agent Name: $($aiConfig.agent_name)" -ForegroundColor White
    Write-Host "   - Model: $($aiConfig.model)" -ForegroundColor White
    
    if (-not $aiConfig.enabled) {
        Write-Host "   - Enabling AI..." -ForegroundColor Yellow
        $enableData = @{
            enabled = $true
            agent_name = "NeuroAI"
            model = "gpt-4o"
            response_tone = "Technical"
            attitude_style = "Helpful"
            context_limitations = "Only provide support for NeuroVirtual products and devices"
            exceptions_behavior = "warranty,refund,billing,escalate,human"
            confidence_threshold = 0.7
        } | ConvertTo-Json
        
        $updateResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/config" -Method PUT -Body $enableData -Headers $headers
        Write-Host "   - ✅ AI enabled successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to configure AI" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Create test ticket
Write-Host "`n4. Creating test ticket..." -ForegroundColor Yellow
try {
    $ticketData = @{
        title = "AI Test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        description = "Test ticket to verify AI responses"
        categoryId = "software"
        priority = "medium"
        customerInfo = @{
            name = "AI Test Customer"
            email = "aitest@example.com"
            company = "Test Corp"
            phone = "123-456-7890"
        }
    } | ConvertTo-Json -Depth 3

    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -ContentType "application/json"
    
    if ($createResponse.success) {
        $ticketId = $createResponse.data.ticket.id
        $ticketNumber = $createResponse.data.ticket.ticketNumber
        Write-Host "✅ Ticket created: $ticketNumber (ID: $ticketId)" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create ticket" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error creating ticket: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Send customer message
Write-Host "`n5. Sending customer message..." -ForegroundColor Yellow
try {
    $messageData = @{
        content = "Hello, I need help with my NeuroVirtual device. It is not working properly. Can you assist me?"
        messageType = "text"
    } | ConvertTo-Json

    $messageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -ContentType "application/json"
    
    if ($messageResponse.success) {
        Write-Host "✅ Customer message sent successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to send message" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error sending message: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 6: Wait and check for AI response
Write-Host "`n6. Waiting for AI response..." -ForegroundColor Yellow
Write-Host "   - Waiting 10 seconds for AI to process and respond..." -ForegroundColor Gray
Start-Sleep -Seconds 10

try {
    $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
    
    if ($messagesResponse.success) {
        $messages = $messagesResponse.data.messages
        Write-Host "   - Total messages found: $($messages.Count)" -ForegroundColor White
        
        $aiResponseFound = $false
        Write-Host "`n   Messages in conversation:" -ForegroundColor White
        
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
        }
        
        Write-Host ""
        if ($aiResponseFound) {
            Write-Host "✅ SUCCESS: AI RESPONSE FOUND! The AI is working properly." -ForegroundColor Green
        } else {
            Write-Host "❌ ISSUE: No AI response found. The AI may not be configured correctly." -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Error checking messages: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 7: Test AI toggle (optional)
Write-Host "`n7. Testing AI toggle functionality..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    # Test disabling AI
    $toggleData = @{
        enabled = $false
        reason = "testing"
    } | ConvertTo-Json
    
    $toggleResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/toggle-ai" -Method POST -Body $toggleData -Headers $headers
    
    if ($toggleResponse.success) {
        Write-Host "✅ AI toggle functionality working - can disable AI" -ForegroundColor Green
        
        # Re-enable AI
        $enableData = @{
            enabled = $true
        } | ConvertTo-Json
        
        $enableResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/toggle-ai" -Method POST -Body $enableData -Headers $headers
        
        if ($enableResponse.success) {
            Write-Host "✅ AI toggle functionality working - can enable AI" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "⚠️  AI toggle test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n📋 TEST SUMMARY" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan
Write-Host "Test ticket created: $ticketNumber" -ForegroundColor White
Write-Host "You can view this ticket in the agent dashboard at: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "🔧 IMPORTANT: The AI toggle should now be visible in the ticket detail view!" -ForegroundColor Yellow
Write-Host "Login as an agent and open this ticket to see the AI toggle in the Actions section." -ForegroundColor White
Write-Host ""
Write-Host "Test completed at $(Get-Date)" -ForegroundColor Gray 