Write-Host "🧪 AI Summary Persistence Test" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Check backend
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend not running" -ForegroundColor Red
    exit 1
}

# Login
try {
    $loginData = @{
        email = "admin@demo.com"
        password = "demo123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $token = $loginResponse.data.tokens.accessToken
    Write-Host "✅ Logged in successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Get tickets
try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    $tickets = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method GET -Headers $headers
    $testTicket = $tickets[0]
    Write-Host "🎯 Testing with ticket: $($testTicket.ticketNumber)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error getting tickets: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Generate summary
try {
    Write-Host "🤖 Generating AI summary..." -ForegroundColor Yellow
    $summaryResponse = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$($testTicket.id)/generate-summary" -Method POST -Headers $headers
    
    if ($summaryResponse.success) {
        Write-Host "✅ AI Summary generated!" -ForegroundColor Green
        Write-Host "📝 Summary: $($summaryResponse.data.summary.Substring(0, 50))..." -ForegroundColor White
        $generatedSummary = $summaryResponse.data.summary
    } else {
        Write-Host "❌ Failed to generate summary" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error generating summary: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Verify persistence
try {
    Start-Sleep 2
    Write-Host "🔍 Verifying persistence..." -ForegroundColor Yellow
    $verifyTicket = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$($testTicket.id)" -Method GET -Headers $headers
    
    if ($verifyTicket.resolutionSummary -eq $generatedSummary) {
        Write-Host "✅ SUCCESS! Summary persists!" -ForegroundColor Green
        Write-Host "🎉 AI Summary persistence is now WORKING!" -ForegroundColor Green
    } else {
        Write-Host "❌ Summary not persisted" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error verifying: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✨ Test complete!" -ForegroundColor Cyan 