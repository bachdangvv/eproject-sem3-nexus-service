# Run with PowerShell 7 after dotnet build. Each run uses its own SQLite database.
param([int]$Port = 5179)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$project = Split-Path -Parent $PSScriptRoot
$data = Join-Path $project ('data/smoke-' + [Guid]::NewGuid().ToString('N'))
New-Item -Path $data -ItemType Directory | Out-Null
$dll = Join-Path $project 'Nexus.Api/bin/Debug/net10.0/Nexus.Api.dll'
$dotnet = if (Test-Path "$env:USERPROFILE\.dotnet\dotnet.exe") { "$env:USERPROFILE\.dotnet\dotnet.exe" } else { 'dotnet' }
$origin = "http://127.0.0.1:$Port"
$previousConnection = $env:ConnectionStrings__Demo
$server = $null

function Check($condition, [string]$label) {
    if (!$condition) { throw "FAIL $label" }
    Write-Host "PASS $label"
}

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
    Check ($session.role -eq $role) "login $role"
    $client.Token = $session.csrfToken
    return $client
}

try {
    $env:ConnectionStrings__Demo = "Data Source=$(Join-Path $data 'smoke.db');Foreign Keys=True"
    $server = Start-Process -FilePath $dotnet -ArgumentList @("`"$dll`"", '--demo', '--urls', $origin) `
        -WorkingDirectory (Join-Path $project 'Nexus.Api') -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $data 'server.log') -RedirectStandardError (Join-Path $data 'error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($server.HasExited) { throw "Server exited. See $data." }
        try {
            $response = Invoke-WebRequest "$origin/api/session" -TimeoutSec 1 -UseBasicParsing
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 400 }
    }
    Check $ready 'fresh migration and seed'
    $guest = @{ Cookies = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Token = $null }
    $null = Call $guest '/customers' 'GET' $null 401
    $null = Call $guest '/login' 'POST' @{username='retail.demo';password='Nexus-Demo-2026!'} 400
    Check $true 'unauthenticated access and missing CSRF rejected'
    $guest.Token = (Call $guest '/session').csrfToken
    $null = Call $guest '/login' 'POST' @{username='retail.demo';password='incorrect'} 401
    Check $true 'invalid credentials rejected'

    $admin = SignIn 'Admin'
    $retail = SignIn 'Retail'
    $technical = SignIn 'Technical'
    $billing = SignIn 'Billing'
    Check (@(Call $admin '/employees').Count -eq 4) 'admin employee list'
    $createdEmployee = Call $admin '/employees' 'POST' @{username='retail.extra';displayName='Retail Extra';role='Retail';password='Nexus-New-2026!'} 201
    Check ($createdEmployee.role -eq 'Retail' -and !$createdEmployee.passwordHash) 'admin employee creation'
    $createdSession = SignIn 'Retail' 'retail.extra' 'Nexus-New-2026!'
    $null = Call $createdSession '/logout' 'POST' $null 204
    $null = Call $createdSession '/orders' 'GET' $null 401
    $null = Call $retail '/employees' 'GET' $null 403
    $null = Call $billing '/orders' 'GET' $null 403
    $null = Call $technical '/requests' 'POST' @{customerId=1;planId=1;hasNexusLandline=$false} 403
    Check $true 'role restrictions'

    $null = Call $retail '/orders/B9999999999' 'GET' $null 404
    $null = Call $retail '/orders?code=invalid' 'GET' $null 400
    $null = Call $retail '/requests/2147483647/confirm' 'POST' $null 404
    Check $true 'application errors map to HTTP 400 and 404'

    $plan = Call $admin '/plans' 'POST' @{name='Temporary Plan';type='B';description='Smoke';price=19.99;active=$true} 201
    $changedPlan = Call $admin "/plans/$($plan.id)" 'PUT' @{name='Updated Plan';type='B';description='Smoke';price=20;active=$true}
    Check ($changedPlan.name -eq 'Updated Plan') 'service plan create and edit'
    $null = Call $admin "/plans/$($plan.id)" 'DELETE' $null 204
    Check (!(Call $retail '/plans' | Where-Object id -eq $plan.id)) 'inactive plan excluded from Retail'
    $product = Call $admin '/products' 'POST' @{name='Temporary modem';description='Smoke';active=$true} 201
    $product = Call $admin "/products/$($product.id)" 'PUT' @{name='Updated modem';description='Smoke';active=$true}
    $null = Call $admin "/products/$($product.id)" 'DELETE' $null 204
    Check ((Call $admin '/products' | Where-Object id -eq $product.id).active -eq $false) 'product create, edit and archive'

    $customerName = "$([char]0x004E)$([char]0x0067)$([char]0x0075)$([char]0x0079)$([char]0x1EC5)$([char]0x006E) $([char]0x0056)$([char]0x0103)$([char]0x006E) A"
    $customerPayload = @{name=$customerName;phone='0900000001';address='10 Nexus Street';cityCode='101';taxId='0101234567';email='a@example.vn';contactPerson='Nguyen Van A';customerType='Corporate'}
    $invalidCustomer = $customerPayload.Clone()
    $invalidCustomer.phone = 'invalid'
    $null = Call $retail '/customers' 'POST' $invalidCustomer 400
    $customer = Call $retail '/customers' 'POST' $customerPayload 201
    Check ($customer.taxId -eq '0101234567' -and $customer.email -eq 'a@example.vn' -and $customer.contactPerson -eq 'Nguyen Van A') 'customer Review 1 profile fields persisted'
    $customerPayload.address = '12 Nexus Street'
    $customer = Call $retail "/customers/$($customer.id)" 'PUT' $customerPayload
    $byCode = @(Call $retail "/customers?q=$($customer.code)")
    $searchTerm = "$([char]0x004E)$([char]0x0047)$([char]0x0055)$([char]0x0059)$([char]0x1EC4)$([char]0x004E)"
    $byName = @(Call $retail ("/customers?q=" + [uri]::EscapeDataString($searchTerm)))
    Check ($byCode[0].address -eq '12 Nexus Street' -and $byName[0].code -eq $customer.code) 'customer validation, create, edit and search'
    $plans = Call $retail '/plans'
    $bb = $plans | Where-Object type -eq 'B'
    $dial = $plans | Where-Object type -eq 'D'
    $null = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$plan.id;hasNexusLandline=$false} 400
    $request = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$bb.id;hasNexusLandline=$false} 201
    Check ($request.planName -eq 'BB Basic' -and $request.customerName -eq $customer.name) 'request contains correct customer and active plan'
    $order = Call $retail "/requests/$($request.id)/confirm" 'POST' $null 201
    $retry = Call $retail "/requests/$($request.id)/confirm" 'POST'
    Check ($order.code -ceq 'B0000000001' -and $order.status -eq 'Pending' -and $retry.code -eq $order.code) 'Order ID, Pending and safe confirmation retry'

    $route = "/orders/$($order.code)"
    $null = Call $technical "$route/connection" 'POST' $null 409
    $null = Call $retail "$route/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true} 403
    $pending = @(Call $technical '/orders?status=Pending')
    Check ($pending[0].code -eq $order.code) 'Technical Pending queue and transition guards'
    $assessed = Call $technical "$route/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
    Check ($assessed.status -eq 'Feasible') 'feasible assessment'
    $connected = Call $technical "$route/connection" 'POST' $null 201
    $again = Call $technical "$route/connection" 'POST'
    Check ($connected.status -eq 'Connected' -and $connected.accountId -ceq 'B101000000000001' -and
        $again.accountId -eq $connected.accountId) 'Connected, Account ID and safe activation retry'
    $tracking = Call $retail "$route"
    $found = @(Call $retail "/orders?code=$($order.code)")
    Check (($tracking.history.status -join ',') -eq 'Pending,Feasible,Connected' -and $found[0].accountId -eq $connected.accountId) 'Retail order search and audit history'
    $public = @{ Cookies = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Token = $null }
    $publicOrder = Call $public "/public/track/order/$($order.code)"
    $publicAccount = Call $public "/public/track/account/$($connected.accountId)"
    Check ($publicOrder.id -eq $order.code -and $publicOrder.accountId -eq $connected.accountId -and
        $publicAccount.id -eq $connected.accountId -and $publicAccount.orderId -eq $order.code) 'public order and account tracking'
    Check (!$publicOrder.customerName -and !$publicOrder.route -and !$publicAccount.customerName -and !$publicAccount.route) 'public tracking omits subscriber name and address'
    $null = Call $retail "$route/feedback" 'POST' @{rating=5;comment='Kết nối hoạt động ổn định.'} 201
    Check ((Call $retail $route).feedback[0].rating -eq 5) 'feedback saved on the connected order'

    $billingRoute = "/billing/accounts/$($connected.accountId)"
    $null = Call $retail $billingRoute 'GET' $null 403
    $null = Call $billing '/billing/accounts/B101999999999999' 'GET' $null 404
    $lookup = Call $billing $billingRoute
    Check ($lookup.status -eq 'NotBilled' -and $lookup.orderId -eq $order.code) 'Billing resolves the same connected Account ID'
    $billingList = Call $billing '/billing/accounts'
    Check (@($billingList).Count -ge 1 -and $billingList[0].accountId -eq $connected.accountId) 'Billing persistent DB accounts list'

    $null = Call $billing "$billingRoute/payment" 'POST' $null 409
    $bill = Call $billing $billingRoute 'POST'
    $expectedTotal = [Math]::Round($bb.price * 1.1224, 2) + 500.00 # $225 + $27.54 tax (12.24%) + $500 refundable security deposit
    Check ($bill.rentalAmount -eq $bb.price -and $bill.depositAmount -eq 500.00 -and $bill.taxAmount -eq 27.54 -and $bill.totalAmount -eq $expectedTotal -and $bill.status -eq 'Unpaid') 'detailed invoice: rental snapshot, deposit, 12.24% tax, and unpaid status'

    # Retail till-date billing view
    $retailLookup = Call $retail "/retail/billing/accounts/$($connected.accountId)"
    Check ($retailLookup.status -eq 'Unpaid' -and $retailLookup.totalAmount -eq $expectedTotal) 'Retail till-date billing view'

    # Retail in-store partial payment collection
    $partialPay = Call $retail "/retail/billing/accounts/$($connected.accountId)/payment" 'POST' @{amount=252.54;note='Cash payment at outlet'}
    Check ($partialPay.status -eq 'PartiallyPaid' -and $partialPay.paidAmount -eq 252.54 -and $partialPay.dueAmount -eq 500.00) 'Retail partial in-store payment collection'

    # Settle remaining balance by Billing
    $paid = Call $billing "$billingRoute/payment" 'POST'
    $paidAgain = Call $billing "$billingRoute/payment" 'POST'
    $billAgain = Call $billing $billingRoute 'POST'
    $stored = Call $billing $billingRoute
    Check ($paid.status -eq 'Paid' -and $paid.paidAt -and $paidAgain.paidAt -eq $paid.paidAt -and
        $billAgain.paidAt -eq $paid.paidAt -and $stored.paidAt -eq $paid.paidAt -and $stored.dueAmount -eq 0) 'payment persists and create/payment retries preserve the original record'

    $dialRequest = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$dial.id;hasNexusLandline=$false} 201
    $dialOrder = Call $retail "/requests/$($dialRequest.id)/confirm" 'POST' $null 201
    $dialRoute = "/orders/$($dialOrder.code)"
    $null = Call $technical "$dialRoute/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true} 400
    $null = Call $technical "$dialRoute/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true;landlineFeasible=$false} 400
    $rejected = Call $technical "$dialRoute/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true;landlineFeasible=$false;note='No line available.'}
    $null = Call $technical "$dialRoute/connection" 'POST' $null 409
    $null = Call $retail "$dialRoute/feedback" 'POST' @{rating=5;comment='Too early'} 409
    Check ($rejected.status -eq 'NotFeasible' -and $dialOrder.code -ceq 'D0000000002') 'Dial-up landline check, rejection and second serial'

    # ========================================================
    # Group 2: Retail Shops, Vendors & Equipment Inventory
    # ========================================================

    # 1. Retail Shops
    $initialShops = Call $admin '/admin/retail-shops'
    Check (@($initialShops).Count -ge 3) 'seeded retail shops present'
    $shopPayload = @{code='RS-TEST-01';name='Smoke Test Outlet';cityCode='101';address='999 Test Blvd';phone='02812345678';active=$true}
    $createdShop = Call $admin '/admin/retail-shops' 'POST' $shopPayload 201
    Check ($createdShop.code -eq 'RS-TEST-01' -and $createdShop.name -eq 'Smoke Test Outlet') 'retail shop creation'
    $lookupBefore = @(Call $retail '/retail-shops?cityCode=101')
    Check (@($lookupBefore | Where-Object code -eq 'RS-TEST-01').Count -eq 1) 'retail shop public/staff city lookup'
    $updatedShop = Call $admin "/admin/retail-shops/$($createdShop.id)" 'PUT' @{code='RS-TEST-01';name='Smoke Test Outlet Updated';cityCode='101';address='999 Test Blvd Suite 2';phone='02812345678';active=$true}
    Check ($updatedShop.name -eq 'Smoke Test Outlet Updated') 'retail shop update'
    $null = Call $admin "/admin/retail-shops/$($createdShop.id)" 'DELETE' $null 204
    $lookupAfter = @(Call $retail '/retail-shops?cityCode=101')
    Check (@($lookupAfter | Where-Object code -eq 'RS-TEST-01').Count -eq 0) 'retail shop soft delete excludes from active lookup'

    # 2. Vendors
    $initialVendors = Call $admin '/admin/vendors'
    Check (@($initialVendors).Count -ge 3) 'seeded vendors present'
    $vendorPayload = @{code='VND-SMOKE';name='Smoke Systems Ltd';contactPerson='David Test';phone='0987654321';email='david@smokesystems.vn';address='456 Vendor Way';active=$true}
    $createdVendor = Call $admin '/admin/vendors' 'POST' $vendorPayload 201
    Check ($createdVendor.code -eq 'VND-SMOKE' -and $createdVendor.contactPerson -eq 'David Test') 'vendor creation'
    $updatedVendor = Call $admin "/admin/vendors/$($createdVendor.id)" 'PUT' @{code='VND-SMOKE';name='Smoke Systems Ltd Global';contactPerson='David Test';phone='0987654321';email='david@smokesystems.vn';address='456 Vendor Way';active=$true}
    Check ($updatedVendor.name -eq 'Smoke Systems Ltd Global') 'vendor update'
    $null = Call $admin "/admin/vendors/$($createdVendor.id)" 'DELETE' $null 204
    Check ((Call $admin '/admin/vendors' | Where-Object id -eq $createdVendor.id).active -eq $false) 'vendor soft delete'

    # 3. Product Equipment Stock & Purchases Flow
    $invProduct = Call $admin '/products' 'POST' @{name='Fiber Optical ONT Unit';description='Dual band smoke test ONT';active=$true;quantityInStock=10;replacementPrice=85.00} 201
    Check ($invProduct.quantityInStock -eq 10 -and $invProduct.replacementPrice -eq 85.00) 'product created with initial stock and replacement price'

    # Place purchase order
    $poPayload = @{vendorId=$initialVendors[0].id;productId=$invProduct.id;quantity=20;unitPrice=60.00;note='Smoke replenishment order'}
    $po = Call $admin '/admin/purchases' 'POST' $poPayload 201
    Check ($po.status -eq 'Ordered' -and $po.orderNumber -like 'PO-*' -and $po.totalAmount -eq 1200.00 -and $po.paidAmount -eq 0) 'purchase order placed'

    # Receive purchase order -> increases stock automatically
    $receivedPo = Call $admin "/admin/purchases/$($po.id)/receive" 'POST' $null 200
    Check ($receivedPo.status -eq 'Received' -and $receivedPo.receivedAt) 'purchase order marked received'
    $reloadedProduct = (Call $admin '/products' | Where-Object id -eq $invProduct.id)
    Check ($reloadedProduct.quantityInStock -eq 30) 'product stock automatically incremented on PO receive (10 + 20 = 30)'

    # Cancel purchase order flow
    $po2 = Call $admin '/admin/purchases' 'POST' @{vendorId=$initialVendors[0].id;productId=$invProduct.id;quantity=5;unitPrice=60.00} 201
    $cancelledPo = Call $admin "/admin/purchases/$($po2.id)/cancel" 'POST' $null 200
    Check ($cancelledPo.status -eq 'Cancelled') 'purchase order cancellation'
    $null = Call $admin "/admin/purchases/$($po2.id)/receive" 'POST' $null 409
    Check $true 'cancelled purchase order cannot be received'

    # 4. Vendor Payments
    $paymentPayload = @{purchaseOrderId=$po.id;amount=700.00;method='BankTransfer';reference='VCB-SMOKE-01';note='Partial payment for PO'}
    $payment = Call $admin '/admin/vendor-payments' 'POST' $paymentPayload 201
    Check ($payment.paymentNumber -like 'VP-*' -and $payment.amount -eq 700.00 -and $payment.method -eq 'BankTransfer') 'vendor payment recorded'
    $poAfterPay = (Call $admin '/admin/purchases' | Where-Object id -eq $po.id)
    Check ($poAfterPay.paidAmount -eq 700.00 -and $poAfterPay.paymentStatus -eq 'PartiallyPaid') 'purchase order paidAmount and PartiallyPaid status updated'
    # Payment exceeding remaining balance rejected
    $null = Call $admin '/admin/vendor-payments' 'POST' @{purchaseOrderId=$po.id;amount=600.00;method='Cash'} 400
    Check $true 'payment exceeding remaining balance ($500) rejected'

    # 5. Technical Equipment Allocation & Stock Decrement
    $equipStock = Call $technical '/technical/equipment'
    Check (@($equipStock).Count -ge 4) 'technical equipment stock overview'
    $stockItem = $equipStock | Where-Object id -eq $invProduct.id
    Check ($stockItem.quantityInStock -eq 30) 'technical equipment reflects current stock'

    # Create new order, assess Feasible, and activate with equipment allocation
    $equipRequest = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$bb.id;hasNexusLandline=$false} 201
    $equipOrder = Call $retail "/requests/$($equipRequest.id)/confirm" 'POST' $null 201
    $equipRoute = "/orders/$($equipOrder.code)"
    $null = Call $technical "$equipRoute/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
    $equipConnected = Call $technical "$equipRoute/connection" 'POST' @{productId=$invProduct.id} 201
    Check ($equipConnected.status -eq 'Connected' -and $equipConnected.assignedProductId -eq $invProduct.id) 'connection activated with equipment allocation'
    $productAfterAllocation = (Call $admin '/products' | Where-Object id -eq $invProduct.id)
    Check ($productAfterAllocation.quantityInStock -eq 29) 'product stock automatically decremented on connection allocation (30 - 1 = 29)'

    # 6. Customer Damaged Equipment Incident Recording
    $incidentPayload = @{
        accountId = $equipConnected.accountId
        productId = $invProduct.id
        description = 'Customer router damaged by electrical power surge during storm'
        replacementFee = 85.00
    }
    $incident = Call $technical '/technical/incidents' 'POST' $incidentPayload 201
    Check ($incident.accountId -eq $equipConnected.accountId -and $incident.productId -eq $invProduct.id -and $incident.replacementFee -eq 85.00 -and $incident.settled -eq $false) 'damaged equipment incident recorded'
    $incidentsList = Call $technical '/technical/incidents'
    Check (@($incidentsList | Where-Object id -eq $incident.id).Count -eq 1) 'technical incidents list includes recorded incident'

    Write-Host 'Smoke suite passed.'
} catch {
    Write-Host "Logs and isolated test data are in $data"
    throw
} finally {
    $env:ConnectionStrings__Demo = $previousConnection
    if ($server -and !$server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}
