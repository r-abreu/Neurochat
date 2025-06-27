# Test Updated PDF Report
Write-Host "Testing Updated PDF Report Format" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

$baseUrl = "http://localhost:3001"

# Test 1: Check if backend is running
Write-Host "`n1. Checking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/categories" -Method GET -TimeoutSec 5
    Write-Host "   ✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend is not running. Please start it first." -ForegroundColor Red
    Write-Host "   Run: .\start-backend.ps1" -ForegroundColor Yellow
    exit 1
}

# Test 2: Check for existing reports
Write-Host "`n2. Checking for existing reports..." -ForegroundColor Yellow
$reportsDir = ".\backend\reports"
if (Test-Path $reportsDir) {
    $existingReports = Get-ChildItem $reportsDir -Filter "*.pdf"
    Write-Host "   Found $($existingReports.Count) existing reports" -ForegroundColor Cyan
    
    if ($existingReports.Count -gt 0) {
        $latestReport = $existingReports | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        Write-Host "   Latest report: $($latestReport.Name)" -ForegroundColor Cyan
        Write-Host "   Created: $($latestReport.LastWriteTime)" -ForegroundColor Gray
        
        # Ask user if they want to open the latest report
        Write-Host "`n   The updated report format should now include:" -ForegroundColor Yellow
        Write-Host "   • Fixed logo (SVG instead of broken image)" -ForegroundColor White
        Write-Host "   • Company name in report information" -ForegroundColor White
        Write-Host "   • 'Contact' instead of 'Customer'" -ForegroundColor White
        Write-Host "   • No 'Status' field" -ForegroundColor White
        Write-Host "   • 'Service Information' instead of 'Service Steps Summary'" -ForegroundColor White
        Write-Host "   • Organized sections for each service step" -ForegroundColor White
        Write-Host "   • Quote and Invoice numbers at the top" -ForegroundColor White
        Write-Host "   • Signature section at the bottom" -ForegroundColor White
        
        Write-Host "`n   To verify the changes, open the latest report file:" -ForegroundColor Green
        Write-Host "   $($latestReport.FullName)" -ForegroundColor Cyan
        
        # Try to open the file
        try {
            Start-Process $latestReport.FullName
            Write-Host "   ✅ Opening latest report..." -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Could not open report automatically. Please open manually." -ForegroundColor Yellow
        }
    } else {
        Write-Host "   No existing reports found. Generate a new report from the frontend." -ForegroundColor Yellow
    }
} else {
    Write-Host "   Reports directory not found." -ForegroundColor Yellow
}

Write-Host "`n3. Instructions to test the updated report:" -ForegroundColor Yellow
Write-Host "   1. Open the frontend application" -ForegroundColor White
Write-Host "   2. Navigate to a service workflow" -ForegroundColor White
Write-Host "   3. Click 'Generate New Report' button" -ForegroundColor White
Write-Host "   4. Download and open the generated PDF" -ForegroundColor White
Write-Host "   5. Verify all the requested changes are present" -ForegroundColor White

Write-Host "`nTest completed!" -ForegroundColor Green 