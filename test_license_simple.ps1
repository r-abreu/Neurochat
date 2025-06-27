Write-Host "🔑 Testing License Detection..." -ForegroundColor Cyan

$payload = @'
{
  "ticketId": "TEST-123",
  "userMessage": "My license has expired and I need to reactivate my software",
  "config": {
    "agent_name": "NeuroAI",
    "model": "gpt-4o"
  },
  "ticketData": {
    "customerName": "Test User"
  },
  "messages": [],
  "contextDocuments": []
}
'@

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/enhanced-response" -Method POST -Body $payload -ContentType "application/json"
    
    Write-Host "✅ Response received!" -ForegroundColor Green
    Write-Host "Response Type: $($response.data.responseType)" -ForegroundColor Yellow
    
    if ($response.data.responseType -eq "license_activation_guidance") {
        Write-Host "✅ License issue detected!" -ForegroundColor Green
        if ($response.data.response -like "*neurokeygeneration*") {
            Write-Host "✅ License URL included!" -ForegroundColor Green
        }
    }
    
    Write-Host "`nResponse:" -ForegroundColor Cyan
    Write-Host $response.data.response
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🏁 Test completed." -ForegroundColor Magenta 