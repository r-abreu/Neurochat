Write-Host "Testing Reports Matching Logic" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green

$reportsDir = ".\backend\reports"
if (Test-Path $reportsDir) {
    $files = Get-ChildItem $reportsDir -Filter "*.pdf"
    Write-Host "Files in reports directory:" -ForegroundColor Cyan
    foreach ($file in $files) {
        Write-Host "  - $($file.Name)" -ForegroundColor White
    }
    
    $testWorkflowNumber = "SWF-02742561"
    Write-Host "Testing match for workflow number: $testWorkflowNumber" -ForegroundColor Yellow
    $matchingFiles = $files | Where-Object { $_.Name -like "*$testWorkflowNumber*" }
    Write-Host "Matching files: $($matchingFiles.Count)" -ForegroundColor Green
    foreach ($file in $matchingFiles) {
        Write-Host "  + $($file.Name)" -ForegroundColor Green
    }
    
    if ($matchingFiles.Count -eq 0) {
        Write-Host "NO MATCHES FOUND - this is the problem!" -ForegroundColor Red
        Write-Host "The workflow number in the system doesn't match the filenames" -ForegroundColor Red
    } else {
        Write-Host "MATCHES FOUND - the matching logic should work!" -ForegroundColor Green
    }
} else {
    Write-Host "Reports directory not found!" -ForegroundColor Red
} 