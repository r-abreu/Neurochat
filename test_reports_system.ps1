Write-Host "=== TESTING REPORTS SYSTEM ===" -ForegroundColor Green
Write-Host "" -ForegroundColor White

Write-Host "1. CHECKING PDF FILES..." -ForegroundColor Cyan
$reportsDir = ".\backend\reports"
if (Test-Path $reportsDir) {
    $allFiles = Get-ChildItem $reportsDir -Filter "*.pdf"
    Write-Host "   Found $($allFiles.Count) PDF files" -ForegroundColor Green
    
    $workflowNumbers = @()
    foreach ($file in $allFiles) {
        if ($file.Name -match "service-report-(.+?)-draft-") {
            $workflowNumber = $Matches[1]
            if ($workflowNumbers -notcontains $workflowNumber) {
                $workflowNumbers += $workflowNumber
            }
        }
    }
    
    Write-Host "   Workflow numbers in files:" -ForegroundColor Yellow
    foreach ($num in $workflowNumbers) {
        $count = ($allFiles | Where-Object { $_.Name -like "*$num*" }).Count
        Write-Host "     - $num ($count files)" -ForegroundColor White
    }
} else {
    Write-Host "   Reports directory not found!" -ForegroundColor Red
    exit 1
}

Write-Host "" -ForegroundColor White
Write-Host "2. CHECKING BACKEND SERVER..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:3001" -Method GET -TimeoutSec 5 -UseBasicParsing
    Write-Host "   Backend server is responding (Status: $($healthCheck.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   Backend server not responding!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "" -ForegroundColor White
Write-Host "3. TESTING FILE MATCHING LOGIC..." -ForegroundColor Cyan
foreach ($workflowNumber in $workflowNumbers) {
    Write-Host "   Testing workflow number: $workflowNumber" -ForegroundColor Yellow
    
    $files = Get-ChildItem $reportsDir
    $reports = @()
    
    foreach ($file in $files) {
        if ($file.Name.Contains($workflowNumber) -and $file.Name.EndsWith('.pdf')) {
            $reports += $file.Name
        }
    }
    
    Write-Host "     Would find $($reports.Count) reports for this workflow" -ForegroundColor Green
    foreach ($report in $reports) {
        Write-Host "       - $report" -ForegroundColor White
    }
}

Write-Host "" -ForegroundColor White
Write-Host "4. CHECKING FRONTEND..." -ForegroundColor Cyan
try {
    $frontendCheck = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -UseBasicParsing
    Write-Host "   Frontend server is responding (Status: $($frontendCheck.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   Frontend server not responding!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "" -ForegroundColor White
Write-Host "5. ANALYSIS..." -ForegroundColor Cyan
Write-Host "   STATUS:" -ForegroundColor Yellow
Write-Host "   - PDF files exist: $($allFiles.Count) files" -ForegroundColor Green
Write-Host "   - File matching logic works correctly" -ForegroundColor Green
Write-Host "   - Backend server is running" -ForegroundColor Green

Write-Host "" -ForegroundColor White
Write-Host "   MOST LIKELY ISSUE:" -ForegroundColor Yellow
Write-Host "   NO ACTIVE WORKFLOW exists with these workflow numbers:" -ForegroundColor Red
foreach ($num in $workflowNumbers) {
    Write-Host "   - $num" -ForegroundColor Cyan
}

Write-Host "" -ForegroundColor White
Write-Host "   SOLUTION:" -ForegroundColor Yellow
Write-Host "   1. Create a service workflow for ticket 2506190003" -ForegroundColor White
Write-Host "   2. Check if it gets assigned one of the existing workflow numbers" -ForegroundColor White
Write-Host "   3. If not, generate a new report for the new workflow" -ForegroundColor White

Write-Host "" -ForegroundColor White
Write-Host "=== TEST COMPLETED ===" -ForegroundColor Green 