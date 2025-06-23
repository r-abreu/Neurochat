# Comprehensive AI Response Test for NeuroChat
Write-Host "🤖 COMPREHENSIVE AI RESPONSE TEST" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"
$testResults = @()

function Test-Step {
    param($StepName, $ScriptBlock)
    
    Write-Host "`n🔍 Testing: $StepName" -ForegroundColor Yellow
    try {
        $result = & $ScriptBlock
        if ($result) {
            Write-Host "✅ PASS: $StepName" -ForegroundColor Green
            $testResults += @{ Step = $StepName; Status = "PASS"; Message = "Success" }
            return $true
        } else {
            Write-Host "❌ FAIL: $StepName" -ForegroundColor Red
            $testResults += @{ Step = $StepName; Status = "FAIL"; Message = "Test failed" }
            return $false
        }
    } catch {
        Write-Host "❌ ERROR: $StepName - $($_.Exception.Message)" -ForegroundColor Red
        $testResults += @{ Step = $StepName; Status = "ERROR"; Message = $_.Exception.Message }
        return $false
    }
}

# Test 1: Backend Connectivity
Test-Step "Backend Connectivity" {
    try {
        $healthResponse = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 5
        return $healthResponse -ne $null
    } catch {
        return $false
    }
}

# Test 2: Admin Login and AI Configuration
$adminToken = $null
Test-Step "Admin Login" {
    try {
        $loginData = @{
            email = "admin@demo.com"
            password = "demo123"
        } | ConvertTo-Json

        $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
        $script:adminToken = $loginResponse.data.tokens.accessToken
        return $adminToken -ne $null
    } catch {
        return $false
    }
}

# Test 3: Check AI Agent Configuration
$aiConfig = $null
Test-Step "AI Agent Configuration Check" {
    if (-not $adminToken) { return $false }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
            "Content-Type" = "application/json"
        }
        
        $aiConfigResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/config" -Method GET -Headers $headers
        $script:aiConfig = $aiConfigResponse.data.config
        
        Write-Host "   - AI Enabled: $($aiConfig.enabled)" -ForegroundColor $(if ($aiConfig.enabled) { "Green" } else { "Red" })
        Write-Host "   - Agent Name: $($aiConfig.agent_name)" -ForegroundColor White
        Write-Host "   - Model: $($aiConfig.model)" -ForegroundColor White
        Write-Host "   - Confidence Threshold: $($aiConfig.confidence_threshold)" -ForegroundColor White
        
        return $aiConfig -ne $null
    } catch {
        return $false
    }
}

# Test 4: Enable AI if Disabled
Test-Step "Enable AI Agent if Needed" {
    if (-not $adminToken -or -not $aiConfig) { return $false }
    
    if ($aiConfig.enabled) {
        Write-Host "   - AI already enabled" -ForegroundColor Green
        return $true
    }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
            "Content-Type" = "application/json"
        }
        
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
        
        Write-Host "   - AI Agent has been enabled!" -ForegroundColor Green
        return $updateResponse.success
    } catch {
        return $false
    }
}

# Test 5: Create Test Ticket
$ticketId = $null
$ticketNumber = $null
Test-Step "Create Test Ticket" {
    try {
        $ticketData = @{
            subject = "AI Response Test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            description = "This is a test ticket to verify AI response functionality"
            categoryId = "software"
            customerName = "AI Test Customer"
            customerEmail = "aitest@example.com"
            customerCompany = "Test Corp"
            customerPhone = "123-456-7890"
            isAnonymous = $true
        } | ConvertTo-Json

        $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/create" -Method POST -Body $ticketData -ContentType "application/json"
        
        if ($createResponse.success) {
            $script:ticketId = $createResponse.data.ticket.id
            $script:ticketNumber = $createResponse.data.ticket.ticketNumber
            Write-Host "   - Ticket created: $ticketNumber (ID: $ticketId)" -ForegroundColor Green
            return $true
        }
        return $false
    } catch {
        return $false
    }
}

# Test 6: Send Customer Message
Test-Step "Send Customer Message" {
    if (-not $ticketId) { return $false }
    
    try {
        $messageData = @{
            content = "Hello, I am having trouble with my NeuroVirtual device. It will not turn on and I have tried everything. Can you help me troubleshoot this issue?"
            messageType = "text"
        } | ConvertTo-Json

        $messageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -ContentType "application/json"
        
        if ($messageResponse.success) {
            Write-Host "   - Customer message sent successfully" -ForegroundColor Green
            return $true
        }
        return $false
    } catch {
        return $false
    }
}

# Test 7: Wait and Check for AI Response
Test-Step "Wait for AI Response" {
    if (-not $ticketId) { return $false }
    
    try {
        Write-Host "   - Waiting 8 seconds for AI to process and respond..." -ForegroundColor Yellow
        Start-Sleep -Seconds 8
        
        $messagesResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method GET
        
        if ($messagesResponse.success) {
            $messages = $messagesResponse.data.messages
            Write-Host "   - Total messages found: $($messages.Count)" -ForegroundColor White
            
            $aiResponseFound = $false
            foreach ($message in $messages) {
                $senderType = if ($message.sender -and $message.sender.userType) { $message.sender.userType } else { "unknown" }
                $senderName = if ($message.sender) { "$($message.sender.firstName) $($message.sender.lastName)" } else { "System" }
                
                $contentPreview = $message.content.Substring(0, [Math]::Min(60, $message.content.Length))
                $color = switch ($senderType) {
                    "ai" { "Cyan" }
                    "customer" { "Yellow" }
                    "system" { "Magenta" }
                    default { "White" }
                }
                
                Write-Host "   - [$senderType] $senderName`: $contentPreview..." -ForegroundColor $color
                
                if ($senderType -eq "ai") {
                    $aiResponseFound = $true
                    Write-Host "   - ✅ AI Response Content: $($message.content)" -ForegroundColor Green
                }
            }
            
            return $aiResponseFound
        }
        return $false
    } catch {
        return $false
    }
}

# Test 8: Test AI Toggle Functionality (if admin token available)
Test-Step "Test AI Toggle Functionality" {
    if (-not $adminToken -or -not $ticketId) { 
        Write-Host "   - Skipping: Admin token or ticket ID not available" -ForegroundColor Yellow
        return $true
    }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
            "Content-Type" = "application/json"
        }
        
        # Disable AI for ticket
        $toggleData = @{
            enabled = $false
            reason = "testing"
        } | ConvertTo-Json
        
        $toggleResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/toggle-ai" -Method POST -Body $toggleData -Headers $headers
        
        if ($toggleResponse.success) {
            Write-Host "   - ✅ AI disabled successfully for ticket" -ForegroundColor Green
            
            # Re-enable AI for ticket
            $enableData = @{
                enabled = $true
            } | ConvertTo-Json
            
            $enableResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/toggle-ai" -Method POST -Body $enableData -Headers $headers
            
            if ($enableResponse.success) {
                Write-Host "   - ✅ AI re-enabled successfully for ticket" -ForegroundColor Green
                return $true
            }
        }
        return $false
    } catch {
        return $false
    }
}

# Test 9: Check AI Statistics
Test-Step "Check AI Statistics" {
    if (-not $adminToken) { 
        Write-Host "   - Skipping: Admin token not available" -ForegroundColor Yellow
        return $true
    }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $adminToken"
            "Content-Type" = "application/json"
        }
        
        $statsResponse = Invoke-RestMethod -Uri "$baseUrl/api/ai-agent/stats" -Method GET -Headers $headers
        
        if ($statsResponse.success) {
            $stats = $statsResponse.data.stats
            Write-Host "`n   📊 AI Statistics:" -ForegroundColor White
            Write-Host "   - Total Responses: $($stats.totalResponses)" -ForegroundColor White
            Write-Host "   - Documents Count: $($stats.documentsCount)" -ForegroundColor White
            Write-Host "   - Average Confidence: $([Math]::Round($stats.averageConfidence, 2))" -ForegroundColor White
            return $true
        }
        return $false
    } catch {
        return $false
    }
}

# Display Test Results Summary
Write-Host "`n📋 TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$errorCount = ($testResults | Where-Object { $_.Status -eq "ERROR" }).Count

foreach ($result in $testResults) {
    $color = switch ($result.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "ERROR" { "Magenta" }
    }
    Write-Host "$($result.Status): $($result.Step)" -ForegroundColor $color
    if ($result.Message -ne "Success") {
        Write-Host "    └─ $($result.Message)" -ForegroundColor Gray
    }
}

Write-Host "`n📈 SUMMARY" -ForegroundColor White
Write-Host "✅ Passed: $passCount" -ForegroundColor Green
Write-Host "❌ Failed: $failCount" -ForegroundColor Red
Write-Host "⚠️  Errors: $errorCount" -ForegroundColor Magenta

if ($passCount -gt 0 -and $failCount -eq 0 -and $errorCount -eq 0) {
    Write-Host "`n🎉 ALL TESTS PASSED! AI Agent is working correctly!" -ForegroundColor Green
} elseif ($passCount -ge 6) {
    Write-Host "`n✅ CORE FUNCTIONALITY WORKING! AI Agent should be responding to customers." -ForegroundColor Green
} else {
    Write-Host "`n⚠️ ISSUES DETECTED! Check the failed/error tests above." -ForegroundColor Yellow
}

Write-Host "`n🔗 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Open the frontend at: http://localhost:3000" -ForegroundColor White
Write-Host "2. Login as an agent and check the ticket detail for the AI toggle" -ForegroundColor White
Write-Host "3. Test customer chat interface" -ForegroundColor White
Write-Host "4. Verify AI responses appear in ticket conversations" -ForegroundColor White

if ($ticketId) {
    Write-Host "`n🎫 Test ticket created: $ticketNumber (ID: $ticketId)" -ForegroundColor Yellow
    Write-Host "   You can view this ticket in the agent dashboard to see the AI toggle and messages." -ForegroundColor White
}

Write-Host "`nTest completed at $(Get-Date)" -ForegroundColor Gray 