Write-Host "=== Testing PDF Reports API Directly ===" -ForegroundColor Cyan
Write-Host ""

# Test the specific workflow ID from the console logs
$workflowId = "a4e125f1-6780-4fc7-82e5-f3681edc2556"
$apiUrl = "http://localhost:3001/api/service-workflows/$workflowId/pdf-reports"

Write-Host "Testing workflow ID: $workflowId" -ForegroundColor Yellow
Write-Host "API URL: $apiUrl" -ForegroundColor Gray
Write-Host ""

try {
    # Make the API call without authentication first to see the raw response
    Write-Host "Making API call..." -ForegroundColor Green
    $response = Invoke-RestMethod -Uri $apiUrl -Method GET -TimeoutSec 10
    
    Write-Host "✅ API Response received successfully" -ForegroundColor Green
    Write-Host "Response type: $($response.GetType().Name)" -ForegroundColor Gray
    Write-Host "Response count: $($response.Count)" -ForegroundColor Gray
    Write-Host ""
    
    if ($response.Count -gt 0) {
        Write-Host "📄 Found $($response.Count) reports:" -ForegroundColor Cyan
        foreach ($report in $response) {
            Write-Host "  - $($report.filename)" -ForegroundColor White
            Write-Host "    Type: $($report.reportType)" -ForegroundColor Gray
            Write-Host "    Size: $($report.formattedSize)" -ForegroundColor Gray
            Write-Host "    Created: $($report.createdAt)" -ForegroundColor Gray
            Write-Host ""
        }
    } else {
        Write-Host "⚠️  No reports found in API response" -ForegroundColor Yellow
        Write-Host "This suggests the workflow lookup or file matching isn't working" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ API call failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Expected Files ===" -ForegroundColor Cyan
Write-Host "Based on directory listing, these files should be found:" -ForegroundColor Gray
Write-Host "- service-report-SWF-66887063-draft-2025-06-25T16-24-34-610Z.pdf" -ForegroundColor White
Write-Host "- service-report-SWF-66887063-draft-2025-06-25T16-28-45-015Z.pdf" -ForegroundColor White
Write-Host "- service-report-SWF-66887063-draft-2025-06-25T16-32-20-434Z.pdf" -ForegroundColor White
Write-Host "- service-report-SWF-66887063-draft-2025-06-25T16-41-32-425Z.pdf" -ForegroundColor White
Write-Host "- service-report-SWF-66887063-draft-2025-06-25T16-41-47-153Z.pdf" -ForegroundColor White
Write-Host "" 