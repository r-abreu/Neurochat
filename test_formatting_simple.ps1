# Simple AI Formatting Test
Write-Host "🧪 Testing AI Formatting..." -ForegroundColor Cyan

$payload = @"
{
  "ticketId": "TEST-123",
  "userMessage": "My BWMini device won't power on. I tried different outlets but nothing works. No LED lights.",
  "config": {
    "agent_name": "NeuroAI",
    "model": "gpt-4o",
    "confidence_threshold": 0.7
  },
  "ticketData": {
    "customerName": "Test Customer",
    "deviceModel": "BWMini",
    "customerType": "standard"
  },
  "messages": [
    {
      "content": "My BWMini device won't power on. I tried different outlets but nothing works. No LED lights.",
      "sender": { "userType": "customer" },
      "createdAt": "2024-01-20T10:00:00Z"
    }
  ],
  "contextDocuments": []
}
"@

Write-Host "🚀 Testing enhanced AI response..." -ForegroundColor Green

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/enhanced-response" -Method POST -Body $payload -ContentType "application/json"
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "📊 Confidence: $($response.data.confidence)" -ForegroundColor Yellow
    Write-Host "📊 Clarity Score: $($response.data.clarityScore)" -ForegroundColor Yellow
    Write-Host "📊 Response Type: $($response.data.responseType)" -ForegroundColor Yellow
    
    Write-Host "`n📝 AI Response:" -ForegroundColor Cyan
    Write-Host "="*60
    Write-Host $response.data.response
    Write-Host "="*60
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🏁 Test completed." -ForegroundColor Magenta 