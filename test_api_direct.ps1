# DIRECT API TEST - Replace WORKFLOW_ID with the actual ID from the browser Network tab
Write-Host "Direct API Test for PDF Reports" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# You need to replace this with the actual workflow ID from the browser Network tab
$workflowId = "REPLACE_WITH_ACTUAL_WORKFLOW_ID"
$baseUrl = "http://localhost:3001"

Write-Host "INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "1. Open the service workflow in the browser" -ForegroundColor White
Write-Host "2. Open Developer Tools (F12) > Network tab" -ForegroundColor White
Write-Host "3. Click 'Reload' in the reports section" -ForegroundColor White
Write-Host "4. Find the API call that looks like:" -ForegroundColor White
Write-Host "   GET /api/service-workflows/{workflow-id}/pdf-reports" -ForegroundColor Cyan
Write-Host "5. Copy the workflow-id from that URL" -ForegroundColor White
Write-Host "6. Replace WORKFLOW_ID in this script with that ID" -ForegroundColor White
Write-Host "7. Run this script again" -ForegroundColor White

if ($workflowId -eq "REPLACE_WITH_ACTUAL_WORKFLOW_ID") {
    Write-Host "" -ForegroundColor White
    Write-Host "Please update the workflowId variable in this script first!" -ForegroundColor Red
    exit 1
}

# Test the API call
$headers = @{
    "Authorization" = "Bearer YOUR_JWT_TOKEN_HERE"
    "Content-Type" = "application/json"
}

Write-Host "Testing API call..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/service-workflows/$workflowId/pdf-reports" -Method GET -Headers $headers
    Write-Host "API Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "API Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "" -ForegroundColor White
Write-Host "COMMON ISSUES:" -ForegroundColor Yellow
Write-Host "- 401 Unauthorized: Need valid JWT token" -ForegroundColor White
Write-Host "- 404 Not Found: Workflow doesn't exist with that ID" -ForegroundColor White  
Write-Host "- Empty array []: No PDF files match the workflow number" -ForegroundColor White 