# Dot-sourced by smoke.ps1 after advance-scenarios.ps1. Real HTTP requests and the run's isolated database.
$historyClient = @{Cookies=(New-Object Microsoft.PowerShell.Commands.WebRequestSession);Token=$null}
$historyClient.Token = (Call $historyClient '/session').csrfToken
$historyOwner = Call $historyClient '/register' 'POST' @{name='History Smoke Customer';phone='0900000085';address='85 History Street';cityCode='101';username='history.smoke';password='Nexus-History-2026!'} 201
$historyClient.Token = (Call $historyClient '/session').csrfToken
$historyRequest = Call $retail '/requests' 'POST' @{customerId=$historyOwner.customerId;planId=$advancePlan.id;connectionCount=1;hasNexusLandline=$false} 201
$historyOrder = Call $retail "/requests/$($historyRequest.id)/confirm" 'POST' $null 201
$null = Call $technical "/orders/$($historyOrder.code)/assessment" 'POST' @{distanceOk=$true;serverAvailable=$true}
$null = Call $retail "/advances/$($historyOrder.code)/collections" 'POST' (New-DepositMoney 80 'History scenario advance receipt')
$null = Collect-OrderDeposit $retail $historyOrder.code
$historyConnection = Call $technical "/orders/$($historyOrder.code)/connection" 'POST' $null 201
$historyAccount = $historyConnection.accountId
$historyRoute = "/billing/accounts/$historyAccount"
$historyFirstBill = Call $billing $historyRoute 'POST'
$null = Call $billing "/advances/$($historyOrder.code)/allocations" 'POST' (New-AdvanceAllocation $historyFirstBill.invoiceId 30)
$null = Call $retail "/retail/billing/accounts/$historyAccount/payment" 'POST' @{amount=40;note='H-RETAIL-001 actual receipt recorded in isolated test'}
$null = Call $billing "$historyRoute/payment" 'POST' @{amount=20;note='H-OFFICE-001 actual receipt recorded in isolated test'}
$historyPaid = Call $historyClient "/customer/billing/$historyAccount/payments" 'POST' @{invoiceId=$historyFirstBill.invoiceId;amount=10;note='H-PORTAL-001 recorded via customer endpoint'} 201
Check ($historyPaid.payments.Count -eq 4 -and $historyPaid.paidAmount -eq 100 -and $historyPaid.dueAmount -eq 152.54 -and
    @($historyPaid.payments.channel | Select-Object -Unique).Count -eq 4) 'history H01 four persisted payment channels, paid 100 and due 152.54'
$historyIds = @($historyPaid.payments.id | Sort-Object)
$historyRolled = Call $billing $historyRoute 'POST' @{periodStart='2027-05-01T00:00:00Z';periodEnd='2027-06-01T00:00:00Z'}
Check ($historyRolled.paidAmount -eq 0 -and $historyRolled.previousDueBalance -eq 152.54 -and $historyRolled.totalAmount -eq 405.08 -and
    $historyRolled.payments.Count -eq 4 -and @($historyRolled.payments | Where-Object invoiceStatus -eq 'RolledOver').Count -eq 4 -and
    (@($historyRolled.payments.id | Sort-Object) -join ',') -eq ($historyIds -join ',')) 'history H02 rollover retains original IDs and history while current invoice paid resets to zero'
$historyRetail = Call $retail "/retail/billing/accounts/$historyAccount"
$historyList = @(Call $billing "/billing/accounts?q=$historyAccount")[0]
$historyOwned = @(Call $historyClient '/customer/billing' | Where-Object accountId -eq $historyAccount)[0]
Check ($historyRetail.payments.Count -eq 4 -and $historyList.payments.Count -eq 4 -and $historyOwned.payments.Count -eq 4) 'history H03 retail, billing list/detail and customer see the same all-period history'
$retailHistoryReceipt = @($historyRetail.payments | Where-Object channel -eq 'RetailOutlet')[0]
Check ($retailHistoryReceipt.retailShopId -gt 0 -and $retailHistoryReceipt.retailShopName -and
    $retailHistoryReceipt.paidByUsername -eq 'retail.demo' -and $retailHistoryReceipt.paidByDisplayName -and
    $retailHistoryReceipt.receiptCode -match '^PAY-\d{10,}$' -and $retailHistoryReceipt.invoiceNumber -eq $historyFirstBill.invoiceNumber) 'history H04 persisted outlet, actual collector, invoice and internal payment code'
$null = Call $billing "$historyRoute/payment" 'POST' @{amount=406;note='Should not silently truncate'} 409
$historyCurrent = Call $billing "$historyRoute/payment" 'POST' @{amount=25;note='H-OFFICE-002 new-period payment'}
Check ($historyCurrent.payments.Count -eq 5 -and ($historyCurrent.payments | Measure-Object amount -Sum).Sum -eq 125 -and
    $historyCurrent.paidAmount -eq 25 -and $historyCurrent.dueAmount -eq 380.08) 'history H05 rejected overpayment adds nothing; historical total 125 differs from current paid 25'
$historyThird = Call $billing $historyRoute 'POST' @{periodStart='2027-06-01T00:00:00Z';periodEnd='2027-07-01T00:00:00Z'}
Check ($historyThird.payments.Count -eq 5 -and $historyThird.paidAmount -eq 0 -and $historyThird.totalAmount -eq 632.62 -and
    ($historyThird.payments | Measure-Object amount -Sum).Sum -eq 125) 'history H06 third period retains receipts without paying carried debt twice'
Check (@(Call $regClient '/customer/billing' | Where-Object accountId -eq $historyAccount).Count -eq 0) 'history H07 another customer cannot see this history'
$null = Call $historyClient $historyRoute 'GET' $null 403
$null = Call $technical "/technical/connections/$historyAccount/terminate" 'POST' @{note='Close payment-history scenario'}
$null = Call $billing "/advances/$($historyOrder.code)/refunds" 'POST' (New-DepositMoney 50 'Unused advance refund is not a service payment')
$null = Call $billing "/deposits/$($historyOrder.code)/refunds" 'POST' (New-DepositMoney 500 'Deposit refund is not a service payment')
$historyAfterRefund = Call $billing $historyRoute
Check ($historyAfterRefund.payments.Count -eq 5 -and $historyAfterRefund.dueAmount -eq 632.62 -and
    ($historyAfterRefund.payments | Measure-Object amount -Sum).Sum -eq 125) 'history H08 refunds and advance receipts stay in separate ledgers; actual allocations appear once'
