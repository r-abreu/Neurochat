# Fix script for ticket 2506190003 device/company association issue
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

# Get ticket 2506190003
Write-Host "`nGetting ticket 2506190003..." -ForegroundColor Cyan
$ticketsResponse = Invoke-RestMethod -Uri "$baseUrl/tickets" -Method GET -Headers $headers
$targetTicket = $ticketsResponse.data.tickets | Where-Object { $_.ticketNumber -eq "2506190003" }

if (-not $targetTicket) {
    Write-Host "Ticket 2506190003 not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Found ticket 2506190003" -ForegroundColor Green
Write-Host "  - Device Model: $($targetTicket.deviceModel)"
Write-Host "  - Device Serial: $($targetTicket.deviceSerialNumber)"
Write-Host "  - Customer Company: $($targetTicket.customerCompany)"

# Get companies to find the matching company
Write-Host "`nFinding company '$($targetTicket.customerCompany)'..." -ForegroundColor Cyan
$companiesResponse = Invoke-RestMethod -Uri "$baseUrl/companies" -Method GET -Headers $headers
$companies = $companiesResponse.data.companies

$targetCompany = $companies | Where-Object { 
    $_.name -eq $targetTicket.customerCompany -or 
    $_.aliases -contains $targetTicket.customerCompany
}

if (-not $targetCompany) {
    Write-Host "Company '$($targetTicket.customerCompany)' not found. Creating it..." -ForegroundColor Yellow
    
    # Create the company
    $companyData = @{
        name = $targetTicket.customerCompany
        description = "Auto-created company for ticket $($targetTicket.ticketNumber)"
        country = $targetTicket.customerCountry
        city = $targetTicket.customerCity
        state = $targetTicket.customerState
        zipCode = $targetTicket.customerZipCode
        address = $targetTicket.customerStreetAddress
    }
    
    try {
        $createCompanyResponse = Invoke-RestMethod -Uri "$baseUrl/companies" -Method POST -Body ($companyData | ConvertTo-Json) -Headers $headers
        $targetCompany = $createCompanyResponse.data.company
        Write-Host "Created company: $($targetCompany.name) (ID: $($targetCompany.id))" -ForegroundColor Green
    } catch {
        Write-Host "Error creating company: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Found company: $($targetCompany.name) (ID: $($targetCompany.id))" -ForegroundColor Green
}

# Check if device already exists
Write-Host "`nChecking if device exists..." -ForegroundColor Cyan
$devicesResponse = Invoke-RestMethod -Uri "$baseUrl/devices" -Method GET -Headers $headers
$existingDevice = $devicesResponse.data.devices | Where-Object { $_.serialNumber -eq $targetTicket.deviceSerialNumber }

if ($existingDevice) {
    Write-Host "Device already exists: $($existingDevice.serialNumber)" -ForegroundColor Yellow
    Write-Host "  - Current Company ID: $($existingDevice.companyId)"
    Write-Host "  - Target Company ID: $($targetCompany.id)"
    
    if ($existingDevice.companyId -ne $targetCompany.id) {
        Write-Host "  - Device company association needs to be updated!" -ForegroundColor Yellow
        
        # Update the device to associate with the correct company
        $updateDeviceData = @{
            companyId = $targetCompany.id
        }
        
        try {
            $updateResponse = Invoke-RestMethod -Uri "$baseUrl/devices/$($existingDevice.id)" -Method PUT -Body ($updateDeviceData | ConvertTo-Json) -Headers $headers
            Write-Host "Updated device company association!" -ForegroundColor Green
        } catch {
            Write-Host "Error updating device: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "  - Device is already correctly associated!" -ForegroundColor Green
    }
} else {
    Write-Host "Device does not exist. Creating it..." -ForegroundColor Yellow
    
    # Create the device
    $deviceData = @{
        customerId = $targetTicket.customerId
        model = $targetTicket.deviceModel
        serialNumber = $targetTicket.deviceSerialNumber
        comments = "Auto-created from ticket $($targetTicket.ticketNumber)"
    }
    
    try {
        $createDeviceResponse = Invoke-RestMethod -Uri "$baseUrl/devices" -Method POST -Body ($deviceData | ConvertTo-Json) -Headers $headers
        $newDevice = $createDeviceResponse.data.device
        Write-Host "Created device: $($newDevice.serialNumber) (ID: $($newDevice.id))" -ForegroundColor Green
        Write-Host "  - Associated with company: $($newDevice.companyName)" -ForegroundColor Green
    } catch {
        Write-Host "Error creating device: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
    }
}

# Update the ticket to have the correct company association
Write-Host "`nUpdating ticket company association..." -ForegroundColor Cyan
if ($targetTicket.companyId -ne $targetCompany.id) {
    try {
        # Use the internal company confirmation endpoint
        $confirmData = @{
            companyId = $targetCompany.id
        }
        
        $confirmResponse = Invoke-RestMethod -Uri "$baseUrl/tickets/$($targetTicket.id)/confirm-company-match" -Method POST -Body ($confirmData | ConvertTo-Json) -Headers $headers
        Write-Host "Updated ticket company association!" -ForegroundColor Green
    } catch {
        Write-Host "Error updating ticket company: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Ticket is already associated with the correct company!" -ForegroundColor Green
}

# Verify the fix
Write-Host "`nVerifying the fix..." -ForegroundColor Cyan
try {
    $companyDetailResponse = Invoke-RestMethod -Uri "$baseUrl/companies/$($targetCompany.id)" -Method GET -Headers $headers
    $companyDetail = $companyDetailResponse.data.company
    
    Write-Host "Company '$($companyDetail.name)' now has:"
    Write-Host "  - Total Devices: $($companyDetail.deviceCount)"
    Write-Host "  - Device List:"
    foreach ($device in $companyDetail.devices) {
        Write-Host "    • $($device.serialNumber) ($($device.model)) - Customer: $($device.customerName)"
        if ($device.serialNumber -eq $targetTicket.deviceSerialNumber) {
            Write-Host "      ✅ THIS IS THE TICKET'S DEVICE!" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "Error verifying fix: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Fix completed!" -ForegroundColor Green
Write-Host "The device should now appear in the company's device tab." -ForegroundColor Green 