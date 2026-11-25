# Invoked by smoke.ps1 after deposit-scenarios.ps1, reusing its isolated DB, roles and HTTP helpers.
$advancePlanInput = @{name='Advance Test Broadband';type='B';description='Explicit test policy, not a price supplied by the specification';price=225;active=$true;advancePerConnection=100}
$advancePlan = Call $admin '/plans' 'POST' $advancePlanInput 201
$invalidAdvancePlan = $advancePlanInput.Clone(); $invalidAdvancePlan.advancePerConnection = 0.001
$null = Call $admin '/plans' 'POST' $invalidAdvancePlan 400
$invalidAdvancePlan.advancePerConnection = -1
$null = Call $admin '/plans' 'POST' $invalidAdvancePlan 400
Check ((@(Call $guest '/public/plans') | Where-Object id -eq $advancePlan.id).advancePerConnection -eq 100) 'advance V01 Admin config and public quote share policy; invalid precision/negative values rejected'

function New-AdvanceOrder([int]$count = 10, [int]$planId = $advancePlan.id, [bool]$assess = $true) {
    $request = Call $retail '/requests' 'POST' @{customerId=$customer.id;planId=$planId;connectionCount=$count;hasNexusLandline=$false} 201
    $order = Call $retail "/requests/$($request.id)/confirm" 'POST' $null 201
    if ($assess) { $null = Call $technical "/orders/$($order.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true} }
    return $order
}
function New-AdvanceAllocation([long]$invoiceId, [decimal]$amount) {
    return @{invoiceId=$invoiceId;amount=$amount;operationId=[Guid]::NewGuid().ToString();reference=('ALLOC-' + [Guid]::NewGuid().ToString('N'));note='Explicit test invoice allocation'}
}

$advanceOrder = New-AdvanceOrder 10 $advancePlan.id $false
$advanceQuote = Call $billing "/advances/$($advanceOrder.code)"
Check ($advanceQuote.quotedAmount -eq 750 -and $advanceQuote.grossAmount -eq 1000 -and $advanceQuote.availableAmount -eq 0) 'advance V02 bulk waiver reduces upfront quote, not full rent and not actual credit'
$null = Call $retail "/advances/$($advanceOrder.code)/collections" 'POST' (New-DepositMoney 100 'Before feasibility') 409
$null = Call $technical "/orders/$($advanceOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}

$changedPolicy = $advancePlanInput.Clone(); $changedPolicy.advancePerConnection = 200
$null = Call $admin "/plans/$($advancePlan.id)" 'PUT' $changedPolicy
$laterOrder = New-AdvanceOrder
$laterQuote = Call $billing "/advances/$($laterOrder.code)"
$unchangedQuote = Call $billing "/advances/$($advanceOrder.code)"
Check ($laterQuote.quotedAmount -eq 1500 -and $unchangedQuote.quotedAmount -eq 750) 'advance V03 Admin edits affect future confirmations, not prior snapshots'
$null = Call $admin "/plans/$($advancePlan.id)" 'PUT' $advancePlanInput

$advanceReceipt = New-DepositMoney 300 'First advance receipt'
$null = Call $technical "/advances/$($advanceOrder.code)/collections" 'POST' $advanceReceipt 403
$null = Call $admin "/advances/$($advanceOrder.code)/collections" 'POST' $advanceReceipt 403
$receivedAdvance = Call $retail "/advances/$($advanceOrder.code)/collections" 'POST' $advanceReceipt
$receivedRetry = Call $retail "/advances/$($advanceOrder.code)/collections" 'POST' $advanceReceipt
$differentReceipt = $advanceReceipt.Clone(); $differentReceipt.amount=301
$null = Call $retail "/advances/$($advanceOrder.code)/collections" 'POST' $differentReceipt 409
$null = Call $billing "/advances/$($advanceOrder.code)/collections" 'POST' (New-DepositMoney 451 'Over quote') 409
$null = Call $billing "/advances/$($advanceOrder.code)/collections" 'POST' (New-DepositMoney 450 'Remaining advance receipt')
Check ($receivedAdvance.availableAmount -eq 300 -and $receivedRetry.transactions.Count -eq 1) 'advance V04 partial receipt, retry and collection cap preserve actual cash'
$null = Call $technical "/orders/$($advanceOrder.code)/connection" 'POST' $null 409
$depositBefore = Collect-OrderDeposit $retail $advanceOrder.code
$advanceConnection = Call $technical "/orders/$($advanceOrder.code)/connection" 'POST' $null 201
$advanceBill = Call $billing "/billing/accounts/$($advanceConnection.accountId)" 'POST'
Check ($depositBefore.collectedAmount -eq 3750 -and $advanceBill.totalAmount -eq 2525.40 -and $advanceBill.paidAmount -eq 0) 'advance V05 advance does not substitute for deposit or automatically discount/pay service charges'

$allocation = New-AdvanceAllocation $advanceBill.invoiceId 500
$null = Call $retail "/advances/$($advanceOrder.code)/allocations" 'POST' $allocation 403
$null = Call $technical "/advances/$($advanceOrder.code)/allocations" 'POST' $allocation 403
$allocatedAdvance = Call $billing "/advances/$($advanceOrder.code)/allocations" 'POST' $allocation
$allocationRetry = Call $billing "/advances/$($advanceOrder.code)/allocations" 'POST' $allocation
$duplicateAllocation = $allocation.Clone(); $duplicateAllocation.operationId=[Guid]::NewGuid().ToString(); $duplicateAllocation.amount=100
$null = Call $billing "/advances/$($advanceOrder.code)/allocations" 'POST' $duplicateAllocation 409
$allocatedBill = Call $billing "/billing/accounts/$($advanceConnection.accountId)"
Check ($allocatedAdvance.availableAmount -eq 250 -and $allocationRetry.transactions.Count -eq 3 -and
    $allocatedBill.totalAmount -eq 2525.40 -and $allocatedBill.taxAmount -eq 275.40 -and $allocatedBill.paidAmount -eq 500 -and
    $allocatedBill.dueAmount -eq 2025.40 -and @($allocatedBill.payments | Where-Object channel -eq 'Advance').Count -eq 1) 'advance V06 explicit allocation/retry creates one payment and leaves charges/tax unchanged'
$foreignAllocation = New-AdvanceAllocation $firstBulkBill.invoiceId 1
$null = Call $billing "/advances/$($advanceOrder.code)/allocations" 'POST' $foreignAllocation 404
$nextAdvanceBill = Call $billing "/billing/accounts/$($advanceConnection.accountId)" 'POST' @{periodStart='2027-03-01T00:00:00Z';periodEnd='2027-04-01T00:00:00Z'}
$null = Call $billing "/advances/$($advanceOrder.code)/allocations" 'POST' (New-AdvanceAllocation $advanceBill.invoiceId 1) 409
$null = Call $billing "/advances/$($advanceOrder.code)/allocations" 'POST' (New-AdvanceAllocation $nextAdvanceBill.invoiceId 250)
$rolledAdvanceBill = Call $billing "/billing/accounts/$($advanceConnection.accountId)"
Check ($rolledAdvanceBill.totalAmount -eq 4550.80 -and $rolledAdvanceBill.dueAmount -eq 4300.80 -and
    (Call $billing "/advances/$($advanceOrder.code)").availableAmount -eq 0) 'advance V07 rollover carries only remaining debt; old advance is not spent twice'

$partialCancelAdvance = New-AdvanceOrder 1
$null = Call $retail "/advances/$($partialCancelAdvance.code)/collections" 'POST' (New-DepositMoney 30 'Partial advance before cancellation')
$null = Call $billing "/advances/$($partialCancelAdvance.code)/refunds" 'POST' (New-DepositMoney 30 'Open order refund') 409
$null = Call $retail "/orders/$($partialCancelAdvance.code)/cancel" 'POST' @{reason='Customer cancels optional advance order'}
$null = Call $billing "/advances/$($partialCancelAdvance.code)/refunds" 'POST' (New-DepositMoney 31 'Over refund') 409
$unusedRefundInput = New-DepositMoney 30 'Unused advance cancellation refund'
$null = Call $billing "/advances/$($partialCancelAdvance.code)/refunds" 'POST' $unusedRefundInput
$unusedRefundRetry = Call $billing "/advances/$($partialCancelAdvance.code)/refunds" 'POST' $unusedRefundInput
Check ($unusedRefundRetry.refundedAmount -eq 30 -and $unusedRefundRetry.availableAmount -eq 0 -and $unusedRefundRetry.transactions.Count -eq 2) 'advance V08 cancellation refunds only actual unused 30; retry cannot refund quoted 100'

$noPolicyOrder = New-AdvanceOrder 1 $bb.id
$null = Call $retail "/advances/$($noPolicyOrder.code)/collections" 'POST' (New-DepositMoney 1 'Unconfigured collection') 409
$null = Collect-OrderDeposit $retail $noPolicyOrder.code
$null = Call $technical "/orders/$($noPolicyOrder.code)/connection" 'POST' $null 201
Check ((Call $billing "/advances/$($noPolicyOrder.code)").status -eq 'NotConfigured') 'advance V09 unconfigured policy adds no invented charge or activation prerequisite'

$waivedAdvanceOrder = New-AdvanceOrder 51
$waivedAdvance = Call $billing "/advances/$($waivedAdvanceOrder.code)"
$null = Call $technical "/orders/$($waivedAdvanceOrder.code)/connection" 'POST' $null 201
Check ($waivedAdvance.status -eq 'Waived' -and $waivedAdvance.availableAmount -eq 0 -and $waivedAdvance.transactions.Count -eq 0) 'advance V10 100-percent waiver is zero receipt and zero spendable credit'

$raceAdvance = New-AdvanceOrder 1
$raceStatuses = @(Concurrent-DepositPosts $retail "/advances/$($raceAdvance.code)/collections" (New-DepositMoney 100 'Concurrent advance A') (New-DepositMoney 100 'Concurrent advance B'))
$raceCredit = Call $billing "/advances/$($raceAdvance.code)"
Check (@($raceStatuses | Where-Object {$_ -eq 200}).Count -eq 1 -and @($raceStatuses | Where-Object {$_ -eq 409}).Count -eq 1 -and
    $raceCredit.receivedAmount -eq 100 -and $raceCredit.transactions.Count -eq 1) 'advance V11 concurrent receipts cannot exceed the quote'
$null = Collect-OrderDeposit $retail $raceAdvance.code
$raceAdvanceConnection = Call $technical "/orders/$($raceAdvance.code)/connection" 'POST' $null 201
$raceAdvanceBill = Call $billing "/billing/accounts/$($raceAdvanceConnection.accountId)" 'POST'
$null = Call $technical "/technical/connections/$($raceAdvanceConnection.accountId)/terminate" 'POST' @{note='Concurrent advance disposal'}

# Compete an allocation with a refund using one shared credit balance.
function Concurrent-AdvanceDisposal($allocateBody, $refundBody) {
    $handler = New-Object System.Net.Http.HttpClientHandler; $handler.CookieContainer=$billing.Cookies.Cookies
    $http = New-Object System.Net.Http.HttpClient($handler); $http.DefaultRequestHeaders.Add('X-CSRF-Token',$billing.Token)
    $a=New-Object System.Net.Http.StringContent((ConvertTo-Json -InputObject $allocateBody -Compress),[Text.Encoding]::UTF8,'application/json')
    $r=New-Object System.Net.Http.StringContent((ConvertTo-Json -InputObject $refundBody -Compress),[Text.Encoding]::UTF8,'application/json')
    try {
        $one=$http.PostAsync("$origin/api/advances/$($raceAdvance.code)/allocations",$a)
        $two=$http.PostAsync("$origin/api/advances/$($raceAdvance.code)/refunds",$r)
        foreach($task in @($one,$two)) { $response=$task.GetAwaiter().GetResult(); try { [int]$response.StatusCode } finally { $response.Dispose() } }
    } finally { $a.Dispose();$r.Dispose();$http.Dispose() }
}
$disposalStatuses=@(Concurrent-AdvanceDisposal (New-AdvanceAllocation $raceAdvanceBill.invoiceId 80) (New-DepositMoney 80 'Concurrent unused refund'))
$disposedCredit=Call $billing "/advances/$($raceAdvance.code)"
$disposedBill=Call $billing "/billing/accounts/$($raceAdvanceConnection.accountId)"
Check (@($disposalStatuses | Where-Object {$_ -eq 200}).Count -eq 1 -and @($disposalStatuses | Where-Object {$_ -eq 409}).Count -eq 1 -and
    $disposedCredit.availableAmount -eq 20 -and ($disposedCredit.allocatedAmount + $disposedCredit.refundedAmount) -eq 80 -and
    $disposedBill.paidAmount -eq $disposedCredit.allocatedAmount) 'advance V12 allocation versus refund cannot spend the same credit twice; invoice payment matches committed allocation'

$ownAdvanceViews=@(Call $regClient '/customer/advances')
$null=Call $regClient "/advances/$($advanceOrder.code)" 'GET' $null 403
$null=Call $regClient "/advances/$($advanceOrder.code)/collections" 'POST' (New-DepositMoney 1 'Customer cannot confirm cash') 403
Check ($ownAdvanceViews.Count -ge 1 -and @($ownAdvanceViews | Where-Object orderId -eq $advanceOrder.code).Count -eq 0) 'advance V13 Customer reads only owned credit and cannot mutate staff transactions'
