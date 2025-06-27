Write-Host "Testing Workflow SWF-66887063" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green

$workflowNumber = "SWF-66887063"
$reportsDir = ".\backend\reports"

Write-Host "1. Checking for files with workflow number: $workflowNumber" -ForegroundColor Yellow

if (Test-Path $reportsDir) {
    $allFiles = Get-ChildItem $reportsDir -Filter "*.pdf"
    Write-Host "   Total PDF files: $($allFiles.Count)" -ForegroundColor Cyan
    
    $matchingFiles = $allFiles | Where-Object { $_.Name -like "*$workflowNumber*" }
    Write-Host "   Matching files: $($matchingFiles.Count)" -ForegroundColor Cyan
    
    foreach ($file in $matchingFiles) {
        Write-Host "   Found: $($file.Name)" -ForegroundColor Green
    }
    
    if ($matchingFiles.Count -eq 0) {
        Write-Host "   No matching files found!" -ForegroundColor Red
    } else {
        Write-Host "   Files found - the API should be able to find these!" -ForegroundColor Green
    }
} else {
    Write-Host "   Reports directory not found!" -ForegroundColor Red
}

Write-Host "2. What to check next:" -ForegroundColor Yellow
Write-Host "   - Open the service workflow in the browser" -ForegroundColor White
Write-Host "   - Open browser Developer Tools (F12)" -ForegroundColor White
Write-Host "   - Go to Network tab" -ForegroundColor White
Write-Host "   - Click Reload button in the reports section" -ForegroundColor White
Write-Host "   - Look for API call to pdf-reports endpoint" -ForegroundColor White
Write-Host "   - Check what response you get" -ForegroundColor White

Write-Host "Test completed." -ForegroundColor Gray 