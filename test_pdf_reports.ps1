Write-Host "Testing PDF Reports System" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green

$baseUrl = "http://localhost:3001"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0Njg5ZjMxMS04NmEyLTQ2MTktODQ3Mi01MmM4OGY5MjExMGMiLCJlbWFpbCI6ImphbmUuc21pdGhAZXhhbXBsZS5jb20iLCJ1c2VyVHlwZSI6ImFkbWluIiwicm9sZUlkIjoiYWRtaW4tMjAyNSIsInBlcm1pc3Npb25zIjpbInVzZXJzLmNyZWF0ZSIsInVzZXJzLnJlYWQiLCJ1c2Vycy51cGRhdGUiLCJ1c2Vycy5kZWxldGUiLCJ0aWNrZXRzLmNyZWF0ZSIsInRpY2tldHMucmVhZCIsInRpY2tldHMudXBkYXRlIiwidGlja2V0cy5kZWxldGUiLCJjdXN0b21lcnMuY3JlYXRlIiwiY3VzdG9tZXJzLnJlYWQiLCJjdXN0b21lcnMudXBkYXRlIiwiY3VzdG9tZXJzLmRlbGV0ZSIsImNvbXBhbmllcy5jcmVhdGUiLCJjb21wYW5pZXMucmVhZCIsImNvbXBhbmllcy51cGRhdGUiLCJjb21wYW5pZXMuZGVsZXRlIiwiZGV2aWNlcy5jcmVhdGUiLCJkZXZpY2VzLnJlYWQiLCJkZXZpY2VzLnVwZGF0ZSIsImRldmljZXMuZGVsZXRlIiwicmVwb3J0cy5yZWFkIiwiaW5zaWdodHMucmVhZCIsInN5c3RlbS5hdWRpdCIsInN5c3RlbS5hZG1pbiIsInN5c3RlbS5haV9zZXR0aW5ncyJdLCJmaXJzdE5hbWUiOiJKYW5lIiwibGFzdE5hbWUiOiJTbWl0aCIsImlhdCI6MTczNTA2NjYxMiwiZXhwIjoxNzM1MjM5NDEyfQ.FJ5XPPCZCDgYIdtbQlCFqplhRdyv8P0jXXD5jjE4VJk"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    Write-Host "1. Checking tickets for service workflows..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$baseUrl/api/tickets" -Method GET -Headers $headers
    $tickets = $response.data.tickets
    Write-Host "Found $($tickets.Count) tickets" -ForegroundColor Cyan

    Write-Host "2. Looking for ticket 2506190003..." -ForegroundColor Yellow
    $ticket = $tickets | Where-Object { $_.ticketNumber -eq "2506190003" }
    if ($ticket) {
        Write-Host "Found ticket 2506190003: $($ticket.title)" -ForegroundColor Green
        
        Write-Host "3. Checking for service workflows on this ticket..." -ForegroundColor Yellow
        $workflowUrl = "$baseUrl/api/tickets/$($ticket.id)/service-workflows"
        Write-Host "Making request to: $workflowUrl" -ForegroundColor Cyan
        
        try {
            $workflows = Invoke-RestMethod -Uri $workflowUrl -Method GET -Headers $headers
            Write-Host "Found $($workflows.Count) workflows" -ForegroundColor Green
            
            if ($workflows.Count -gt 0) {
                $workflow = $workflows[0]
                Write-Host "  - Workflow ID: $($workflow.workflowId)" -ForegroundColor Cyan
                Write-Host "  - Workflow Number: $($workflow.workflowNumber)" -ForegroundColor Cyan
                Write-Host "  - Status: $($workflow.status)" -ForegroundColor Cyan
                
                Write-Host "4. Checking PDF reports for this workflow..." -ForegroundColor Yellow
                $reportsUrl = "$baseUrl/api/service-workflows/$($workflow.workflowId)/pdf-reports"
                Write-Host "Making request to: $reportsUrl" -ForegroundColor Cyan
                
                try {
                    $reports = Invoke-RestMethod -Uri $reportsUrl -Method GET -Headers $headers
                    Write-Host "API returned $($reports.Count) reports" -ForegroundColor Green
                    
                    foreach ($report in $reports) {
                        Write-Host "  Report: $($report.filename)" -ForegroundColor White
                        Write-Host "     Type: $($report.reportType)" -ForegroundColor Gray
                        Write-Host "     Created: $($report.createdAt)" -ForegroundColor Gray
                        Write-Host "     Size: $($report.size) bytes" -ForegroundColor Gray
                    }
                    
                    Write-Host "5. Checking actual files in backend/reports folder..." -ForegroundColor Yellow
                    $reportsDir = ".\backend\reports"
                    if (Test-Path $reportsDir) {
                        $files = Get-ChildItem $reportsDir -Filter "*.pdf"
                        Write-Host "Found $($files.Count) PDF files in reports directory" -ForegroundColor Green
                        
                        Write-Host "6. Looking for files matching workflow number $($workflow.workflowNumber)..." -ForegroundColor Yellow
                        $matchingFiles = $files | Where-Object { $_.Name -like "*$($workflow.workflowNumber)*" }
                        Write-Host "Found $($matchingFiles.Count) matching files:" -ForegroundColor Green
                        
                        foreach ($file in $matchingFiles) {
                            Write-Host "  File: $($file.Name)" -ForegroundColor White
                            Write-Host "     Size: $($file.Length) bytes" -ForegroundColor Gray
                            Write-Host "     Created: $($file.CreationTime)" -ForegroundColor Gray
                        }
                        
                        if ($matchingFiles.Count -gt 0 -and $reports.Count -eq 0) {
                            Write-Host "ISSUE DETECTED: Files exist but API returns no reports!" -ForegroundColor Red
                            Write-Host "This suggests the API logic might not be matching the workflow number correctly." -ForegroundColor Red
                        } elseif ($matchingFiles.Count -eq 0 -and $reports.Count -eq 0) {
                            Write-Host "No reports found - this is expected if none have been generated yet." -ForegroundColor Yellow
                        } else {
                            Write-Host "Everything looks correct - files match API response." -ForegroundColor Green
                        }
                        
                    } else {
                        Write-Host "Reports directory not found: $reportsDir" -ForegroundColor Red
                    }
                    
                } catch {
                    Write-Host "Error getting PDF reports: $($_.Exception.Message)" -ForegroundColor Red
                    if ($_.Exception.Response) {
                        $statusCode = $_.Exception.Response.StatusCode.value__
                        Write-Host "Status Code: $statusCode" -ForegroundColor Red
                    }
                }
            } else {
                Write-Host "No workflows found for this ticket" -ForegroundColor Red
            }
            
        } catch {
            Write-Host "Error getting workflows: $($_.Exception.Message)" -ForegroundColor Red
            if ($_.Exception.Response) {
                $statusCode = $_.Exception.Response.StatusCode.value__
                Write-Host "Status Code: $statusCode" -ForegroundColor Red
            }
        }
        
    } else {
        Write-Host "Ticket 2506190003 not found" -ForegroundColor Red
        Write-Host "Available tickets:" -ForegroundColor Yellow
        $tickets | Select-Object -First 5 | ForEach-Object {
            Write-Host "  - $($_.ticketNumber): $($_.title)" -ForegroundColor Gray
        }
    }

} catch {
    Write-Host "Error during test: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
    }
}

Write-Host "Test completed." -ForegroundColor Gray 