Write-Host "🧪 AI Summary Persistence Test" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host "This test verifies that AI summaries stay visible and don't disappear after 2 seconds" -ForegroundColor White

$baseUrl = "http://localhost:3001"

# Check if backend is running
try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running. Please start it first:" -ForegroundColor Red
    Write-Host "   ./start-backend.ps1" -ForegroundColor White
    exit 1
}

# Login
try {
    $loginData = @{
        email = "admin@neurochat.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    
    if (-not $loginResponse.success) {
        Write-Host "❌ Login failed" -ForegroundColor Red
        exit 1
    }
    
    $token = $loginResponse.token
    Write-Host "✅ Logged in successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Create test ticket
try {
    $ticketData = @{
        title = "Summary Persistence Test - $(Get-Date -Format 'HH:mm:ss')"
        description = "This ticket tests that AI summaries don't disappear after 2 seconds"
        priority = "medium"
        category = "technical"
        customerName = "Test Customer"
        customerEmail = "test@example.com"
        deviceModel = "BWIII"
        deviceSerialNumber = "PERSIST-TEST-001"
    } | ConvertTo-Json

    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    $ticketResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -Headers $headers

    if (-not $ticketResponse.success) {
        Write-Host "❌ Failed to create ticket" -ForegroundColor Red
        exit 1
    }
    
    $ticketId = $ticketResponse.data.id
    $ticketNumber = $ticketResponse.data.ticketNumber
    Write-Host "✅ Created test ticket: $ticketNumber" -ForegroundColor Green
} catch {
    Write-Host "❌ Ticket creation error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Add some conversation
try {
    $messages = @(
        "My device won't turn on. I've tried different power sources but nothing works.",
        "Let me help you troubleshoot this. First, can you try holding the power button for 10 seconds?",
        "I tried that and it still doesn't work. The LED lights are not turning on either.",
        "This sounds like a hardware issue. Let's try a factory reset. Hold both the power and reset buttons for 15 seconds.",
        "That worked! The device is now turning on and I can see the LED lights. Thank you so much!"
    )
    
    foreach ($messageContent in $messages) {
        $messageData = @{
            content = $messageContent
            ticketId = $ticketId
        } | ConvertTo-Json
        
        $messageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $messageData -Headers $headers
        Start-Sleep -Seconds 1
    }
    
    Write-Host "✅ Added conversation messages" -ForegroundColor Green
} catch {
    Write-Host "❌ Message error: $($_.Exception.Message)" -ForegroundColor Red
}

# Mark as resolved
try {
    $statusData = @{
        status = "resolved"
    } | ConvertTo-Json
    
    $statusResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId" -Method PUT -Body $statusData -Headers $headers
    Write-Host "✅ Marked ticket as resolved" -ForegroundColor Green
} catch {
    Write-Host "❌ Status update error: $($_.Exception.Message)" -ForegroundColor Red
}

# Generate summary
Write-Host "`n🤖 Generating AI summary..." -ForegroundColor Yellow
try {
    $summaryResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/generate-summary" -Method POST -Headers $headers
    
    if ($summaryResponse.success) {
        Write-Host "✅ AI Summary generated!" -ForegroundColor Green
        Write-Host "`n📝 Generated Summary:" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host $summaryResponse.data.summary -ForegroundColor White
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host "Model: $($summaryResponse.data.modelVersion)" -ForegroundColor Gray
        Write-Host "Generated: $($summaryResponse.data.generatedAt)" -ForegroundColor Gray
        
        # Test persistence by checking the summary multiple times
        Write-Host "`n🔍 Testing summary persistence..." -ForegroundColor Yellow
        
        for ($i = 1; $i -le 5; $i++) {
            Start-Sleep -Seconds 2
            
            try {
                $checkResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId" -Method GET -Headers $headers
                
                if ($checkResponse.success -and $checkResponse.data.resolutionSummary) {
                    Write-Host "✅ Check $i/5: Summary still present after $($i * 2) seconds" -ForegroundColor Green
                } else {
                    Write-Host "❌ Check $i/5: Summary DISAPPEARED after $($i * 2) seconds!" -ForegroundColor Red
                    break
                }
            } catch {
                Write-Host "❌ Check $i/5: Error checking summary: $($_.Exception.Message)" -ForegroundColor Red
                break
            }
        }
        
    } else {
        Write-Host "❌ Summary generation failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Summary generation error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 TEST RESULTS" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan
Write-Host "Test Ticket: $ticketNumber" -ForegroundColor White
Write-Host "Frontend URL: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "🔧 FIXES APPLIED:" -ForegroundColor Green
Write-Host "- Removed onTicketUpdate() call from socket handler" -ForegroundColor White
Write-Host "- Added defensive checks in handleTicketUpdate" -ForegroundColor White
Write-Host "- Preserved local summary state during updates" -ForegroundColor White
Write-Host ""
Write-Host "📋 MANUAL TEST STEPS:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:3000 in browser" -ForegroundColor White
Write-Host "2. Login as admin (admin@neurochat.com / admin123)" -ForegroundColor White
Write-Host "3. Open ticket: $ticketNumber" -ForegroundColor White
Write-Host "4. Click 'Generate Summary' or 'Regenerate'" -ForegroundColor White
Write-Host "5. Wait 5+ seconds and verify summary stays visible" -ForegroundColor White
Write-Host "6. Summary should NOT blink or disappear!" -ForegroundColor White
Write-Host ""
Write-Host "Test completed at $(Get-Date)" -ForegroundColor Gray 