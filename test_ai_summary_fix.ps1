Write-Host "🧪 AI Summary Fix Test Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

Write-Host "`n1. Testing backend connectivity..." -ForegroundColor Yellow

try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 10
    Write-Host "✅ Backend is running!" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running. Please start the backend first." -ForegroundColor Red
    Write-Host "Run: ./start-backend.ps1" -ForegroundColor White
    exit 1
}

Write-Host "`n2. Testing admin login..." -ForegroundColor Yellow

try {
    $loginData = @{
        email = "admin@neurochat.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    
    if ($loginResponse.success) {
        $adminToken = $loginResponse.token
        Write-Host "✅ Admin login successful" -ForegroundColor Green
    } else {
        Write-Host "❌ Admin login failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Creating test ticket..." -ForegroundColor Yellow

try {
    $ticketData = @{
        title = "AI Summary Test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        description = "Testing AI summary functionality after fixing the blinking text issue"
        priority = "medium"
        category = "technical"
        customerName = "Test Customer"
        customerEmail = "test@example.com"
        deviceModel = "BWIII"
        deviceSerialNumber = "TEST-12345"
    } | ConvertTo-Json

    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }

    $ticketResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method POST -Body $ticketData -Headers $headers

    if ($ticketResponse.success) {
        $ticketId = $ticketResponse.data.id
        $ticketNumber = $ticketResponse.data.ticketNumber
        Write-Host "✅ Test ticket created: $ticketNumber" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create test ticket" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Ticket creation error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n4. Adding test messages..." -ForegroundColor Yellow

try {
    # Add customer message
    $customerMessage = @{
        content = "I'm having trouble with my device. It won't turn on and I've tried different power sources."
        ticketId = $ticketId
    } | ConvertTo-Json

    $messageResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $customerMessage -Headers $headers
    
    if ($messageResponse.success) {
        Write-Host "✅ Customer message added" -ForegroundColor Green
    }

    # Wait for AI response
    Start-Sleep -Seconds 3

    # Add agent response
    $agentMessage = @{
        content = "I understand the issue. Let's try a factory reset. Hold the power button for 10 seconds, then try turning it on again."
        ticketId = $ticketId
    } | ConvertTo-Json

    $agentResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $agentMessage -Headers $headers
    
    if ($agentResponse.success) {
        Write-Host "✅ Agent message added" -ForegroundColor Green
    }

    # Add resolution message
    $resolutionMessage = @{
        content = "Great! The factory reset worked. My device is now turning on properly. Thank you for your help!"
        ticketId = $ticketId
    } | ConvertTo-Json

    $finalResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/messages" -Method POST -Body $resolutionMessage -Headers $headers
    
    if ($finalResponse.success) {
        Write-Host "✅ Resolution message added" -ForegroundColor Green
    }

} catch {
    Write-Host "❌ Message error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n5. Marking ticket as resolved..." -ForegroundColor Yellow

try {
    $statusUpdate = @{
        status = "resolved"
    } | ConvertTo-Json

    $statusResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId" -Method PUT -Body $statusUpdate -Headers $headers
    
    if ($statusResponse.success) {
        Write-Host "✅ Ticket marked as resolved" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Status update error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n6. Testing AI summary generation..." -ForegroundColor Yellow

try {
    $summaryResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$ticketId/generate-summary" -Method POST -Headers $headers
    
    if ($summaryResponse.success) {
        Write-Host "✅ AI Summary generated successfully!" -ForegroundColor Green
        Write-Host "`nGenerated Summary:" -ForegroundColor White
        Write-Host "==================" -ForegroundColor White
        Write-Host $summaryResponse.data.summary -ForegroundColor Cyan
        Write-Host "`nModel: $($summaryResponse.data.modelVersion)" -ForegroundColor Gray
        Write-Host "Generated At: $($summaryResponse.data.generatedAt)" -ForegroundColor Gray
    } else {
        Write-Host "❌ AI summary generation failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Summary generation error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 TEST COMPLETE" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
Write-Host "Test ticket: $ticketNumber" -ForegroundColor White
Write-Host "Frontend URL: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "✨ FIXES APPLIED:" -ForegroundColor Green
Write-Host "- Fixed race condition in handleSummaryGenerated" -ForegroundColor White
Write-Host "- Increased delay to prevent state conflicts" -ForegroundColor White
Write-Host "- Reset generating state on socket event" -ForegroundColor White
Write-Host "- Added whitespace-pre-wrap for better text display" -ForegroundColor White
Write-Host ""
Write-Host "🔧 TO TEST THE FIX:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "2. Login as an agent" -ForegroundColor White
Write-Host "3. Open the test ticket: $ticketNumber" -ForegroundColor White
Write-Host "4. Click 'Generate Summary' or 'Regenerate' button" -ForegroundColor White
Write-Host "5. The summary should appear and stay visible (no blinking/disappearing)" -ForegroundColor White
Write-Host ""
Write-Host "Test completed at $(Get-Date)" -ForegroundColor Gray