# Test Service Workflow Creation - Fixed Version
$baseUrl = "http://localhost:3001/api"

Write-Host "Testing Service Workflow Creation (Fixed)..." -ForegroundColor Yellow

# First login to get a token
try {
    Write-Host "1. Logging in to get auth token..." -ForegroundColor Cyan
    $loginBody = @{
        email = "admin@demo.com"
        password = "admin123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.data.tokens.accessToken
    $userId = $loginData.data.user.id
    
    Write-Host "✓ Login successful" -ForegroundColor Green
    Write-Host "User ID: $userId" -ForegroundColor Gray
} catch {
    Write-Host "✗ Login failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Get a list of tickets to test with
try {
    Write-Host "2. Getting tickets list..." -ForegroundColor Cyan
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $ticketsResponse = Invoke-WebRequest -Uri "$baseUrl/tickets" -Method GET -Headers $headers -UseBasicParsing
    $tickets = ($ticketsResponse.Content | ConvertFrom-Json)
    
    # Find a ticket with a device serial number
    $testTicket = $tickets | Where-Object { $_.deviceSerialNumber -ne $null -and $_.deviceSerialNumber -ne "" } | Select-Object -First 1
    
    if (!$testTicket) {
        Write-Host "✗ No tickets with device serial numbers found" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Found test ticket: $($testTicket.ticketNumber)" -ForegroundColor Green
    Write-Host "Device Serial: $($testTicket.deviceSerialNumber)" -ForegroundColor Gray
    
    $ticketId = $testTicket.id
    
} catch {
    Write-Host "✗ Failed to get tickets" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test creating a service workflow
try {
    Write-Host "3. Creating service workflow..." -ForegroundColor Cyan
    
    $workflowBody = @{
        deviceSerialNumber = $testTicket.deviceSerialNumber
    } | ConvertTo-Json
    
    Write-Host "Request URL: $baseUrl/tickets/$ticketId/service-workflows" -ForegroundColor Gray
    Write-Host "Request Body: $workflowBody" -ForegroundColor Gray
    
    $response = Invoke-WebRequest -Uri "$baseUrl/tickets/$ticketId/service-workflows" -Method POST -Body $workflowBody -Headers $headers -UseBasicParsing
    $responseData = $response.Content | ConvertFrom-Json
    
    Write-Host "✓ Service workflow API call successful" -ForegroundColor Green
    Write-Host "Response Status: $($response.StatusCode)" -ForegroundColor Gray
    
    if ($responseData.success -eq $true) {
        Write-Host "✓ Workflow operation successful" -ForegroundColor Green
        if ($responseData.message) {
            Write-Host "Message: $($responseData.message)" -ForegroundColor Cyan
        }
        if ($responseData.workflow) {
            Write-Host "Workflow ID: $($responseData.workflow.workflowId)" -ForegroundColor Gray
            Write-Host "Workflow Number: $($responseData.workflow.workflowNumber)" -ForegroundColor Gray
            Write-Host "Current Step: $($responseData.workflow.currentStep)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️ Unexpected response format" -ForegroundColor Yellow
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "✗ Service workflow creation failed" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get more details
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

# Test getting service workflows for the ticket
try {
    Write-Host "4. Getting service workflows for ticket..." -ForegroundColor Cyan
    
    $response = Invoke-WebRequest -Uri "$baseUrl/tickets/$ticketId/service-workflows" -Method GET -Headers $headers -UseBasicParsing
    $workflows = $response.Content | ConvertFrom-Json
    
    Write-Host "✓ Successfully retrieved workflows" -ForegroundColor Green
    Write-Host "Workflows found: $($workflows.Length)" -ForegroundColor Gray
    
    if ($workflows.Length -gt 0) {
        foreach ($workflow in $workflows) {
            Write-Host "- Workflow: $($workflow.workflowNumber) (Status: $($workflow.status))" -ForegroundColor Gray
        }
    }
    
} catch {
    Write-Host "✗ Failed to get service workflows" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest completed!" -ForegroundColor Yellow