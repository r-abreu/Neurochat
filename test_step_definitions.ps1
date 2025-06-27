# Test Step Definitions
# Simple script to check current step definitions from backend

Write-Host "🔍 Testing Step Definitions..." -ForegroundColor Cyan

$baseUrl = "http://localhost:5000"

try {
    Write-Host "📡 Calling API: $baseUrl/api/service-workflows/step-definitions" -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/service-workflows/step-definitions" -Method GET
    
    Write-Host "✅ Response received!" -ForegroundColor Green
    
    # Find Step 6
    $step6 = $response | Where-Object { $_.stepNumber -eq 6 }
    
    if ($step6) {
        Write-Host "📋 Step 6 Definition Found:" -ForegroundColor Cyan
        Write-Host "  Step Name: $($step6.stepName)" -ForegroundColor White
        Write-Host "  Fields Count: $($step6.fields.Count)" -ForegroundColor White
        
        # Find partsUsed field
        $partsUsedField = $step6.fields | Where-Object { $_.name -eq "partsUsed" }
        
        if ($partsUsedField) {
            Write-Host "🔧 Parts Used Field Found:" -ForegroundColor Green
            Write-Host "  Label: $($partsUsedField.label)" -ForegroundColor White
            Write-Host "  Type: $($partsUsedField.type)" -ForegroundColor White
            Write-Host "  Schema Fields:" -ForegroundColor White
            
            foreach ($schemaField in $partsUsedField.schema) {
                Write-Host "    - $($schemaField.name): $($schemaField.label) ($($schemaField.type))" -ForegroundColor Cyan
            }
            
            # Check if serialNumber is present
            $serialNumberField = $partsUsedField.schema | Where-Object { $_.name -eq "serialNumber" }
            if ($serialNumberField) {
                Write-Host "✅ Serial Number field is present!" -ForegroundColor Green
            } else {
                Write-Host "❌ Serial Number field is MISSING!" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ partsUsed field not found in Step 6" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Step 6 not found in response" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -like "*Unable to connect*") {
        Write-Host "💡 Backend server might not be running on port 5000" -ForegroundColor Yellow
        Write-Host "   Try starting the backend with: npm start or node server.js" -ForegroundColor Yellow
    }
}

Write-Host "🏁 Test completed." -ForegroundColor Cyan 