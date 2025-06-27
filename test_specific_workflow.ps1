Write-Host "Testing Specific Workflow: SWF-66887063" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Test the file matching logic for this specific workflow
$workflowNumber = "SWF-66887063"
$reportsDir = ".\backend\reports"

Write-Host "1. Checking files in reports directory..." -ForegroundColor Yellow
if (Test-Path $reportsDir) {
    $allFiles = Get-ChildItem $reportsDir -Filter "*.pdf"
    Write-Host "   Total PDF files: $($allFiles.Count)" -ForegroundColor Cyan
    
    Write-Host "2. Testing matching logic for workflow: $workflowNumber" -ForegroundColor Yellow
    $matchingFiles = $allFiles | Where-Object { $_.Name -like "*$workflowNumber*" }
    Write-Host "   Matching files: $($matchingFiles.Count)" -ForegroundColor Cyan
    
    foreach ($file in $matchingFiles) {
        Write-Host "   ✓ $($file.Name)" -ForegroundColor Green
        Write-Host "     Size: $($file.Length) bytes" -ForegroundColor Gray
        Write-Host "     Created: $($file.CreationTime)" -ForegroundColor Gray
    }
    
    if ($matchingFiles.Count -eq 0) {
        Write-Host "   ❌ NO MATCHING FILES FOUND!" -ForegroundColor Red
    } else {
        Write-Host "   ✅ Files found - matching logic works!" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ Reports directory not found!" -ForegroundColor Red
    exit 1
}

Write-Host "3. Testing what the pdfReportService.getWorkflowReports() would return..." -ForegroundColor Yellow

# Simulate the exact logic from pdfReportService.js
$files = Get-ChildItem $reportsDir
$reports = @()

foreach ($file in $files) {
    if ($file.Name.Contains($workflowNumber) -and $file.Name.EndsWith('.pdf')) {
        $report = @{
            filename = $file.Name
            filepath = $file.FullName
            reportType = if ($file.Name.Contains('-draft-')) { 'draft' } else { 'final' }
            createdAt = $file.CreationTime
            size = $file.Length
        }
        $reports += $report
    }
}

Write-Host "   Simulated API response would contain: $($reports.Count) reports" -ForegroundColor Cyan
foreach ($report in $reports) {
    Write-Host "   - Filename: $($report.filename)" -ForegroundColor White
    Write-Host "     Type: $($report.reportType)" -ForegroundColor Gray
    Write-Host "     Size: $($report.size) bytes" -ForegroundColor Gray
}

Write-Host "4. Next steps to test the actual API..." -ForegroundColor Yellow
Write-Host "   To test the real API, you need to:" -ForegroundColor White
Write-Host "   1. Find a ticket that has a workflow with number: $workflowNumber" -ForegroundColor White
Write-Host "   2. Open that ticket's service workflow in the frontend" -ForegroundColor White
Write-Host "   3. Check the browser's Network tab for API calls" -ForegroundColor White
Write-Host "   4. Look for calls to: /api/service-workflows/{workflowId}/pdf-reports" -ForegroundColor White
Write-Host "   5. Check the backend console for the enhanced debug logging" -ForegroundColor White

Write-Host "5. Browser Network Debugging Steps:" -ForegroundColor Yellow
Write-Host "   1. Open browser Developer Tools (F12)" -ForegroundColor White
Write-Host "   2. Go to Network tab" -ForegroundColor White
Write-Host "   3. Open a service workflow that should have reports" -ForegroundColor White
Write-Host "   4. Click the 'Reload' button in the reports section" -ForegroundColor White
Write-Host "   5. Check if you see the API call and what response it gets" -ForegroundColor White

Write-Host "" -ForegroundColor White
Write-Host "CONCLUSION:" -ForegroundColor Green
if ($matchingFiles.Count -gt 0) {
    Write-Host "✅ The file matching logic works correctly" -ForegroundColor Green
    Write-Host "✅ There is a PDF file for workflow $workflowNumber" -ForegroundColor Green
    Write-Host "❓ The issue is likely:" -ForegroundColor Yellow
    Write-Host "   - No active workflow exists with number $workflowNumber" -ForegroundColor Yellow
    Write-Host "   - OR the frontend is calling the API with a different workflow ID" -ForegroundColor Yellow
    Write-Host "   - OR there's an authentication/permission issue" -ForegroundColor Yellow
} else {
    Write-Host "❌ No files found for this workflow number" -ForegroundColor Red
}

Write-Host "Test completed." -ForegroundColor Gray 