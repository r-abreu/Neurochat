# Test Service Workflow API Endpoint
$baseUrl = "http://localhost:3001/api"
$ticketId = "8f568487-8f20-4c51-b85a-c6e8fc880cfb"

Write-Host "Testing Service Workflow API..." -ForegroundColor Yellow

# First, let's test if the server is running
try {
    Write-Host "1. Testing if server is running..." -ForegroundColor Cyan
    $healthCheck = Invoke-WebRequest -Uri "$baseUrl/tickets" -Method GET -UseBasicParsing
    Write-Host "✓ Server is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Server appears to be down or not responding" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test the specific service workflow endpoint (without auth first)
try {
    Write-Host "2. Testing service workflow endpoint..." -ForegroundColor Cyan
    $body = @{
        deviceSerialNumber = "TEMP-001"
        initiatedBy = "test-user"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$baseUrl/tickets/$ticketId/service-workflows" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    Write-Host "✓ Service workflow endpoint is working" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Service workflow endpoint failed" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get more details
    if ($_.Exception.Response) {
        $responseBody = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseBody)
        $responseText = $reader.ReadToEnd()
        Write-Host "Response Body: $responseText" -ForegroundColor Yellow
    }
} 