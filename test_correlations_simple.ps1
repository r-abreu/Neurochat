# Simple test for company relationships
$baseUrl = "http://localhost:3001/api"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "Testing company relationships..." -ForegroundColor Cyan

# Login
$loginData = @{ email = "admin@demo.com"; password = "demo123" } | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -Headers $headers
$headers["Authorization"] = "Bearer $($loginResponse.data.tokens.accessToken)"

# Get companies
$companiesResponse = Invoke-RestMethod -Uri "$baseUrl/companies" -Method GET -Headers $headers
$companies = $companiesResponse.data.companies

Write-Host "Companies found: $($companies.Count)"
foreach ($company in $companies) {
    Write-Host "- $($company.name): $($company.customerCount) customers, $($company.deviceCount) devices"
}

# Get customers
$customersResponse = Invoke-RestMethod -Uri "$baseUrl/customers" -Method GET -Headers $headers
$customers = $customersResponse.data.customers

Write-Host "`nCustomers found: $($customers.Count)"
foreach ($customer in $customers) {
    Write-Host "- $($customer.email): Company = '$($customer.company)', CompanyId = '$($customer.companyId)'"
}

# Get devices
$devicesResponse = Invoke-RestMethod -Uri "$baseUrl/devices" -Method GET -Headers $headers  
$devices = $devicesResponse.data.devices

Write-Host "`nDevices found: $($devices.Count)"
foreach ($device in $devices) {
    Write-Host "- $($device.serialNumber): CompanyId = '$($device.companyId)', CompanyName = '$($device.companyName)'"
} 