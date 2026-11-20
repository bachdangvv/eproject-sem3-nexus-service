# Seed rich, realistic demo data for Billing & Retail portals
$ErrorActionPreference = 'Stop'
$origin = 'http://127.0.0.1:5168'

function Call($client, [string]$path, [string]$method = 'GET', $body = $null, [int]$expected = 200) {
    $parameters = @{
        Uri = "$origin/api$path"
        Method = $method
        WebSession = $client.Cookies
        TimeoutSec = 15
        UseBasicParsing = $true
    }
    if ($method -ne 'GET' -and $client.Token) {
        $parameters.Headers = @{ 'X-CSRF-Token' = $client.Token }
    }
    if ($null -ne $body) {
        $parameters.ContentType = 'application/json; charset=utf-8'
        $parameters.Body = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $body -Compress))
    }
    $content = $null
    $statusCode = 0
    try {
        $result = Invoke-WebRequest @parameters
        $content = $result.Content
        $statusCode = [int]$result.StatusCode
    } catch [System.Net.WebException] {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            $statusCode = [int]$response.StatusCode
            $stream = $response.GetResponseStream()
            if ($null -ne $stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $content = $reader.ReadToEnd()
            }
        } else { throw }
    }
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    if ($statusCode -ne $expected) {
        throw "$method $path returned $statusCode, expected $expected. $content"
    }
    if ($content) {
        $parsed = ConvertFrom-Json -InputObject $content
        if ($null -ne $parsed -and $parsed.PSObject.Properties['value']) {
            return $parsed.value
        }
        return $parsed
    }
}

function SignIn([string]$role, [string]$username = "$($role.ToLowerInvariant()).demo", [string]$password = 'Nexus-Demo-2026!') {
    $client = @{ Cookies = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Token = $null }
    $client.Token = (Call $client '/session').csrfToken
    Call $client '/login' 'POST' @{username=$username;password=$password} 204
    $session = Call $client '/session'
    $client.Token = $session.csrfToken
    return $client
}

Write-Host "Connecting to Nexus API at $origin..."

# Step 1: Ensure Cities 102 & 103 exist (Admin)
$admin = SignIn 'Admin'
$cities = Call $admin '/cities'
$cityCodes = @($cities | ForEach-Object { $_.code })
if (-not ($cityCodes -contains '102')) {
    Write-Host "Creating City 102 (Ho Chi Minh City)..."
    Call $admin '/cities' 'POST' @{ code = '102'; name = 'Ho Chi Minh City' } 201 | Out-Null
}
if (-not ($cityCodes -contains '103')) {
    Write-Host "Creating City 103 (Da Nang)..."
    Call $admin '/cities' 'POST' @{ code = '103'; name = 'Da Nang' } 201 | Out-Null
}

# Step 2: Get Plans
$plans = Call $admin '/plans'
$bbPlan = $plans | Where-Object { $_.type -eq 'B' -and $_.active } | Select-Object -First 1
$dialUpPlan = $plans | Where-Object { $_.type -eq 'D' -and $_.active } | Select-Object -First 1
$landlinePlan = $plans | Where-Object { $_.type -eq 'T' -and $_.active } | Select-Object -First 1

# Step 3: Register Customers & Requests (Retail)
$retail = SignIn 'Retail'

$customersData = @(
    @{ name = "Nguyễn Văn An"; phone = "0901234501"; address = "12 Lê Lợi, P. Bến Nghé"; cityCode = "101"; customerType = "Individual"; email = "an.nguyen@example.com" },
    @{ name = "Công ty TNHH Công Nghệ Ánh Dương"; phone = "0901234502"; address = "45 Nguyễn Huệ, P. Bến Nghé"; cityCode = "101"; customerType = "Corporate"; taxId = "0109988771"; contactPerson = "Trần Bảo"; email = "contact@anhduong.vn" },
    @{ name = "Trần Thị Mai"; phone = "0901234503"; address = "88 Pasteur, P. 6, Q. 3"; cityCode = "102"; customerType = "Individual"; email = "mai.tran@example.com" },
    @{ name = "Tập đoàn Viễn Thông Sao Mai"; phone = "0901234504"; address = "209 Nam Kỳ Khởi Nghĩa, Q. 3"; cityCode = "102"; customerType = "Corporate"; taxId = "0308877662"; contactPerson = "Phạm Hùng"; email = "billing@saomai.com" },
    @{ name = "Lê Hoàng Long"; phone = "0901234505"; address = "15 Bạch Đằng, Q. Hải Châu"; cityCode = "103"; customerType = "Individual"; email = "long.le@example.com" },
    @{ name = "Phạm Thu Hà"; phone = "0901234506"; address = "77 Hai Bà Trưng, P. Bến Nghé"; cityCode = "101"; customerType = "Individual"; email = "ha.pham@example.com" }
)

$createdCustomers = @()
foreach ($c in $customersData) {
    # Check if phone already registered
    $existing = Call $retail "/customers?q=$($c.phone)"
    if ($existing -and $existing.Count -gt 0) {
        $createdCustomers += $existing[0]
    } else {
        Write-Host "Registering customer: $($c.name)..."
        $newCust = Call $retail '/customers' 'POST' $c 201
        $createdCustomers += $newCust
    }
}

# Create connection requests:
# Request 1: Cust 1 -> Broadband Basic (1 line)
# Request 2: Cust 2 -> Broadband Basic (15 lines, Bulk 50% tier)
# Request 3: Cust 3 -> Dial-Up 10h (1 line, hasNexusLandline = false)
# Request 4: Cust 4 -> Landline Monthly (25 lines, Bulk 75% tier)
# Request 5: Cust 5 -> Landline Monthly (1 line with calls)
# Request 6: Cust 6 -> Broadband Basic (1 line, NotBilled)

$requestsToCreate = @(
    @{ customer = $createdCustomers[0]; plan = $bbPlan; count = 1; landline = $false; tag = "Standard Broadband" },
    @{ customer = $createdCustomers[1]; plan = $bbPlan; count = 15; landline = $false; tag = "Bulk Corporate Broadband (15 lines)" },
    @{ customer = $createdCustomers[2]; plan = $dialUpPlan; count = 1; landline = $false; tag = "Dial-Up Internet" },
    @{ customer = $createdCustomers[3]; plan = $landlinePlan; count = 25; landline = $false; tag = "Bulk Corporate Landline (25 lines)" },
    @{ customer = $createdCustomers[4]; plan = $landlinePlan; count = 1; landline = $false; tag = "Landline with Call Minutes" },
    @{ customer = $createdCustomers[5]; plan = $bbPlan; count = 1; landline = $false; tag = "Broadband Initial Ready-to-Bill" }
)

$ordersToProcess = @()
foreach ($r in $requestsToCreate) {
    Write-Host "Creating request: $($r.tag) for $($r.customer.name)..."
    $req = Call $retail '/requests' 'POST' @{
        customerId = $r.customer.id
        planId = $r.plan.id
        connectionCount = $r.count
        hasNexusLandline = $r.landline
    } 201

    Write-Host "Confirming request #$($req.id) -> Order..."
    $ord = Call $retail "/requests/$($req.id)/confirm" 'POST' $null 201
    $ordersToProcess += @{ order = $ord; tag = $r.tag; index = $ordersToProcess.Count }
}

# Step 4: Feasibility & Activation (Technical)
$tech = SignIn 'Technical'
$connectedAccounts = @()

foreach ($item in $ordersToProcess) {
    $code = $item.order.code
    Write-Host "Technical assessment for $code ($($item.tag))..."
    Call $tech "/orders/$code/assessment" 'POST' @{
        distanceOk = $true
        serverAvailable = $true
        landlineFeasible = $true
        note = "Feasibility verified for $($item.tag)"
    } 200 | Out-Null

    Write-Host "Activating connection for $code..."
    $connected = Call $tech "/orders/$code/connection" 'POST' $null 201
    $connectedAccounts += @{
        accountId = $connected.accountId
        code = $code
        tag = $item.tag
        index = $item.index
    }
}

# Step 5: Billing & Invoicing (Billing & Retail)
$bill = SignIn 'Billing'

# Account 0: Cust 1 (Broadband 1 line) -> Invoiced Unpaid, then Retail collects partial payment $300.00
Write-Host "Generating bill for Account $($connectedAccounts[0].accountId)..."
$inv0 = Call $bill "/billing/accounts/$($connectedAccounts[0].accountId)" 'POST' $null 200
Write-Host "Recording partial retail payment on Account $($connectedAccounts[0].accountId)..."
Call $retail "/retail/billing/accounts/$($connectedAccounts[0].accountId)/payment" 'POST' @{
    amount = 300.0
    note = "Counter payment: Cash collected at Retail Outlet"
} 200 | Out-Null

# Account 1: Cust 2 (Broadband 15 lines, 50% bulk discount tier) -> Invoiced Unpaid
Write-Host "Generating bill for Bulk Corporate Account $($connectedAccounts[1].accountId) (15 lines)..."
Call $bill "/billing/accounts/$($connectedAccounts[1].accountId)" 'POST' $null 200 | Out-Null

# Account 2: Cust 3 (Dial-Up 1 line) -> Invoiced, then record full payment via City Office
Write-Host "Generating bill for Dial-Up Account $($connectedAccounts[2].accountId)..."
Call $bill "/billing/accounts/$($connectedAccounts[2].accountId)" 'POST' $null 200 | Out-Null
Write-Host "Recording full payment via City Office on Account $($connectedAccounts[2].accountId)..."
Call $bill "/billing/accounts/$($connectedAccounts[2].accountId)/payment" 'POST' @{
    note = "Settled via City Office Bank Transfer #CHQ-9821"
} 200 | Out-Null

# Account 3: Cust 4 (Landline 25 lines, 75% bulk discount tier) -> Invoiced, then record 2 installments
Write-Host "Generating bill for Bulk Landline Account $($connectedAccounts[3].accountId) (25 lines)..."
Call $bill "/billing/accounts/$($connectedAccounts[3].accountId)" 'POST' $null 200 | Out-Null
Write-Host "Recording installment 1 ($200.00) at Retail Outlet..."
Call $retail "/retail/billing/accounts/$($connectedAccounts[3].accountId)/payment" 'POST' @{
    amount = 200.0
    note = "Installment 1 of 2 via corporate credit card"
} 200 | Out-Null

# Account 4: Cust 5 (Landline with calls & damaged equipment fee)
Write-Host "Generating detailed Landline bill with calls and equipment fee for $($connectedAccounts[4].accountId)..."
Call $bill "/billing/accounts/$($connectedAccounts[4].accountId)" 'POST' @{
    localMinutes = 150
    stdMinutes = 45
    mobileMinutes = 30
    equipmentFee = 25.0
} 200 | Out-Null

# Account 5: Cust 6 (Broadband 1 line) -> Left as NotBilled!
Write-Host "Account $($connectedAccounts[5].accountId) left as NotBilled (Ready for invoicing)."

Write-Host ""
Write-Host "=== SEEDING SUMMARY ==="
Write-Host "Successfully created 6 billing accounts:"
Write-Host "1. $($connectedAccounts[0].accountId): Broadband 1 line - Status: PartiallyPaid (Total invoiced, partial cash payment at Retail)"
Write-Host "2. $($connectedAccounts[1].accountId): Broadband 15 lines - Status: Unpaid (50% Bulk discount applied on rental & deposit)"
Write-Host "3. $($connectedAccounts[2].accountId): Dial-Up 1 line - Status: Paid (Fully settled via City Office)"
Write-Host "4. $($connectedAccounts[3].accountId): Landline 25 lines - Status: PartiallyPaid (75% Bulk discount, installment 1 paid)"
Write-Host "5. $($connectedAccounts[4].accountId): Landline 1 line - Status: Unpaid (Includes Local/STD/Mobile call charges + $25 equipment fee)"
Write-Host "6. $($connectedAccounts[5].accountId): Broadband 1 line - Status: NotBilled (Connection active, ready for initial invoice)"
Write-Host "All accounts are now live in the database!"
