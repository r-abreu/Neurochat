# Quick test to check existing workflows
$ticketId = "ec4592c4-131e-4fdc-95ed-de842670e342"
$baseUrl = "http://localhost:3001/api"

# Login first
$loginBody = @{
    email = "admin@demo.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.data.tokens.accessToken
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    Write-Host "1. Checking existing workflows..." -ForegroundColor Cyan
    $workflowsResponse = Invoke-WebRequest -Uri "$baseUrl/tickets/$ticketId/service-workflows" -Method GET -Headers $headers -UseBasicParsing
    $workflows = $workflowsResponse.Content | ConvertFrom-Json
    
    Write-Host "Found $($workflows.Length) workflows" -ForegroundColor Green
    
    if ($workflows.Length -gt 0) {
        foreach ($workflow in $workflows) {
            Write-Host "- Workflow ID: $($workflow.workflowId)" -ForegroundColor Gray
            Write-Host "- Status: $($workflow.status)" -ForegroundColor Gray
        }
    }
    
    Write-Host "2. Attempting to create workflow..." -ForegroundColor Cyan
    $createBody = @{
        deviceSerialNumber = "MXX-2024-012345"
    } | ConvertTo-Json
    
    $createResponse = Invoke-WebRequest -Uri "$baseUrl/tickets/$ticketId/service-workflows" -Method POST -Body $createBody -Headers $headers -UseBasicParsing
    $createData = $createResponse.Content | ConvertFrom-Json
    
    Write-Host "Create request successful" -ForegroundColor Green
    Write-Host "Response: $($createResponse.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "Error occurred" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $responseBody = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($responseBody)
            $responseText = $reader.ReadToEnd()
            Write-Host "Response Body: $responseText" -ForegroundColor Yellow
        } catch {
            Write-Host "Could not read error response" -ForegroundColor Yellow
        }
    }
} 