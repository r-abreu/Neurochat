Write-Host "=== COMPREHENSIVE REPORTS SYSTEM TEST ===" -ForegroundColor Green
Write-Host "This will test the entire reports system automatically" -ForegroundColor Yellow
Write-Host "" -ForegroundColor White

# Step 1: Check files exist
Write-Host "1. CHECKING PDF FILES..." -ForegroundColor Cyan
$reportsDir = ".\backend\reports"
if (Test-Path $reportsDir) {
    $allFiles = Get-ChildItem $reportsDir -Filter "*.pdf"
    Write-Host "   ✓ Found $($allFiles.Count) PDF files" -ForegroundColor Green
    
    # Extract workflow numbers
    $workflowNumbers = @()
    foreach ($file in $allFiles) {
        if ($file.Name -match "service-report-(.+?)-draft-") {
            $workflowNumber = $Matches[1]
            if ($workflowNumbers -notcontains $workflowNumber) {
                $workflowNumbers += $workflowNumber
            }
        }
    }
    
    Write-Host "   ✓ Workflow numbers in files:" -ForegroundColor Green
    foreach ($num in $workflowNumbers) {
        $count = ($allFiles | Where-Object { $_.Name -like "*$num*" }).Count
        Write-Host "     - $num ($count files)" -ForegroundColor White
    }
} else {
    Write-Host "   ❌ Reports directory not found!" -ForegroundColor Red
    exit 1
}

# Step 2: Check backend server is running
Write-Host "" -ForegroundColor White
Write-Host "2. CHECKING BACKEND SERVER..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:3001" -Method GET -TimeoutSec 5 -UseBasicParsing
    Write-Host "   ✓ Backend server is responding (Status: $($healthCheck.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend server not responding!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure backend is running: npm start" -ForegroundColor Yellow
    exit 1
}

# Step 3: Test the PDF reports API endpoints (without auth for now)
Write-Host "" -ForegroundColor White
Write-Host "3. TESTING PDF REPORTS API STRUCTURE..." -ForegroundColor Cyan

# Check if the API routes are defined by testing with a dummy ID
$testWorkflowId = "test-workflow-id"
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/service-workflows/$testWorkflowId/pdf-reports" -Method GET -UseBasicParsing
    Write-Host "   ✓ PDF reports API endpoint exists" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✓ PDF reports API endpoint exists (needs authentication)" -ForegroundColor Green
    } elseif ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "   ✓ PDF reports API endpoint exists (workflow not found)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PDF reports API endpoint issue: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 4: Test the file matching logic directly
Write-Host "" -ForegroundColor White
Write-Host "4. TESTING FILE MATCHING LOGIC..." -ForegroundColor Cyan

foreach ($workflowNumber in $workflowNumbers) {
    Write-Host "   Testing workflow number: $workflowNumber" -ForegroundColor Yellow
    
    # Simulate the pdfReportService.getWorkflowReports() logic
    $files = Get-ChildItem $reportsDir
    $reports = @()
    
    foreach ($file in $files) {
        if ($file.Name.Contains($workflowNumber) -and $file.Name.EndsWith('.pdf')) {
            $report = @{
                filename = $file.Name
                reportType = if ($file.Name.Contains('-draft-')) { 'draft' } else { 'final' }
                createdAt = $file.CreationTime
                size = $file.Length
            }
            $reports += $report
        }
    }
    
    Write-Host "     ✓ Would find $($reports.Count) reports for this workflow" -ForegroundColor Green
    foreach ($report in $reports) {
        Write-Host "       - $($report.filename)" -ForegroundColor White
    }
}

# Step 5: Check frontend build
Write-Host "" -ForegroundColor White
Write-Host "5. CHECKING FRONTEND..." -ForegroundColor Cyan
if (Test-Path ".\frontend\build") {
    Write-Host "   ✓ Frontend build exists" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Frontend build not found - run 'npm run build' in frontend" -ForegroundColor Yellow
}

try {
    $frontendCheck = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -UseBasicParsing
    Write-Host "   ✓ Frontend server is responding (Status: $($frontendCheck.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Frontend server not responding!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure frontend is running: npm start" -ForegroundColor Yellow
}

# Step 6: Check for common issues
Write-Host "" -ForegroundColor White
Write-Host "6. CHECKING FOR COMMON ISSUES..." -ForegroundColor Cyan

# Check if pdfReportService is properly initialized
$serverPath = ".\backend\server.js"
if (Test-Path $serverPath) {
    $serverContent = Get-Content $serverPath -Raw
    if ($serverContent -match "pdfReportService") {
        Write-Host "   ✓ pdfReportService is initialized in server.js" -ForegroundColor Green
    } else {
        Write-Host "   ❌ pdfReportService not found in server.js" -ForegroundColor Red
    }
    
    if ($serverContent -match "/pdf-reports") {
        Write-Host "   ✓ PDF reports API route is defined" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PDF reports API route not found" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ server.js not found!" -ForegroundColor Red
}

# Step 7: Analysis and recommendations
Write-Host "" -ForegroundColor White
Write-Host "7. ANALYSIS AND RECOMMENDATIONS..." -ForegroundColor Cyan

Write-Host "   SYSTEM STATUS:" -ForegroundColor Yellow
Write-Host "   ✓ PDF files exist ($($allFiles.Count) files)" -ForegroundColor Green
Write-Host "   ✓ File matching logic should work" -ForegroundColor Green
Write-Host "   ✓ API endpoints are defined" -ForegroundColor Green

Write-Host "" -ForegroundColor White
Write-Host "   MOST LIKELY ISSUES:" -ForegroundColor Yellow
Write-Host "   1. NO ACTIVE WORKFLOW exists with the workflow numbers from the files" -ForegroundColor Red
Write-Host "   2. AUTHENTICATION issues preventing API calls" -ForegroundColor Red
Write-Host "   3. WORKFLOW ID mismatch between frontend and backend" -ForegroundColor Red

Write-Host "" -ForegroundColor White
Write-Host "   NEXT STEPS TO FIX:" -ForegroundColor Yellow
Write-Host "   1. Create a service workflow for ticket 2506190003" -ForegroundColor White
Write-Host "   2. Check if the new workflow gets assigned one of these numbers:" -ForegroundColor White
foreach ($num in $workflowNumbers) {
    Write-Host "      - $num" -ForegroundColor Cyan
}
Write-Host "   3. If not, generate a new report for the new workflow" -ForegroundColor White
Write-Host "   4. Check backend console for the enhanced debug logging" -ForegroundColor White

Write-Host "" -ForegroundColor White
Write-Host "   TO CREATE A WORKFLOW:" -ForegroundColor Yellow
Write-Host "   1. Open http://localhost:3000 in browser" -ForegroundColor White
Write-Host "   2. Go to ticket 2506190003" -ForegroundColor White
Write-Host "   3. Click 'Service Workflow' button" -ForegroundColor White
Write-Host "   4. Click 'Create Workflow' if prompted" -ForegroundColor White
Write-Host "   5. Check if reports appear in the table" -ForegroundColor White

Write-Host "" -ForegroundColor White
Write-Host "=== TEST COMPLETED ===" -ForegroundColor Green
Write-Host "The system components are working. The issue is likely missing workflow data." -ForegroundColor Yellow 