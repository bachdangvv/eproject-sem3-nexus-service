import {
  fetchDebtAccounts,
  unsuspendCircuit,
  syncDebtAccountPayment,
  syncDebtAccountInvoiceBalance,
} from './debtService.js'
import { getActivatedAccounts } from './activationService.js'
import { fetchPlans, normalizePlanConnectionType } from './planService.js'
import { STATUTORY_TAX_RATE, STATUTORY_TAX_RATE_PERCENT, calculateStatutoryTax } from './taxConfig.js'

export const SERVICE_TAX_RATE = STATUTORY_TAX_RATE

export const INITIAL_INVOICES = [
  {
    invoiceId: 'INV-2026-03-0881',
    accountId: 'B101000000000089',
    orderId: 'B0000001089',
    customerId: 'CUS-001',
    customerName: 'AlphaCorp Technology Solutions JSC',
    taxId: '0108881948',
    customerEmail: 'accounting@alphacorp.vn',
    serviceTitle: 'FTTH Dedicated 500Mbps Metro Core',
    serviceType: 'BROADBAND',
    billingCycle: '01/03/2026 – 31/03/2026',
    issuedDate: '2026-04-01',
    dueDate: '2026-04-15',
    status: 'PENDING',
    paymentMethod: null,
    paidAt: null,
    paidAmount: 0,
    remainingBalance: 339.53,
    previousBalance: 0,
    items: [
      { desc: 'Broadband FTTx 500Mbps Metro Port Monthly Recurring Charge', quantity: 1, unitPrice: 240.0, amount: 240.0 },
      { desc: 'Static Public Subnet /29 IPv4 Allocation Block (8 IPs)', quantity: 1, unitPrice: 40.0, amount: 40.0 },
      { desc: 'Out-of-Profile Optical Burstable Traffic Overage (450 GB @ $0.05/GB)', quantity: 450, unitPrice: 0.05, amount: 22.5 },
    ],
  },
  {
    invoiceId: 'INV-2026-03-0882',
    accountId: 'T101000000000102',
    orderId: 'T0000001092',
    customerName: 'An Binh Commercial Joint Stock Bank',
    taxId: '0101446758',
    serviceTitle: 'SIP Trunking 30 Channels PRI Backbone',
    serviceType: 'LANDLINE',
    billingCycle: '01/03/2026 – 31/03/2026',
    issuedDate: '2026-04-01',
    dueDate: '2026-04-08',
    status: 'OVERDUE',
    paymentMethod: null,
    paidAt: null,
    paidAmount: 0,
    remainingBalance: 807.62,
    previousBalance: 50.0,
    items: [
      { desc: 'Enterprise SIP Trunking 30 Concurrent Channels Monthly Port', quantity: 1, unitPrice: 180.0, amount: 180.0 },
      { desc: 'Local PSTN Call Minutes (14,200 mins @ $0.02/min)', quantity: 14200, unitPrice: 0.02, amount: 284.0 },
      { desc: 'STD Inter-Provincial Long Distance Calls (3,800 mins @ $0.05/min)', quantity: 3800, unitPrice: 0.05, amount: 190.0 },
      { desc: 'Corporate Mobile SMS Gateway Broadcasts (2,100 SMS @ $0.01/SMS)', quantity: 2100, unitPrice: 0.01, amount: 21.0 },
    ],
  },
  {
    invoiceId: 'INV-2026-03-0883',
    accountId: 'D101000000000045',
    orderId: 'D0000001094',
    customerName: 'VinMart+ Convenience Retail Chain',
    taxId: '0107891234',
    serviceTitle: 'POS / ATM Dedicated V.92 Backup Network',
    serviceType: 'DIAL_UP',
    billingCycle: '01/03/2026 – 31/03/2026',
    issuedDate: '2026-04-01',
    dueDate: '2026-04-15',
    status: 'PAID',
    paymentMethod: 'Corporate Wire Transfer (Demo Settlement)',
    paidAt: '2026-04-03T10:14:00Z',
    receiptNumber: 'REC-2026-884102',
    paidAmount: 122.34,
    remainingBalance: 0,
    previousBalance: 0,
    items: [
      { desc: 'V.92 Dial-Up Hardware Dedicated Access Port (Hoan Kiem Cluster)', quantity: 1, unitPrice: 85.0, amount: 85.0 },
      { desc: 'Dial-In Central Polling Transaction Volume Surcharge (4,800 sessions)', quantity: 4800, unitPrice: 0.005, amount: 24.0 },
    ],
  },
  {
    invoiceId: 'INV-2026-02-0719',
    accountId: 'B101000000000089',
    orderId: 'B0000001089',
    customerId: 'CUS-001',
    customerName: 'AlphaCorp Technology Solutions JSC',
    taxId: '0108881948',
    customerEmail: 'accounting@alphacorp.vn',
    serviceTitle: 'FTTH Dedicated 500Mbps Metro Core',
    serviceType: 'BROADBAND',
    billingCycle: '01/02/2026 – 28/02/2026',
    issuedDate: '2026-03-01',
    dueDate: '2026-03-15',
    status: 'OVERDUE',
    paymentMethod: null,
    paidAt: null,
    paidAmount: 0,
    remainingBalance: 168.36,
    previousBalance: 0,
    items: [
      { desc: 'Broadband FTTx 500Mbps Metro Port Monthly Arrears (Feb Cycle)', quantity: 1, unitPrice: 150.0, amount: 150.0 },
    ],
  },
]

export function calculateInvoiceTotals(items = [], previousBalance = 0, paidAmount = 0) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const serviceTax = calculateStatutoryTax(subtotal)
  const roundedSubtotal = Number(subtotal.toFixed(2))
  const roundedBalance = Number(Number(previousBalance || 0).toFixed(2))
  const totalPayable = Number((roundedSubtotal + serviceTax + roundedBalance).toFixed(2))
  const roundedPaid = Number(Number(paidAmount || 0).toFixed(2))
  const remainingBalance = Math.max(0, Number((totalPayable - roundedPaid).toFixed(2)))

  return {
    subtotal: roundedSubtotal,
    taxRatePercent: STATUTORY_TAX_RATE_PERCENT,
    serviceTax,
    previousBalance: roundedBalance,
    totalPayable,
    paidAmount: roundedPaid,
    remainingBalance,
  }
}

export function formatUSD(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num || 0)
}

export const INVOICES_UPDATED_EVENT = 'nexus:invoices-updated'

function notifyInvoicesUpdated() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(INVOICES_UPDATED_EVENT))
  }
}

export function saveStoredInvoices(invoices) {
  try {
    localStorage.setItem('nexus_invoices', JSON.stringify(Array.isArray(invoices) ? invoices : []))
    notifyInvoicesUpdated()
  } catch {}
}

export function subscribeInvoicesUpdated(callback) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }
  const handleCustom = () => callback()
  const handleStorage = (event) => {
    if (!event || event.key === null || event.key === 'nexus_invoices') {
      callback()
    }
  }
  window.addEventListener(INVOICES_UPDATED_EVENT, handleCustom)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(INVOICES_UPDATED_EVENT, handleCustom)
    window.removeEventListener('storage', handleStorage)
  }
}

export function getStoredInvoices() {
  try {
    const raw = localStorage.getItem('nexus_invoices')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return INITIAL_INVOICES
}

export async function fetchInvoices() {
  await new Promise((resolve) => setTimeout(resolve, 200))
  const invs = getStoredInvoices()
  localStorage.setItem('nexus_invoices', JSON.stringify(invs))
  return invs
}

const PAYMENT_RECEIPTS_STORAGE_KEY = 'nexus_payment_receipts_v1'

function toChronologicalRank(dateStr) {
  if (!dateStr) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(dateStr)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

export function getInvoiceRemainingBalance(invoice) {
  if (!invoice) return 0
  if (invoice.status === 'PAID') return 0
  if (
    invoice.remainingBalance !== undefined &&
    invoice.remainingBalance !== null &&
    Number.isFinite(Number(invoice.remainingBalance))
  ) {
    return Math.max(0, Number(Number(invoice.remainingBalance).toFixed(2)))
  }
  const totals = calculateInvoiceTotals(invoice.items || [], invoice.previousBalance || 0, invoice.paidAmount || 0)
  return totals.remainingBalance
}

/** Sort invoices strictly oldest-first (issuedDate -> dueDate -> invoiceId) for FIFO settlement. */
export function sortInvoicesFifo(invoices = []) {
  return [...invoices].sort((a, b) => {
    const issuedDiff = toChronologicalRank(a?.issuedDate || a?.dueDate) - toChronologicalRank(b?.issuedDate || b?.dueDate)
    if (issuedDiff !== 0) return issuedDiff
    const dueDiff = toChronologicalRank(a?.dueDate) - toChronologicalRank(b?.dueDate)
    if (dueDiff !== 0) return dueDiff
    return String(a?.invoiceId || '').localeCompare(String(b?.invoiceId || ''))
  })
}

/** Return unpaid invoices for an account ordered strictly oldest-first for FIFO allocation. */
export function getAccountOpenInvoicesFifo(accountId, invoices = []) {
  if (!accountId) return []
  const open = invoices.filter(
    (inv) => inv.accountId === accountId && inv.status !== 'PAID' && getInvoiceRemainingBalance(inv) > 0
  )
  return sortInvoicesFifo(open)
}

export function getAccountUnpaidSummary(accountId, invoices = []) {
  const openFifo = getAccountOpenInvoicesFifo(accountId, invoices)
  const totalUnpaidBalance = Number(
    openFifo.reduce((sum, inv) => sum + getInvoiceRemainingBalance(inv), 0).toFixed(2)
  )
  return {
    accountId,
    invoices: openFifo,
    count: openFifo.length,
    totalUnpaidBalance,
    oldestInvoice: openFifo[0] || null,
  }
}

/** Preview how a lump-sum payment allocates across open invoices in FIFO order without mutating state. */
export function simulateFifoAllocation(accountId, amount, invoices = []) {
  const summary = getAccountUnpaidSummary(accountId, invoices)
  const parsed = Number(amount)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      ...summary,
      requestedAmount: 0,
      effectiveAmount: 0,
      excessAmount: 0,
      remainingAccountBalance: summary.totalUnpaidBalance,
      allocations: [],
    }
  }

  let pool = Number(Math.min(parsed, summary.totalUnpaidBalance).toFixed(2))
  const excessAmount = Number(Math.max(0, parsed - summary.totalUnpaidBalance).toFixed(2))
  const allocations = []

  summary.invoices.forEach((inv, index) => {
    if (pool <= 0) return
    const remainingBefore = getInvoiceRemainingBalance(inv)
    const allocatedAmount = Number(Math.min(pool, remainingBefore).toFixed(2))
    const remainingAfter = Math.max(0, Number((remainingBefore - allocatedAmount).toFixed(2)))
    let resultingStatus = 'PAID'
    if (remainingAfter > 0) {
      resultingStatus =
        inv.status === 'OVERDUE' || (inv.dueDate && new Date(inv.dueDate) < new Date())
          ? 'OVERDUE'
          : 'PARTIALLY_PAID'
    }
    allocations.push({
      fifoOrder: index + 1,
      invoiceId: inv.invoiceId,
      billingCycle: inv.billingCycle,
      issuedDate: inv.issuedDate,
      dueDate: inv.dueDate,
      previousStatus: inv.status,
      remainingBefore,
      allocatedAmount,
      remainingAfter,
      resultingStatus,
    })
    pool = Math.max(0, Number((pool - allocatedAmount).toFixed(2)))
  })

  const effectiveAmount = Number(
    allocations.reduce((sum, item) => sum + item.allocatedAmount, 0).toFixed(2)
  )

  return {
    ...summary,
    requestedAmount: Number(parsed.toFixed(2)),
    effectiveAmount,
    excessAmount,
    remainingAccountBalance: Math.max(0, Number((summary.totalUnpaidBalance - effectiveAmount).toFixed(2))),
    allocations,
  }
}

export function fetchPaymentReceipts() {
  try {
    const raw = localStorage.getItem(PAYMENT_RECEIPTS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
  }
  return []
}

function savePaymentReceipt(receiptSummary) {
  try {
    const existing = fetchPaymentReceipts()
    const filtered = existing.filter((r) => r.receiptNumber !== receiptSummary.receiptNumber)
    localStorage.setItem(PAYMENT_RECEIPTS_STORAGE_KEY, JSON.stringify([receiptSummary, ...filtered].slice(0, 100)))
  } catch {
  }
}

/** Build a PrintReceiptModal payload directly from a real FIFO payment response or settled invoice record. */
export function buildPaymentReceiptFromResponse(source) {
  if (!source) {
    throw new Error('No payment record available to generate receipt.')
  }

  const isPaymentResponse = Array.isArray(source.allocations) && source.totalPaidAmount !== undefined
  const amount = Number(
    isPaymentResponse
      ? source.totalPaidAmount
      : source.lastPaymentAmount ?? source.paidAmount ?? 0
  )

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Cannot issue payment receipt without a recorded payment transaction.')
  }

  const allocations = Array.isArray(source.allocations) && source.allocations.length > 0
    ? source.allocations
    : [
        {
          fifoOrder: 1,
          invoiceId: source.invoiceId,
          billingCycle: source.billingCycle,
          issuedDate: source.issuedDate,
          dueDate: source.dueDate,
          allocatedAmount: amount,
          remainingAfter: Number(source.remainingBalance ?? 0),
          resultingStatus: source.status || 'PAID',
          status: source.status || 'PAID',
        },
      ]

  const primaryAlloc = allocations[0]
  const cycleSummary =
    allocations.length > 1
      ? `${primaryAlloc?.billingCycle || source.billingCycle || ''} (+${allocations.length - 1} FIFO invoice${allocations.length > 2 ? 's' : ''})`
      : source.billingCycle || primaryAlloc?.billingCycle || 'Monthly Billing Cycle'

  const receiptNumber = source.receiptNumber || `REC-${source.invoiceId || 'PAY'}`

  return {
    receiptType: 'PAYMENT',
    receiptNumber,
    date: source.paidAt || new Date().toISOString(),
    customerName: source.customerName || 'Enterprise Subscriber',
    taxId: source.taxId || 'N/A',
    accountId: source.accountId,
    orderId: source.orderId || source.invoiceId || primaryAlloc?.invoiceId || '',
    serviceTitle: source.serviceTitle || 'Nexus Enterprise Telecom Service',
    billingCycle: cycleSummary,
    paymentMethod: source.paymentMethod || 'Counter Cash Desk',
    amount: Number(amount.toFixed(2)),
    collectorName: source.cashierName || source.collectorName || 'Accounts Desk',
    referenceCode: receiptNumber,
    allocations,
    remainingAccountBalance:
      source.remainingAccountBalance !== undefined
        ? Number(Number(source.remainingAccountBalance).toFixed(2))
        : Number(source.remainingBalance ?? 0),
    note: source.note || source.paymentNote || '',
  }
}

/** Record an account payment and allocate funds across unpaid invoices strictly oldest-first (FIFO). */
export async function recordFifoAccountPayment(accountId, paymentInfo = {}) {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const invoices = await fetchInvoices()
  const summary = getAccountUnpaidSummary(accountId, invoices)

  if (!accountId || summary.count === 0 || summary.totalUnpaidBalance <= 0) {
    throw new Error(`No unpaid invoices found for account ${accountId || '(missing)'}.`)
  }

  const incomingAmount =
    paymentInfo.amount === undefined || paymentInfo.amount === null || paymentInfo.amount === ''
      ? summary.totalUnpaidBalance
      : Number(paymentInfo.amount)

  if (Number.isNaN(incomingAmount) || incomingAmount < 0) {
    throw new Error('Payment amount cannot be negative.')
  }

  if (incomingAmount === 0) {
    throw new Error('Payment amount must be greater than zero ($0.00).')
  }

  if (incomingAmount > Number((summary.totalUnpaidBalance + 0.001).toFixed(2))) {
    throw new Error(
      `Payment amount ($${incomingAmount.toFixed(2)}) exceeds total unpaid FIFO account balance ($${summary.totalUnpaidBalance.toFixed(2)}).`
    )
  }

  const cappedAmount = Number(Math.min(incomingAmount, summary.totalUnpaidBalance).toFixed(2))
  const paidAt = new Date().toISOString()
  const receiptNumber =
    paymentInfo.receiptNumber ||
    `REC-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`
  const paymentMethod = paymentInfo.method || 'Counter Cash Desk'
  const cashierName = paymentInfo.cashierName || 'Tran Thi Mai (Accounts)'
  const paymentNote = paymentInfo.note || `FIFO payment allocation (${paymentMethod})`

  let pool = cappedAmount
  const allocations = []
  const updatedById = new Map()

  summary.invoices.forEach((inv, index) => {
    if (pool <= 0) return
    const totals = calculateInvoiceTotals(inv.items || [], inv.previousBalance || 0, inv.paidAmount || 0)
    const remainingBefore = getInvoiceRemainingBalance(inv)
    const allocatedAmount = Number(Math.min(pool, remainingBefore).toFixed(2))
    if (allocatedAmount <= 0) return

    const basePayable = totals.totalPayable
    const currentPaid = Number((inv.paidAmount ?? Math.max(0, basePayable - remainingBefore)).toFixed(2))
    const newPaidAmount = Number((currentPaid + allocatedAmount).toFixed(2))
    const newRemainingBalance = Math.max(0, Number((remainingBefore - allocatedAmount).toFixed(2)))

    let newStatus = 'PAID'
    if (newRemainingBalance > 0) {
      if (inv.status === 'OVERDUE' || (inv.dueDate && new Date(inv.dueDate) < new Date())) {
        newStatus = 'OVERDUE'
      } else {
        newStatus = 'PARTIALLY_PAID'
      }
    }

    const txEntry = {
      receiptNumber,
      paidAt,
      allocatedAmount,
      paymentMethod,
      cashierName,
      fifoOrder: index + 1,
      note: paymentNote,
    }

    const updatedInvoice = {
      ...inv,
      status: newStatus,
      paidAmount: newPaidAmount,
      remainingBalance: newRemainingBalance,
      lastPaymentAmount: allocatedAmount,
      paymentMethod,
      paidAt,
      receiptNumber,
      paymentNote,
      cashierName,
      paymentHistory: [...(Array.isArray(inv.paymentHistory) ? inv.paymentHistory : []), txEntry],
    }

    updatedById.set(inv.invoiceId, updatedInvoice)
    allocations.push({
      fifoOrder: index + 1,
      invoiceId: inv.invoiceId,
      billingCycle: inv.billingCycle,
      issuedDate: inv.issuedDate,
      dueDate: inv.dueDate,
      previousStatus: inv.status,
      remainingBefore,
      allocatedAmount,
      remainingAfter: newRemainingBalance,
      status: newStatus,
    })

    pool = Math.max(0, Number((pool - allocatedAmount).toFixed(2)))
  })

  const nextInvoices = invoices.map((inv) => updatedById.get(inv.invoiceId) || inv)
  saveStoredInvoices(nextInvoices)

  const remainingSummary = getAccountUnpaidSummary(accountId, nextInvoices)
  const stillHasOverdue = nextInvoices.some(
    (inv) => inv.accountId === accountId && inv.status === 'OVERDUE' && getInvoiceRemainingBalance(inv) > 0
  )

  let circuitRestored = false
  try {
    syncDebtAccountPayment(accountId, cappedAmount, remainingSummary.totalUnpaidBalance)
    const syncedDebtAcc = fetchDebtAccounts().find((a) => a.accountId === accountId)
    const hasHistoricalDebt = Number(syncedDebtAcc?.historicalArrearsUSD || 0) > 0
    if (!hasHistoricalDebt && !stillHasOverdue && remainingSummary.totalUnpaidBalance <= 0) {
      unsuspendCircuit(accountId, `FIFO settlement ${receiptNumber} cleared account balance`)
      circuitRestored = true
    } else if (!hasHistoricalDebt && !stillHasOverdue && allocations.some((a) => a.previousStatus === 'OVERDUE' && a.status === 'PAID')) {
      unsuspendCircuit(accountId, `FIFO settlement ${receiptNumber} cleared all overdue invoices`, {
        preserveRemainingBalance: remainingSummary.totalUnpaidBalance > 0,
      })
      circuitRestored = true
    }
  } catch {
  }

  const headInvoice = updatedById.get(allocations[0]?.invoiceId) || summary.oldestInvoice
  const responsePayload = {
    receiptNumber,
    paidAt,
    accountId,
    customerId: headInvoice?.customerId,
    customerName: headInvoice?.customerName || 'Enterprise Subscriber',
    taxId: headInvoice?.taxId || '',
    orderId: headInvoice?.orderId || '',
    serviceTitle: headInvoice?.serviceTitle || 'Nexus Enterprise Telecom Service',
    billingCycle:
      allocations.length > 1
        ? `${allocations[0].billingCycle} .. ${allocations[allocations.length - 1].billingCycle}`
        : allocations[0]?.billingCycle || '',
    paymentMethod,
    cashierName,
    note: paymentNote,
    totalPaidAmount: cappedAmount,
    remainingAccountBalance: remainingSummary.totalUnpaidBalance,
    fullySettled: remainingSummary.totalUnpaidBalance <= 0,
    circuitRestored,
    allocations,
    updatedInvoices: nextInvoices,
    primaryInvoice: headInvoice,
  }

  savePaymentReceipt({
    ...responsePayload,
    updatedInvoices: undefined,
    primaryInvoice: undefined,
  })

  return responsePayload
}

export async function recordInvoicePayment(invoiceId, paymentInfo = {}) {
  if (paymentInfo?.fifo === true) {
    const invoices = await fetchInvoices()
    const target = invoices.find((i) => i.invoiceId === invoiceId)
    if (!target) {
      throw new Error(`Invoice ${invoiceId} not found.`)
    }
    const fifoResult = await recordFifoAccountPayment(target.accountId, paymentInfo)
    const matchedUpdated =
      fifoResult.updatedInvoices.find((i) => i.invoiceId === invoiceId) || fifoResult.primaryInvoice
    return {
      ...matchedUpdated,
      fifoPaymentResult: fifoResult,
      allocations: fifoResult.allocations,
      lastPaymentAmount: fifoResult.totalPaidAmount,
      receiptNumber: fifoResult.receiptNumber,
      paidAt: fifoResult.paidAt,
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 400))
  const invoices = await fetchInvoices()
  const idx = invoices.findIndex((i) => i.invoiceId === invoiceId)

  if (idx === -1) {
    throw new Error(`Invoice ${invoiceId} not found.`)
  }

  const current = invoices[idx]

  if (current.status === 'PAID') {
    throw new Error(`Invoice ${invoiceId} has already been PAID in full.`)
  }

  const totals = calculateInvoiceTotals(current.items, current.previousBalance, current.paidAmount || 0)

  if (totals.remainingBalance <= 0) {
    throw new Error(`Invoice ${invoiceId} has zero outstanding balance.`)
  }

  const incomingAmount = paymentInfo.amount !== undefined ? Number(paymentInfo.amount) : totals.remainingBalance

  if (isNaN(incomingAmount) || incomingAmount < 0) {
    throw new Error('Payment amount cannot be negative.')
  }

  if (incomingAmount === 0) {
    throw new Error('Payment amount must be greater than zero ($0.00).')
  }

  if (incomingAmount > totals.remainingBalance) {
    throw new Error(
      `Payment amount ($${incomingAmount.toFixed(2)}) exceeds remaining balance ($${totals.remainingBalance.toFixed(2)}).`
    )
  }

  const newPaidAmount = Number(((current.paidAmount || 0) + incomingAmount).toFixed(2))
  const newRemainingBalance = Math.max(0, Number((totals.totalPayable - newPaidAmount).toFixed(2)))

  let newStatus = 'PAID'
  if (newRemainingBalance > 0) {
    if (current.status === 'OVERDUE' || (current.dueDate && new Date(current.dueDate) < new Date())) {
      newStatus = 'OVERDUE'
    } else {
      newStatus = 'PARTIALLY_PAID'
    }
  }

  const receiptNumber = `REC-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`
  const paidAt = new Date().toISOString()
  const paymentMethod = paymentInfo.method || 'Cash Desk / Counter'
  const cashierName = paymentInfo.cashierName || 'Tran Thi Mai (Accounts)'
  const paymentNote = paymentInfo.note || ''

  const allocEntry = {
    fifoOrder: 1,
    invoiceId: current.invoiceId,
    billingCycle: current.billingCycle,
    issuedDate: current.issuedDate,
    dueDate: current.dueDate,
    previousStatus: current.status,
    remainingBefore: totals.remainingBalance,
    allocatedAmount: incomingAmount,
    remainingAfter: newRemainingBalance,
    status: newStatus,
  }

  const updatedInvoice = {
    ...current,
    status: newStatus,
    paidAmount: newPaidAmount,
    remainingBalance: newRemainingBalance,
    lastPaymentAmount: incomingAmount,
    paymentMethod,
    paidAt,
    receiptNumber,
    paymentNote,
    cashierName,
    allocations: [allocEntry],
    paymentHistory: [
      ...(Array.isArray(current.paymentHistory) ? current.paymentHistory : []),
      {
        receiptNumber,
        paidAt,
        allocatedAmount: incomingAmount,
        paymentMethod,
        cashierName,
        fifoOrder: 1,
        note: paymentNote,
      },
    ],
  }

  invoices[idx] = updatedInvoice
  saveStoredInvoices(invoices)

  const accountRemainingSummary = getAccountUnpaidSummary(current.accountId, invoices)
  const stillHasOverdueOnAccount = invoices.some(
    (inv) => inv.accountId === current.accountId && inv.status === 'OVERDUE' && getInvoiceRemainingBalance(inv) > 0
  )

  try {
    syncDebtAccountPayment(current.accountId, incomingAmount, accountRemainingSummary.totalUnpaidBalance)
    const syncedDebtAcc = fetchDebtAccounts().find((a) => a.accountId === current.accountId)
    const hasHistoricalDebt = Number(syncedDebtAcc?.historicalArrearsUSD || 0) > 0
    if (newStatus === 'PAID' && !stillHasOverdueOnAccount && !hasHistoricalDebt) {
      unsuspendCircuit(current.accountId, `Invoice ${invoiceId} settled in full`, {
        preserveRemainingBalance: accountRemainingSummary.totalUnpaidBalance > 0,
      })
    }
  } catch {
  }

  savePaymentReceipt({
    receiptNumber,
    paidAt,
    accountId: current.accountId,
    customerId: current.customerId,
    customerName: current.customerName,
    taxId: current.taxId,
    orderId: current.orderId,
    serviceTitle: current.serviceTitle,
    billingCycle: current.billingCycle,
    paymentMethod,
    cashierName,
    note: paymentNote,
    totalPaidAmount: incomingAmount,
    remainingAccountBalance: accountRemainingSummary.totalUnpaidBalance,
    fullySettled: accountRemainingSummary.totalUnpaidBalance <= 0,
    allocations: [allocEntry],
  })

  return updatedInvoice
}

function readStoredJsonArray(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function normalizeBillingServiceType(rawType, accountId = '') {
  const token = String(rawType || '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (token === 'LANDLINE' || token === 'SIP_TRUNK' || token === 'TELEPHONE' || token === 'VOIP') {
    return 'LANDLINE'
  }
  if (token === 'DIAL_UP' || token === 'DIALUP' || token === 'LEASED_LINE' || token === 'LEASED') {
    return 'DIAL_UP'
  }
  if (token === 'BROADBAND' || token === 'FTTH') {
    return 'BROADBAND'
  }
  const prefix = String(accountId || '').trim().toUpperCase().charAt(0)
  if (prefix === 'T') return 'LANDLINE'
  if (prefix === 'D') return 'DIAL_UP'
  return 'BROADBAND'
}

/**
 * Resolve authoritative subscriber, tax ID, plan rate, and service type for an Account ID
 * from activated accounts, debt ledger, customers, orders, and plans without hardcoded fallbacks.
 */
export function resolveAccountBillingProfile(accountId, invoicesOverride = null) {
  const targetId = String(accountId || '').trim()
  const activated = getActivatedAccounts()
  const debtAccounts = fetchDebtAccounts()
  const plans = fetchPlans()
  const orders = readStoredJsonArray('nexus_orders')
  const customers = readStoredJsonArray('nexus_customers')
  const invoices = Array.isArray(invoicesOverride) ? invoicesOverride : getStoredInvoices()

  const acc = activated.find((a) => a.accountId === targetId) || null
  const debt = debtAccounts.find((d) => d.accountId === targetId) || null
  const linkedOrder =
    orders.find(
      (o) =>
        (acc?.orderId && (o.id === acc.orderId || o.orderId === acc.orderId)) ||
        o.accountId === targetId
    ) || null
  const existingInv =
    invoices.find(
      (i) =>
        i.accountId === targetId &&
        i.customerName &&
        i.customerName !== 'Customer Subscription Account'
    ) || null

  const resolvedCustomerId =
    acc?.customerId || linkedOrder?.customerId || existingInv?.customerId || null
  const customer =
    customers.find(
      (c) =>
        (resolvedCustomerId && c.id === resolvedCustomerId) ||
        (acc?.taxId && c.taxId === acc.taxId) ||
        (acc?.customerEmail && c.email?.toLowerCase() === acc.customerEmail.toLowerCase())
    ) || null

  const candidateServiceTitle =
    acc?.serviceTitle ||
    acc?.planName ||
    linkedOrder?.planName ||
    linkedOrder?.serviceTitle ||
    debt?.planName ||
    debt?.plan ||
    existingInv?.serviceTitle ||
    ''

  const candidateServiceType = normalizeBillingServiceType(
    acc?.serviceType ||
      acc?.connectionType ||
      linkedOrder?.serviceType ||
      existingInv?.serviceType ||
      '',
    targetId
  )

  const expectedConnType = normalizePlanConnectionType(candidateServiceType)
  const explicitPlanId = String(acc?.planId || acc?.planSku || '').trim().toLowerCase()
  const titleLower = String(candidateServiceTitle || '').trim().toLowerCase()
  const matchedPlan =
    (explicitPlanId &&
      plans.find((p) => p.id.toLowerCase() === explicitPlanId || p.sku.toLowerCase() === explicitPlanId)) ||
    (titleLower &&
      plans.find(
        (p) =>
          p.name.toLowerCase() === titleLower ||
          titleLower.includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(titleLower)
      )) ||
    plans.find((p) => p.connectionType === expectedConnType && p.recommended) ||
    plans.find((p) => p.connectionType === expectedConnType) ||
    null

  const resolvedOrderId =
    acc?.orderId ||
    linkedOrder?.id ||
    linkedOrder?.orderId ||
    existingInv?.orderId ||
    (debt?.invoiceRef ? String(debt.invoiceRef).replace(/^#/, '') : '') ||
    (targetId ? `${targetId.charAt(0).toUpperCase()}${targetId.slice(-10)}` : '')

  const resolvedCustomerName =
    acc?.customerName ||
    customer?.customerName ||
    linkedOrder?.customerName ||
    debt?.customerName ||
    existingInv?.customerName ||
    `Subscriber Account ${targetId}`

  const resolvedTaxId =
    acc?.taxId ||
    customer?.taxId ||
    linkedOrder?.taxId ||
    debt?.taxId ||
    existingInv?.taxId ||
    'UNREGISTERED'

  const resolvedEmail =
    acc?.customerEmail ||
    acc?.email ||
    customer?.email ||
    linkedOrder?.customerEmail ||
    debt?.contactEmail ||
    existingInv?.customerEmail ||
    null

  const resolvedServiceTitle =
    candidateServiceTitle ||
    matchedPlan?.name ||
    (candidateServiceType === 'LANDLINE'
      ? 'Voice Landline / SIP Trunk Service'
      : candidateServiceType === 'DIAL_UP'
      ? 'Dial-Up / Dedicated Link Service'
      : 'Broadband FTTH Circuit Service')

  const rawCharge =
    acc?.monthlyChargeUSD ??
    acc?.monthlyNetUSD ??
    linkedOrder?.monthlyFeeUSD ??
    linkedOrder?.planPriceUSD ??
    matchedPlan?.monthlyNetUSD ??
    0

  const rawStatusToken = String(
    acc?.lifecycleStatus || acc?.status || debt?.oltStatus || 'ACTIVE'
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

  const isTerminated =
    rawStatusToken === 'PERMANENTLY_INACTIVE' ||
    rawStatusToken === 'TERMINATED' ||
    rawStatusToken === 'CANCELLED' ||
    rawStatusToken === 'DISCONNECTED'

  return {
    found: Boolean(acc || debt || linkedOrder || existingInv),
    accountId: targetId,
    customerId: resolvedCustomerId,
    customerName: resolvedCustomerName,
    taxId: resolvedTaxId,
    customerEmail: resolvedEmail,
    orderId: resolvedOrderId,
    serviceTitle: resolvedServiceTitle,
    serviceType: candidateServiceType,
    connectionType: expectedConnType,
    planId: acc?.planId || matchedPlan?.id || null,
    planName: acc?.planName || matchedPlan?.name || resolvedServiceTitle,
    monthlyPlanChargeUSD: Number(Math.max(0, Number(rawCharge) || 0).toFixed(2)),
    cpeMonthlyUSD: Number(Math.max(0, Number(matchedPlan?.cpeMonthlyUSD || 0)).toFixed(2)),
    assignedHardware: acc?.assignedHardware || null,
    status: rawStatusToken,
    isTerminated,
  }
}

function addDaysToIsoDate(isoDateStr, days = 15) {
  const parsed = new Date(`${isoDateStr}T00:00:00Z`)
  const baseMs = Number.isFinite(parsed.getTime()) ? parsed.getTime() : Date.now()
  return new Date(baseMs + days * 86400000).toISOString().split('T')[0]
}

export async function generateNewInvoice(accountId, customItems = [], customerMeta = {}) {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const cleanAccountId = String(accountId || '').trim()
  if (!cleanAccountId) {
    throw new Error('Account ID is required to generate an invoice.')
  }

  const invoices = await fetchInvoices()
  const profile = resolveAccountBillingProfile(cleanAccountId, invoices)

  const items = customItems.length > 0 ? customItems : [
    {
      desc: `${profile.planName || profile.serviceTitle} Monthly Subscription`,
      quantity: 1,
      unitPrice: profile.monthlyPlanChargeUSD || 200.0,
      amount: profile.monthlyPlanChargeUSD || 200.0,
    },
  ]
  const totals = calculateInvoiceTotals(items, 0, 0)

  const issuedDate = customerMeta.issuedDate || new Date().toISOString().split('T')[0]
  const dueDate = customerMeta.dueDate || addDaysToIsoDate(issuedDate, 15)
  const suffix = `${Date.now().toString().slice(-4)}-${Math.floor(10 + Math.random() * 89)}`
  const invoiceId = customerMeta.invoiceId || `INV-2026-${suffix}`

  const resolvedCustomerId = customerMeta.customerId || profile.customerId
  const resolvedEmail = customerMeta.customerEmail || profile.customerEmail
  const resolvedServiceType = normalizeBillingServiceType(
    customerMeta.serviceType || profile.serviceType,
    cleanAccountId
  )

  const newInv = {
    invoiceId,
    accountId: cleanAccountId,
    orderId: customerMeta.orderId || profile.orderId,
    ...(resolvedCustomerId ? { customerId: resolvedCustomerId } : {}),
    customerName: customerMeta.customerName || customerMeta.company || profile.customerName,
    taxId: customerMeta.taxId || profile.taxId,
    ...(resolvedEmail ? { customerEmail: resolvedEmail } : {}),
    serviceTitle: customerMeta.serviceTitle || profile.serviceTitle,
    serviceType: resolvedServiceType,
    billingCycle: customerMeta.billingCycle || '01/04/2026 – 30/04/2026',
    issuedDate,
    dueDate,
    status: 'PENDING',
    paymentMethod: null,
    paidAt: null,
    paidAmount: 0,
    remainingBalance: totals.remainingBalance,
    previousBalance: 0,
    ...(customerMeta.billingSource ? { billingSource: customerMeta.billingSource } : {}),
    items,
  }

  invoices.unshift(newInv)
  saveStoredInvoices(invoices)
  try {
    const unpaidAfterNew = getAccountUnpaidSummary(cleanAccountId, invoices)
    syncDebtAccountInvoiceBalance(cleanAccountId, unpaidAfterNew.totalUnpaidBalance)
  } catch {
  }
  return newInv
}

function isInvoiceEligibleForCdrMerge(invoice, cleanAccountId, targetCycle = null) {
  if (!invoice || invoice.accountId !== cleanAccountId) return false
  const normalizedStatus = String(invoice.status || '').trim().toUpperCase()
  if (normalizedStatus === 'PAID') return false
  if (Number(invoice.paidAmount || 0) > 0 || Boolean(invoice.paidAt)) return false
  if (getInvoiceRemainingBalance(invoice) <= 0) return false
  if (targetCycle && invoice.billingCycle !== targetCycle) return false
  return true
}

export async function syncCdrToInvoice(accountId, cdrSessions = [], options = {}) {
  const cleanAccountId = String(accountId || '').trim()
  if (!cleanAccountId || cleanAccountId === 'ALL') {
    throw new Error('Select a specific subscriber Account ID before posting rated CDR usage.')
  }

  const invoices = await fetchInvoices()
  const profile = resolveAccountBillingProfile(cleanAccountId, invoices)

  const targetCycle = options.billingCycle || null
  const idx = options.createSeparateInvoice
    ? -1
    : invoices.findIndex((inv) => isInvoiceEligibleForCdrMerge(inv, cleanAccountId, targetCycle))

  const accountScopedSessions = cdrSessions.filter(
    (s) =>
      (!s.accountId || s.accountId === cleanAccountId) &&
      (options.includeAlreadyBilled || !s.billedInvoiceId)
  )
  const billableSessions = accountScopedSessions.filter(
    (s) => s.ratingStatus === 'BILLABLE' && Number(s.chargeUSD) > 0
  )
  const newCdrItems = billableSessions.map((s) => ({
    desc: `CDR Rated Usage: ${s.eventType} (${s.service} - ${s.duration})`,
    quantity: Number(s.quantity) || 1,
    unitPrice:
      Number(s.quantity) > 1 && Number(s.unitRateUSD) > 0
        ? Number(s.unitRateUSD)
        : Number(s.chargeUSD),
    amount: Number(Number(s.chargeUSD).toFixed(2)),
  }))

  const extraItems = Array.isArray(options.extraItems) ? options.extraItems : []
  const itemsToBill = [...newCdrItems, ...extraItems]
  if (itemsToBill.length === 0) {
    throw new Error(`No unbilled billable CDR usage or surcharges found for account ${cleanAccountId}.`)
  }

  if (idx !== -1) {
    const inv = invoices[idx]
    const nonCdrItems = inv.items.filter(
      (item) => !item.desc.startsWith('CDR Rated Usage:')
    )
    const mergedItems = [...nonCdrItems, ...newCdrItems, ...extraItems]
    const totals = calculateInvoiceTotals(mergedItems, inv.previousBalance, inv.paidAmount || 0)

    invoices[idx] = {
      ...inv,
      customerId: inv.customerId || profile.customerId || undefined,
      customerName:
        inv.customerName && inv.customerName !== 'Customer Subscription Account'
          ? inv.customerName
          : profile.customerName,
      taxId: inv.taxId && inv.taxId !== '0109998822' ? inv.taxId : profile.taxId,
      customerEmail: inv.customerEmail || profile.customerEmail || undefined,
      serviceTitle: inv.serviceTitle || profile.serviceTitle,
      serviceType: inv.serviceType || profile.serviceType,
      items: mergedItems,
      remainingBalance: totals.remainingBalance,
    }
    saveStoredInvoices(invoices)
    try {
      const unpaidAfterCdr = getAccountUnpaidSummary(cleanAccountId, invoices)
      syncDebtAccountInvoiceBalance(cleanAccountId, unpaidAfterCdr.totalUnpaidBalance)
    } catch {
    }
    return invoices[idx]
  } else {
    const hadSettledOrPartialInvoice = invoices.some(
      (i) =>
        i.accountId === cleanAccountId &&
        (String(i.status || '').toUpperCase() === 'PAID' || Number(i.paidAmount || 0) > 0)
    )
    const newAdjustmentInvoice = await generateNewInvoice(cleanAccountId, itemsToBill, {
      customerId: profile.customerId,
      customerName: profile.customerName,
      taxId: profile.taxId,
      customerEmail: profile.customerEmail,
      orderId: profile.orderId,
      serviceTitle: hadSettledOrPartialInvoice
        ? `${profile.serviceTitle} (Supplemental CDR Adjustment)`
        : profile.serviceTitle,
      serviceType: profile.serviceType,
      billingCycle: targetCycle || '01/04/2026 – 30/04/2026',
      billingSource: options.billingSource || (hadSettledOrPartialInvoice ? 'CN17_CDR_ADJUSTMENT' : 'CN17_CDR_SYNC'),
    })
    return newAdjustmentInvoice
  }
}
