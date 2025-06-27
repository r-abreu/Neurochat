Write-Host "Debug Reports Issue" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green

$baseUrl = "http://localhost:3001"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0Njg5ZjMxMS04NmEyLTQ2MTktODQ3Mi01MmM4OGY5MjExMGMiLCJlbWFpbCI6ImphbmUuc21pdGhAZXhhbXBsZS5jb20iLCJ1c2VyVHlwZSI6ImFkbWluIiwicm9sZUlkIjoiYWRtaW4tMjAyNSIsImZpcnN0TmFtZSI6IkphbmUiLCJsYXN0TmFtZSI6IlNtaXRoIiwiaWF0IjoxNzM1MDY2NjEyLCJleHAiOjE3MzUyMzk0MTJ9.FJ5XPPCZCDgYIdtbQlCFqplhRdyv8P0jXXD5jjE4VJk"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "1. Checking backend connection..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method GET -Headers $headers
    Write-Host "   Backend is responding!" -ForegroundColor Green
    Write-Host "   Found $($healthCheck.data.tickets.Count) tickets" -ForegroundColor Cyan
} catch {
    Write-Host "   Backend connection failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "2. Looking for ticket 2506190003..." -ForegroundColor Yellow
$ticket = $healthCheck.data.tickets | Where-Object { $_.ticketNumber -eq "2506190003" }
if (-not $ticket) {
    Write-Host "   Ticket 2506190003 not found. Available tickets:" -ForegroundColor Red
    $healthCheck.data.tickets | Select-Object -First 5 | ForEach-Object {
        Write-Host "   - $($_.ticketNumber): $($_.title)" -ForegroundColor Gray
    }
    exit 1
}

Write-Host "   Found ticket: $($ticket.title)" -ForegroundColor Green
Write-Host "   Ticket ID: $($ticket.id)" -ForegroundColor Cyan

Write-Host "3. Checking for service workflows..." -ForegroundColor Yellow
try {
    $workflows = Invoke-RestMethod -Uri "$baseUrl/api/tickets/$($ticket.id)/service-workflows" -Method GET -Headers $headers
    Write-Host "   Found $($workflows.Count) workflows" -ForegroundColor Green
    
    if ($workflows.Count -eq 0) {
        Write-Host "   No workflows found. This is the issue!" -ForegroundColor Red
        Write-Host "   Need to create a workflow first before reports can be generated." -ForegroundColor Yellow
        exit 1
    }
    
    $workflow = $workflows[0]
    Write-Host "   Workflow ID: $($workflow.workflowId)" -ForegroundColor Cyan
    Write-Host "   Workflow Number: $($workflow.workflowNumber)" -ForegroundColor Cyan
    
} catch {
    Write-Host "   Error getting workflows: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "4. Checking PDF reports via API..." -ForegroundColor Yellow
try {
    $reports = Invoke-RestMethod -Uri "$baseUrl/api/service-workflows/$($workflow.workflowId)/pdf-reports" -Method GET -Headers $headers
    Write-Host "   API returned $($reports.Count) reports" -ForegroundColor Green
    
    if ($reports.Count -eq 0) {
        Write-Host "   No reports returned by API" -ForegroundColor Yellow
    } else {
        foreach ($report in $reports) {
            Write-Host "   - $($report.filename)" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "   Error getting reports: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "5. Checking physical files..." -ForegroundColor Yellow
$reportsDir = ".\backend\reports"
if (Test-Path $reportsDir) {
    $files = Get-ChildItem $reportsDir -Filter "*.pdf"
    Write-Host "   Found $($files.Count) PDF files in directory" -ForegroundColor Green
    
    $matchingFiles = $files | Where-Object { $_.Name -like "*$($workflow.workflowNumber)*" }
    Write-Host "   Found $($matchingFiles.Count) files matching workflow number" -ForegroundColor Green
    
    if ($matchingFiles.Count -gt 0) {
        Write-Host "   Matching files:" -ForegroundColor White
        foreach ($file in $matchingFiles) {
            Write-Host "   - $($file.Name)" -ForegroundColor Gray
        }
    }
    
    if ($matchingFiles.Count -gt 0 -and $reports.Count -eq 0) {
        Write-Host "   ISSUE: Files exist but API doesn't find them!" -ForegroundColor Red
        Write-Host "   This suggests a problem with the getWorkflowReports function" -ForegroundColor Red
    }
    
} else {
    Write-Host "   Reports directory not found!" -ForegroundColor Red
}

Write-Host "Debug completed." -ForegroundColor Gray 