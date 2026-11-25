# Invoked by smoke.ps1 against its isolated SQLite database and authenticated demo sessions.
function New-DepositOrder([int]$count = 1) {
    $request = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$bb.id;connectionCount=$count;hasNexusLandline=$false} 201
    return Call $retail "/requests/$($request.id)/confirm" 'POST' $null 201
}

function New-DepositMoney([decimal]$amount, [string]$reason) {
    return @{amount=$amount;operationId=[Guid]::NewGuid().ToString();method='Cash';reference=('DEPOSIT-' + [Guid]::NewGuid().ToString('N'));note=$reason}
}

# Send both HTTP requests before awaiting either, using the real authenticated API and database.
function Concurrent-DepositPosts($client, [string]$route, $first, $second) {
    Add-Type -AssemblyName System.Net.Http
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.CookieContainer = $client.Cookies.Cookies
    $http = New-Object System.Net.Http.HttpClient($handler)
    $http.DefaultRequestHeaders.Add('X-CSRF-Token', $client.Token)
    $contents = @()
    try {
        $pending = @()
        foreach ($body in @($first, $second)) {
            $content = New-Object System.Net.Http.StringContent((ConvertTo-Json -InputObject $body -Compress), [Text.Encoding]::UTF8, 'application/json')
            $contents += $content
            $pending += $http.PostAsync("$origin/api$route", $content)
        }
        foreach ($task in $pending) {
            $response = $task.GetAwaiter().GetResult()
            try { [int]$response.StatusCode } finally { $response.Dispose() }
        }
    } finally {
        foreach ($content in $contents) { $content.Dispose() }
        $http.Dispose()
    }
}

$unpaidOrder = New-DepositOrder
$unpaidLedger = Call $retail "/deposits/$($unpaidOrder.code)"
Check ($unpaidLedger.requiredAmount -eq 500 -and $unpaidLedger.collectedAmount -eq 0 -and $unpaidLedger.balance -eq 0) 'deposit D01 quote is an obligation, not received money'
$null = Call $retail "/deposits/$($unpaidOrder.code)/collections" 'POST' (New-DepositMoney 100 'Before feasibility') 409
$null = Call $retail "/orders/$($unpaidOrder.code)/cancel" 'POST' @{reason='Customer withdrew before feasibility'}
$null = Call $technical "/orders/$($unpaidOrder.code)/connection" 'POST' $null 409
$null = Call $technical "/orders/$($unpaidOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true} 409
$null = Call $billing "/deposits/$($unpaidOrder.code)/refunds" 'POST' (New-DepositMoney 1 'No receipt exists') 409
Check $true 'deposit D02 unpaid cancelled order cannot activate, assess or receive invented refund'

$partialOrder = New-DepositOrder
$null = Call $technical "/orders/$($partialOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
$partialInput = New-DepositMoney 200 'First partial deposit receipt'
$partialLedger = Call $retail "/deposits/$($partialOrder.code)/collections" 'POST' $partialInput
$replayed = Call $retail "/deposits/$($partialOrder.code)/collections" 'POST' $partialInput
Check ($partialLedger.status -eq 'PartiallyCollected' -and $partialLedger.balance -eq 200 -and $partialLedger.remainingToCollect -eq 300 -and $replayed.transactions.Count -eq 1) 'deposit D03 partial receipt and retry create exactly one transaction'
$changedInput = $partialInput.Clone(); $changedInput.amount = 201
$null = Call $retail "/deposits/$($partialOrder.code)/collections" 'POST' $changedInput 409
$duplicateReceipt = $partialInput.Clone(); $duplicateReceipt.operationId = [Guid]::NewGuid().ToString()
$null = Call $retail "/deposits/$($partialOrder.code)/collections" 'POST' $duplicateReceipt 409
$null = Call $billing "/deposits/$($partialOrder.code)/collections" 'POST' (New-DepositMoney 301 'Over collection') 409
$null = Call $technical "/orders/$($partialOrder.code)/connection" 'POST' $null 409
$null = Call $retail "/orders/$($partialOrder.code)/cancel" 'POST' @{reason='Customer cancels after partial receipt'}
$firstRefund = New-DepositMoney 100 'Partial cancellation refund'
$null = Call $retail "/deposits/$($partialOrder.code)/refunds" 'POST' $firstRefund 403
$null = Call $technical "/deposits/$($partialOrder.code)/refunds" 'POST' $firstRefund 403
$null = Call $admin "/deposits/$($partialOrder.code)/refunds" 'POST' $firstRefund 403
$refundPart = Call $billing "/deposits/$($partialOrder.code)/refunds" 'POST' $firstRefund
$refundReplay = Call $billing "/deposits/$($partialOrder.code)/refunds" 'POST' $firstRefund
Check ($refundPart.balance -eq 100 -and $refundPart.refundedAmount -eq 100 -and $refundReplay.transactions.Count -eq 2) 'deposit D04 Billing refunds actual receipts only; partial refund retry is safe'
$null = Call $billing "/deposits/$($partialOrder.code)/refunds" 'POST' (New-DepositMoney 101 'Over refund') 409
$refundRest = Call $billing "/deposits/$($partialOrder.code)/refunds" 'POST' (New-DepositMoney 100 'Remaining cancellation refund')
Check ($refundRest.status -eq 'Refunded' -and $refundRest.refundedAmount -eq 200 -and $refundRest.balance -eq 0) 'deposit D05 cancellation returns 200 actually received, never the quoted 500'

$fullOrder = New-DepositOrder
$null = Call $technical "/orders/$($fullOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
$null = Collect-OrderDeposit $billing $fullOrder.code
$active = Call $technical "/orders/$($fullOrder.code)/connection" 'POST' $null 201
$null = Call $retail "/orders/$($fullOrder.code)/cancel" 'POST' @{reason='Wrong closure operation'} 409
$null = Call $billing "/billing/accounts/$($active.accountId)" 'POST' @{includeDeposit=$true} 400
$serviceBill = Call $billing "/billing/accounts/$($active.accountId)" 'POST'
Check ($serviceBill.totalAmount -eq 252.54 -and $serviceBill.depositAmount -eq 0) 'deposit D06 full receipt enables activation; service invoice never bills deposit again'
$null = Call $technical '/technical/incidents' 'POST' @{accountId=$active.accountId;productId=$invProduct.id;description='Damage after activation';replacementFee=10} 201
$null = Call $technical "/technical/connections/$($active.accountId)/suspend" 'POST' @{reason='Temporary break'}
$null = Call $billing "/deposits/$($fullOrder.code)/refunds" 'POST' (New-DepositMoney 500 'Premature refund') 409
$null = Call $technical "/technical/connections/$($active.accountId)/reactivate" 'POST'
$terminated = Call $technical "/technical/connections/$($active.accountId)/terminate" 'POST' @{note='Permanent withdrawal with unpaid bill and damage'}
Check ($terminated.refundAmount -eq 500 -and $terminated.refundStatus -eq 'Pending') 'deposit D07 termination refunds full held balance; no automatic debt or damage offset'
$fullRefundInput = New-DepositMoney 500 'Return held security deposit'
$null = Call $billing "/deposits/$($fullOrder.code)/refunds" 'POST' $fullRefundInput
$fullReplay = Call $billing "/deposits/$($fullOrder.code)/refunds" 'POST' $fullRefundInput
$afterRefundBill = Call $billing "/billing/accounts/$($active.accountId)"
Check ($fullReplay.balance -eq 0 -and $fullReplay.transactions.Count -eq 2 -and $afterRefundBill.dueAmount -eq 252.54) 'deposit D08 disbursement is idempotent and outstanding service debt remains unchanged'

$waivedOrder = New-DepositOrder 51
$null = Call $technical "/orders/$($waivedOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
$waived = Call $billing "/deposits/$($waivedOrder.code)"
$waivedActive = Call $technical "/orders/$($waivedOrder.code)/connection" 'POST' $null 201
$waivedClosed = Call $technical "/technical/connections/$($waivedActive.accountId)/terminate" 'POST' @{note='Waived deposit withdrawal'}
Check ($waived.status -eq 'Waived' -and $waived.transactions.Count -eq 0 -and $waivedClosed.refundAmount -eq 0) 'deposit D09 51-line waiver activates without fake receipt and has no refundable money'

$raceOrder = New-DepositOrder
$null = Call $technical "/orders/$($raceOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
$raceInput1 = New-DepositMoney 500 'Concurrent receipt A'
$raceInput2 = New-DepositMoney 500 'Concurrent receipt B'
$raceStatuses = @(Concurrent-DepositPosts $retail "/deposits/$($raceOrder.code)/collections" $raceInput1 $raceInput2)
$raceLedger = Call $billing "/deposits/$($raceOrder.code)"
Check (@($raceStatuses | Where-Object {$_ -eq 200}).Count -eq 1 -and @($raceStatuses | Where-Object {$_ -eq 409}).Count -eq 1 -and
    $raceLedger.collectedAmount -eq 500 -and $raceLedger.transactions.Count -eq 1) 'deposit D10 concurrent receipts cannot over-collect'
$raceActive = Call $technical "/orders/$($raceOrder.code)/connection" 'POST' $null 201
$null = Call $technical "/technical/connections/$($raceActive.accountId)/terminate" 'POST' @{note='Concurrency refund check'}
$raceRefund1 = New-DepositMoney 500 'Concurrent refund A'
$raceRefund2 = New-DepositMoney 500 'Concurrent refund B'
$refundStatuses = @(Concurrent-DepositPosts $billing "/deposits/$($raceOrder.code)/refunds" $raceRefund1 $raceRefund2)
$raceLedger = Call $billing "/deposits/$($raceOrder.code)"
Check (@($refundStatuses | Where-Object {$_ -eq 200}).Count -eq 1 -and @($refundStatuses | Where-Object {$_ -eq 409}).Count -eq 1 -and
    $raceLedger.refundedAmount -eq 500 -and $raceLedger.balance -eq 0 -and $raceLedger.transactions.Count -eq 2) 'deposit D11 concurrent refunds cannot disburse twice'

$replayOrder = New-DepositOrder
$null = Call $technical "/orders/$($replayOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
$sameReceipt = New-DepositMoney 200 'Same operation concurrently'
$sameStatuses = @(Concurrent-DepositPosts $retail "/deposits/$($replayOrder.code)/collections" $sameReceipt $sameReceipt)
$sameLedger = Call $billing "/deposits/$($replayOrder.code)"
Check (@($sameStatuses | Where-Object {$_ -eq 200}).Count -eq 2 -and $sameLedger.collectedAmount -eq 200 -and $sameLedger.transactions.Count -eq 1) 'deposit D12 concurrent retries of the same operation return one receipt'

$ownDeposits = @(Call $regClient '/customer/deposits')
$null = Call $regClient "/deposits/$($fullOrder.code)" 'GET' $null 403
$null = Call $regClient "/deposits/$($fullOrder.code)/collections" 'POST' (New-DepositMoney 1 'Customer cannot confirm cash') 403
Check ($ownDeposits.Count -ge 1 -and @($ownDeposits | Where-Object orderId -eq $fullOrder.code).Count -eq 0) 'deposit D13 customer sees only own ledger and cannot confirm staff cash transactions'
