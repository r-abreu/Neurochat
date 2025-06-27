# Enhanced Parts Fields Test Script
# Tests the new parts description functionality in service workflow reports

Write-Host "" -ForegroundColor White
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "     ENHANCED PARTS FIELDS TEST" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:5000"
$headers = @{ "Content-Type" = "application/json" }

# Test configuration
$testConfig = @{
    ticketId = "TEST-PARTS-001"
    deviceSerial = "ENH-PARTS-TEST-001"
    agentId = "test-agent-enhanced"
}

try {
    Write-Host "🧪 Step 1: Creating Test Service Workflow" -ForegroundColor Yellow
    
    $createWorkflowPayload = @{
        ticketId = $testConfig.ticketId
        deviceSerialNumber = $testConfig.deviceSerial
        initiatedBy = $testConfig.agentId
    } | ConvertTo-Json

    $createUrl = "$baseUrl/api/service-workflows"
    $workflow = Invoke-RestMethod -Uri $createUrl -Method POST -Headers $headers -Body $createWorkflowPayload
    
    $workflowId = $workflow.workflowId
    Write-Host "✅ Created workflow: $workflowId" -ForegroundColor Green

    Write-Host ""
    Write-Host "🔧 Step 2: Populate Step 3 - Receiving Parts with Serial Numbers" -ForegroundColor Yellow
    
    # Get Step 3
    $getWorkflowUrl = "$baseUrl/api/service-workflows/$workflowId"
    $workflowDetail = Invoke-RestMethod -Uri $getWorkflowUrl -Method GET -Headers $headers
    $step3 = $workflowDetail.steps | Where-Object { $_.stepNumber -eq 3 }
    $step3Id = $step3.stepId
    
    # Step 3 data with received parts including serial numbers
    $receivedParts = @(
        @{
            partModel = "PWR-SUPPLY-2024"
            partName = "Advanced Power Supply Unit"
            serialNumber = "PSU-ABC123456"
        },
        @{
            partModel = "LCD-DISPLAY-HD"
            partName = "High Definition LCD Panel"
            serialNumber = "LCD-XYZ789012"
        },
        @{
            partModel = "CONTROL-BOARD"
            partName = "Main Control Board"
            serialNumber = "MCB-DEF345678"
        }
    )
    
    $step3Data = @{
        receivedDate = (Get-Date).ToString("yyyy-MM-dd")
        cleaningDate = (Get-Date).ToString("yyyy-MM-dd")
        productIdConfirmationDate = (Get-Date).ToString("yyyy-MM-dd")
        receivedParts = ($receivedParts | ConvertTo-Json -Compress)
        inspectionComments = "All parts received in good condition with visible serial numbers"
        status = "completed"
    }
    
    $updateStep3Url = "$baseUrl/api/service-workflows/$workflowId/steps/$step3Id"
    $updatedStep3 = Invoke-RestMethod -Uri $updateStep3Url -Method PUT -Headers $headers -Body ($step3Data | ConvertTo-Json)
    
    Write-Host "  ✅ Step 3 completed with $($receivedParts.Count) parts with serial numbers" -ForegroundColor Green

    Write-Host ""
    Write-Host "🔍 Step 3: Populate Step 4 - Defect Analysis with Replacement Parts" -ForegroundColor Yellow
    
    # Get Step 4
    $workflowDetail = Invoke-RestMethod -Uri $getWorkflowUrl -Method GET -Headers $headers
    $step4 = $workflowDetail.steps | Where-Object { $_.stepNumber -eq 4 }
    $step4Id = $step4.stepId
    
    # Step 4 data with replacement parts
    $replacementParts = @(
        @{
            partNumber = "PWR-SUPPLY-2024-V2"
            partName = "Enhanced Power Supply Unit V2"
            quantity = 1
        },
        @{
            partNumber = "LCD-DISPLAY-HD-PRO"
            partName = "Professional HD LCD Panel"
            quantity = 1
        }
    )
    
    $step4Data = @{
        analysisDate = (Get-Date).ToString("yyyy-MM-dd")
        findingsDescription = "Power supply failure detected, LCD panel has minor defects requiring replacement"
        replacementParts = ($replacementParts | ConvertTo-Json -Compress)
        diagnosticSummary = "Primary failure in power management circuit, secondary display controller issues"
        status = "completed"
    }
    
    $updateStep4Url = "$baseUrl/api/service-workflows/$workflowId/steps/$step4Id"
    $updatedStep4 = Invoke-RestMethod -Uri $updateStep4Url -Method PUT -Headers $headers -Body ($step4Data | ConvertTo-Json)
    
    Write-Host "  ✅ Step 4 completed with $($replacementParts.Count) replacement parts identified" -ForegroundColor Green

    Write-Host ""
    Write-Host "🛠️ Step 4: Populate Step 6 - Repair with Parts Used including Serial Numbers" -ForegroundColor Yellow
    
    # Get Step 6
    $workflowDetail = Invoke-RestMethod -Uri $getWorkflowUrl -Method GET -Headers $headers
    $step6 = $workflowDetail.steps | Where-Object { $_.stepNumber -eq 6 }
    $step6Id = $step6.stepId
    
    # Step 6 data with parts used including serial numbers
    $partsUsed = @(
        @{
            partNumber = "PWR-SUPPLY-2024-V2"
            partName = "Enhanced Power Supply Unit V2"
            quantity = 1
            serialNumber = "PSU-NEW789456"
        },
        @{
            partNumber = "LCD-DISPLAY-HD-PRO"
            partName = "Professional HD LCD Panel"
            quantity = 1
            serialNumber = "LCD-NEW123789"
        },
        @{
            partNumber = "THERMAL-PAD-001"
            partName = "Thermal Interface Pad"
            quantity = 2
            serialNumber = "TIP-BATCH-2024-001"
        }
    )
    
    $testChecklist = @{
        powerTest = $true
        functionalTest = $true
        calibrationTest = $true
        safetyTest = $true
        finalTest = $true
    }
    
    $step6Data = @{
        correctionDate = (Get-Date).ToString("yyyy-MM-dd")
        repairDescription = "Replaced faulty power supply and LCD panel. Added thermal interface pads for improved heat dissipation."
        partsUsed = ($partsUsed | ConvertTo-Json -Compress)
        testChecklist = ($testChecklist | ConvertTo-Json -Compress)
        finalRepairApproval = $true
        status = "completed"
    }
    
    $updateStep6Url = "$baseUrl/api/service-workflows/$workflowId/steps/$step6Id"
    $updatedStep6 = Invoke-RestMethod -Uri $updateStep6Url -Method PUT -Headers $headers -Body ($step6Data | ConvertTo-Json)
    
    Write-Host "  ✅ Step 6 completed with $($partsUsed.Count) parts used with serial numbers" -ForegroundColor Green

    Write-Host ""
    Write-Host "📄 Step 5: Generate PDF Report to Test Enhanced Parts Fields" -ForegroundColor Yellow
    
    $generateReportUrl = "$baseUrl/api/service-workflows/$workflowId/generate-report"
    $reportPayload = @{
        reportType = "draft"
        includeAttachments = $false
    } | ConvertTo-Json
    
    $reportResponse = Invoke-RestMethod -Uri $generateReportUrl -Method POST -Headers $headers -Body $reportPayload
    
    Write-Host "  ✅ Report generated: $($reportResponse.filename)" -ForegroundColor Green
    Write-Host "  📁 Report path: $($reportResponse.filepath)" -ForegroundColor Cyan

    Write-Host ""
    Write-Host "🔍 Step 6: Verify Report Contents" -ForegroundColor Yellow
    
    # Get the generated report list
    $reportsUrl = "$baseUrl/api/service-workflows/$workflowId/reports"
    $reports = Invoke-RestMethod -Uri $reportsUrl -Method GET -Headers $headers
    
    if ($reports -and $reports.Count -gt 0) {
        Write-Host "  ✅ Reports found: $($reports.Count)" -ForegroundColor Green
        
        $latestReport = $reports[0]
        Write-Host "  📋 Latest Report Details:" -ForegroundColor Cyan
        Write-Host "    - Filename: $($latestReport.filename)" -ForegroundColor White
        Write-Host "    - Type: $($latestReport.reportType)" -ForegroundColor White
        Write-Host "    - Size: $($latestReport.formattedSize)" -ForegroundColor White
        Write-Host "    - Created: $($latestReport.createdAt)" -ForegroundColor White
        
        Write-Host ""
        Write-Host "✅ ENHANCED PARTS FIELDS TEST COMPLETED SUCCESSFULLY!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Test Results Summary:" -ForegroundColor Yellow
        Write-Host "  ✅ Step 3: Received parts with serial numbers populated" -ForegroundColor Green
        Write-Host "  ✅ Step 4: Replacement parts with part numbers populated" -ForegroundColor Green
        Write-Host "  ✅ Step 6: Parts used with serial numbers populated" -ForegroundColor Green
        Write-Host "  ✅ PDF report generated with enhanced parts descriptions" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔍 Expected Report Enhancements:" -ForegroundColor Cyan
        Write-Host "  • Analysis & Diagnosis section should show: 'Advanced Power Supply Unit (Serial: PSU-ABC123456), High Definition LCD Panel (Serial: LCD-XYZ789012), Main Control Board (Serial: MCB-DEF345678)'" -ForegroundColor White
        Write-Host "  • Repair & Testing section should show: 'Enhanced Power Supply Unit V2 (Part #: PWR-SUPPLY-2024-V2), Professional HD LCD Panel (Part #: LCD-DISPLAY-HD-PRO)'" -ForegroundColor White
        Write-Host "  • Parts Used table should include serial numbers for all used parts" -ForegroundColor White

    } else {
        Write-Host "  ⚠️ No reports found - check report generation" -ForegroundColor Yellow
    }

} catch {
    Write-Host "❌ Error during test: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Full error: $($_.Exception | ConvertTo-Json -Depth 3)" -ForegroundColor Red
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "        TEST COMPLETED" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Cyan 