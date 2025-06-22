# Debug script for ticket 2506190003 device/company association issue
$baseUrl = "http://localhost:3001/api"

# Login as admin
Write-Host "Logging in as admin..." -ForegroundColor Cyan
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body (@{
    email = "admin@demo.com"
    password = "demo123"
} | ConvertTo-Json) -ContentType "application/json"

$token = $loginResponse.data.tokens.accessToken
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Login successful" -ForegroundColor Green

# Get all tickets and find 2506190003
Write-Host "`nFinding ticket 2506190003..." -ForegroundColor Cyan
$ticketsResponse = Invoke-RestMethod -Uri "$baseUrl/tickets" -Method GET -Headers $headers
$targetTicket = $ticketsResponse.data.tickets | Where-Object { $_.ticketNumber -eq "2506190003" }

if ($targetTicket) {
    Write-Host "Found ticket 2506190003!" -ForegroundColor Green
    Write-Host "  - Title: $($targetTicket.title)"
    Write-Host "  - Customer: $($targetTicket.customerName)"
    Write-Host "  - Customer Email: $($targetTicket.customerEmail)"
    Write-Host "  - Customer Company: $($targetTicket.customerCompany)"
    Write-Host "  - Company ID: $($targetTicket.companyId)"
    Write-Host "  - Device Model: $($targetTicket.deviceModel)"
    Write-Host "  - Device Serial: $($targetTicket.deviceSerialNumber)"
    Write-Host "  - Customer ID: $($targetTicket.customerId)"
} else {
    Write-Host "Ticket 2506190003 not found!" -ForegroundColor Red
    exit 1
}

# Get all companies
Write-Host "`nGetting companies..." -ForegroundColor Cyan
$companiesResponse = Invoke-RestMethod -Uri "$baseUrl/companies" -Method GET -Headers $headers
$companies = $companiesResponse.data.companies

Write-Host "Companies found: $($companies.Count)"
$ticketCompany = $null
foreach ($company in $companies) {
    Write-Host "  - $($company.name) (ID: $($company.id)): $($company.customerCount) customers, $($company.deviceCount) devices"
    
    # Check if this company matches the ticket's company
    if ($company.name -eq $targetTicket.customerCompany -or $company.id -eq $targetTicket.companyId) {
        Write-Host "    THIS IS THE TICKET'S COMPANY!" -ForegroundColor Green
        $ticketCompany = $company
    }
}

# Get all devices  
Write-Host "`nGetting devices..." -ForegroundColor Cyan
$devicesResponse = Invoke-RestMethod -Uri "$baseUrl/devices" -Method GET -Headers $headers
$devices = $devicesResponse.data.devices

Write-Host "Devices found: $($devices.Count)"
$targetDevice = $null
foreach ($device in $devices) {
    Write-Host "  - $($device.serialNumber) ($($device.model)): CompanyId = '$($device.companyId)', CompanyName = '$($device.companyName)'"
    
    # Check if this is the ticket's device
    if ($device.serialNumber -eq $targetTicket.deviceSerialNumber) {
        Write-Host "    THIS IS THE TICKET'S DEVICE!" -ForegroundColor Green
        $targetDevice = $device
    }
}

# Check if the target device exists and its company association
if ($targetDevice) {
    Write-Host "`nANALYSIS OF TARGET DEVICE:" -ForegroundColor Yellow
    Write-Host "  - Device Serial: $($targetDevice.serialNumber)"
    Write-Host "  - Device Model: $($targetDevice.model)"
    Write-Host "  - Device Company ID: $($targetDevice.companyId)"
    Write-Host "  - Device Company Name: $($targetDevice.companyName)"
    Write-Host "  - Device Customer ID: $($targetDevice.customerId)"
    Write-Host "  - Device Customer Name: $($targetDevice.customerName)"
    
    if ($ticketCompany) {
        Write-Host "`nANALYSIS OF TARGET COMPANY:" -ForegroundColor Yellow
        Write-Host "  - Company Name: $($ticketCompany.name)"
        Write-Host "  - Company ID: $($ticketCompany.id)"
        Write-Host "  - Company Device Count: $($ticketCompany.deviceCount)"
        
        # Check if device's companyId matches the ticket's company
        if ($targetDevice.companyId -eq $ticketCompany.id) {
            Write-Host "Device is correctly associated with the company!" -ForegroundColor Green
        } else {
            Write-Host "PROBLEM FOUND: Device companyId ($($targetDevice.companyId)) does not match ticket company ID ($($ticketCompany.id))" -ForegroundColor Red
            
            # Check if we need to fix the association
            Write-Host "`nPROPOSED FIX:" -ForegroundColor Magenta
            Write-Host "  - Update device companyId from '$($targetDevice.companyId)' to '$($ticketCompany.id)'"
            Write-Host "  - Device should appear in company '$($ticketCompany.name)' device tab"
        }
    }
} else {
    Write-Host "Device with serial '$($targetTicket.deviceSerialNumber)' not found!" -ForegroundColor Red
    Write-Host "The device should be auto-created when the ticket was created" -ForegroundColor Magenta
}

# Get specific company details to see what devices are shown
if ($ticketCompany) {
    Write-Host "`nGetting detailed company information..." -ForegroundColor Cyan
    try {
        $companyDetailResponse = Invoke-RestMethod -Uri "$baseUrl/companies/$($ticketCompany.id)" -Method GET -Headers $headers
        $companyDetail = $companyDetailResponse.data.company
        
        Write-Host "Company '$($companyDetail.name)' Details:"
        Write-Host "  - Total Devices: $($companyDetail.deviceCount)"
        Write-Host "  - Device List:"
        foreach ($device in $companyDetail.devices) {
            Write-Host "    • $($device.serialNumber) ($($device.model)) - Customer: $($device.customerName)"
        }
        
        # Check if our target device is in the list
        $deviceInCompany = $companyDetail.devices | Where-Object { $_.serialNumber -eq $targetTicket.deviceSerialNumber }
        if ($deviceInCompany) {
            Write-Host "Target device IS in the company's device list!" -ForegroundColor Green
        } else {
            Write-Host "Target device is NOT in the company's device list!" -ForegroundColor Red
        }
    } catch {
        Write-Host "Error getting company details: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nDebug completed!" -ForegroundColor Cyan 