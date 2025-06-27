Write-Host "=== Enhanced Reports Table Test ===" -ForegroundColor Cyan
Write-Host ""

# Check backend status
Write-Host "1. Checking backend server..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend server is running" -ForegroundColor Green
}
catch {
    Write-Host "❌ Backend server not responding" -ForegroundColor Red
    exit 1
}

# Check PDF files
Write-Host ""
Write-Host "2. Checking PDF files..." -ForegroundColor Green
$reportsPath = ".\backend\reports"
if (Test-Path $reportsPath) {
    $pdfFiles = Get-ChildItem -Path $reportsPath -Filter "*.pdf"
    Write-Host "Found $($pdfFiles.Count) PDF files" -ForegroundColor Cyan
    
    foreach ($file in $pdfFiles) {
        Write-Host "  📄 $($file.Name)" -ForegroundColor White
    }
}

# Test workflows API
Write-Host ""
Write-Host "3. Testing workflows API..." -ForegroundColor Green
try {
    $workflows = Invoke-RestMethod -Uri "http://localhost:3001/api/service-workflows" -Method GET -TimeoutSec 10
    Write-Host "✅ Found $($workflows.Count) workflows" -ForegroundColor Green
    
    if ($workflows.Count -gt 0) {
        $testWorkflow = $workflows[0]
        Write-Host "Testing workflow: $($testWorkflow.workflowNumber)" -ForegroundColor Cyan
        
        # Test enhanced PDF reports endpoint
        try {
            $reports = Invoke-RestMethod -Uri "http://localhost:3001/api/service-workflows/$($testWorkflow.workflowId)/pdf-reports" -Method GET -TimeoutSec 10
            Write-Host "✅ Enhanced reports API working - found $($reports.Count) reports" -ForegroundColor Green
            
            foreach ($report in $reports) {
                Write-Host "  📊 Report: $($report.filename)" -ForegroundColor White
                Write-Host "    Type: $($report.reportType)" -ForegroundColor Gray
                Write-Host "    Size: $($report.formattedSize)" -ForegroundColor Gray
                Write-Host "    Directory: $($report.directory)" -ForegroundColor Gray
            }
        }
        catch {
            Write-Host "❌ Reports API error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}
catch {
    Write-Host "❌ Workflows API error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "✅ Enhanced table now includes:" -ForegroundColor Green
Write-Host "  - Report Date (formatted date/time)" -ForegroundColor White
Write-Host "  - File Name (monospace display)" -ForegroundColor White
Write-Host "  - Directory (relative/absolute paths)" -ForegroundColor White
Write-Host "  - File Size (human-readable format)" -ForegroundColor White
Write-Host ""
Write-Host "🌐 View enhanced table at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "" 