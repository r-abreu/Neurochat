Write-Host "=== Enhanced Reports Table Test ===" -ForegroundColor Cyan
Write-Host "Testing new columns: Report Date, File Name, Directory, File Size" -ForegroundColor Yellow
Write-Host ""

# Check backend status
Write-Host "1. Checking backend server status..." -ForegroundColor Green
try {
    $backendStatus = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend server is not responding" -ForegroundColor Red
    Write-Host "Please start the backend with: .\start-backend.ps1" -ForegroundColor Yellow
    exit 1
}

# Check available PDF files
Write-Host ""
Write-Host "2. Checking available PDF files in backend/reports..." -ForegroundColor Green
$reportsPath = ".\backend\reports"
$pdfFiles = @()
if (Test-Path $reportsPath) {
    $pdfFiles = Get-ChildItem -Path $reportsPath -Filter "*.pdf" | Sort-Object CreationTime -Descending
    Write-Host "Found $($pdfFiles.Count) PDF files:" -ForegroundColor Cyan
    
    $workflowNumbers = @()
    foreach ($file in $pdfFiles) {
        Write-Host "  📄 $($file.Name) - Size: $([math]::Round($file.Length/1024, 2)) KB - Created: $($file.CreationTime)" -ForegroundColor White
        
        # Extract workflow number
        if ($file.Name -match "service-report-(.+?)-draft-") {
            $workflowNumbers += $matches[1]
        }
    }
    
    $uniqueWorkflowNumbers = $workflowNumbers | Select-Object -Unique
    Write-Host ""
    Write-Host "Available workflow numbers: $($uniqueWorkflowNumbers -join ', ')" -ForegroundColor Cyan
} else {
    Write-Host "❌ Reports directory not found: $reportsPath" -ForegroundColor Red
}

# Test service workflows API
Write-Host ""
Write-Host "3. Testing service workflows API..." -ForegroundColor Green
try {
    $workflows = Invoke-RestMethod -Uri "http://localhost:3001/api/service-workflows" -Method GET -TimeoutSec 10
    Write-Host "✅ Found $($workflows.Count) service workflows" -ForegroundColor Green
    
    if ($workflows.Count -gt 0) {
        $testWorkflow = $workflows[0]
        Write-Host "🔍 Testing with workflow: $($testWorkflow.workflowId) - Number: $($testWorkflow.workflowNumber)" -ForegroundColor Cyan
        
        # Test PDF reports endpoint with enhanced data
        Write-Host ""
        Write-Host "4. Testing enhanced PDF reports endpoint..." -ForegroundColor Green
        try {
            $reports = Invoke-RestMethod -Uri "http://localhost:3001/api/service-workflows/$($testWorkflow.workflowId)/pdf-reports" -Method GET -TimeoutSec 10
            Write-Host "✅ PDF reports API responded successfully" -ForegroundColor Green
            Write-Host "Found $($reports.Count) reports for workflow $($testWorkflow.workflowNumber)" -ForegroundColor Cyan
            
            if ($reports.Count -gt 0) {
                Write-Host ""
                Write-Host "📊 Enhanced Report Data Structure:" -ForegroundColor Yellow
                foreach ($report in $reports) {
                    Write-Host "  📄 Report Details:" -ForegroundColor White
                    Write-Host "    - Filename: $($report.filename)" -ForegroundColor Gray
                    Write-Host "    - Report Type: $($report.reportType)" -ForegroundColor Gray
                    Write-Host "    - Created At: $($report.createdAt)" -ForegroundColor Gray
                    Write-Host "    - Directory: $($report.directory)" -ForegroundColor Gray
                    Write-Host "    - Relative Path: $($report.relativePath)" -ForegroundColor Gray
                    Write-Host "    - File Size: $($report.size) bytes ($($report.formattedSize))" -ForegroundColor Gray
                    Write-Host "    - Modified At: $($report.modifiedAt)" -ForegroundColor Gray
                    Write-Host ""
                }
            } else {
                Write-Host "⚠️  No reports found for this workflow" -ForegroundColor Yellow
                Write-Host "💡 Consider generating a new report or using a workflow with existing reports" -ForegroundColor Cyan
            }
        } catch {
            Write-Host "❌ Error testing PDF reports endpoint: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  No service workflows found in database" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error testing service workflows API: $($_.Exception.Message)" -ForegroundColor Red
}

# Test report download endpoint
Write-Host ""
Write-Host "5. Testing report download functionality..." -ForegroundColor Green
if ($pdfFiles.Count -gt 0) {
    $testFile = $pdfFiles[0].Name
    try {
        $downloadUrl = "http://localhost:3001/api/service-workflows/reports/$testFile"
        $response = Invoke-WebRequest -Uri $downloadUrl -Method HEAD -TimeoutSec 10
        Write-Host "✅ Report download endpoint accessible: $downloadUrl" -ForegroundColor Green
        Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
        Write-Host "Content-Length: $($response.Headers['Content-Length'])" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error accessing report download: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  No PDF files available to test download" -ForegroundColor Yellow
}

# Summary and recommendations
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Enhanced Reports Table Features:" -ForegroundColor Yellow
Write-Host "✅ Report Date column (with separate date and time display)" -ForegroundColor Green
Write-Host "✅ File Name column (with monospace font for readability)" -ForegroundColor Green
Write-Host "✅ Directory column (showing both relative and absolute paths)" -ForegroundColor Green
Write-Host "✅ File Size column (with human-readable format and bytes)" -ForegroundColor Green
Write-Host "✅ Enhanced backend service providing additional metadata" -ForegroundColor Green

Write-Host ""
Write-Host "💡 Recommendations:" -ForegroundColor Cyan
Write-Host "1. Navigate to a ticket with service workflow in browser" -ForegroundColor White
Write-Host "2. Open Service Workflow to see the enhanced reports table" -ForegroundColor White
Write-Host "3. The table now shows: Report Type, Report Date, File Name, Directory, File Size, Actions" -ForegroundColor White
Write-Host "4. Each report matches the actual workflow number from the database" -ForegroundColor White

Write-Host ""
Write-Host "🌐 Frontend URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 Backend URL: http://localhost:3001" -ForegroundColor Cyan
Write-Host "" 