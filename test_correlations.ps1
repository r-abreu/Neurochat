#!/usr/bin/env pwsh

# Test script to verify correlations between Companies, Customers, Devices, and Tickets
Write-Host "🔍 Testing Entity Correlations - Companies, Customers, Devices, Tickets" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001/api"
$headers = @{ "Content-Type" = "application/json" }

# Login
$loginData = @{ email = "admin@demo.com"; password = "demo123" } | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -Headers $headers
$headers["Authorization"] = "Bearer $($loginResponse.data.tokens.accessToken)"

Write-Host "✅ Login successful!" -ForegroundColor Green

# Test 1: Company Relationships
Write-Host "`n📊 Test 1: Company Relationships" -ForegroundColor Cyan
$companiesResponse = Invoke-RestMethod -Uri "$baseUrl/companies" -Method GET -Headers $headers
$companies = $companiesResponse.data.companies

foreach ($company in $companies) {
    Write-Host "🏢 $($company.name)" -ForegroundColor White
    Write-Host "  Customers: $($company.customerCount) | Tickets: $($company.ticketCount) | Devices: $($company.deviceCount)" -ForegroundColor Gray
    
    if ($company.customerCount -gt 0 -and $company.deviceCount -gt 0) {
        Write-Host "  ✅ Has both customers and devices!" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Missing customers or devices" -ForegroundColor Yellow
    }
}

# Test 2: Device-Company Associations  
Write-Host "`n🔧 Test 2: Device-Company Associations" -ForegroundColor Cyan
$devicesResponse = Invoke-RestMethod -Uri "$baseUrl/devices" -Method GET -Headers $headers
$devices = $devicesResponse.data.devices

foreach ($device in $devices) {
    $companyStatus = if ($device.companyId) { "✅ $($device.companyName)" } else { "❌ No Company" }
    Write-Host "🔧 $($device.serialNumber) - Company: $companyStatus" -ForegroundColor White
}

# Summary
$devicesWithCompanies = $devices | Where-Object { $_.companyId }
Write-Host "`n📊 SUMMARY" -ForegroundColor Cyan
Write-Host "Devices with companies: $($devicesWithCompanies.Count)/$($devices.Count)" -ForegroundColor Green

if ($devicesWithCompanies.Count -gt 0) {
    Write-Host "🎉 SUCCESS: Company-Device relationships are working!" -ForegroundColor Green
} else {
    Write-Host "❌ ISSUE: No devices are linked to companies" -ForegroundColor Red
} 