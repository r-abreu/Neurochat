# Test script to verify service report field population
# This script will test the service report generation to ensure all fields are properly populated

$baseUrl = "http://localhost:3001"

Write-Host "🧪 Testing Service Report Field Population" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Test login
Write-Host "🔐 Testing login..." -ForegroundColor Yellow
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body (@{
    email = "admin@neurochat.com"
    password = "admin123"
} | ConvertTo-Json) -ContentType "application/json"

if ($loginResponse.success) {
    Write-Host "✅ Login successful" -ForegroundColor Green
    $token = $loginResponse.token
    $headers = @{ "Authorization" = "Bearer $token" }
} else {
    Write-Host "❌ Login failed" -ForegroundColor Red
    exit 1
}

# Get existing service workflows
Write-Host "📋 Getting existing service workflows..." -ForegroundColor Yellow
try {
    $workflowsResponse = Invoke-RestMethod -Uri "$baseUrl/api/service-workflows" -Method GET -Headers $headers
    
    if ($workflowsResponse -and $workflowsResponse.Count -gt 0) {
        $workflow = $workflowsResponse[0]
        Write-Host "✅ Found workflow: $($workflow.workflowNumber)" -ForegroundColor Green
        
        # Test PDF report generation
        Write-Host "📄 Testing PDF report generation..." -ForegroundColor Yellow
        $reportResponse = Invoke-RestMethod -Uri "$baseUrl/api/service-workflows/$($workflow.workflowId)/pdf-report" -Method POST -Headers $headers -Body (@{
            reportType = "draft"
        } | ConvertTo-Json) -ContentType "application/json"
        
        if ($reportResponse.success) {
            Write-Host "✅ PDF report generated successfully: $($reportResponse.filename)" -ForegroundColor Green
            
            # Check if report files exist
            $reportsDir = "backend/reports"
            if (Test-Path $reportsDir) {
                $reportFiles = Get-ChildItem -Path $reportsDir -Filter "*.pdf" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
                Write-Host "📄 Recent report files:" -ForegroundColor Cyan
                foreach ($file in $reportFiles) {
                    Write-Host "  - $($file.Name) ($([math]::Round($file.Length/1KB, 2)) KB)" -ForegroundColor White
                }
            }
        } else {
            Write-Host "❌ PDF report generation failed" -ForegroundColor Red
        }
        
        # Get workflow details to check data population
        Write-Host "🔍 Checking workflow data population..." -ForegroundColor Yellow
        $workflowDetail = Invoke-RestMethod -Uri "$baseUrl/api/service-workflows/$($workflow.workflowId)" -Method GET -Headers $headers
        
        Write-Host "📊 Workflow Data Analysis:" -ForegroundColor Cyan
        Write-Host "  - Workflow Number: $($workflowDetail.workflowNumber)" -ForegroundColor White
        Write-Host "  - Device Serial: $($workflowDetail.deviceSerialNumber)" -ForegroundColor White
        Write-Host "  - Current Step: $($workflowDetail.currentStep)" -ForegroundColor White
        Write-Host "  - Steps Count: $($workflowDetail.steps.Count)" -ForegroundColor White
        
        # Check each step for data
        for ($i = 1; $i -le 10; $i++) {
            $step = $workflowDetail.steps | Where-Object { $_.stepNumber -eq $i }
            if ($step) {
                Write-Host "  Step $i ($($step.stepName)): $($step.status)" -ForegroundColor White
                
                # Check for common fields that should be populated
                $fieldsToCheck = @(
                    'defectDescription', 'deviceSerialNumber', 'loanerModel', 'loanerSerialNumber',
                    'receivedDate', 'cleaningDate', 'analysisDate', 'findingsDescription',
                    'quoteNumber', 'invoiceNumber', 'repairDescription', 'testChecklist'
                )
                
                $populatedFields = @()
                foreach ($field in $fieldsToCheck) {
                    if ($step.$field -and $step.$field -ne '' -and $step.$field -ne 'N/A') {
                        $populatedFields += $field
                    }
                }
                
                if ($populatedFields.Count -gt 0) {
                    Write-Host "    Populated fields: $($populatedFields -join ', ')" -ForegroundColor Green
                } else {
                    Write-Host "    No fields populated" -ForegroundColor Yellow
                }
            }
        }
        
    } else {
        Write-Host "⚠️ No service workflows found" -ForegroundColor Yellow
        Write-Host "💡 Create a service workflow first to test report generation" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "❌ Error getting workflows: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🏁 Service Report Field Test Complete" -ForegroundColor Green 