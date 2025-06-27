# Test License Detection and Response
Write-Host "🔑 Testing License Detection and Response..." -ForegroundColor Cyan

# Test different license-related messages
$testCases = @(
    @{
        message = "My software license has expired and I can't use the program anymore"
        expectedType = "expired"
        description = "Expired License"
    },
    @{
        message = "I need help with software activation, it's not working"
        expectedType = "activation"
        description = "Software Activation"
    },
    @{
        message = "My software is blocked due to license issues"
        expectedType = "blocked"
        description = "License Blocked"
    },
    @{
        message = "I lost my license key and need to reactivate"
        expectedType = "key"
        description = "License Key Issue"
    },
    @{
        message = "The license validation failed"
        expectedType = "validation"
        description = "License Validation"
    }
)

foreach ($testCase in $testCases) {
    Write-Host "`n🧪 Testing: $($testCase.description)" -ForegroundColor Yellow
    Write-Host "Message: $($testCase.message)" -ForegroundColor Gray
    
    $payload = @"
{
  "ticketId": "LICENSE-TEST-$([System.Guid]::NewGuid().ToString().Substring(0,8))",
  "userMessage": "$($testCase.message)",
  "config": {
    "agent_name": "NeuroAI",
    "model": "gpt-4o",
    "confidence_threshold": 0.7
  },
  "ticketData": {
    "customerName": "License Test Customer",
    "deviceModel": "NeuroVirtual Software",
    "customerType": "standard"
  },
  "messages": [
    {
      "content": "$($testCase.message)",
      "sender": { "userType": "customer" },
      "createdAt": "$(Get-Date -Format 'o')"
    }
  ],
  "contextDocuments": []
}
"@

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/enhanced-response" -Method POST -Body $payload -ContentType "application/json"
        
        Write-Host "✅ Response Generated!" -ForegroundColor Green
        Write-Host "📊 Response Type: $($response.data.responseType)" -ForegroundColor Magenta
        Write-Host "📊 License Issue Type: $($response.data.licenseIssueType)" -ForegroundColor Magenta
        Write-Host "📊 Confidence: $($response.data.confidence)" -ForegroundColor Magenta
        
        if ($response.data.responseType -eq "license_activation_guidance") {
            Write-Host "✅ License issue correctly detected!" -ForegroundColor Green
            
            # Check if response contains the license URL
            if ($response.data.response -like "*neurokeygeneration-a9atdaanf8gbh7gb.canadacentral-01.azurewebsites.net*") {
                Write-Host "✅ License URL correctly included in response!" -ForegroundColor Green
            } else {
                Write-Host "❌ License URL missing from response!" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ License issue NOT detected - Response Type: $($response.data.responseType)" -ForegroundColor Red
        }
        
        Write-Host "`n📝 AI Response:" -ForegroundColor Cyan
        Write-Host "="*80
        Write-Host $response.data.response
        Write-Host "="*80
        
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n" + ("-"*80)
}

# Test a non-license message to ensure it doesn't trigger license response
Write-Host "`n🧪 Testing Non-License Message (Control Test)" -ForegroundColor Blue
$nonLicensePayload = @"
{
  "ticketId": "CONTROL-TEST-$([System.Guid]::NewGuid().ToString().Substring(0,8))",
  "userMessage": "My device won't connect to WiFi",
  "config": {
    "agent_name": "NeuroAI",
    "model": "gpt-4o",
    "confidence_threshold": 0.7
  },
  "ticketData": {
    "customerName": "Control Test Customer",
    "deviceModel": "BWMini",
    "customerType": "standard"
  },
  "messages": [
    {
      "content": "My device won't connect to WiFi",
      "sender": { "userType": "customer" },
      "createdAt": "$(Get-Date -Format 'o')"
    }
  ],
  "contextDocuments": []
}
"@

try {
    $controlResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/enhanced-response" -Method POST -Body $nonLicensePayload -ContentType "application/json"
    
    if ($controlResponse.data.responseType -ne "license_activation_guidance") {
        Write-Host "✅ Control test passed - Non-license message correctly handled!" -ForegroundColor Green
        Write-Host "📊 Response Type: $($controlResponse.data.responseType)" -ForegroundColor Magenta
    } else {
        Write-Host "❌ Control test failed - Non-license message incorrectly detected as license issue!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Control test error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🏁 License Detection Test completed!" -ForegroundColor Magenta 