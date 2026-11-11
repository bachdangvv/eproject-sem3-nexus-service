# Run with PowerShell 7 after dotnet build. Each run uses its own SQLite database.
param([int]$Port = 5179)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$data = Join-Path $project ('data/smoke-' + [Guid]::NewGuid().ToString('N'))
New-Item -Path $data -ItemType Directory | Out-Null
$dll = Join-Path $project 'Nexus.Api/bin/Debug/net10.0/Nexus.Api.dll'
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
        SkipHttpErrorCheck = $true
        TimeoutSec = 15
    }
    if ($method -ne 'GET' -and $client.Token) {
        $parameters.Headers = @{ 'X-CSRF-Token' = $client.Token }
    }
    if ($null -ne $body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = ConvertTo-Json -InputObject $body -Compress
    }
    $result = Invoke-WebRequest @parameters
    $content = $result.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    if ($result.StatusCode -ne $expected) {
        throw "$method $path returned $($result.StatusCode), expected $expected. $content"
    }
    if ($content) { return ConvertFrom-Json -InputObject $content }
}

function SignIn([string]$role) {
    $client = @{ Cookies = [Microsoft.PowerShell.Commands.WebRequestSession]::new(); Token = $null }
    $client.Token = (Call $client '/session').csrfToken
    Call $client '/login' 'POST' @{username="$($role.ToLowerInvariant()).demo";password='Nexus-Demo-2026!'} 204
    $session = Call $client '/session'
    Check ($session.role -eq $role) "login $role"
    $client.Token = $session.csrfToken
    return $client
}

try {
    $env:ConnectionStrings__Demo = "Data Source=$(Join-Path $data 'smoke.db');Foreign Keys=True"
    $server = Start-Process -FilePath 'dotnet' -ArgumentList @("`"$dll`"", '--demo', '--urls', $origin) `
        -WorkingDirectory (Join-Path $project 'Nexus.Api') -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $data 'server.log') -RedirectStandardError (Join-Path $data 'error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($server.HasExited) { throw "Server exited. See $data." }
        try {
            $response = Invoke-WebRequest "$origin/api/session" -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 400 }
    }
    Check $ready 'fresh migration and seed'
    $guest = @{ Cookies = [Microsoft.PowerShell.Commands.WebRequestSession]::new(); Token = $null }
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

    $customerPayload = @{name='Nguyễn Văn A';phone='0900000001';address='10 Nexus Street';cityCode='101'}
    $invalidCustomer = $customerPayload.Clone()
    $invalidCustomer.phone = 'invalid'
    $null = Call $retail '/customers' 'POST' $invalidCustomer 400
    $customer = Call $retail '/customers' 'POST' $customerPayload 201
    $customerPayload.address = '12 Nexus Street'
    $customer = Call $retail "/customers/$($customer.id)" 'PUT' $customerPayload
    $byCode = @(Call $retail "/customers?q=$($customer.code)")
    $byName = @(Call $retail ("/customers?q=" + [uri]::EscapeDataString('NGUYỄN')))
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
    $null = Call $retail "$route/feedback" 'POST' @{rating=5;comment='Kết nối hoạt động ổn định.'} 201
    Check ((Call $retail $route).feedback[0].rating -eq 5) 'feedback saved on the connected order'

    $dialRequest = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$dial.id;hasNexusLandline=$false} 201
    $dialOrder = Call $retail "/requests/$($dialRequest.id)/confirm" 'POST' $null 201
    $dialRoute = "/orders/$($dialOrder.code)"
    $null = Call $technical "$dialRoute/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true} 400
    $null = Call $technical "$dialRoute/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true;landlineFeasible=$false} 400
    $rejected = Call $technical "$dialRoute/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true;landlineFeasible=$false;note='No line available.'}
    $null = Call $technical "$dialRoute/connection" 'POST' $null 409
    $null = Call $retail "$dialRoute/feedback" 'POST' @{rating=5;comment='Too early'} 409
    Check ($rejected.status -eq 'NotFeasible' -and $dialOrder.code -ceq 'D0000000002') 'Dial-up landline check, rejection and second serial'
    Write-Host 'Smoke suite passed.'
} catch {
    Write-Host "Logs and isolated test data are in $data"
    throw
} finally {
    $env:ConnectionStrings__Demo = $previousConnection
    if ($server -and !$server.HasExited) { Stop-Process -Id $server.Id }
}
