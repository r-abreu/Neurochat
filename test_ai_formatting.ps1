# Test Enhanced AI Response Formatting
# This script tests the improved AI response formatting for better organization and friendliness

Write-Host "🧪 Testing Enhanced AI Response Formatting..." -ForegroundColor Cyan

# Test data - simulate a complex technical question
$testPayload = @{
    ticketId = "TEST-123"
    userMessage = "My BWMini device won't power on and I've tried different outlets but nothing is working. The LED lights are not coming on at all."
    config = @{
        agent_name = "NeuroAI"
        model = "gpt-4o"
        confidence_threshold = 0.7
    }
    ticketData = @{
        customerName = "Test Customer"
        customerEmail = "test@example.com"
        deviceModel = "BWMini"
        customerType = "standard"
    }
    messages = @(
        @{
            content = "My BWMini device won't power on and I've tried different outlets but nothing is working. The LED lights are not coming on at all."
            sender = @{
                userType = "customer"
            }
            createdAt = "2024-01-20T10:00:00Z"
        }
    )
    contextDocuments = @()
} | ConvertTo-Json -Depth 10

Write-Host "📋 Test Payload:" -ForegroundColor Yellow
Write-Host $testPayload

Write-Host "`n🚀 Sending request to enhanced AI service..." -ForegroundColor Green

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/enhanced-response" -Method POST -Body $testPayload -ContentType "application/json"
    
    Write-Host "`n✅ Response received!" -ForegroundColor Green
    Write-Host "📊 Response Details:" -ForegroundColor Yellow
    Write-Host "- Response Type: $($response.responseType)"
    Write-Host "- Confidence: $($response.confidence)"
    Write-Host "- Clarity Score: $($response.clarityScore)"
    Write-Host "- Response Time: $($response.responseTimeMs)ms"
    Write-Host "- Optimizations Applied: $($response.optimizations -join ', ')"
    
    Write-Host "`n📝 Formatted Response:" -ForegroundColor Cyan
    Write-Host "=" * 80
    Write-Host $response.response
    Write-Host "=" * 80
    
    # Test another scenario - connectivity issue
    Write-Host "`n🔄 Testing connectivity issue formatting..." -ForegroundColor Blue
    
    $connectivityPayload = @{
        ticketId = "TEST-124"
        userMessage = "I can't connect my Compass device to WiFi. It keeps failing during setup."
        config = @{
            agent_name = "NeuroAI"
            model = "gpt-4o"
            confidence_threshold = 0.7
        }
        ticketData = @{
            customerName = "Test Customer 2"
            customerEmail = "test2@example.com"
            deviceModel = "Compass"
            customerType = "premium"
        }
        messages = @(
            @{
                content = "I can't connect my Compass device to WiFi. It keeps failing during setup."
                sender = @{
                    userType = "customer"
                }
                createdAt = "2024-01-20T10:30:00Z"
            }
        )
        contextDocuments = @()
    } | ConvertTo-Json -Depth 10
    
    $response2 = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/enhanced-response" -Method POST -Body $connectivityPayload -ContentType "application/json"
    
    Write-Host "`n📝 Connectivity Issue Response:" -ForegroundColor Cyan
    Write-Host "=" * 80
    Write-Host $response2.response
    Write-Host "=" * 80
    
    Write-Host "`n✅ All tests completed successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Error testing AI formatting:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`n🏁 Test completed." -ForegroundColor Magenta 