# Run with Windows PowerShell 5.1 or PowerShell 7 after dotnet build. Each run uses its own SQLite database.
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
$server2 = $null
$data2 = $null
$passed = $false

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
    $employees = @(Call $admin '/employees')
    Check ($employees.Count -eq 5 -and (@($employees | Where-Object { $_.username -eq 'customer.demo' -and $_.role -eq 'Customer' -and $_.customerId -eq 1 }).Count -eq 1)) 'admin employee list includes seeded customer.demo'
    $adminRecord = @($employees | Where-Object username -eq 'admin.demo')[0]
    $createdEmployee = Call $admin '/employees' 'POST' @{username='retail.extra';displayName='Retail Extra';role='Retail';password='Nexus-New-2026!'} 201
    Check ($createdEmployee.role -eq 'Retail' -and $createdEmployee.active -eq $true -and !$createdEmployee.passwordHash) 'admin employee creation'
    $updatedEmployee = Call $admin "/employees/$($createdEmployee.id)" 'PUT' @{displayName='Retail Extra Updated';role='Retail'}
    Check ($updatedEmployee.displayName -eq 'Retail Extra Updated') 'admin employee update'
    $createdSession = SignIn 'Retail' 'retail.extra' 'Nexus-New-2026!'
    $null = Call $createdSession '/logout' 'POST' $null 204
    $null = Call $createdSession '/orders' 'GET' $null 401
    $deactivatedEmployee = Call $admin "/employees/$($createdEmployee.id)" 'DELETE' $null 200
    Check ($deactivatedEmployee.active -eq $false) 'admin employee soft deactivation'
    $null = Call $guest '/login' 'POST' @{username='retail.extra';password='Nexus-New-2026!'} 401
    $null = Call $admin "/employees/$($adminRecord.id)" 'DELETE' $null 409
    Check $true 'deactivated employee login rejected and self-deactivation guarded'
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
    Check ($changedPlan.name -eq 'Updated Plan' -and $changedPlan.validityMonths -eq 1) 'service plan create and edit'
    $null = Call $admin '/plans' 'POST' @{name='Invalid Validity';type='B';description='Smoke';price=20;active=$true;validityMonths=2} 400
    $landlineTariffPlan = Call $admin '/plans' 'POST' @{name='Smoke STD Landline';type='T';description='STD test';price=125;active=$true;localCallRate=0.70;stdCallRate=2.25;mobileMsgRate=1.00} 201
    Check ($landlineTariffPlan.localCallRate -eq 0.70 -and $landlineTariffPlan.stdCallRate -eq 2.25 -and $landlineTariffPlan.mobileMsgRate -eq 1.00) 'landline plan per-minute call tariff rates persisted'
    $updatedCity = Call $admin '/cities/101' 'PUT' @{name='City 101 Central'}
    Check ($updatedCity.name -eq 'City 101 Central') 'admin city name update'
    $null = Call $admin "/plans/$($plan.id)" 'DELETE' $null 204
    Check (!(Call $retail '/plans' | Where-Object id -eq $plan.id)) 'inactive plan excluded from Retail'
    $publicPlans = @(Call $guest '/public/plans')
    Check ($publicPlans.Count -ge 18 -and !($publicPlans | Where-Object id -eq $plan.id)) 'public plans endpoint returns active catalog anonymously'
    $product = Call $technical '/products' 'POST' @{name='Temporary modem';description='Smoke';active=$true;quantityInStock=1;replacementPrice=40} 201
    $product = Call $technical "/products/$($product.id)" 'PUT' @{name='Updated modem';description='Smoke';active=$true;quantityInStock=1;replacementPrice=45}
    Check (@(Call $technical '/products' | Where-Object id -eq $product.id).Count -eq 1) 'technical can read/create/update products'
    $null = Call $technical "/products/$($product.id)" 'DELETE' $null 403
    $null = Call $admin "/products/$($product.id)" 'DELETE' $null 204
    Check ((Call $admin '/products' | Where-Object id -eq $product.id).active -eq $false) 'product create, edit and archive (admin-only delete)'

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
    Check (@($plans).Count -ge 18) 'canonical specification tariff plans seeded'
    $bb = @($plans | Where-Object name -eq 'BB Basic')[0]
    $dial = @($plans | Where-Object name -eq 'Dial-up 10h')[0]
    $null = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$plan.id;hasNexusLandline=$false} 400
    $request = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$bb.id;hasNexusLandline=$false} 201
    Check ($request.planName -eq 'BB Basic' -and $request.customerName -eq $customer.name) 'request contains correct customer and active plan'
    $order = Call $retail "/requests/$($request.id)/confirm" 'POST' $null 201
    $retry = Call $retail "/requests/$($request.id)/confirm" 'POST'
    Check ($order.code -ceq 'B0000000004' -and $order.status -eq 'Pending' -and $retry.code -eq $order.code) 'Order ID, Pending and safe confirmation retry'

    $route = "/orders/$($order.code)"
    $null = Call $technical "$route/connection" 'POST' $null 409
    $null = Call $retail "$route/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true} 403
    $pending = @(Call $technical '/orders?status=Pending')
    Check ($pending[0].code -eq $order.code) 'Technical Pending queue and transition guards'
    $assessed = Call $technical "$route/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
    Check ($assessed.status -eq 'Feasible') 'feasible assessment'
    $connected = Call $technical "$route/connection" 'POST' $null 201
    $again = Call $technical "$route/connection" 'POST'
    Check ($connected.status -eq 'Connected' -and $connected.accountId -ceq 'B101000000000004' -and
        $again.accountId -eq $connected.accountId) 'Connected, Account ID and safe activation retry'
    $tracking = Call $retail "$route"
    $found = @(Call $retail "/orders?code=$($order.code)")
    Check (($tracking.history.status -join ',') -eq 'Pending,Feasible,Connected' -and $found[0].accountId -eq $connected.accountId) 'Retail order search and audit history'
    $public = @{ Cookies = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Token = $null }
    $publicOrder = Call $public "/public/track/order/$($order.code)"
    $publicAccount = Call $public "/public/track/account/$($connected.accountId)"
    Check ($publicOrder.id -eq $order.code -and $publicOrder.accountId -eq $connected.accountId -and
        $publicAccount.id -eq $connected.accountId -and $publicAccount.orderId -eq $order.code -and
        $publicAccount.status -eq 'Active' -and $publicAccount.dueAmount -eq 0) 'public order and account tracking'
    Check (!$publicOrder.customerName -and !$publicOrder.route -and !$publicAccount.customerName -and !$publicAccount.route) 'public tracking omits subscriber name and address'
    $feedbackText = "K$([char]0x1EBF)t n$([char]0x1ED1)i ho$([char]0x1EA1)t $([char]0x0111)$([char]0x1ED9)ng $([char]0x1ED5)n $([char]0x0111)$([char]0x1ECB)nh."
    $null = Call $retail "$route/feedback" 'POST' @{rating=5;comment=$feedbackText} 201
    Check ((Call $retail $route).feedback[0].rating -eq 5) 'feedback saved on the connected order'

    $billingRoute = "/billing/accounts/$($connected.accountId)"
    $null = Call $retail $billingRoute 'GET' $null 403
    $null = Call $billing '/billing/accounts/B101999999999999' 'GET' $null 404
    $lookup = Call $billing $billingRoute
    Check ($lookup.status -eq 'NotBilled' -and $lookup.orderId -eq $order.code) 'Billing resolves the same connected Account ID'
    $billingList = Call $billing '/billing/accounts'
    $billingSearch = @(Call $billing "/billing/accounts?q=$($connected.accountId)")
    $retailBillingSearch = @(Call $retail "/retail/billing/accounts?q=$($customer.phone)")
    Check (@($billingList).Count -ge 1 -and $billingList[0].accountId -eq $connected.accountId -and
        $billingSearch.Count -eq 1 -and $retailBillingSearch.Count -ge 1) 'Billing persistent DB accounts list and ?q= search'

    $null = Call $billing "$billingRoute/payment" 'POST' $null 409
    $bill = Call $billing $billingRoute 'POST'
    $expectedTotal = [Math]::Round($bb.price * 1.1224, 2) + 500.00 # $225 + $27.54 tax (12.24%) + $500 refundable security deposit
    Check ($bill.rentalAmount -eq $bb.price -and $bill.depositAmount -eq 500.00 -and $bill.taxAmount -eq 27.54 -and $bill.totalAmount -eq $expectedTotal -and $bill.status -eq 'Unpaid') 'detailed invoice: rental snapshot, deposit, 12.24% tax, and unpaid status'
    $publicAfterBill = Call $public "/public/track/account/$($connected.accountId)"
    Check ($publicAfterBill.dueAmount -eq $expectedTotal) 'public account tracking reflects unpaid dueAmount'

    $null = Call $billing "$billingRoute/payment" 'POST' @{amount=-5} 400
    Check $true 'negative payment amount rejected with 400'

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
    Check ($rejected.status -eq 'NotFeasible' -and $dialOrder.code -ceq 'D0000000005') 'Dial-up landline check, rejection and second serial'

    # ========================================================
    # Group 2: Retail Shops, Vendors & Equipment Inventory
    # ========================================================

    # 1. Retail Shops
    $initialShops = Call $admin '/admin/retail-shops'
    Check (@($initialShops).Count -ge 3) 'seeded retail shops present'
    $shopPayload = @{code='RS-TEST-01';name='Smoke Test Outlet';cityCode='101';address='999 Test Blvd';phone='02812345678';active=$true}
    $createdShop = Call $admin '/admin/retail-shops' 'POST' $shopPayload 201
    Check ($createdShop.code -eq 'RS-TEST-01' -and $createdShop.name -eq 'Smoke Test Outlet') 'retail shop creation'
    $null = Call $admin '/admin/retail-shops' 'POST' @{code='rs-test-01';name='Dup Outlet';cityCode='101';address='1 Dup Way';phone='02812345679';active=$true} 409
    Check $true 'retail shop lowercase duplicate code rejected with 409'
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
    $null = Call $admin '/admin/vendor-payments' 'POST' @{purchaseOrderId=$po2.id;amount=10.00;method='Cash'} 409
    Check $true 'cancelled purchase order cannot be received or paid'

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
    Check ($stockItem.quantityInStock -eq 30 -and $stockItem.pendingAllocations -eq 0) 'technical equipment reflects current stock and per-SKU pendingAllocations = 0'
    $equipSummary = Call $technical '/technical/equipment/summary'
    Check ($equipSummary.pendingFeasibleOrders -ge 0) 'technical equipment summary returns global pending feasible orders'
    $null = Call $retail '/technical/equipment/summary' 'GET' $null 403

    # Create new order, assess Feasible, and activate with equipment allocation
    $equipRequest = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$bb.id;hasNexusLandline=$false} 201
    $equipOrder = Call $retail "/requests/$($equipRequest.id)/confirm" 'POST' $null 201
    $equipRoute = "/orders/$($equipOrder.code)"
    $null = Call $technical "$equipRoute/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
    $equipConnected = Call $technical "$equipRoute/connection" 'POST' @{productId=$invProduct.id} 201
    Check ($equipConnected.status -eq 'Connected' -and $equipConnected.assignedProductId -eq $invProduct.id) 'connection activated with equipment allocation'
    $productAfterAllocation = (Call $admin '/products' | Where-Object id -eq $invProduct.id)
    Check ($productAfterAllocation.quantityInStock -eq 29) 'product stock automatically decremented on connection allocation (30 - 1 = 29)'

    # Verify ConnectionCount > 1 stock check and multi-unit decrement
    $bulkEquipProd = Call $technical '/products' 'POST' @{name='Smoke Bulk ONT';description='Multi-unit stock test';active=$true;quantityInStock=1;replacementPrice=50} 201
    $bulkReq = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$bb.id;hasNexusLandline=$false;connectionCount=2} 201
    $bulkOrder = Call $retail "/requests/$($bulkReq.id)/confirm" 'POST' $null 201
    $null = Call $technical "/orders/$($bulkOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
    $null = Call $technical "/orders/$($bulkOrder.code)/connection" 'POST' @{productId=$bulkEquipProd.id} 400
    $null = Call $technical "/products/$($bulkEquipProd.id)" 'PUT' @{name='Smoke Bulk ONT';description='Multi-unit stock test';active=$true;quantityInStock=5;replacementPrice=50}
    $bulkConn = Call $technical "/orders/$($bulkOrder.code)/connection" 'POST' @{productId=$bulkEquipProd.id} 201
    Check ($bulkConn.status -eq 'Connected' -and ((Call $technical '/products' | Where-Object id -eq $bulkEquipProd.id).quantityInStock -eq 3)) 'ConnectAsync enforces and decrements stock by ConnectionCount (5 - 2 = 3)'

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

    # Auto-include unsettled equipment incident fee into next invoice and mark incident settled
    $incidentBill = Call $billing "/billing/accounts/$($equipConnected.accountId)" 'POST' @{localMinutes=0;stdMinutes=0;mobileMinutes=0}
    Check ($incidentBill.equipmentFee -eq 85.00) 'unsettled equipment incident replacement fee auto-included in invoice'
    $settledIncident = @(Call $technical '/technical/incidents?settled=true' | Where-Object id -eq $incident.id)
    Check ($settledIncident.Count -eq 1 -and $settledIncident[0].settled -eq $true) 'equipment incident marked settled upon invoice creation'
    # Verify RolledOver behavior on subsequent billing cycle before paying
    $rolledNextBill = Call $billing "/billing/accounts/$($equipConnected.accountId)" 'POST' @{localMinutes=0;stdMinutes=0;mobileMinutes=0;periodStart='2026-12-01T00:00:00Z';periodEnd='2027-01-01T00:00:00Z'}
    Check (@($rolledNextBill.invoices | Where-Object status -eq 'RolledOver').Count -eq 1) 'prior unpaid invoice rolled over cleanly without double-counting'
    $null = Call $billing "/billing/accounts/$($equipConnected.accountId)/payment" 'POST'

    # ==================== Group 3: Connection Lifecycle & 5-Criteria Advanced Search ====================

    # 7. Connection Lifecycle (Suspend, Reactivate, Terminate & Deposit Refund)
    $allConnections = @(Call $technical '/connections')
    Check ($allConnections.Count -ge 2) 'connections list endpoint returns active connections'
    $connDetail = Call $retail "/connections/$($equipConnected.accountId)"
    Check ($connDetail.accountId -eq $equipConnected.accountId -and $connDetail.status -eq 'Active') 'connection detail retrieval'

    $suspendedConn = Call $technical "/technical/connections/$($equipConnected.accountId)/suspend" 'POST' @{reason='Scheduled fiber line maintenance'}
    Check ($suspendedConn.status -eq 'TemporarilyInactive' -and $suspendedConn.suspendReason -eq 'Scheduled fiber line maintenance' -and $suspendedConn.suspendedAt) 'connection suspended to TemporarilyInactive'

    $reactivatedConn = Call $technical "/technical/connections/$($equipConnected.accountId)/reactivate" 'POST'
    Check ($reactivatedConn.status -eq 'Active' -and !$reactivatedConn.suspendReason) 'connection reactivated to Active'

    # 8. 5-Criteria Advanced Search (Orders & Connections)
    $escapedCustomerTerm = [uri]::EscapeDataString($searchTerm)
    $searchOrders = @(Call $retail "/orders/search?code=$($equipOrder.code)&customerName=$escapedCustomerTerm&serviceType=B&phone=0900000001&status=Connected")
    Check ($searchOrders.Count -eq 1 -and $searchOrders[0].code -eq $equipOrder.code) '5-criteria advanced order search'
    $searchConns = @(Call $technical "/connections?code=$($equipConnected.accountId)&customerName=$escapedCustomerTerm&serviceType=B&phone=0900000001&status=Active")
    Check ($searchConns.Count -eq 1 -and $searchConns[0].accountId -eq $equipConnected.accountId) '5-criteria advanced connection search'

    # ==================== Group 4: Customer Documents, Plan Changes & Dynamic FAQ ====================

    # 9. Customer Document Archival (Indexed by Year & CityCode)
    $null = Call $retail '/documents' 'POST' @{customerId=$customer.id;documentType='AddressProof';title='Traversal';filePathOrUrl='../../etc/passwd';year=2026;cityCode='101'} 400
    $null = Call $retail '/documents' 'POST' @{customerId=$customer.id;documentType='AddressProof';title='Bad Ext';filePathOrUrl='uploads/documents/2026/101/bad.exe';year=2026;cityCode='101'} 400
    $docPayload = @{
        customerId = $customer.id
        documentType = 'AddressProof'
        title = 'Utility Bill Proof 2026'
        filePathOrUrl = 'uploads/documents/2026/101/smoke-address-proof.pdf'
        year = 2026
        cityCode = '101'
    }
    $createdDoc = Call $retail '/documents' 'POST' $docPayload 201
    Check ($createdDoc.customerId -eq $customer.id -and $createdDoc.year -eq 2026 -and $createdDoc.cityCode -eq '101') 'customer document archival record created'
    $filteredDocs = @(Call $admin "/documents?year=2026&cityCode=101&customerId=$($customer.id)&documentType=AddressProof")
    Check (@($filteredDocs | Where-Object id -eq $createdDoc.id).Count -eq 1) 'customer document filtered by Year, CityCode, CustomerId, and DocumentType'

    # 10. Plan Change Request Workflow (Submit & Approve)
    $newBbPlan = Call $admin '/plans' 'POST' @{name='BB Ultra 128K';type='B';description="128 Kbps $([char]0x00B7) monthly";price=350;active=$true} 201
    $null = Call $retail '/plan-changes' 'POST' @{connectionId=$connDetail.id;targetPlanId=$dial.id;note='Cross-type check'} 400
    $planChangeReq = Call $retail '/plan-changes' 'POST' @{connectionId=$connDetail.id;targetPlanId=$newBbPlan.id;note='Customer requested speed upgrade'} 201
    Check ($planChangeReq.status -eq 'Pending' -and $planChangeReq.targetPlanId -eq $newBbPlan.id -and $planChangeReq.requestedById -gt 0) 'plan change request submitted with requestedById'
    $null = Call $retail '/plan-changes' 'POST' @{connectionId=$connDetail.id;targetPlanId=$newBbPlan.id;note='Duplicate pending check'} 409
    $approvedPlanChange = Call $technical "/plan-changes/$($planChangeReq.id)/approve" 'POST'
    Check ($approvedPlanChange.status -eq 'Approved' -and $approvedPlanChange.reviewedAt) 'plan change request approved by Technical'

    # Terminate connection and verify security deposit refund calculation and disbursement
    $terminatedConn = Call $technical "/technical/connections/$($equipConnected.accountId)/terminate" 'POST' @{note='Subscriber relocated outside coverage'}
    Check ($terminatedConn.status -eq 'PermanentlyInactive' -and $terminatedConn.refundStatus -eq 'Pending' -and $terminatedConn.refundAmount -eq 500.00) 'connection permanently terminated with security deposit refund calculated'
    $refundedView = Call $billing "/billing/accounts/$($equipConnected.accountId)/refund" 'POST' @{note='Cheque #1001'}
    Check ($refundedView.refundStatus -eq 'Refunded' -and $refundedView.refundAmount -eq 500.00 -and $refundedView.refundedAt) 'security deposit refund disbursed'
    $null = Call $billing "/billing/accounts/$($equipConnected.accountId)/refund" 'POST' @{note='Duplicate refund'} 409

    # 11. Customer Queries & Dynamic FAQ Catalog
    $queryPayload = @{
        customerId = $customer.id
        subject = 'Broadband Security Deposit Refund Policy'
        category = 'Billing'
        question = 'When is the $500 Broadband security deposit refunded?'
    }
    $createdQuery = Call $retail '/queries' 'POST' $queryPayload 201
    Check ($createdQuery.status -eq 'Open' -and $createdQuery.category -eq 'Billing') 'customer query logged'
    $answeredQuery = Call $admin "/queries/$($createdQuery.id)/answer" 'POST' @{answer='The refundable security deposit is automatically calculated and refunded upon permanent termination of the connection.';isFaq=$true}
    Check ($answeredQuery.status -eq 'Answered' -and $answeredQuery.isFaq -eq $true) 'customer query answered and promoted to FAQ'
    $faqList = @(Call $public '/faq?category=Billing')
    Check (@($faqList | Where-Object id -eq $createdQuery.id).Count -eq 1) 'public/staff dynamic FAQ catalog returns promoted FAQ entry'
    $closedQuery = Call $retail "/queries/$($createdQuery.id)/close" 'POST'
    Check ($closedQuery.status -eq 'Closed' -and $closedQuery.createdById -gt 0 -and $closedQuery.closedById -gt 0 -and $closedQuery.closedAt) 'customer query closed with actor and timestamp'

    # ==================== Customer Portal, Self-Registration & Suspension Blocking ====================

    # 12. Public cities & unlinked Customer role guard on staff endpoints
    $publicCities = @(Call $guest '/public/cities')
    Check ($publicCities.Count -ge 1 -and (@($publicCities | Where-Object code -eq '101').Count -eq 1)) 'public cities endpoint returns city catalog anonymously'
    $null = Call $admin '/employees' 'POST' @{username='unlinked.cust';displayName='Unlinked Customer';role='Customer';password='Nexus-New-2026!'} 400
    $null = Call $admin '/employees' 'POST' @{username='cus-99';displayName='Reserved Code';role='Retail';password='Nexus-New-2026!'} 400
    Check $true 'admin cannot create unlinked Customer employee or reserved cus-* username'

    # 13. Seeded customer.demo login, /api/session customer claims & strict role isolation
    $demoCust = SignIn 'Customer' 'customer.demo'
    $demoSession = Call $demoCust '/session'
    Check ($demoSession.role -eq 'Customer' -and $demoSession.customerId -eq 1 -and $demoSession.customerCode -eq 'CUS-000001') 'customer.demo session exposes customerId and customerCode'
    foreach ($staffRoute in @(
        '/retail-shops', '/employees', '/customers', '/requests', '/orders',
        '/connections', '/documents', '/plan-changes', '/queries',
        '/billing/accounts', "/billing/accounts/$($connected.accountId)",
        '/retail/billing/accounts', '/technical/equipment'
    )) {
        $null = Call $demoCust $staffRoute 'GET' $null 403
    }
    $null = Call $demoCust '/cities'
    $null = Call $demoCust '/plans'
    $null = Call $demoCust '/faq'
    foreach ($staffClient in @($admin, $retail, $technical, $billing)) {
        $null = Call $staffClient '/customer/profile' 'GET' $null 403
    }
    Check $true 'role isolation enforced between Customer and Staff routes'

    # 14. Self-registration (POST /api/register), immediate session & immediate login
    $regClient = @{ Cookies = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Token = $null }
    $regClient.Token = (Call $regClient '/session').csrfToken
    $regPayload = @{
        name = 'Smoke Customer Reg'
        phone = '0900000099'
        address = '99 Customer Ave'
        cityCode = '101'
        username = 'cust.reg.smoke'
        password = 'Nexus-Cust-2026!'
        email = 'cust.reg@example.com'
        contactPerson = 'Smoke Contact'
        customerType = 'Individual'
    }
    $regResult = Call $regClient '/register' 'POST' $regPayload 201
    Check ($regResult.customerId -gt 0 -and $regResult.customerCode -match '^CUS-\d{6}$' -and $regResult.username -eq 'cust.reg.smoke' -and $regResult.role -eq 'Customer') 'POST /api/register returns 201 with active customer identity'
    $regSession = Call $regClient '/session'
    Check ($regSession.role -eq 'Customer' -and $regSession.username -eq 'cust.reg.smoke' -and $regSession.customerId -eq $regResult.customerId -and $regSession.customerCode -eq $regResult.customerCode) 'registered customer is immediately signed into session'
    $regClient.Token = $regSession.csrfToken
    $regLoginClient = SignIn 'Customer' 'cust.reg.smoke' 'Nexus-Cust-2026!'
    $null = Call $regLoginClient '/customer/profile'
    Check $true 'newly registered customer can explicitly sign in immediately'

    # 15. Customer Portal self-service workflows + IDOR protection
    $custProfile = Call $regClient '/customer/profile'
    Check ($custProfile.username -eq 'cust.reg.smoke' -and $custProfile.status -eq 'ACTIVE') 'customer profile read'
    $updatedProfile = Call $regClient '/customer/profile' 'PUT' @{
        name = 'Smoke Customer Updated'
        phone = '0900000098'
        address = '100 Customer Ave'
        cityCode = '101'
        email = 'cust.updated@example.com'
        contactPerson = 'Updated Contact'
        customerType = 'Corporate'
        status = 'SUSPENDED'
    }
    Check ($updatedProfile.name -eq 'Smoke Customer Updated' -and $updatedProfile.status -eq 'ACTIVE') 'customer profile update preserves ACTIVE status against self-escalation'

    $custReq = Call $regClient '/customer/requests' 'POST' @{planId=$bb.id;hasNexusLandline=$false;connectionCount=1} 201
    $custReqs = @(Call $regClient '/customer/requests')
    Check (@($custReqs | Where-Object id -eq $custReq.id).Count -eq 1) 'customer self-service request creation and listing'

    $custOrder = Call $retail "/requests/$($custReq.id)/confirm" 'POST' $null 201
    $null = Call $regClient "/customer/orders/$($custOrder.code)/feedback" 'POST' @{rating=5;comment='Too early'} 409
    $null = Call $technical "/orders/$($custOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
    $custConnOrder = Call $technical "/orders/$($custOrder.code)/connection" 'POST' $null 201
    $custAccountId = $custConnOrder.accountId

    $custOrders = @(Call $regClient '/customer/orders')
    Check (@($custOrders | Where-Object code -eq $custOrder.code).Count -eq 1) 'customer orders list includes own order'
    $custConns = @(Call $regClient '/customer/connections')
    $custConn = ($custConns | Where-Object accountId -eq $custAccountId)[0]
    Check ($custConn.status -eq 'Active') 'customer connections list includes own active connection'

    # IDOR 404 checks against customer.demo's resources
    $null = Call $regClient '/customer/orders/B0000000001' 'GET' $null 404
    $null = Call $regClient '/customer/orders/B0000000001/feedback' 'POST' @{rating=5;comment='IDOR check'} 404
    $null = Call $regClient '/customer/billing/B101000000000001/payments' 'POST' @{amount=10;note='IDOR check'} 404
    $null = Call $regClient '/customer/plan-changes' 'POST' @{connectionId=1;targetPlanId=$newBbPlan.id;note='IDOR check'} 404
    Check $true 'IDOR cross-customer access returns 404'

    # Billing & online payment (Channel = CustomerPortal)
    $null = Call $billing "/billing/accounts/$custAccountId" 'POST'
    $custBillsBefore = @(Call $regClient '/customer/billing')
    $custBill = ($custBillsBefore | Where-Object accountId -eq $custAccountId)[0]
    Check ($custBill.status -eq 'Unpaid' -and $custBill.dueAmount -gt 0) 'customer billing view shows unpaid invoice'
    $onlinePartial = Call $regClient "/customer/billing/$custAccountId/payments" 'POST' @{invoiceId=$custBill.invoiceId;amount=100.00;note='Online partial payment'} 201
    Check ($onlinePartial.status -eq 'PartiallyPaid' -and (@($onlinePartial.payments | Where-Object channel -eq 'CustomerPortal').Count -eq 1)) 'customer online partial payment uses CustomerPortal channel'
    $onlineFull = Call $regClient "/customer/billing/$custAccountId/payments" 'POST' @{note='Online full settlement'} 201
    Check ($onlineFull.status -eq 'Paid' -and $onlineFull.dueAmount -eq 0) 'customer online full settlement marks invoice Paid'

    # Self-service plan change + Technical approval
    $custPlanChange = Call $regClient '/customer/plan-changes' 'POST' @{connectionId=$custConn.id;targetPlanId=$newBbPlan.id;note='Upgrade via portal'} 201
    $null = Call $regClient '/customer/plan-changes' 'POST' @{connectionId=$custConn.id;targetPlanId=$newBbPlan.id;note='Dup'} 409
    $custPlanChanges = @(Call $regClient '/customer/plan-changes')
    Check (@($custPlanChanges | Where-Object id -eq $custPlanChange.id).Count -eq 1) 'customer plan change created and listed'
    $approvedCustPc = Call $technical "/plan-changes/$($custPlanChange.id)/approve" 'POST'
    Check ($approvedCustPc.status -eq 'Approved') 'staff approved customer-submitted plan change'

    # Self-service query + Retail answer
    $custQuery = Call $regClient '/customer/queries' 'POST' @{subject='Portal Billing Question';category='Billing';question='Can I download my receipt online?'} 201
    $custQueries = @(Call $regClient '/customer/queries')
    Check (@($custQueries | Where-Object id -eq $custQuery.id).Count -eq 1) 'customer query created and listed'
    $null = Call $retail "/queries/$($custQuery.id)/answer" 'POST' @{answer='Yes, payment history is available in your billing tab.';isFaq=$false}
    $answeredCustQuery = (@(Call $regClient '/customer/queries') | Where-Object id -eq $custQuery.id)[0]
    Check ($answeredCustQuery.status -eq 'Answered' -and $answeredCustQuery.answer) 'customer sees staff answer to query'

    # Self-service order feedback
    $custFeedback = Call $regClient "/customer/orders/$($custOrder.code)/feedback" 'POST' @{rating=5;comment='Great self-service experience!'} 201
    $null = Call $regClient "/customer/orders/$($custOrder.code)/feedback" 'POST' @{rating=4;comment='Duplicate feedback attempt'} 409
    $custOrderDetail = Call $regClient "/customer/orders/$($custOrder.code)"
    Check ($custFeedback.rating -eq 5 -and $custOrderDetail.feedback.Count -eq 1 -and $custOrderDetail.feedback[0].comment -eq 'Great self-service experience!') 'customer feedback persisted on order detail and duplicate rejected with 409'

    # 16. Isolated server2 ($Port + 1): Reserved/Duplicate Register, SUSPENDED Customer & Deactivated Employee Blocking + Reactivation
    $data2 = Join-Path $project ('data/smoke-' + [Guid]::NewGuid().ToString('N'))
    New-Item -Path $data2 -ItemType Directory | Out-Null
    $origin2 = "http://127.0.0.1:$($Port + 1)"
    $env:ConnectionStrings__Demo = "Data Source=$(Join-Path $data2 'smoke.db');Foreign Keys=True"
    $server2 = Start-Process -FilePath $dotnet -ArgumentList @("`"$dll`"", '--demo', '--urls', $origin2) `
        -WorkingDirectory (Join-Path $project 'Nexus.Api') -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $data2 'server.log') -RedirectStandardError (Join-Path $data2 'error.log')
    $ready2 = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($server2.HasExited) { throw "Server2 exited. See $data2." }
        try {
            $response2 = Invoke-WebRequest "$origin2/api/session" -TimeoutSec 1 -UseBasicParsing
            if ($response2.StatusCode -eq 200) { $ready2 = $true; break }
        } catch { Start-Sleep -Milliseconds 400 }
    }
    Check $ready2 'isolated server2 ready for suspension and deactivation tests'
    $origin = $origin2

    $admin2 = SignIn 'Admin'
    $retail2 = SignIn 'Retail'
    $suspRegClient = @{ Cookies = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Token = $null }
    $suspRegClient.Token = (Call $suspRegClient '/session').csrfToken
    $null = Call $suspRegClient '/register' 'POST' @{name='Reserved';phone='0900000077';address='1 Way';cityCode='101';username='cus-1';password='Nexus-Cust-2026!'} 400
    $suspReg = Call $suspRegClient '/register' 'POST' @{name='Susp Test Customer';phone='0900000088';address='88 Suspend St';cityCode='101';username='cust.susp.smoke';password='Nexus-Cust-2026!'} 201
    $dupRegClient = @{ Cookies = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Token = $null }
    $dupRegClient.Token = (Call $dupRegClient '/session').csrfToken
    $null = Call $dupRegClient '/register' 'POST' @{name='Dup User';phone='0900000087';address='87 Dup St';cityCode='101';username='cust.susp.smoke';password='Nexus-Cust-2026!'} 409
    Check $true 'reserved cus-1 (400) and duplicate username (409) rejected on /register'

    $suspClient = SignIn 'Customer' 'cust.susp.smoke' 'Nexus-Cust-2026!'
    # Suspend Customer -> existing cookie mutations blocked (403), fresh login rejected (403)
    $null = Call $retail2 "/customers/$($suspReg.customerId)" 'PUT' @{name='Susp Test Customer';phone='0900000088';address='88 Suspend St';cityCode='101';status='SUSPENDED'}
    $suspProfileRead = Call $suspClient '/customer/profile'
    Check ($suspProfileRead.status -eq 'SUSPENDED') 'suspended customer can still read profile status'
    $null = Call $suspClient '/customer/profile' 'PUT' @{name='Blocked';phone='0900000088';address='88 Suspend St';cityCode='101'} 403
    $null = Call $suspClient '/customer/requests' 'POST' @{planId=$bb.id;hasNexusLandline=$false;connectionCount=1} 403
    $null = Call $suspClient '/customer/queries' 'POST' @{subject='Blocked';category='General';question='Should fail'} 403
    $guest2 = @{ Cookies = (New-Object Microsoft.PowerShell.Commands.WebRequestSession); Token = $null }
    $guest2.Token = (Call $guest2 '/session').csrfToken
    $null = Call $guest2 '/login' 'POST' @{username='cust.susp.smoke';password='Nexus-Cust-2026!'} 403
    Check $true 'SUSPENDED customer login rejected (403) and existing session mutations blocked (403)'

    # Reactivate Customer -> login & mutations restored
    $null = Call $retail2 "/customers/$($suspReg.customerId)" 'PUT' @{name='Susp Test Customer';phone='0900000088';address='88 Suspend St';cityCode='101';status='ACTIVE'}
    $suspClient = SignIn 'Customer' 'cust.susp.smoke' 'Nexus-Cust-2026!'
    $restoredQuery = Call $suspClient '/customer/queries' 'POST' @{subject='Restored';category='General';question='Account active again'} 201
    Check ($restoredQuery.status -eq 'Open') 'reactivated customer login and self-service restored'

    # Deactivate Employee -> existing cookie reads & mutations blocked (403), fresh login rejected (403)
    $custEmp = (@(Call $admin2 '/employees') | Where-Object username -eq 'cust.susp.smoke')[0]
    $deactCustEmp = Call $admin2 "/employees/$($custEmp.id)" 'DELETE' $null 200
    Check ($deactCustEmp.active -eq $false) 'admin deactivated customer login employee'
    $null = Call $suspClient '/customer/profile' 'GET' $null 403
    $null = Call $suspClient '/customer/queries' 'POST' @{subject='Blocked';category='General';question='Should fail'} 403
    $null = Call $guest2 '/login' 'POST' @{username='cust.susp.smoke';password='Nexus-Cust-2026!'} 403
    Check $true 'deactivated customer employee login rejected (403) and existing session reads/mutations blocked (403)'

    # Reactivate Employee via PUT /employees/{id} active = true -> login & mutations restored
    $reactCustEmp = Call $admin2 "/employees/$($custEmp.id)" 'PUT' @{displayName=$custEmp.displayName;role='Customer';active=$true}
    Check ($reactCustEmp.active -eq $true) 'admin reactivated customer login employee via active=true'
    $suspClient = SignIn 'Customer' 'cust.susp.smoke' 'Nexus-Cust-2026!'
    $null = Call $suspClient '/customer/profile'
    $null = Call $suspClient '/customer/queries' 'POST' @{subject='Employee Restored';category='General';question='Login active again'} 201
    Check $true 'reactivated customer employee login and self-service restored'

    $passed = $true
    Write-Host 'Smoke suite passed.'
} catch {
    Write-Host "Logs and isolated test data are in $data $(if ($data2) { "and $data2" })"
    throw
} finally {
    $env:ConnectionStrings__Demo = $previousConnection
    if ($server -and !$server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
        $null = $server.WaitForExit(3000)
    }
    if ($server2 -and !$server2.HasExited) {
        Stop-Process -Id $server2.Id -Force -ErrorAction SilentlyContinue
        $null = $server2.WaitForExit(3000)
    }
    if ($passed -and (Test-Path -LiteralPath $data)) {
        Remove-Item -LiteralPath $data -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($passed -and $data2 -and (Test-Path -LiteralPath $data2)) {
        Remove-Item -LiteralPath $data2 -Recurse -Force -ErrorAction SilentlyContinue
    }
}
