# Debug company details
$baseUrl = "http://localhost:3001/api"
$headers = @{ "Content-Type" = "application/json" }

# Login
$loginData = @{ email = "admin@demo.com"; password = "demo123" } | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -Headers $headers
$headers["Authorization"] = "Bearer $($loginResponse.data.tokens.accessToken)"

# Get Acme Corporation details
$companiesResponse = Invoke-RestMethod -Uri "$baseUrl/companies" -Method GET -Headers $headers
$acme = $companiesResponse.data.companies | Where-Object { $_.name -eq "Acme Corporation" }

if ($acme) {
    Write-Host "Found Acme Corporation: $($acme.id)" -ForegroundColor Green
    
    # Get detailed company info
    $acmeDetailsResponse = Invoke-RestMethod -Uri "$baseUrl/companies/$($acme.id)" -Method GET -Headers $headers
    $acmeDetails = $acmeDetailsResponse.data.company
    
    Write-Host "Acme Details:" -ForegroundColor Cyan
    Write-Host "- Customer Count: $($acmeDetails.customerCount)" -ForegroundColor White
    Write-Host "- Device Count: $($acmeDetails.deviceCount)" -ForegroundColor White
    Write-Host "- Ticket Count: $($acmeDetails.ticketCount)" -ForegroundColor White
    
    Write-Host "`nCustomers:" -ForegroundColor Cyan
    foreach ($customer in $acmeDetails.customers) {
        Write-Host "- $($customer.email) (ID: $($customer.id))" -ForegroundColor White
    }
    
    Write-Host "`nDevices:" -ForegroundColor Cyan
    foreach ($device in $acmeDetails.devices) {
        Write-Host "- $($device.serialNumber) (ID: $($device.id))" -ForegroundColor White
    }
    
    Write-Host "`nTickets:" -ForegroundColor Cyan
    foreach ($ticket in $acmeDetails.tickets) {
        Write-Host "- $($ticket.ticketNumber) - $($ticket.title)" -ForegroundColor White
    }
} else {
    Write-Host "Acme Corporation not found!" -ForegroundColor Red
} 