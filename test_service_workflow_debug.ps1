# Debug Service Workflow Creation
$baseUrl = "http://localhost:3001/api"
$ticketId = "aff4924d-6658-47be-b723-d52a56e08330"

Write-Host "Testing Authenticated Service Workflow Creation..." -ForegroundColor Yellow

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
    Write-Host "Token: $($token.Substring(0,20))..." -ForegroundColor Gray
} catch {
    Write-Host "✗ Login failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Now test the service workflow creation with proper auth
try {
    Write-Host "2. Creating service workflow with authentication..." -ForegroundColor Cyan
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $workflowBody = @{
        deviceSerialNumber = "TEST-001"
        initiatedBy = $userId
    } | ConvertTo-Json
    
    Write-Host "Request URL: $baseUrl/tickets/$ticketId/service-workflows" -ForegroundColor Gray
    Write-Host "Request Body: $workflowBody" -ForegroundColor Gray
    
    $response = Invoke-WebRequest -Uri "$baseUrl/tickets/$ticketId/service-workflows" -Method POST -Body $workflowBody -Headers $headers -UseBasicParsing
    Write-Host "✓ Service workflow created successfully" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Service workflow creation failed" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get detailed error response
    if ($_.Exception.Response) {
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorDetails = $reader.ReadToEnd()
            Write-Host "Detailed Error Response: $errorDetails" -ForegroundColor Yellow
        } catch {
            Write-Host "Could not read error details" -ForegroundColor Gray
        }
    }
} 