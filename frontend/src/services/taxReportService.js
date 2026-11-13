import { DEFAULT_BULK_TIERS, formatTierRange } from './bulkScheme.js'
import { STATUTORY_TAX_RATE_PERCENT, calculateStatutoryTax } from './taxConfig.js'
import {
  INITIAL_INVOICES,
  getStoredInvoices,
  calculateInvoiceTotals,
  getInvoiceRemainingBalance,
  subscribeInvoicesUpdated,
} from './billingService.js'
import { fetchOrders } from './orderService.js'

const MONTH_NAMES_BY_NUM = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Aug',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dec',
}

export function derivePeriodAndQuarter(invoice = {}) {
  const cycleText = String(invoice.billingCycle || '')
  const cycleMatch = cycleText.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  const isoCycleMatch = !cycleMatch ? cycleText.match(/(\d{4})-(\d{2})-(\d{2})/) : null
  const cycleYear = cycleMatch ? cycleMatch[3] : isoCycleMatch ? isoCycleMatch[1] : null
  const cycleMonth = cycleMatch ? cycleMatch[2] : isoCycleMatch ? isoCycleMatch[2] : null
  if (cycleYear && cycleMonth) {
    const quarterNum = Math.ceil(Number(cycleMonth) / 3)
    return {
      period: `M${cycleMonth}/${cycleYear}`,
      quarter: `Q${quarterNum}/${cycleYear}`,
      periodLabel: `${MONTH_NAMES_BY_NUM[cycleMonth] || cycleMonth} ${cycleYear}`,
    }
  }

  const issueText = String(invoice.issuedDate || invoice.issueDate || '')
  const isoMatch = issueText.match(/^(\d{4})-(\d{2})/)
  if (isoMatch) {
    const year = isoMatch[1]
    const month = isoMatch[2]
    const quarterNum = Math.ceil(Number(month) / 3)
    return {
      period: `M${month}/${year}`,
      quarter: `Q${quarterNum}/${year}`,
      periodLabel: `${MONTH_NAMES_BY_NUM[month] || month} ${year}`,
    }
  }

  return {
    period: invoice.period || 'M03/2026',
    quarter: invoice.quarter || 'Q1/2026',
    periodLabel: 'Mar 2026',
  }
}

export function normalizeTaxServiceType(rawType = '') {
  const upper = String(rawType || 'BROADBAND').trim().toUpperCase()
  if (upper === 'BROADBAND' || upper === 'FTTH') return 'BROADBAND'
  if (upper === 'LEASED_LINE' || upper === 'LEASED') return 'LEASED_LINE'
  if (upper === 'DIAL_UP' || upper === 'DIALUP') return 'DIAL_UP'
  if (upper === 'LANDLINE' || upper === 'SIP_TRUNK' || upper === 'VOIP') return 'SIP_TRUNK'
  return upper
}

export function normalizeTaxAuditStatus(status = '') {
  const upper = String(status || 'PENDING').trim().toUpperCase()
  if (upper === 'PARTIAL_PAID' || upper === 'PARTIALLY_PAID') return 'PARTIALLY_PAID'
  return upper
}

export function normalizeTaxAuditRecord(record = {}) {
  const grossSubtotal = Number(
    Number(record.grossSubtotal ?? record.taxableSubtotal ?? 0).toFixed(2)
  ) || 0
  // CN07 Bulk discounts apply strictly to Order Deposit & Advance Payment,
  // never to MRC or the monthly invoice taxable base.
  const taxableSubtotal = grossSubtotal
  const taxAmount = calculateStatutoryTax(taxableSubtotal)
  const previousBalance = Number(Number(record.previousBalance || 0).toFixed(2)) || 0
  const currentCycleTotal = Number((taxableSubtotal + taxAmount).toFixed(2))
  const totalPayable = Number((currentCycleTotal + previousBalance).toFixed(2))
  const status = normalizeTaxAuditStatus(record.status)
  const paidAmount =
    status === 'PAID'
      ? totalPayable
      : Math.min(totalPayable, Math.max(0, Number(Number(record.paidAmount || 0).toFixed(2)) || 0))
  const debtBalance =
    status === 'PAID'
      ? 0
      : record.debtBalance !== undefined
      ? Math.max(0, Number(Number(record.debtBalance).toFixed(2)) || 0)
      : Math.max(0, Number((totalPayable - paidAmount).toFixed(2)))

  return {
    ...record,
    id: record.id || record.invoiceId,
    invoiceId: record.invoiceId || record.id,
    mrcDiscountPct: 0,
    mrcDiscount: 0,
    bulkDiscount: 0,
    bulkDiscountScope: 'DEPOSIT_AND_ADVANCE_ONLY',
    grossSubtotal,
    taxableSubtotal,
    taxRate: STATUTORY_TAX_RATE_PERCENT,
    taxAmount,
    currentCycleTotal,
    previousBalance,
    totalPayable,
    paidAmount,
    debtBalance,
    status,
  }
}

export function mapInvoiceToTaxAuditRecord(invoice = {}, matchedOrder = null) {
  const totals = calculateInvoiceTotals(
    invoice.items || [],
    invoice.previousBalance || 0,
    invoice.paidAmount || 0
  )
  const status = normalizeTaxAuditStatus(invoice.status)
  const debtBalance = status === 'PAID' ? 0 : getInvoiceRemainingBalance(invoice)
  const { period, quarter, periodLabel } = derivePeriodAndQuarter(invoice)
  const accountId = String(invoice.accountId || '').trim()
  const cityCode = accountId.length >= 4 ? accountId.slice(1, 4) : invoice.cityCode || '101'

  const cn07DepositAdvanceBulkUSD = matchedOrder
    ? Number(Number(matchedOrder.bulkDiscountUSD || matchedOrder.bulkDiscountAmountUSD || 0).toFixed(2)) || 0
    : 0
  const cn07DepositAdvanceBulkPercent = matchedOrder
    ? Number(matchedOrder.bulkDiscountPercent || 0) || 0
    : 0

  return normalizeTaxAuditRecord({
    id: invoice.invoiceId,
    invoiceId: invoice.invoiceId,
    period,
    quarter,
    periodLabel,
    billingCycle: invoice.billingCycle || '',
    issueDate: invoice.issuedDate || '',
    dueDate: invoice.dueDate || '',
    customerId: invoice.customerId || matchedOrder?.customerId || '',
    customerName: invoice.customerName || 'Customer Subscription Account',
    contractId: invoice.orderId ? `#${String(invoice.orderId).replace(/^#/, '')}` : '',
    orderId: invoice.orderId || '',
    accountId,
    taxCode: invoice.taxId || invoice.taxCode || '0109998822',
    cityCode,
    serviceType: normalizeTaxServiceType(invoice.serviceType),
    rawServiceType: invoice.serviceType || 'BROADBAND',
    serviceName: invoice.serviceTitle || 'Telecom Service Subscription',
    billingSource: invoice.billingSource || 'STANDARD_BILLING',
    itemCount: Array.isArray(invoice.items) ? invoice.items.length : 0,
    grossSubtotal: totals.subtotal,
    taxableSubtotal: totals.subtotal,
    previousBalance: totals.previousBalance,
    paidAmount: totals.paidAmount,
    debtBalance,
    status,
    cn07DepositAdvanceBulkUSD,
    cn07DepositAdvanceBulkPercent,
    source: 'BILLING_INVOICE_LEDGER',
  })
}

function buildOrdersLookupMap() {
  const map = new Map()
  try {
    const rawOrders = localStorage.getItem('nexus_orders')
    const orders = rawOrders !== null ? fetchOrders() : []
    orders.forEach((order) => {
      const cleanId = String(order.orderId || order.id || '').replace(/^#/, '').trim().toUpperCase()
      if (cleanId) map.set(cleanId, order)
    })
  } catch {}
  return map
}

export const INITIAL_TAX_AUDIT_DATA = INITIAL_INVOICES.map((inv) =>
  mapInvoiceToTaxAuditRecord(inv, null)
)

export function fetchTaxAuditRecords(options = {}) {
  const invoices = getStoredInvoices()
  const ordersById = buildOrdersLookupMap()

  const mapped = invoices.map((inv) => {
    const cleanOrderKey = String(inv.orderId || '').replace(/^#/, '').trim().toUpperCase()
    const matchedOrder = cleanOrderKey ? ordersById.get(cleanOrderKey) || null : null
    return mapInvoiceToTaxAuditRecord(inv, matchedOrder)
  })

  const { period, serviceType, status, accountId } = options
  return mapped.filter((rec) => {
    if (period && period !== 'ALL' && rec.period !== period && rec.quarter !== period) {
      return false
    }
    if (serviceType && serviceType !== 'ALL' && rec.serviceType !== normalizeTaxServiceType(serviceType)) {
      return false
    }
    if (status && status !== 'ALL' && rec.status !== normalizeTaxAuditStatus(status)) {
      return false
    }
    if (accountId && rec.accountId !== accountId) {
      return false
    }
    return true
  })
}

export function getTaxPeriodOptions(records = []) {
  const quarters = Array.from(new Set(records.map((r) => r.quarter).filter(Boolean))).sort()
  const periods = Array.from(new Set(records.map((r) => r.period).filter(Boolean))).sort()
  return { quarters, periods }
}

export function reconcileTaxLedgerWithBilling(records = null) {
  const rows = Array.isArray(records) ? records : fetchTaxAuditRecords()
  return rows.reduce(
    (acc, r) => {
      acc.invoiceCount += 1
      acc.grossBillingSubtotal = Number((acc.grossBillingSubtotal + (r.grossSubtotal || 0)).toFixed(2))
      acc.netTaxableBase = Number((acc.netTaxableBase + (r.taxableSubtotal || 0)).toFixed(2))
      acc.totalStatutoryTax = Number((acc.totalStatutoryTax + (r.taxAmount || 0)).toFixed(2))
      acc.previousArrearsTotal = Number((acc.previousArrearsTotal + (r.previousBalance || 0)).toFixed(2))
      acc.totalPayableLedger = Number((acc.totalPayableLedger + (r.totalPayable || 0)).toFixed(2))
      acc.collectedTotal = Number((acc.collectedTotal + (r.paidAmount || 0)).toFixed(2))
      acc.outstandingDebt = Number((acc.outstandingDebt + (r.debtBalance || 0)).toFixed(2))
      return acc
    },
    {
      invoiceCount: 0,
      grossBillingSubtotal: 0,
      netTaxableBase: 0,
      totalStatutoryTax: 0,
      previousArrearsTotal: 0,
      totalPayableLedger: 0,
      collectedTotal: 0,
      outstandingDebt: 0,
      bulkDiscountDeductedFromMrc: 0,
      taxRatePercent: STATUTORY_TAX_RATE_PERCENT,
    }
  )
}

export function subscribeTaxAuditUpdates(callback) {
  return subscribeInvoicesUpdated(callback)
}

export const BULK_SCHEME_TIERS = DEFAULT_BULK_TIERS.map((tier) => ({
  id: tier.id,
  tier: tier.tier,
  range: formatTierRange(tier),
  minEndpoints: tier.minEndpoints,
  maxEndpoints: tier.maxEndpoints,
  discountPercent: tier.discountPercent,
  discountScope: 'DEPOSIT_AND_ADVANCE_ONLY',
  discountRate:
    tier.discountPercent >= 100
      ? '100% Deposit & Advance Waiver'
      : `${Number(tier.discountPercent).toFixed(1)}% Deposit & Advance`,
  benefitScopeNote: tier.benefit,
}))
