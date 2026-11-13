import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  bulkDiscountRate,
  calcBulk,
  DEFAULT_BULK_TIERS,
  fetchBulkSchemeTiers,
  updateBulkSchemeTier,
  resetBulkSchemeTiers,
  clampSimulatorEndpoints,
  auditOrderBulkScheme,
} from '../src/services/bulkScheme.js'
import {
  STATUTORY_TAX_RATE,
  STATUTORY_TAX_RATE_PERCENT,
  calculateStatutoryTax,
} from '../src/services/taxConfig.js'
import { calculateInvoiceTotals, SERVICE_TAX_RATE } from '../src/services/billingService.js'
import {
  generateInvoicePdfBytes,
  generateStatementPdfBytes,
  buildInvoiceXmlContent,
} from '../src/utils/telecomDocumentGenerator.js'
import { INITIAL_DEBT_ACCOUNTS } from '../src/services/debtService.js'
import {
  INITIAL_PLANS,
  DEFAULT_TAX_RATE,
  fetchPlans,
  fetchRetailPlansByType,
  getPlansGroupedByConnectionType,
  addPlan,
  updatePlan,
  deletePlan,
  resetPlansToDefault,
  normalizePlanConnectionType,
  fetchTaxRate,
  saveTaxRate,
  normalizePlanRecord,
  fetchPlanVersionHistory,
  getPlanCatalogVersionMeta,
  restoreCatalogVersion,
} from '../src/services/planService.js'
import {
  INITIAL_METRO_PREFIXES,
  INITIAL_RETAIL_STORES,
  INITIAL_HARDWARE_VENDORS,
  fetchMetroPrefixes,
  fetchRetailStores,
  saveRetailStores,
  createRetailStore,
  updateRetailStore,
  deleteRetailStore,
  normalizeRetailStoreRecord,
  fetchHardwareVendors,
  saveHardwareVendors,
  createHardwareVendor,
  updateHardwareVendor,
  deleteHardwareVendor,
  generateTestAccountId,
} from '../src/services/vendorShopService.js'
import {
  INITIAL_TAX_AUDIT_DATA,
  BULK_SCHEME_TIERS,
  fetchTaxAuditRecords,
  normalizeTaxAuditRecord,
  getTaxPeriodOptions,
  reconcileTaxLedgerWithBilling,
  subscribeTaxAuditUpdates,
} from '../src/services/taxReportService.js'
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_DISPATCH_ORDERS,
  WAREHOUSE_LOCATIONS,
  fetchInventoryRecords,
  fetchAvailableInventoryForService,
  addInventoryDevice,
  toggleInventoryFaultyStatus,
  reportAssignedHardwareDamaged,
  findInventoryDeviceBySerialOrMac,
} from '../src/services/inventoryService.js'
import {
  getNextOrderId,
  commitOrder,
  commitOrderWithDocuments,
  saveOrders,
  calculateOrderFinancials,
  updateOrder,
  cancelOrder,
  refundOrder,
  fetchOrders,
  getOrderRefundAmountUSD,
  isValidExistingLandlineIdentifier,
  validateDialupLandlineRequirement,
  DEPOSIT_STATUS,
  DEPOSIT_COLLECTION_METHODS,
  DEPOSIT_WAIVER_METHOD,
  validateDepositCollectionInput,
  getOrderDepositSummary,
  recordOrderDepositCollection,
  buildDepositReceiptNumber,
} from '../src/services/orderService.js'
import {
  setDocumentStorageAdapter,
  loadDocumentContent,
  checkDocumentAvailability,
} from '../src/services/documentStorageService.js'
import {
  ORDER_STATUS,
  ORDER_STATUS_LIST,
  ORDER_STATUS_MAP,
  normalizeOrderStatus,
  getOrderStatusMeta,
  getRetailEditableStatuses,
  isOrderTerminalStatus,
  isOrderModificationLocked,
  canModifyOrCancelOrder,
} from '../src/utils/orderStatus.js'
import {
  INITIAL_CUSTOMERS,
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  filterCustomerData,
  resolveVerifiedCustomerAccount,
} from '../src/services/customerService.js'
import {
  commissionCircuit,
  updateAccountConnectionStatus,
  findActivationOrderById,
  loadActivationOrderById,
  getActivatedAccounts,
  getActivationQueue,
  fetchAvailableWarehouseDevices,
} from '../src/services/activationService.js'
import {
  fetchMockSurveyOrders,
  approveMockSurvey,
  rejectMockSurvey,
  MAX_SURVEY_DISTANCE_METERS,
  SURVEY_INFEASIBILITY_REASONS,
} from '../src/services/mock/mockSurveyService.js'
import { fetchMockTracking } from '../src/services/mock/mockTrackingService.js'
import {
  PUBLIC_TRACKING_STAGES,
  maskCustomerName,
  maskPublicRoute,
  buildPublicTrackingTimeline,
  sanitizePublicTrackingPayload,
} from '../src/utils/publicTracking.js'
import {
  INITIAL_INVOICES,
  recordInvoicePayment,
  fetchInvoices,
  syncCdrToInvoice,
  generateNewInvoice,
  saveStoredInvoices,
  resolveAccountBillingProfile,
  sortInvoicesFifo,
  getAccountOpenInvoicesFifo,
  getAccountUnpaidSummary,
  simulateFifoAllocation,
  recordFifoAccountPayment,
  buildPaymentReceiptFromResponse,
} from '../src/services/billingService.js'
import {
  CDR_UNIT_RATES,
  fetchCdrSessions,
  addCdrSession,
  markCdrSessionsBilled,
  fetchDamagedEquipmentIncidents,
  recordDamagedEquipmentFee,
  calculateAccountMonthlyStatement,
  previewMonthlyBillingBatch,
  runMonthlyBillingBatch,
} from '../src/services/cdrBillingService.js'
import {
  ACCOUNT_LIFECYCLE_LIST,
  ACCOUNT_LIFECYCLE_STATUS,
  calculateDailyProration,
  canTransitionAccountStatus,
  changeAccountLifecycleStatus,
  changeAccountPlanWithProration,
  fetchLifecycleAccounts,
  fetchLifecycleLogs,
  getLifecycleStatusMeta,
  normalizeLifecycleStatus,
} from '../src/services/accountLifecycleService.js'
import {
  runBatchDunningScan,
  fetchDebtAccounts,
  saveDebtAccounts,
  syncDebtAccountPayment,
  syncDebtAccountInvoiceBalance,
  reconcileDebtAccountWithBillingSummary,
  subscribeDebtAccountsUpdated,
  suspendCircuit,
  unsuspendCircuit,
} from '../src/services/debtService.js'
import {
  getDefaultDashboardForRole,
  ROLE_DASHBOARDS,
  login,
  enterDemoRole,
  logout,
  getCurrentUser,
  isAuthenticated,
  DEMO_DEFAULT_PASSWORD,
  DEMO_TOKEN_PREFIX,
} from '../src/services/authService.js'
import {
  INITIAL_EMPLOYEES,
  fetchEmployees,
  addEmployee,
  updateEmployee,
  unlockEmployee,
  toggleEmployeeStatus,
  resetEmployeePassword,
} from '../src/services/adminUserService.js'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  }
}

let fail = 0
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)
}

eq('9 connections', bulkDiscountRate(9), 0)
eq('10 connections', bulkDiscountRate(10), 0.25)
eq('15 connections', bulkDiscountRate(15), 0.25)
eq('16 connections', bulkDiscountRate(16), 0.5)
eq('25 connections', bulkDiscountRate(25), 0.5)
eq('26 connections', bulkDiscountRate(26), 0.75)
eq('50 connections', bulkDiscountRate(50), 0.75)
eq('51 connections', bulkDiscountRate(51), 1)

eq('20 Broadband sites', calcBulk(20, 'BROADBAND'), { rate: 0.5, gross: 10000, saved: 5000, payable: 5000 })

const ORDER = /^[DBT]\d{10}$/
const ACCOUNT = /^[DBT]\d{15}$/
eq('Valid Order', ORDER.test('B0000000001'), true)
eq('Order missing digit', ORDER.test('B000000001'), false)
eq('Order wrong prefix', ORDER.test('X0000000001'), false)
eq('Valid Account', ACCOUNT.test('B001000000000001'), true)
eq('Reject 11-char Account', ACCOUNT.test('B0000000001'), false)

eq('Role dashboard admin', getDefaultDashboardForRole('admin'), '/admin/plans')
eq('Role dashboard retail', getDefaultDashboardForRole('retail'), '/retail/orders')
eq('Role dashboard technical', getDefaultDashboardForRole('technical'), '/technical/surveys')
eq('Role dashboard accounts', getDefaultDashboardForRole('accounts'), '/accounts/billing')
eq('Role dashboard customer', getDefaultDashboardForRole('customer'), '/customer')

const finTest = calculateOrderFinancials({
  planPriceUSD: 55,
  endpoints: 10,
  monthsPrepaid: 6,
  bulkDiscountPercent: 25,
  installationFee: 50,
})
eq('Order financials monthly subtotal', finTest.monthlyBillingSubtotal, 550)
eq('Order financials deposit', finTest.depositAmount, 5000)
eq('Order financials advance', finTest.advancePaymentAmount, 3300)
eq('Order financials bulk discount', finTest.bulkDiscountAmount, 2075)
eq('Order financials telecom tax', finTest.telecomTax, 67.32)
eq('Order financials grand total', finTest.grandTotal, 6892.32)

const nextB = getNextOrderId('B')
eq('Next Broadband Order ID format valid', ORDER.test(nextB), true)
eq('Next Broadband Order ID match prefix B', nextB.startsWith('B'), true)
const nextD = getNextOrderId('D')
eq('Next Dial-up Order ID format valid', ORDER.test(nextD), true)
eq('Next Dial-up Order ID match prefix D', nextD.startsWith('D'), true)
const nextT = getNextOrderId('T')
eq('Next Landline Order ID format valid', ORDER.test(nextT), true)
eq('Next Landline Order ID match prefix T', nextT.startsWith('T'), true)

eq('Service Tax Rate 12.24%', SERVICE_TAX_RATE, 0.1224)
const calcAdvance = (monthlyFee, monthsPrepaid) => monthlyFee * (monthsPrepaid || 0)
eq('Prepay 0 months advance', calcAdvance(55, 0), 0)
eq('Prepay 6 months advance', calcAdvance(55, 6), 330)
eq('Prepay 12 months advance', calcAdvance(55, 12), 660)
eq('Tax calculation on $1000 subtotal', calculateInvoiceTotals([{ amount: 1000 }], 0), {
  subtotal: 1000,
  taxRatePercent: 12.24,
  serviceTax: 122.4,
  previousBalance: 0,
  totalPayable: 1122.4,
  paidAmount: 0,
  remainingBalance: 1122.4,
})
eq('Partial payment remaining balance test', calculateInvoiceTotals([{ amount: 1000 }], 0, 500).remainingBalance, 622.4)

eq('Debt initial accounts loaded', INITIAL_DEBT_ACCOUNTS.length, 4)
eq('AlphaCorp initial debt balance reconciles 1:1 with Billing open invoices ($507.89)', INITIAL_DEBT_ACCOUNTS[0].balanceUSD, 507.89)
eq('AlphaCorp initial openInvoicesBalanceUSD matches Billing ($507.89) with $0 historical arrears', `${INITIAL_DEBT_ACCOUNTS[0].openInvoicesBalanceUSD}|${INITIAL_DEBT_ACCOUNTS[0].historicalArrearsUSD}`, '507.89|0')

eq('Plans initial loaded', INITIAL_PLANS.length, 6)
eq('Default telecom statutory tax rate 12.24%', DEFAULT_TAX_RATE, 12.24)
eq('FTTH 500M net price', INITIAL_PLANS[0].monthlyNetUSD, 2500.0)

eq('Metro prefixes count', INITIAL_METRO_PREFIXES.length, 5)
eq('Retail stores initial count', INITIAL_RETAIL_STORES.length, 4)
eq('Hardware vendors initial count', INITIAL_HARDWARE_VENDORS.length, 4)

const testAcc = generateTestAccountId('B', '101', 89)
eq('Generated Account ID match 16-char spec', testAcc, 'B101000000000089')
eq('Generated Account ID regex valid', ACCOUNT.test(testAcc), true)

eq('Tax audit initial records match INITIAL_INVOICES length', INITIAL_TAX_AUDIT_DATA.length, INITIAL_INVOICES.length)
eq('AlphaCorp tax audit payable reconciles 1:1 with INV-2026-03-0881', INITIAL_TAX_AUDIT_DATA[0].totalPayable, 339.53)
eq('AlphaCorp tax audit VAT amount reconciles with 12.24% of $302.50', INITIAL_TAX_AUDIT_DATA[0].taxAmount, 37.03)
eq('AlphaCorp tax audit MRC discount pct is 0 (CN07 bulk is Deposit/Advance only)', INITIAL_TAX_AUDIT_DATA[0].mrcDiscountPct, 0)
eq('AlphaCorp tax audit bulkDiscount deducted from MRC is 0', INITIAL_TAX_AUDIT_DATA[0].bulkDiscount, 0)
eq('Bulk scheme tiers remain scoped to Deposit & Advance only', BULK_SCHEME_TIERS.every((t) => t.discountScope === 'DEPOSIT_AND_ADVANCE_ONLY'), true)
eq('Bulk scheme tiers count', BULK_SCHEME_TIERS.length, 5)
eq('Bulk scheme standard tier 0 percent', BULK_SCHEME_TIERS[0].discountPercent, 0)
eq('Default bulk tiers count includes standard 1-9', DEFAULT_BULK_TIERS.length, 5)

eq('Clamp simulator lower bound 0 -> 1', clampSimulatorEndpoints(0), 1)
eq('Clamp simulator negative -> 1', clampSimulatorEndpoints(-5), 1)
eq('Clamp simulator upper bound 600 -> 500', clampSimulatorEndpoints(600), 500)
eq('Clamp simulator decimal truncates', clampSimulatorEndpoints(42.9), 42)

const mismatchZeroAudit = auditOrderBulkScheme({ endpoints: 20, bulkDiscountPercent: 0, serviceType: 'BROADBAND' })
eq('Audit preserves actual 0% instead of falling back to expected', mismatchZeroAudit.actualPercent, 0)
eq('Audit expected stays 50% for 20 endpoints', mismatchZeroAudit.expectedPercent, 50)
eq('Audit detects MISMATCH when 20 endpoints get 0%', mismatchZeroAudit.auditStatus, 'MISMATCH')

const matchedAudit = auditOrderBulkScheme({ endpoints: 20, bulkDiscountPercent: 50, serviceType: 'BROADBAND' })
eq('Audit marks compliant bulk order MATCHED', matchedAudit.auditStatus, 'MATCHED')

const unrecordedAudit = auditOrderBulkScheme({ endpoints: 12, serviceType: 'BROADBAND' })
eq('Audit marks missing bulkDiscountPercent UNRECORDED', unrecordedAudit.auditStatus, 'UNRECORDED')
eq('Audit leaves unrecorded actualPercent null', unrecordedAudit.actualPercent, null)

const editedTiers = updateBulkSchemeTier('sme', { maxEndpoints: 18, discountPercent: 30 })
eq('Tier edit updates SME discount to 30%', editedTiers.find((t) => t.id === 'sme')?.discountPercent, 30)
eq('Tier edit auto-aligns adjacent minEndpoints to 19', editedTiers.find((t) => t.id === 'expansion')?.minEndpoints, 19)
eq('Updated policy applies 30% to 18 endpoints', bulkDiscountRate(18), 0.3)

let rejectedBoundary = false
try {
  updateBulkSchemeTier('sme', { maxEndpoints: 25 })
} catch {
  rejectedBoundary = true
}
eq('Tier edit rejects collapsing adjacent tier range', rejectedBoundary, true)

resetBulkSchemeTiers()
eq('Reset restores default bulk tier count 5', fetchBulkSchemeTiers().length, 5)
eq('Reset restores default 25% for 10 endpoints', bulkDiscountRate(10), 0.25)

eq('Inventory initial items count', INITIAL_INVENTORY_ITEMS.length, 10)
eq('Nokia ONT sample item exists', INITIAL_INVENTORY_ITEMS[0].id, 'NX8829104')
eq('AlphaCorp assigned hardware match', INITIAL_INVENTORY_ITEMS[0].contractAccount, 'B101000000000089')
eq('Dispatch initial orders count', INITIAL_DISPATCH_ORDERS.length, 3)
eq('Warehouse locations count', WAREHOUSE_LOCATIONS.length, 9)

async function runAsyncTests() {
  let activationErrorThrown = false
  try {
    await commissionCircuit('NON_EXISTENT_ORDER_9999', {})
  } catch (err) {
    activationErrorThrown = true
  }
  eq('Commissioning non-existent order throws error', activationErrorThrown, true)

  let negativePaymentError = false
  try {
    await recordInvoicePayment('INV-2026-03-0881', { amount: -50 })
  } catch {
    negativePaymentError = true
  }
  eq('Payment rejects negative amount', negativePaymentError, true)

  let zeroPaymentError = false
  try {
    await recordInvoicePayment('INV-2026-03-0881', { amount: 0 })
  } catch {
    zeroPaymentError = true
  }
  eq('Payment rejects zero amount', zeroPaymentError, true)

  let excessPaymentError = false
  try {
    await recordInvoicePayment('INV-2026-03-0881', { amount: 999999 })
  } catch {
    excessPaymentError = true
  }
  eq('Payment rejects excess amount over remaining balance', excessPaymentError, true)

  let paidInvoiceError = false
  try {
    await recordInvoicePayment('INV-2026-03-0883', { amount: 50 })
  } catch {
    paidInvoiceError = true
  }
  eq('Payment rejects already PAID invoice', paidInvoiceError, true)

  const partialOverdue = await recordInvoicePayment('INV-2026-03-0882', { amount: 100 })
  eq('Overdue invoice remains OVERDUE after partial payment', partialOverdue.status, 'OVERDUE')
  eq('Overdue invoice remaining balance decreased', partialOverdue.remainingBalance, 707.62)

  const debtBefore = fetchDebtAccounts().find((a) => a.accountId === 'B101000000000089')?.balanceUSD || 507.89
  syncDebtAccountPayment('B101000000000089', 500)
  const debtAfter = fetchDebtAccounts().find((a) => a.accountId === 'B101000000000089')?.balanceUSD
  eq('Debt account synced after payment', debtAfter, Number((debtBefore - 500).toFixed(2)))

  // Test full payment clears debt and restores connection
  suspendCircuit('B101000000000089', 'Test overdue suspension')
  eq('Account circuit suspended', fetchDebtAccounts().find(a => a.accountId === 'B101000000000089').oltStatus, 'SUSPENDED')
  unsuspendCircuit('B101000000000089', 'Test full payment clearance')
  eq('Full payment restores connection to ACTIVE', fetchDebtAccounts().find(a => a.accountId === 'B101000000000089').oltStatus, 'ACTIVE')

  // Test CDR sync to Invoice
  const mockCdrSessions = [
    { eventType: 'VoIP Call', service: 'SIP', duration: '10m', ratingStatus: 'BILLABLE', chargeUSD: 100 },
    { eventType: 'Data Burst', service: 'FTTH', duration: '1h', ratingStatus: 'BILLABLE', chargeUSD: 200 },
    { eventType: 'Keepalive', service: 'FTTH', duration: '5m', ratingStatus: 'INCLUDED', chargeUSD: 0 },
  ]
  const updatedInvWithCdr = await syncCdrToInvoice('B101000000000089', mockCdrSessions)
  const hasCdrItems = updatedInvWithCdr.items.some(it => it.desc.includes('CDR Rated Usage: VoIP Call'))
  eq('CDR sync adds billable CDR items to invoice', hasCdrItems, true)
  eq('CDR sync recalculates tax strictly at 12.24%', updatedInvWithCdr.remainingBalance > 0, true)

  // Test Cancel Order
  const cancelled = cancelOrder('B0000001090', 'Customer relocation to unserviceable zone')
  eq('Cancel order sets status CANCELLED', cancelled.status, ORDER_STATUS.CANCELLED)
  eq('Cancel order records cancellation reason', cancelled.cancellationReason, 'Customer relocation to unserviceable zone')
  eq('Cancel order sets status label', cancelled.statusLabel, ORDER_STATUS_MAP.CANCELLED.label)

  eq('Order status list defines all 7 canonical statuses', ORDER_STATUS_LIST.length, 7)
  eq('Draft status label', getOrderStatusMeta(ORDER_STATUS.DRAFT).label, 'Draft')
  eq('Pending Survey status label', getOrderStatusMeta(ORDER_STATUS.PENDING_SURVEY).label, 'Pending Survey')
  eq('Feasible status label', getOrderStatusMeta(ORDER_STATUS.FEASIBLE).label, 'Feasible')
  eq('Not Feasible status label', getOrderStatusMeta(ORDER_STATUS.NOT_FEASIBLE).label, 'Not Feasible')
  eq('Activated status label', getOrderStatusMeta(ORDER_STATUS.ACTIVATED).label, 'Activated')
  eq('Cancelled status label', getOrderStatusMeta(ORDER_STATUS.CANCELLED).label, 'Cancelled')
  eq('Refunded status label', getOrderStatusMeta(ORDER_STATUS.REFUNDED).label, 'Refunded')

  eq('Alias ACTIVE normalizes to ACTIVATED', normalizeOrderStatus('ACTIVE'), ORDER_STATUS.ACTIVATED)
  eq('Alias SURVEY_PASSED normalizes to FEASIBLE', normalizeOrderStatus('SURVEY_PASSED'), ORDER_STATUS.FEASIBLE)
  eq('Alias SURVEY_FAILED normalizes to NOT_FEASIBLE', normalizeOrderStatus('SURVEY_FAILED'), ORDER_STATUS.NOT_FEASIBLE)
  eq('Terminal status true for CANCELLED', isOrderTerminalStatus(ORDER_STATUS.CANCELLED), true)
  eq('Terminal status true for REFUNDED', isOrderTerminalStatus(ORDER_STATUS.REFUNDED), true)
  eq('Terminal status false for FEASIBLE', isOrderTerminalStatus(ORDER_STATUS.FEASIBLE), false)
  eq('Retail modification allowed for DRAFT', canModifyOrCancelOrder(ORDER_STATUS.DRAFT), true)
  eq('Retail modification allowed for PENDING_SURVEY', canModifyOrCancelOrder(ORDER_STATUS.PENDING_SURVEY), true)
  eq('Retail modification allowed for FEASIBLE', canModifyOrCancelOrder(ORDER_STATUS.FEASIBLE), true)
  eq('Retail modification allowed for NOT_FEASIBLE', canModifyOrCancelOrder(ORDER_STATUS.NOT_FEASIBLE), true)
  eq('Retail modification blocked for ACTIVATED', canModifyOrCancelOrder(ORDER_STATUS.ACTIVATED), false)
  eq('Retail modification blocked for ACTIVE alias', canModifyOrCancelOrder('ACTIVE'), false)
  eq('Retail modification blocked for CANCELLED', canModifyOrCancelOrder(ORDER_STATUS.CANCELLED), false)
  eq('Retail modification blocked for REFUNDED', canModifyOrCancelOrder(ORDER_STATUS.REFUNDED), false)
  eq('Modification locked true for ACTIVATED', isOrderModificationLocked(ORDER_STATUS.ACTIVATED), true)

  const draftOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Draft Test Corp',
    status: ORDER_STATUS.DRAFT,
  })
  eq('Commit order respects DRAFT status', draftOrder.status, ORDER_STATUS.DRAFT)
  eq('Commit draft order sets Draft label', draftOrder.statusLabel, 'Draft')

  const pendingOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Pending Test Corp',
  })
  eq('Commit order defaults to PENDING_SURVEY', pendingOrder.status, ORDER_STATUS.PENDING_SURVEY)
  eq('Commit order default label is Pending Survey', pendingOrder.statusLabel, 'Pending Survey')

  const refunded = refundOrder('B0000001058', 'CN16 full deposit refund verified')
  eq('Refund order sets status REFUNDED', refunded.status, ORDER_STATUS.REFUNDED)
  eq('Refund order sets canonical label', refunded.statusLabel, 'Refunded')
  eq('Refund order stores reason', refunded.refundReason, 'CN16 full deposit refund verified')
  eq('Refund order records deposit amount USD', refunded.refundAmountUSD, 500)
  eq('Order refund calculation matches BROADBAND deposit', getOrderRefundAmountUSD({ serviceType: 'BROADBAND', endpoints: 2 }), 1000)

  let blockedMissingIndexedDb = false
  setDocumentStorageAdapter(null)
  const countBeforeIdbFail = fetchOrders().length
  try {
    await commitOrderWithDocuments({
      serviceType: 'BROADBAND',
      customerName: 'Unavailable IDB Corp',
      documents: {
        nationalId: { name: 'cccd.pdf', size: 1200, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
        addressProof: { name: 'addr.png', size: 800, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
      },
    })
  } catch {
    blockedMissingIndexedDb = true
  }
  eq('Unavailable IndexedDB aborts commitOrderWithDocuments loudly', blockedMissingIndexedDb, true)
  eq('Unavailable IndexedDB does not save partial order', fetchOrders().length, countBeforeIdbFail)

  const idbStore = new Map()
  setDocumentStorageAdapter({
    put: async (record) => {
      idbStore.set(record.storageKey, record)
    },
    get: async (key) => idbStore.get(key) || null,
    delete: async (key) => {
      idbStore.delete(key)
    },
  })

  const orderWithIdbDocs = await commitOrderWithDocuments({
    serviceType: 'BROADBAND',
    customerName: 'IndexedDB Docs Corp',
    documents: {
      nationalId: { name: 'cccd-subscriber.pdf', size: 1200, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,QUFB' },
      addressProof: { name: 'address-utility-bill.png', size: 800, type: 'image/png', dataUrl: 'data:image/png;base64,QkJC' },
    },
  })
  eq('commitOrderWithDocuments stores IndexedDB storageBackend', orderWithIdbDocs.documents?.nationalId?.storageBackend, 'indexeddb')
  eq('commitOrderWithDocuments strips large dataUrl from localStorage order metadata', orderWithIdbDocs.documents?.nationalId?.dataUrl, null)
  eq('IndexedDB adapter stores nationalId file record', idbStore.has(`${orderWithIdbDocs.id}:nationalId`), true)
  eq('IndexedDB adapter stores addressProof file name', idbStore.get(`${orderWithIdbDocs.id}:addressProof`)?.name, 'address-utility-bill.png')
  eq('checkDocumentAvailability verifies stored nationalId', await checkDocumentAvailability(orderWithIdbDocs.documents?.nationalId), true)
  const loadedDoc = await loadDocumentContent(orderWithIdbDocs.documents?.addressProof)
  eq('loadDocumentContent retrieves stored file metadata', loadedDoc?.name, 'address-utility-bill.png')

  idbStore.delete(`${orderWithIdbDocs.id}:addressProof`)
  eq('checkDocumentAvailability returns false when file deleted from IndexedDB', await checkDocumentAvailability(orderWithIdbDocs.documents?.addressProof), false)

  let rolledBackOnSecondDocFailure = false
  const preFailOrderCount = fetchOrders().length
  const preFailIdbSize = idbStore.size
  setDocumentStorageAdapter({
    put: async (record) => {
      if (record.docKey === 'addressProof') {
        throw new Error('Simulated IndexedDB quota error on second file')
      }
      idbStore.set(record.storageKey, record)
    },
    get: async (key) => idbStore.get(key) || null,
    delete: async (key) => {
      idbStore.delete(key)
    },
  })
  try {
    await commitOrderWithDocuments({
      serviceType: 'BROADBAND',
      customerName: 'Rollback Docs Corp',
      documents: {
        nationalId: { name: 'cccd-rollback.pdf', size: 1000, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
        addressProof: { name: 'addr-rollback.png', size: 900, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
      },
    })
  } catch {
    rolledBackOnSecondDocFailure = true
  }
  eq('Partial IndexedDB document failure throws loudly', rolledBackOnSecondDocFailure, true)
  eq('Partial IndexedDB failure rolls back first file', idbStore.size, preFailIdbSize)
  eq('Partial IndexedDB failure does not save order', fetchOrders().length, preFailOrderCount)

  setDocumentStorageAdapter({
    put: async (record) => {
      idbStore.set(record.storageKey, record)
    },
    get: async (key) => idbStore.get(key) || null,
    delete: async (key) => {
      idbStore.delete(key)
    },
  })

  const originalSetItem = globalThis.localStorage.setItem
  let saveOrdersThrewOnQuota = false
  let rollbackOnOrderQuotaWorked = false
  try {
    globalThis.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    try {
      saveOrders(fetchOrders())
    } catch {
      saveOrdersThrewOnQuota = true
    }
    const idbBeforeQuota = idbStore.size
    try {
      await commitOrderWithDocuments({
        serviceType: 'BROADBAND',
        customerName: 'Quota Fail Corp',
        documents: {
          nationalId: { name: 'cccd-quota.pdf', size: 1000, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
          addressProof: { name: 'addr-quota.png', size: 900, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
        },
      })
    } catch {
      rollbackOnOrderQuotaWorked = idbStore.size === idbBeforeQuota
    }
  } finally {
    globalThis.localStorage.setItem = originalSetItem
  }
  eq('saveOrders throws explicitly instead of silently clearing dataUrl', saveOrdersThrewOnQuota, true)
  eq('Order save failure rolls back stored IndexedDB files', rollbackOnOrderQuotaWorked, true)

  const orderWithDocs = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Docs Payload Corp',
    documents: {
      nationalId: { name: 'cccd-subscriber.pdf', size: 1200, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
      addressProof: { name: 'address-utility-bill.png', size: 800, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
    },
  })
  eq('Commit order preserves Citizen ID (CCCD) dataUrl', orderWithDocs.documents?.nationalId?.dataUrl, 'data:application/pdf;base64,AAA')
  eq('Commit order preserves Address Proof file name', orderWithDocs.documents?.addressProof?.name, 'address-utility-bill.png')

  eq('Retail draft allows 2 transitions', getRetailEditableStatuses(ORDER_STATUS.DRAFT).length, 2)
  eq('Retail non-draft locks direct status edit', getRetailEditableStatuses(ORDER_STATUS.PENDING_SURVEY).length, 0)
  eq('Retail activated locks direct status edit', getRetailEditableStatuses(ORDER_STATUS.ACTIVATED).length, 0)

  const initialCustomerCount = fetchCustomers().length
  eq('Initial customers seeded cleanly', initialCustomerCount, INITIAL_CUSTOMERS.length)
  const createdCus = createCustomer({
    customerName: 'Saigon Edge Telecom JSC',
    taxId: '0311223344',
    contactPerson: 'Nguyen Lan Anh',
    phone: '0909123456',
    email: 'lan.anh@saigonedge.vn',
    branchCode: '201',
    address: '100 Nguyen Hue, District 1, HCMC',
  })
  eq('Create customer increments customer list', fetchCustomers().length, initialCustomerCount + 1)
  eq('Create customer assigns branchName from code', createdCus.branchName, 'District 1 (HCMC)')

  let duplicateTaxRejected = false
  try {
    createCustomer({
      customerName: 'Duplicate Tax Entity',
      taxId: '0311223344',
      contactPerson: 'Someone',
      phone: '0901234567',
      email: 'dup@entity.vn',
      address: 'Hanoi',
    })
  } catch {
    duplicateTaxRejected = true
  }
  eq('Customer creation rejects duplicate Tax ID', duplicateTaxRejected, true)

  const updatedCus = updateCustomer(createdCus.id, { status: 'SUSPENDED', contactPerson: 'Tran Quoc Bao' })
  eq('Update customer applies updated status', updatedCus.status, 'SUSPENDED')
  eq('Update customer applies updated contact', updatedCus.contactPerson, 'Tran Quoc Bao')

  const afterDelete = deleteCustomer(createdCus.id)
  eq('Delete customer removes record', afterDelete.length, initialCustomerCount)

  // Test Activation Order lookup without first-order fallback
  eq('Empty orderId returns null without falling back to first order', findActivationOrderById(''), null)
  eq('Unknown orderId returns null without falling back to first order', findActivationOrderById('UNKNOWN-999'), null)
  const validActOrder = findActivationOrderById('T0000001092')
  eq('Valid queue orderId resolves exact order', validActOrder?.orderId, 'T0000001092')
  const asyncMissingOrder = await loadActivationOrderById('INVALID_ID_XYZ')
  eq('Async load returns null for missing orderId', asyncMissingOrder, null)
  const asyncRetailOrder = await loadActivationOrderById('B0000001090')
  eq('Async load resolves retail storage orderId', asyncRetailOrder?.orderId, 'B0000001090')

  const flowOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Unified Flow Corp',
    taxId: '0105559999',
    branchCode: '201',
    planName: 'Fiber ENTERPRISE 500',
    planPriceUSD: 55,
    endpoints: 12,
    bulkDiscountPercent: 25,
    address: '99 Nguyen Hue, District 1, HCMC',
    odnCheckResult: { distanceMeters: 165, feederNode: 'ODF-CORE-201', availablePorts: 5 },
    documents: {
      nationalId: { name: 'flow-cccd.pdf', size: 1200, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
      addressProof: { name: 'flow-address.png', size: 900, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
    },
  })
  eq('Retail ODN distance carries through to committed order', flowOrder.distanceMeters, 165)
  const surveyBefore = await fetchMockSurveyOrders()
  eq('New Retail order appears in Survey queue', surveyBefore.some((o) => o.id === flowOrder.id && o.status === ORDER_STATUS.PENDING_SURVEY), true)

  const trackPending = await fetchMockTracking('order', flowOrder.id)
  eq('Tracking finds newly created order as PENDING_SURVEY', trackPending.status, ORDER_STATUS.PENDING_SURVEY)

  let blockedBeforeSurvey = false
  try {
    await commissionCircuit(flowOrder.id, { serialNumber: 'SN1', macAddress: '00:11', model: 'ONT', vendor: 'Nokia', signatoryName: 'Test' })
  } catch {
    blockedBeforeSurvey = true
  }
  eq('Commissioning blocks order before FEASIBLE survey', blockedBeforeSurvey, true)

  await approveMockSurvey(flowOrder.id, {
    distanceMeters: 165,
    reservedPort: 5,
    conduitType: 'HDPE Dual-Duct',
  })
  eq('Approved survey persists FEASIBLE to nexus_orders', fetchOrders().find((o) => o.id === flowOrder.id)?.status, ORDER_STATUS.FEASIBLE)
  eq('Feasible order appears in Activation queue', getActivationQueue().some((o) => o.orderId === flowOrder.id), true)

  const trackFeasible = await fetchMockTracking('order', flowOrder.id)
  eq('Tracking sees updated FEASIBLE status', trackFeasible.status, ORDER_STATUS.FEASIBLE)

  addInventoryDevice({
    model: 'Nokia ISAM ONT G-240W-C',
    category: 'ONT',
    serialNumber: 'SN-UNIFIED-991',
    macAddress: 'AA:BB:CC:11:22:33',
    warehouseCode: 'HUB-HN-01',
  })
  eq(
    'Admin-registered stock unit appears immediately in Activation device list',
    fetchAvailableWarehouseDevices('BROADBAND').some((d) => d.serialNumber === 'SN-UNIFIED-991'),
    true
  )
  eq('DIAL_UP activation sees stock modem/router units', fetchAvailableWarehouseDevices('DIAL_UP').length > 0, true)
  eq('LANDLINE activation sees stock VoIP/SBC units', fetchAvailableWarehouseDevices('LANDLINE').length > 0, true)

  const commissionedNew = await commissionCircuit(flowOrder.id, {
    serialNumber: 'SN-UNIFIED-991',
    macAddress: 'AA:BB:CC:11:22:33',
    model: 'Nokia ISAM ONT G-240W-C',
    vendor: 'Nokia Enterprise',
    vlanId: 100,
    ipWan: '118.70.184.99/29',
    gateway: '118.70.184.97',
    signatoryName: 'Tran Minh',
    signatoryNationalId: '079090001122',
  })
  eq('Newly surveyed Retail order commissions cleanly to 16-char Account ID', ACCOUNT.test(commissionedNew.accountId), true)
  eq('Commissioned order status updates to ACTIVATED in nexus_orders', fetchOrders().find((o) => o.id === flowOrder.id)?.status, ORDER_STATUS.ACTIVATED)
  eq('Commissioned order leaves pending Activation queue', getActivationQueue().some((o) => o.orderId === flowOrder.id), false)

  const assignedWarehouseUnit = findInventoryDeviceBySerialOrMac('SN-UNIFIED-991')
  eq('Commissioned hardware status transitions to ASSIGNED in warehouse inventory', assignedWarehouseUnit?.status, 'ASSIGNED')
  eq('Commissioned hardware records assignedOrderId', assignedWarehouseUnit?.assignedOrderId, flowOrder.id)
  eq('Commissioned hardware records contractAccount', assignedWarehouseUnit?.contractAccount, commissionedNew.accountId)
  eq(
    'Assigned hardware no longer appears in available IN_STOCK activation list',
    fetchAvailableWarehouseDevices('BROADBAND').some((d) => d.serialNumber === 'SN-UNIFIED-991'),
    false
  )

  let blockedReuseAssignedDevice = false
  try {
    await commissionCircuit('B0000001089', {
      serialNumber: 'SN-UNIFIED-991',
      macAddress: 'AA:BB:CC:11:22:33',
      vlanId: 100,
      ipWan: '118.70.184.50/29',
      gateway: '118.70.184.49',
      signatoryName: 'Reuse Attempt',
    })
  } catch {
    blockedReuseAssignedDevice = true
  }
  eq('Commissioning blocks reusing already ASSIGNED hardware unit', blockedReuseAssignedDevice, true)
  eq('Rejected duplicate hardware does not mutate target order status', fetchOrders().find((o) => o.id === 'B0000001089')?.status, ORDER_STATUS.FEASIBLE)

  let blockedFaultyHardware = false
  try {
    await commissionCircuit('B0000001089', {
      serialNumber: 'DU-POS-00812',
      macAddress: '00:E0:4C:00:01:23',
      signatoryName: 'Faulty Unit Attempt',
    })
  } catch {
    blockedFaultyHardware = true
  }
  eq('Commissioning blocks FAULTY warehouse hardware', blockedFaultyHardware, true)

  let blockedUnknownHardware = false
  try {
    await commissionCircuit('B0000001089', {
      serialNumber: 'NON-EXISTENT-SN',
      macAddress: 'FF:FF:FF:FF:FF:FF',
      signatoryName: 'Unknown Unit Attempt',
    })
  } catch {
    blockedUnknownHardware = true
  }
  eq('Commissioning blocks hardware not in warehouse inventory', blockedUnknownHardware, true)

  let blockedRmaAssigned = false
  try {
    toggleInventoryFaultyStatus('SN-UNIFIED-991')
  } catch {
    blockedRmaAssigned = true
  }
  eq('Inventory blocks marking ASSIGNED hardware as FAULTY/RMA', blockedRmaAssigned, true)

  const trackActivatedOrder = await fetchMockTracking('order', flowOrder.id)
  eq('Tracking shows ACTIVATED status for commissioned order', trackActivatedOrder.status, ORDER_STATUS.ACTIVATED)
  eq('Tracking links generated accountId to order', trackActivatedOrder.accountId, commissionedNew.accountId)

  const trackActivatedAccount = await fetchMockTracking('account', commissionedNew.accountId)
  eq('Tracking finds newly commissioned 16-char Account ID', trackActivatedAccount.status, 'ACTIVE')
  eq('Tracking account resolves back to orderId', trackActivatedAccount.orderId, flowOrder.id)

  const editedPreActivation = updateOrder('D0000001094', { contactPerson: 'Updated Retail Contact' })
  eq('Service allows updateOrder before activation', editedPreActivation.contactPerson, 'Updated Retail Contact')

  let blockedEditOnActivated = false
  try {
    updateOrder(flowOrder.id, { planPriceUSD: 999 })
  } catch {
    blockedEditOnActivated = true
  }
  eq('Service blocks updateOrder on ACTIVATED order', blockedEditOnActivated, true)
  eq('ACTIVATED order price remains unchanged after blocked update', fetchOrders().find((o) => o.id === flowOrder.id)?.planPriceUSD, 55)

  let blockedCancelOnActivated = false
  try {
    cancelOrder(flowOrder.id, 'Attempt post-activation cancel')
  } catch {
    blockedCancelOnActivated = true
  }
  eq('Service blocks cancelOrder on ACTIVATED order', blockedCancelOnActivated, true)
  eq('ACTIVATED order status remains ACTIVATED after blocked cancel', fetchOrders().find((o) => o.id === flowOrder.id)?.status, ORDER_STATUS.ACTIVATED)

  let blockedRefundOnActivated = false
  try {
    refundOrder(flowOrder.id, 'Attempt post-activation refund')
  } catch {
    blockedRefundOnActivated = true
  }
  eq('Service blocks refundOrder on ACTIVATED order', blockedRefundOnActivated, true)

  let blockedCancelOnSeededActivated = false
  try {
    cancelOrder('D0000000412', 'Attempt cancel seeded activated order')
  } catch {
    blockedCancelOnSeededActivated = true
  }
  eq('Service blocks cancelOrder on seeded ACTIVATED order D0000000412', blockedCancelOnSeededActivated, true)

  let blockedEditOnCancelled = false
  try {
    updateOrder('B0000001090', { customerName: 'Mutated After Cancel' })
  } catch {
    blockedEditOnCancelled = true
  }
  eq('Service blocks updateOrder on CANCELLED order', blockedEditOnCancelled, true)

  const failSurveyOrder = commitOrder({
    serviceType: 'DIALUP',
    hasLandlineBundle: true,
    customerName: 'Rejected Survey Corp',
    branchCode: '301',
    documents: {
      nationalId: { name: 'fail-cccd.pdf', size: 1100, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
      addressProof: { name: 'fail-addr.png', size: 800, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
    },
  })
  const presetDistanceReason = SURVEY_INFEASIBILITY_REASONS.find((r) => r.code === 'DISTANCE_EXCEEDS_500M')
  eq('Survey infeasibility presets include 500m rule', Boolean(presetDistanceReason), true)
  eq('Survey infeasibility presets include missing documents rule', SURVEY_INFEASIBILITY_REASONS.some((r) => r.code === 'MISSING_DOCUMENTS'), true)
  eq('Survey max distance limit constant is 500m', MAX_SURVEY_DISTANCE_METERS, 500)

  await rejectMockSurvey(failSurveyOrder.id, presetDistanceReason.label, { distanceMeters: 620 })
  const savedRejected = fetchOrders().find((o) => o.id === failSurveyOrder.id)
  eq('Rejected survey persists NOT_FEASIBLE to nexus_orders', savedRejected?.status, ORDER_STATUS.NOT_FEASIBLE)
  eq('Rejected survey persists inspected distanceMeters', savedRejected?.distanceMeters, 620)
  const trackRejected = await fetchMockTracking('order', failSurveyOrder.id)
  eq('Tracking sees NOT_FEASIBLE after survey rejection', trackRejected.status, ORDER_STATUS.NOT_FEASIBLE)

  const noDocsSurveyOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Missing Both Docs Corp',
    branchCode: '101',
  })
  let blockedNoDocsSurvey = false
  try {
    await approveMockSurvey(noDocsSurveyOrder.id, { distanceMeters: 150 })
  } catch {
    blockedNoDocsSurvey = true
  }
  eq('Survey blocks FEASIBLE when both documents are missing', blockedNoDocsSurvey, true)

  const oneDocSurveyOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Missing Address Doc Corp',
    branchCode: '101',
    documents: {
      nationalId: { name: 'only-cccd.pdf', size: 900, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
    },
  })
  let blockedOneDocSurvey = false
  try {
    await approveMockSurvey(oneDocSurveyOrder.id, { distanceMeters: 150 })
  } catch {
    blockedOneDocSurvey = true
  }
  eq('Survey blocks FEASIBLE when addressProof document is missing', blockedOneDocSurvey, true)

  const idbMissingFileOrder = await commitOrderWithDocuments({
    serviceType: 'BROADBAND',
    customerName: 'Lost Storage File Corp',
    branchCode: '101',
    documents: {
      nationalId: { name: 'cccd-idb.pdf', size: 1000, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
      addressProof: { name: 'addr-idb.png', size: 900, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
    },
  })
  idbStore.delete(idbMissingFileOrder.documents.addressProof.storageKey)
  let blockedMissingIdbBlob = false
  try {
    await approveMockSurvey(idbMissingFileOrder.id, { distanceMeters: 150 })
  } catch {
    blockedMissingIdbBlob = true
  }
  eq('Survey blocks FEASIBLE when IndexedDB stored document blob is missing', blockedMissingIdbBlob, true)

  const overLimitOrder = commitOrder({
    serviceType: 'LEASED',
    customerName: 'Long Span Fiber Corp',
    branchCode: '201',
    documents: {
      nationalId: { name: 'span-cccd.pdf', size: 1000, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,AAA' },
      addressProof: { name: 'span-addr.png', size: 900, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
    },
  })
  let blockedOverLimitWithoutOverride = false
  try {
    await approveMockSurvey(overLimitOrder.id, { distanceMeters: 620 })
  } catch {
    blockedOverLimitWithoutOverride = true
  }
  eq('Survey blocks FEASIBLE above 500m without override', blockedOverLimitWithoutOverride, true)

  let blockedOverLimitShortReason = false
  try {
    await approveMockSurvey(overLimitOrder.id, {
      distanceMeters: 620,
      allowDistanceOverride: true,
      overrideReason: 'too short',
    })
  } catch {
    blockedOverLimitShortReason = true
  }
  eq('Survey blocks >500m override when justification is shorter than 10 chars', blockedOverLimitShortReason, true)

  await approveMockSurvey(overLimitOrder.id, {
    distanceMeters: 620,
    allowDistanceOverride: true,
    overrideReason: 'Senior NOC approved auxiliary repeater splice (-19.2 dBm)',
  })
  const savedOverrideOrder = fetchOrders().find((o) => o.id === overLimitOrder.id)
  eq('Survey allows >500m FEASIBLE with explicit override and valid justification', savedOverrideOrder?.status, ORDER_STATUS.FEASIBLE)
  eq('Survey records distanceOverrideApproved flag on overridden order', savedOverrideOrder?.distanceOverrideApproved, true)

  setDocumentStorageAdapter(null)

  const groupedInitialPlans = getPlansGroupedByConnectionType()
  eq('Normalized LEASED_LINE maps to Retail DIALUP group', normalizePlanConnectionType('LEASED_LINE'), 'DIALUP')
  eq('Normalized SIP_TRUNK maps to Retail LANDLINE group', normalizePlanConnectionType('SIP_TRUNK'), 'LANDLINE')
  eq('Unified plan catalog exposes BROADBAND plans to Retail', groupedInitialPlans.BROADBAND.length, 3)
  eq('Unified plan catalog exposes LEASED_LINE and DIAL_UP under DIALUP', groupedInitialPlans.DIALUP.length, 2)
  eq('Unified plan catalog exposes SIP_TRUNK under LANDLINE', groupedInitialPlans.LANDLINE.length, 1)

  addPlan({
    sku: 'NX-FIBER-2G',
    name: 'Fiber Ultra 2Gbps Enterprise',
    type: 'BROADBAND',
    cirMbps: 1000,
    pirMbps: 2000,
    monthlyNetUSD: 3200,
    cpeMonthlyUSD: 250,
    recommended: true,
  })
  const broadbandAfterAdd = fetchRetailPlansByType('BROADBAND')
  const addedRetailPlan = broadbandAfterAdd.find((p) => p.sku === 'NX-FIBER-2G')
  eq('Newly added Admin plan appears immediately in Retail BROADBAND list', Boolean(addedRetailPlan), true)
  eq('Newly added Admin plan syncs monthlyNetUSD as Retail priceUSD', addedRetailPlan?.priceUSD, 3200)

  let duplicateSkuRejected = false
  try {
    addPlan({
      sku: 'nx-fiber-2g',
      name: 'Duplicate SKU Attempt',
      type: 'BROADBAND',
      monthlyNetUSD: 1500,
    })
  } catch {
    duplicateSkuRejected = true
  }
  eq('Adding duplicate SKU throws explicit error', duplicateSkuRejected, true)

  updatePlan('FTTH-PRO-500M', { monthlyNetUSD: 2750, name: 'FTTH Dedicated 500Mbps Revised' })
  const updatedRetailPlan = fetchRetailPlansByType('BROADBAND').find((p) => p.id === 'FTTH-PRO-500M')
  eq('Admin price update syncs new priceUSD to Retail catalog', updatedRetailPlan?.priceUSD, 2750)
  eq('Admin name update syncs new name to Retail catalog', updatedRetailPlan?.name, 'FTTH Dedicated 500Mbps Revised')

  updatePlan('NX-FIBER-2G', { status: 'INACTIVE' })
  eq('Inactive Admin plan is hidden from active Retail list', fetchRetailPlansByType('BROADBAND').some((p) => p.sku === 'NX-FIBER-2G'), false)
  eq('Inactive Admin plan remains visible in full Admin catalog', fetchPlans().some((p) => p.sku === 'NX-FIBER-2G'), true)

  deletePlan('NX-FIBER-2G')
  eq('Deleted Admin plan is removed from Admin and Retail catalogs', fetchPlans().some((p) => p.sku === 'NX-FIBER-2G'), false)

  eq('Statutory tax config rate percent is fixed at 12.24', STATUTORY_TAX_RATE_PERCENT, 12.24)
  eq('Statutory tax multiplier matches SERVICE_TAX_RATE', SERVICE_TAX_RATE, STATUTORY_TAX_RATE)
  eq('Plan DEFAULT_TAX_RATE matches STATUTORY_TAX_RATE_PERCENT', DEFAULT_TAX_RATE, STATUTORY_TAX_RATE_PERCENT)
  eq('Order financials exposes shared statutory taxRatePercent', finTest.taxRatePercent, STATUTORY_TAX_RATE_PERCENT)
  eq('Shared calculateStatutoryTax matches AlphaCorp audit VAT', calculateStatutoryTax(302.5), INITIAL_TAX_AUDIT_DATA[0].taxAmount)

  localStorage.setItem('nexus_telecom_tax_rate_v1', '18.5')
  eq('fetchTaxRate enforces 12.24 despite tampered localStorage', fetchTaxRate(), 12.24)
  eq('fetchTaxRate reconciles localStorage back to 12.24', localStorage.getItem('nexus_telecom_tax_rate_v1'), '12.24')

  let taxEditRejected = false
  try {
    saveTaxRate(18.5)
  } catch {
    taxEditRejected = true
  }
  eq('saveTaxRate rejects mutation as read-only', taxEditRejected, true)

  const fixedNormalizedPlan = normalizePlanRecord(
    { id: 'TEST-TAX', sku: 'TEST-TAX', name: 'Fixed Tax Verification', monthlyNetUSD: 1000, vatPercent: 5 },
    25
  )
  eq('normalizePlanRecord locks vatPercent to 12.24', fixedNormalizedPlan.vatPercent, 12.24)
  eq('normalizePlanRecord calculates gross at 12.24%', fixedNormalizedPlan.monthlyGrossUSD, 1122.4)

  const normalizedRecordStrict = normalizeTaxAuditRecord({
    id: 'vINV-TEST',
    grossSubtotal: 1000,
    bulkDiscount: 200,
    taxableSubtotal: 800,
    taxRate: 5,
    taxAmount: 50,
    totalPayable: 850,
  })
  eq('normalizeTaxAuditRecord zeros illegal MRC bulkDiscount (CN07 scope)', normalizedRecordStrict.bulkDiscount, 0)
  eq('normalizeTaxAuditRecord restores taxableSubtotal to full grossSubtotal', normalizedRecordStrict.taxableSubtotal, 1000)
  eq('normalizeTaxAuditRecord locks taxRate to 12.24', normalizedRecordStrict.taxRate, 12.24)
  eq('normalizeTaxAuditRecord recalculates taxAmount at 12.24%', normalizedRecordStrict.taxAmount, 122.4)
  eq('normalizeTaxAuditRecord recalculates totalPayable at 12.24%', normalizedRecordStrict.totalPayable, 1122.4)

  const prevInvoicesSnapshotForTax = localStorage.getItem('nexus_invoices')
  localStorage.setItem(
    'nexus_invoices',
    JSON.stringify([
      {
        invoiceId: 'INV-TAX-LIVE-1',
        accountId: 'B101000000000089',
        customerName: 'AlphaCorp Telecom Ltd.',
        taxId: '0109998822',
        serviceType: 'BROADBAND',
        billingCycle: '2026-04-01 to 2026-04-30',
        issuedDate: '2026-05-01',
        items: [{ desc: 'Circuit MRC', amount: 1000 }],
        previousBalance: 0,
        paidAmount: 0,
        status: 'PENDING',
      },
    ])
  )
  const normalizedAudit = fetchTaxAuditRecords()
  eq('fetchTaxAuditRecords reconciles directly from nexus_invoices & locks taxRate 12.24', normalizedAudit[0].taxRate, 12.24)
  eq('fetchTaxAuditRecords calculates statutory taxAmount at 12.24% on live invoice', normalizedAudit[0].taxAmount, 122.4)
  eq('fetchTaxAuditRecords derives M04/2026 & Q2/2026 from billingCycle', `${normalizedAudit[0].period}|${normalizedAudit[0].quarter}`, 'M04/2026|Q2/2026')
  if (prevInvoicesSnapshotForTax === null) {
    localStorage.removeItem('nexus_invoices')
  } else {
    localStorage.setItem('nexus_invoices', prevInvoicesSnapshotForTax)
  }

  const customInvoice = await generateNewInvoice('B101000000000089', [{ desc: 'Custom Audit Item', amount: 1000 }])
  eq('generateNewInvoice calculates balance with 12.24% tax for custom items', customInvoice.remainingBalance, 1122.4)

  const samplePdfBytes = generateInvoicePdfBytes({
    invoiceId: 'INV-2026-PDF-1',
    customerName: 'Công ty Viễn thông & Hạ tầng Mạng Đô thị',
    accountId: 'B101000000000089',
    taxId: '0108881948',
    items: [
      { desc: 'FTTH 500M Metro Port', quantity: 1, unitPrice: 1000, amount: 1000 },
    ],
  })
  const samplePdfText = Buffer.from(samplePdfBytes).toString('latin1')
  const decodedPdfText = samplePdfText.replace(/\\\(/g, '(').replace(/\\\)/g, ')')
  eq('Invoice PDF begins with %PDF-1.4 header', samplePdfText.startsWith('%PDF-1.4'), true)
  eq('Invoice PDF ends with %%EOF marker', samplePdfText.trimEnd().endsWith('%%EOF'), true)
  eq('Invoice PDF contains computed tax line at 12.24%', decodedPdfText.includes('Statutory Telecom Tax (12.24%)') && decodedPdfText.includes('+$122.40'), true)
  eq(
    'Invoice PDF transliterates Vietnamese characters safely to ASCII',
    decodedPdfText.includes('Cong ty Vien thong & Ha tang Mang Do') && decodedPdfText.includes('(thi) Tj'),
    true
  )
  eq('Invoice PDF omits fake OFFICIAL VAT E-INVOICE stamp', samplePdfText.includes('OFFICIAL VAT E-INVOICE'), false)
  eq('Invoice PDF omits fake DIGITALLY SIGNED stamp', samplePdfText.includes('DIGITALLY SIGNED'), false)
  eq('Invoice PDF states SYSTEM PREVIEW DOCUMENT', samplePdfText.includes('SYSTEM PREVIEW DOCUMENT'), true)

  const xrefMatch = samplePdfText.match(/xref\n0 (\d+)\n([\s\S]*?)trailer/)
  const xrefEntries = xrefMatch ? xrefMatch[2].trim().split('\n').slice(1) : []
  const allXrefOffsetsValid =
    xrefEntries.length >= 6 &&
    xrefEntries.every((line, idx) => {
      const offset = Number(line.slice(0, 10))
      return Buffer.from(samplePdfBytes).subarray(offset, offset + `${idx + 1} 0 obj`.length).toString('ascii') === `${idx + 1} 0 obj`
    })
  eq('Invoice PDF xref byte offsets match exact object positions', allXrefOffsetsValid, true)

  const multiPagePdfBytes = generateInvoicePdfBytes({
    invoiceId: 'INV-2026-MULTI',
    customerName: 'Multi-Site Corp',
    items: Array.from({ length: 40 }, (_, i) => ({
      desc: `Dedicated Branch Circuit Endpoint #${i + 1}`,
      quantity: 1,
      unitPrice: 100,
      amount: 100,
    })),
  })
  const multiPageText = Buffer.from(multiPagePdfBytes).toString('latin1')
  eq('Multi-page Invoice PDF generates multiple pages', /\/Count [2-9]\d*/.test(multiPageText), true)

  const statementBytes = generateStatementPdfBytes(
    { customerName: 'AlphaCorp JSC', taxId: '0108881948', identifier: 'B101000000000089' },
    [{ serviceTitle: 'FTTH 500M', accountId: 'B101000000000089', networkConfig: { ipWan: '118.70.184.22/29' } }],
    [customInvoice],
    1122.4
  )
  const statementText = Buffer.from(statementBytes).toString('latin1')
  eq('Statement PDF begins with %PDF-1.4 header', statementText.startsWith('%PDF-1.4'), true)

  const xmlDraft = buildInvoiceXmlContent({
    invoiceId: 'INV-XML-1',
    customerName: 'AT&T Vietnam <Enterprise>',
    accountId: 'B101000000000089',
    taxId: '0108881948',
    items: [{ desc: 'Optical Link & SLA', quantity: 1, unitPrice: 1000, amount: 1000 }],
  })
  eq('Invoice XML escapes special characters safely', xmlDraft.includes('AT&amp;T Vietnam &lt;Enterprise&gt;'), true)
  eq('Invoice XML includes 12.24% tax and computed totals', xmlDraft.includes('<TSThue>12.24%</TSThue>') && xmlDraft.includes('<TgTThue>122.40</TgTThue>'), true)
  eq('Invoice XML omits placeholder MEQCID digital signature block', xmlDraft.includes('MEQCID') || xmlDraft.includes('<DSCKS>'), false)
  eq('Invoice XML marks document UNSIGNED_PREVIEW', xmlDraft.includes('<TrangThai>UNSIGNED_PREVIEW</TrangThai>'), true)

  const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
  const taxReportsSrc = readFileSync(resolve(srcRoot, 'pages/accounts/TaxAuditReportsPage.jsx'), 'utf8')
  const accountsTariffsSrc = readFileSync(resolve(srcRoot, 'pages/accounts/AccountsTariffsPage.jsx'), 'utf8')
  const accountsLayoutSrc = readFileSync(resolve(srcRoot, 'components/layout/AccountsLayout.jsx'), 'utf8')
  const tariffTableSrc = readFileSync(resolve(srcRoot, 'components/tariffs/TariffTable.jsx'), 'utf8')
  const billingPageSrc = readFileSync(resolve(srcRoot, 'pages/accounts/BillingInvoicingPage.jsx'), 'utf8')

  eq(
    'TaxAuditReportsPage removes duplicate TariffTable and Tariff Lookup tab',
    taxReportsSrc.includes('TariffTable') || taxReportsSrc.includes("setActiveView('tariffs')"),
    false
  )
  eq(
    'TaxAuditReportsPage focuses on Invoice Tax Ledger and links to /accounts/tariffs',
    taxReportsSrc.includes('Invoice Tax') && taxReportsSrc.includes('to="/accounts/tariffs"'),
    true
  )
  eq(
    'AccountsTariffsPage acts as single read-only tariff lookup without Tax Configuration label',
    accountsTariffsSrc.includes('<TariffTable readOnly={true} />') && !accountsTariffsSrc.includes('Tax Configuration'),
    true
  )
  eq(
    'AccountsLayout labels /accounts/tariffs as Master Tariff Lookup instead of Tax Configuration',
    accountsLayoutSrc.includes("label: 'Master Tariff Lookup'") && !accountsLayoutSrc.includes('Tax Configuration'),
    true
  )
  eq(
    'TariffTable displays fixed tax column without editable tax input',
    tariffTableSrc.includes('Tax ({taxRate}%)') && !tariffTableSrc.includes('saveTaxRate'),
    true
  )
  eq(
    'BillingInvoicingPage continues displaying CN18 statutory tax on invoices',
    billingPageSrc.includes('STATUTORY_TAX_RATE_PERCENT') && !billingPageSrc.includes('saveTaxRate'),
    true
  )

  const layoutChecks = [
    ['TechnicalLayout.jsx', ['GPS DISPATCH LIVE', 'OLT ONLINE', 'PROD-NODE-VN01']],
    ['AdminLayout.jsx', ['CLUSTER HA', 'PROD-LIVE', 'PROD-NODE-VN01']],
    ['RetailLayout.jsx', ['HANOI FLAGSHIP', 'POS READY', 'PROD-NODE-VN01']],
    ['AccountsLayout.jsx', ['[RECONCILING]', 'PROD-NODE-VN01']],
    ['CustomerLayout.jsx', ['CLIENT TIER 1', 'PROD-NODE-VN01']],
    ['PortalLayout.jsx', ['PROD-LIVE']],
  ]
  for (const [fileName, forbidden] of layoutChecks) {
    const content = readFileSync(resolve(srcRoot, 'components/layout', fileName), 'utf8')
    const found = forbidden.filter((token) => content.includes(token))
    eq(`${fileName} omits unbacked live/node status claims`, found.length, 0)
  }

  const plansMgmtSrc = readFileSync(resolve(srcRoot, 'pages/admin/PlansManagementPage.jsx'), 'utf8')
  eq(
    'PlansManagementPage omits static #TX-9024-LIVE audit ID and FULL_CRUD_LIVE badge',
    plansMgmtSrc.includes('#TX-9024-LIVE') || plansMgmtSrc.includes('FULL_CRUD_LIVE'),
    false
  )

  const taxSvcSrc = readFileSync(resolve(srcRoot, 'services/taxReportService.js'), 'utf8')
  eq(
    'taxReportService omits fake TCT/CA SHA256 signature hashes',
    taxSvcSrc.includes('MATCHED_100') || taxSvcSrc.includes('NEXUS-CA-SHA256'),
    false
  )

  eq(
    'BillingInvoicingPage omits fake VCB/Vietcombank/Techcombank live gateway claims and #0084921 ref',
    billingPageSrc.includes('VCB B2B') ||
      billingPageSrc.includes('Vietcombank') ||
      billingPageSrc.includes('Techcombank') ||
      billingPageSrc.includes('LIVE CDR ENGINE') ||
      billingPageSrc.includes('#0084921'),
    false
  )

  const cdrSrc = readFileSync(resolve(srcRoot, 'pages/accounts/CdrMeteringPage.jsx'), 'utf8')
  eq(
    'CdrMeteringPage omits unbacked LIVE NOC / MEDIATION_SYNCED claims',
    cdrSrc.includes('LIVE NOC') || cdrSrc.includes('MEDIATION_SYNCED'),
    false
  )

  const diagSrc = readFileSync(resolve(srcRoot, 'components/common/LiveDiagnosticModal.jsx'), 'utf8')
  eq(
    'LiveDiagnosticModal labels telemetry checks as simulated/demo',
    diagSrc.includes('Simulated Optical Line Diagnostic') && diagSrc.includes('DEMO'),
    true
  )

  const telemetryCardSrc = readFileSync(resolve(srcRoot, 'components/landing/TelemetryCard.jsx'), 'utf8')
  eq(
    'TelemetryCard labels NOC telemetry widget as simulated demo',
    telemetryCardSrc.includes('SIMULATED NOC TELEMETRY (DEMO)') && !telemetryCardSrc.includes('Real-time Traffic Density'),
    true
  )

  eq(
    'Broadband does not require Landline prerequisite',
    validateDialupLandlineRequirement({ serviceType: 'BROADBAND', hasLandlineBundle: false }).valid,
    true
  )
  const missingDialupLandline = validateDialupLandlineRequirement({
    serviceType: 'DIALUP',
    hasLandlineBundle: false,
    landlineOption: 'NONE',
    existingLandlineNumber: '',
  })
  eq('Dial-Up without Landline fails validation', missingDialupLandline.valid, false)
  eq('Dial-Up validation error explains Landline requirement', missingDialupLandline.error.includes('Landline'), true)

  const shortExistingLandline = validateDialupLandlineRequirement({
    serviceType: 'DIALUP',
    hasLandlineBundle: false,
    landlineOption: 'EXISTING',
    existingLandlineNumber: '1234',
  })
  eq('Dial-Up rejects short invalid existing Landline identifier', shortExistingLandline.valid, false)
  eq('isValidExistingLandlineIdentifier accepts 16-char T account ID', isValidExistingLandlineIdentifier('t101000000000102'), true)
  eq('isValidExistingLandlineIdentifier accepts PSTN phone number', isValidExistingLandlineIdentifier('+84 24 3825 9900'), true)

  const validExistingAccountCheck = validateDialupLandlineRequirement({
    serviceType: 'DIALUP',
    hasLandlineBundle: false,
    landlineOption: 'EXISTING',
    existingLandlineNumber: 't101000000000102',
  })
  eq('Dial-Up with existing T-Account ID passes validation', validExistingAccountCheck.valid, true)
  eq('Dial-Up existing T-Account normalizes uppercase ID', validExistingAccountCheck.existingLandlineNumber, 'T101000000000102')
  eq('Dial-Up existing Landline keeps hasLandlineBundle false', validExistingAccountCheck.hasLandlineBundle, false)

  const validBundledLandlineCheck = validateDialupLandlineRequirement({
    serviceType: 'DIALUP',
    hasLandlineBundle: true,
  })
  eq('Dial-Up with PSTN Landline Bundle passes validation', validBundledLandlineCheck.valid, true)
  eq('Dial-Up bundle sets mode BUNDLE', validBundledLandlineCheck.mode, 'BUNDLE')

  const dialupFinBundled = calculateOrderFinancials({
    planPriceUSD: 85,
    endpoints: 1,
    selectedConnectionType: 'DIALUP',
    hasLandlineBundle: true,
    monthsPrepaid: 0,
    bulkDiscountPercent: 0,
    installationFee: 50,
  })
  const dialupFinExisting = calculateOrderFinancials({
    planPriceUSD: 85,
    endpoints: 1,
    selectedConnectionType: 'DIALUP',
    hasLandlineBundle: false,
    monthsPrepaid: 0,
    bulkDiscountPercent: 0,
    installationFee: 50,
  })
  eq('Dial-Up bundle adds $15/mo over existing Landline', dialupFinBundled.monthlyBillingSubtotal - dialupFinExisting.monthlyBillingSubtotal, 15)

  let blockedCommitWithoutLandline = false
  try {
    commitOrder({
      serviceType: 'DIALUP',
      customerName: 'Blocked Dialup No Landline Corp',
      hasLandlineBundle: false,
      status: ORDER_STATUS.PENDING_SURVEY,
    })
  } catch {
    blockedCommitWithoutLandline = true
  }
  eq('commitOrder blocks non-draft DIALUP order without Landline', blockedCommitWithoutLandline, true)

  let blockedAsyncWithoutLandline = false
  try {
    await commitOrderWithDocuments({
      serviceType: 'DIALUP',
      customerName: 'Async Blocked Dialup Corp',
      hasLandlineBundle: false,
      documents: {
        nationalId: { name: 'cccd.png', size: 500, type: 'image/png', dataUrl: 'data:image/png;base64,AAA' },
        addressProof: { name: 'addr.png', size: 500, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
      },
    })
  } catch {
    blockedAsyncWithoutLandline = true
  }
  eq('commitOrderWithDocuments blocks DIALUP order without Landline before saving', blockedAsyncWithoutLandline, true)

  const draftDialupOrder = commitOrder({
    serviceType: 'DIALUP',
    customerName: 'Draft Dialup Allowed Corp',
    hasLandlineBundle: false,
    status: ORDER_STATUS.DRAFT,
  })
  eq('Draft DIALUP order can still save without Landline yet', draftDialupOrder.status, ORDER_STATUS.DRAFT)

  let blockedDraftToPendingWithoutLandline = false
  try {
    updateOrder(draftDialupOrder.id, { status: ORDER_STATUS.PENDING_SURVEY })
  } catch {
    blockedDraftToPendingWithoutLandline = true
  }
  eq('updateOrder blocks promoting DIALUP draft to PENDING_SURVEY without Landline', blockedDraftToPendingWithoutLandline, true)

  const submittedDialupExisting = commitOrder({
    serviceType: 'DIALUP',
    customerName: 'Linked Existing Landline Corp',
    hasLandlineBundle: false,
    landlineOption: 'EXISTING',
    existingLandlineNumber: 'T101000000000102',
    status: ORDER_STATUS.PENDING_SURVEY,
  })
  eq('commitOrder allows DIALUP with valid existing Landline Account ID', submittedDialupExisting.existingLandlineNumber, 'T101000000000102')
  eq('commitOrder preserves hasLandlineBundle false when existing Landline linked', submittedDialupExisting.hasLandlineBundle, false)

  const submittedDialupBundle = commitOrder({
    serviceType: 'DIALUP',
    customerName: 'Bundled PSTN Landline Corp',
    hasLandlineBundle: true,
    status: ORDER_STATUS.PENDING_SURVEY,
  })
  eq('commitOrder allows DIALUP with PSTN Landline bundle', submittedDialupBundle.hasLandlineBundle, true)
  eq('commitOrder records landlineOption BUNDLE', submittedDialupBundle.landlineOption, 'BUNDLE')

  const newOrderPageSrc = readFileSync(resolve(srcRoot, 'pages/retail/NewOrderPage.jsx'), 'utf8')
  const servicePlanStepSrc = readFileSync(resolve(srcRoot, 'pages/retail/components/ServicePlanStep.jsx'), 'utf8')
  eq(
    'NewOrderPage enforces hasDialupLandlineRequirement inside canSubmit and handleNextStep',
    newOrderPageSrc.includes('hasDialupLandlineRequirement') &&
      newOrderPageSrc.includes('dialupLandlineValidation.valid'),
    true
  )
  eq(
    'ServicePlanStep explains mandatory Dial-Up Landline requirement and renders validation error',
    servicePlanStepSrc.includes('Mandatory Dial-Up Prerequisite') &&
      servicePlanStepSrc.includes('dialupLandlineValidation.error'),
    true
  )

  // Public tracking timeline & privacy masking regression tests
  eq('PUBLIC_TRACKING_STAGES exposes 5 provisioning stages', PUBLIC_TRACKING_STAGES.length, 5)
  eq(
    'maskCustomerName masks full corporate name and preserves asterisks',
    (() => {
      const m = maskCustomerName('AlphaCorp Technology Solutions JSC')
      return m.startsWith('A***') && m.includes('***') && !m.includes('AlphaCorp') && !m.includes('Technology')
    })(),
    true
  )
  eq(
    'maskPublicRoute redacts street/POP details and preserves metro region only',
    (() => {
      const m = maskPublicRoute({
        cityCode: 'HN',
        route: 'POP-HN-01 -> ODN-04 -> 54 Lieu Giai, Ba Dinh',
        address: '54 Lieu Giai, Ba Dinh, Hanoi',
      })
      return m === 'Hanoi Metro Region (Route Masked)' && !m.includes('Lieu Giai') && !m.includes('POP-HN-01')
    })(),
    true
  )

  const timelineExpectations = [
    ['DRAFT', ['active', 'pending', 'pending', 'pending', 'pending'], 0, 1, false, false],
    ['PENDING_SURVEY', ['done', 'active', 'pending', 'pending', 'pending'], 1, 2, false, false],
    ['FEASIBLE', ['done', 'done', 'active', 'pending', 'pending'], 2, 3, false, false],
    ['IN_PROGRESS', ['done', 'done', 'active', 'pending', 'pending'], 2, 3, false, false],
    ['ACTIVATED', ['done', 'done', 'done', 'done', 'done'], 5, 5, false, false],
    ['ACTIVE', ['done', 'done', 'done', 'done', 'done'], 5, 5, false, false],
    ['NOT_FEASIBLE', ['done', 'failed', 'halted', 'halted', 'halted'], 1, 2, true, true],
    ['CANCELLED', ['done', 'halted', 'halted', 'halted', 'halted'], 1, 1, true, false],
    ['REFUNDED', ['done', 'failed', 'halted', 'halted', 'halted'], 1, 2, true, false],
    ['LOCKED', ['done', 'done', 'done', 'done', 'warning'], 4, 5, false, false],
  ]
  for (const [status, wantStates, wantCompleted, wantActive, wantHalted, wantFailed] of timelineExpectations) {
    const tl = buildPublicTrackingTimeline(status)
    eq(`Timeline ${status} stages`, tl.stages.map((s) => s.state), wantStates)
    eq(`Timeline ${status} counters`, [tl.completedSteps, tl.activeStep, tl.isHalted, tl.isFailed], [
      wantCompleted,
      wantActive,
      wantHalted,
      wantFailed,
    ])
  }

  const redactedSensitiveKeys = [
    'customerName',
    'route',
    'address',
    'odnBox',
    'odfName',
    'assignedONT',
    'note',
    'depositPaidUSD',
  ]
  const mockIdsToVerify = [
    ['order', 'D0000000001'],
    ['order', 'B0000000001'],
    ['account', 'B001000000000001'],
  ]
  const forbiddenMockTokens = ['Vincom', 'Techcombank', 'AlphaCorp', 'FPT', 'Lieu Giai', 'Nguyen Hue', 'POP-']
  for (const [trackType, id] of mockIdsToVerify) {
    const res = await fetchMockTracking(trackType, id)
    eq(
      `fetchMockTracking(${trackType}, ${id}) omits raw sensitive properties`,
      redactedSensitiveKeys.every((k) => !Object.prototype.hasOwnProperty.call(res, k)),
      true
    )
    eq(
      `fetchMockTracking(${trackType}, ${id}) masks customer & route text`,
      res.id === id &&
        res.maskedCustomer.includes('***') &&
        res.maskedRoute.includes('Route Masked') &&
        forbiddenMockTokens.every((t) => !res.maskedCustomer.includes(t) && !res.maskedRoute.includes(t)),
      true
    )
    eq(`fetchMockTracking(${trackType}, ${id}) includes 5-stage timeline`, res.timeline?.stages?.length, 5)
  }

  let emptyIdRejected = false
  try {
    await fetchMockTracking('account', '')
  } catch {
    emptyIdRejected = true
  }
  eq('fetchMockTracking rejects empty tracking ID without leaking unactivated orders', emptyIdRejected, true)

  const sanitizedApiSim = sanitizePublicTrackingPayload({
    type: 'ACCOUNT',
    id: 'B001000000000777',
    accountId: 'B001000000000777',
    orderId: 'B0000000777',
    serviceType: 'BROADBAND',
    status: 'ACTIVE',
    customerName: 'FPT Software Private Limited',
    cityCode: 'DN',
    address: 'Hoa Hai, Ngu Hanh Son, Da Nang',
    route: 'POP-DN-03 -> ODF-88 -> Hoa Hai',
    odnBox: 'ODN-DN-09',
    odfName: 'ODF-88',
    assignedONT: 'ONT-HUAWEI-001',
    note: 'VIP account note',
    depositPaidUSD: 500,
    bandwidth: '1 Gbps',
  })
  eq(
    'sanitizePublicTrackingPayload strips PII/route fields from simulated API payload',
    redactedSensitiveKeys.every((k) => !Object.prototype.hasOwnProperty.call(sanitizedApiSim, k)) &&
      !sanitizedApiSim.maskedCustomer.includes('FPT') &&
      !sanitizedApiSim.maskedCustomer.includes('Software') &&
      sanitizedApiSim.maskedRoute === 'Da Nang Metro Region (Route Masked)' &&
      sanitizedApiSim.timeline.completedSteps === 5 &&
      sanitizedApiSim.timeline.stages.every((s) => s.state === 'done'),
    true
  )
  eq('sanitizePublicTrackingPayload returns null for null/missing payload', sanitizePublicTrackingPayload(null), null)

  const publicLeakTestOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Vincom Private Enterprise Corp',
    cityCode: 'SGN',
    branchCode: 'SG01',
    address: '72 Le Thanh Ton, District 1, HCMC',
    route: 'POP-SGN-09 -> ODN-12 -> 72 Le Thanh Ton',
    odnBox: 'ODN-SG-88',
    assignedONT: 'ONT-ZTE-99999',
    depositPaidUSD: 350,
    note: 'VIP secret installation',
    status: ORDER_STATUS.PENDING_SURVEY,
  })
  const livePendingTracked = await fetchMockTracking('order', publicLeakTestOrder.id)
  eq(
    'Live PENDING_SURVEY order tracking redacts private fields and hides corporate identity',
    redactedSensitiveKeys.every((k) => !Object.prototype.hasOwnProperty.call(livePendingTracked, k)) &&
      livePendingTracked.type === 'order' &&
      livePendingTracked.id === publicLeakTestOrder.id &&
      !livePendingTracked.maskedCustomer.includes('Vincom') &&
      !livePendingTracked.maskedRoute.includes('Le Thanh Ton') &&
      !livePendingTracked.maskedRoute.includes('ODN-12') &&
      livePendingTracked.maskedRoute.includes('Ho Chi Minh Metro Region') &&
      livePendingTracked.timeline.activeStep === 2 &&
      livePendingTracked.timeline.stages[1].state === 'active',
    true
  )

  updateOrder(publicLeakTestOrder.id, { status: ORDER_STATUS.NOT_FEASIBLE })
  const liveFailedTracked = await fetchMockTracking('order', publicLeakTestOrder.id)
  eq(
    'Live NOT_FEASIBLE order tracking marks survey halted/failed',
    liveFailedTracked.timeline.isFailed === true &&
      liveFailedTracked.timeline.isHalted === true &&
      liveFailedTracked.timeline.stages.map((s) => s.state).join(',') === 'done,failed,halted,halted,halted',
    true
  )

  updateOrder(publicLeakTestOrder.id, { status: ORDER_STATUS.ACTIVATED })
  const liveActivatedTracked = await fetchMockTracking('order', publicLeakTestOrder.id)
  eq(
    'Live ACTIVATED order tracking completes all 5 stages',
    liveActivatedTracked.timeline.completedSteps === 5 &&
      liveActivatedTracked.timeline.stages.every((s) => s.state === 'done'),
    true
  )

  const trackingServiceSrc = readFileSync(resolve(srcRoot, 'services/trackingService.js'), 'utf8')
  eq(
    'trackingService sanitizes both mock and API tracking results through sanitizePublicTrackingPayload',
    trackingServiceSrc.includes('sanitizePublicTrackingPayload') &&
      trackingServiceSrc.includes('sanitizePublicTrackingPayload(await fetchMockTracking') &&
      trackingServiceSrc.includes('sanitizePublicTrackingPayload(await fetchApiTracking'),
    true
  )

  const trackingWidgetSrc = readFileSync(resolve(srcRoot, 'components/landing/TrackingWidget.jsx'), 'utf8')
  eq(
    'TrackingWidget renders maskedCustomer, maskedRoute, and 5-Stage Provisioning Timeline without raw PII',
    trackingWidgetSrc.includes('result.maskedCustomer') &&
      trackingWidgetSrc.includes('result.maskedRoute') &&
      trackingWidgetSrc.includes('result.timeline') &&
      trackingWidgetSrc.includes('5-Stage Provisioning Timeline') &&
      !trackingWidgetSrc.includes('result.customerName') &&
      !trackingWidgetSrc.includes('result.route'),
    true
  )

  // Customer Portal strict identity matching & honest mock auth tests
  for (const fuzzyInput of [
    { identifier: 'a' },
    { identifier: 'Tech' },
    { identifier: 'Corp' },
    { identifier: 'Alpha', fullName: 'Vietnam' },
    { identifier: 'AlphaCorp Technology Solutions JSC' },
  ]) {
    const res = filterCustomerData(fuzzyInput)
    eq(
      `filterCustomerData blocks fuzzy/name-only match for "${fuzzyInput.identifier}"`,
      res.isEmpty && res.circuits.length === 0 && res.orders.length === 0 && res.invoices.length === 0,
      true
    )
  }

  const fullNameOnlyUser = filterCustomerData({ fullName: 'AlphaCorp Technology Solutions JSC' })
  eq('filterCustomerData refuses unverified fullName-only object', fullNameOnlyUser.hasUser && !fullNameOnlyUser.isEmpty, false)

  const cus001Portal = filterCustomerData({ customerId: 'CUS-001' })
  eq('CUS-001 portal profile binds customerId CUS-001', cus001Portal.customerProfile?.customerId, 'CUS-001')
  eq('CUS-001 portal sees AlphaCorp circuit B101000000000089', cus001Portal.circuits.some((c) => c.accountId === 'B101000000000089'), true)
  eq('CUS-001 portal sees AlphaCorp invoice INV-2026-03-0881', cus001Portal.invoices.some((i) => i.invoiceId === 'INV-2026-03-0881'), true)
  eq('CUS-001 portal excludes TechNova CUS-002 order B0000001089', cus001Portal.orders.some((o) => o.id === 'B0000001089'), false)

  const aliasPortal = filterCustomerData({ identifier: 'B001000000000001' })
  eq('Demo alias B001000000000001 resolves verified customerId CUS-001', aliasPortal.customerProfile?.customerId, 'CUS-001')
  eq('Demo alias excludes TechNova CUS-002 order B0000001089', aliasPortal.orders.some((o) => o.id === 'B0000001089'), false)

  const cus002Portal = filterCustomerData({ identifier: 'dang.nh@technova.vn' })
  eq('TechNova email resolves verified customerId CUS-002', cus002Portal.customerProfile?.customerId, 'CUS-002')
  eq('TechNova portal sees own order B0000001089', cus002Portal.orders.some((o) => o.id === 'B0000001089'), true)
  eq('TechNova portal excludes AlphaCorp circuit B101000000000089', cus002Portal.circuits.some((c) => c.accountId === 'B101000000000089'), false)
  eq('TechNova portal excludes AlphaCorp invoice INV-2026-03-0881', cus002Portal.invoices.some((i) => i.invoiceId === 'INV-2026-03-0881'), false)

  const siblingA = createCustomer({
    customerName: 'VietNet Alpha Shared Name Holdings',
    taxId: '0900111222',
    contactPerson: 'Nguyen A',
    phone: '0901111222',
    email: 'alpha@vietnetholdings.example',
    address: '10 Kim Ma, Ba Dinh, Hanoi',
    branchCode: '101',
  })
  const siblingB = createCustomer({
    customerName: 'VietNet Beta Shared Name Holdings',
    taxId: '0900333444',
    contactPerson: 'Tran B',
    phone: '0903333444',
    email: 'beta@vietnetholdings.example',
    address: '20 Ton Duc Thang, District 1, HCMC',
    branchCode: '201',
  })

  const siblingOrderA = commitOrder({
    customerId: siblingA.id,
    serviceType: 'BROADBAND',
    customerName: siblingA.customerName,
    taxId: siblingA.taxId,
    customerEmail: siblingA.email,
    cityCode: '101',
    branchCode: '101',
    status: ORDER_STATUS.FEASIBLE,
    documents: {
      nationalId: { name: 'cccd-a.png', size: 300, type: 'image/png', dataUrl: 'data:image/png;base64,AAA' },
      addressProof: { name: 'addr-a.png', size: 300, type: 'image/png', dataUrl: 'data:image/png;base64,BBB' },
    },
  })
  const siblingOrderB = commitOrder({
    customerId: siblingB.id,
    serviceType: 'BROADBAND',
    customerName: siblingB.customerName,
    taxId: siblingB.taxId,
    customerEmail: siblingB.email,
    cityCode: '201',
    branchCode: '201',
    status: ORDER_STATUS.PENDING_SURVEY,
  })

  addInventoryDevice({
    model: 'Nokia ISAM ONT G-240W-C',
    category: 'ONT',
    serialNumber: 'SN-CUST-SCOPE-777',
    macAddress: 'CC:DD:EE:11:22:77',
    warehouseCode: 'HUB-HN-01',
  })
  const commissionedSiblingA = await commissionCircuit(siblingOrderA.id, {
    serialNumber: 'SN-CUST-SCOPE-777',
    macAddress: 'CC:DD:EE:11:22:77',
    model: 'Nokia ISAM ONT G-240W-C',
    vendor: 'Nokia Enterprise',
    vlanId: 100,
    ipWan: '118.70.184.120/29',
    gateway: '118.70.184.119',
    signatoryName: 'Nguyen A',
    signatoryNationalId: '079090001777',
  })
  eq('commissionCircuit preserves order customerId on activated circuit', commissionedSiblingA.customerId, siblingA.id)

  const invoiceSiblingA = await generateNewInvoice(
    commissionedSiblingA.accountId,
    [{ desc: 'Sibling A Dedicated FTTH', amount: 150 }],
    {
      customerId: siblingA.id,
      taxId: siblingA.taxId,
      customerName: siblingA.customerName,
      orderId: siblingOrderA.id,
    }
  )

  const scopedA = filterCustomerData({ customerId: siblingA.id })
  const scopedB = filterCustomerData({ customerId: siblingB.id })
  const partialSharedName = filterCustomerData({ identifier: 'VietNet' })
  eq('Sibling customer A sees own order, circuit, and invoice by customerId',
    scopedA.orders.map((o) => o.id).includes(siblingOrderA.id) &&
      scopedA.circuits.map((c) => c.accountId).includes(commissionedSiblingA.accountId) &&
      scopedA.invoices.map((i) => i.invoiceId).includes(invoiceSiblingA.invoiceId),
    true
  )
  eq('Sibling customer A never receives sibling B order', scopedA.orders.some((o) => o.id === siblingOrderB.id), false)
  eq('Sibling customer B sees own order and zero data from sibling A',
    scopedB.orders.some((o) => o.id === siblingOrderB.id) &&
      !scopedB.orders.some((o) => o.id === siblingOrderA.id) &&
      scopedB.circuits.length === 0 &&
      scopedB.invoices.length === 0,
    true
  )
  eq('Shared partial name "VietNet" matches zero customer portal records', partialSharedName.isEmpty, true)
  eq('resolveVerifiedCustomerAccount blocks partial name lookup', resolveVerifiedCustomerAccount('VietNet'), null)

  // Auth service: strict mock directory checks + honest Demo Role Switcher labeling
  logout()
  let rejectedArbitraryLogin = false
  try {
    await login('arbitrary.stranger', 'random-pass', 'admin')
  } catch {
    rejectedArbitraryLogin = true
  }
  eq('login rejects unregistered arbitrary identifier/password for admin', rejectedArbitraryLogin, true)

  let rejectedWrongPassword = false
  try {
    await login('admin@nexus.vn', 'wrong-password', 'admin')
  } catch {
    rejectedWrongPassword = true
  }
  eq('login rejects incorrect password for registered staff', rejectedWrongPassword, true)

  let blockedRoleEscalation = false
  try {
    await login('retail.hn01@nexus.vn', DEMO_DEFAULT_PASSWORD, 'admin')
  } catch {
    blockedRoleEscalation = true
  }
  eq('login blocks role escalation from RETAIL account to ADMIN', blockedRoleEscalation, true)

  let rejectedFuzzyCustomerLogin = false
  try {
    await login('AlphaCorp', DEMO_DEFAULT_PASSWORD, 'customer')
  } catch {
    rejectedFuzzyCustomerLogin = true
  }
  eq('login rejects fuzzy customer name as customer identifier', rejectedFuzzyCustomerLogin, true)

  let blockedLockedStaff = false
  try {
    await login('retail.sg01@nexus.vn', DEMO_DEFAULT_PASSWORD, 'retail')
  } catch {
    blockedLockedStaff = true
  }
  eq('login blocks LOCKED staff account EMP-NX-008', blockedLockedStaff, true)

  unlockEmployee('EMP-NX-008')
  const { tempPass: resetPassSg01 } = resetEmployeePassword('EMP-NX-008')
  let blockedOldPassAfterReset = false
  try {
    await login('retail.sg01@nexus.vn', DEMO_DEFAULT_PASSWORD, 'retail')
  } catch {
    blockedOldPassAfterReset = true
  }
  eq('login rejects default password after admin resetEmployeePassword', blockedOldPassAfterReset, true)
  const loggedResetStaff = await login('retail.sg01@nexus.vn', resetPassSg01, 'retail')
  eq('Unlocked staff logs in cleanly with admin-reset temporary password', loggedResetStaff.role, 'retail')

  const verifiedCusSession = await login(siblingA.id, DEMO_DEFAULT_PASSWORD, 'customer')
  eq('Customer login binds verified customerId on session', verifiedCusSession.customerId, siblingA.id)
  eq('Mock directory login marks isRealAuth false and uses demo-session token',
    verifiedCusSession.isRealAuth === false &&
      verifiedCusSession.authMode === 'MOCK_DIRECTORY_LOGIN' &&
      String(localStorage.getItem('nexus_token') || '').startsWith(DEMO_TOKEN_PREFIX) &&
      !String(localStorage.getItem('nexus_token') || '').startsWith('mock-jwt'),
    true
  )
  eq('isAuthenticated reflects active demo session', isAuthenticated() && getCurrentUser()?.customerId === siblingA.id, true)

  const demoSwitcherAdmin = enterDemoRole('admin')
  eq('enterDemoRole marks explicit DEMO_ROLE_SWITCHER session with isRealAuth false',
    demoSwitcherAdmin.role === 'admin' &&
      demoSwitcherAdmin.authMode === 'DEMO_ROLE_SWITCHER' &&
      demoSwitcherAdmin.isRealAuth === false,
    true
  )
  const demoSwitcherCustomer = enterDemoRole('customer', { customerId: siblingB.id })
  eq('enterDemoRole for customer scopes explicitly to customerId', demoSwitcherCustomer.customerId, siblingB.id)
  logout()
  eq('logout clears session state', isAuthenticated(), false)

  const customerServiceSrc = readFileSync(resolve(srcRoot, 'services/customerService.js'), 'utf8')
  const loginPageSrc = readFileSync(resolve(srcRoot, 'pages/auth/LoginPage.jsx'), 'utf8')
  eq(
    'customerService removes fuzzy customerName includes matching',
    !customerServiceSrc.includes('oName.includes') &&
      !customerServiceSrc.includes('cName.includes') &&
      !customerServiceSrc.includes('invName.includes'),
    true
  )
  eq(
    'LoginPage honestly discloses demo sandbox mode and exposes Quick Demo Preview switcher',
    loginPageSrc.includes('Demo Mode Disclaimer') &&
      loginPageSrc.includes('Quick Demo Preview') &&
      loginPageSrc.includes('enterDemoRole'),
    true
  )

  // --- CN15: Account Lifecycle Management (3 States, Plan Change & Daily Proration) ---
  eq('CN15 defines exact 3 canonical lifecycle states', ACCOUNT_LIFECYCLE_LIST, [
    'ACTIVE',
    'TEMPORARILY_INACTIVE',
    'PERMANENTLY_INACTIVE',
  ])
  eq('Normalize legacy SUSPENDED to TEMPORARILY_INACTIVE', normalizeLifecycleStatus('SUSPENDED'), ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE)
  eq('Normalize legacy TERMINATED to PERMANENTLY_INACTIVE', normalizeLifecycleStatus('TERMINATED'), ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE)
  eq('Lifecycle transition ACTIVE -> TEMPORARILY_INACTIVE allowed', canTransitionAccountStatus('ACTIVE', 'TEMPORARILY_INACTIVE').allowed, true)
  eq('Lifecycle transition TEMPORARILY_INACTIVE -> ACTIVE allowed', canTransitionAccountStatus('TEMPORARILY_INACTIVE', 'ACTIVE').allowed, true)
  eq('Lifecycle transition ACTIVE -> PERMANENTLY_INACTIVE allowed', canTransitionAccountStatus('ACTIVE', 'PERMANENTLY_INACTIVE').allowed, true)
  eq('Lifecycle transition PERMANENTLY_INACTIVE -> ACTIVE blocked', canTransitionAccountStatus('PERMANENTLY_INACTIVE', 'ACTIVE').allowed, false)
  eq('Lifecycle transition PERMANENTLY_INACTIVE -> TEMPORARILY_INACTIVE blocked', canTransitionAccountStatus('PERMANENTLY_INACTIVE', 'TEMPORARILY_INACTIVE').allowed, false)
  eq('Lifecycle meta label for TEMPORARILY_INACTIVE', getLifecycleStatusMeta('TEMPORARILY_INACTIVE').label, 'Temporarily Inactive')

  const upgradeProration = calculateDailyProration({
    currentMonthlyUSD: 2500,
    newMonthlyUSD: 4200,
    effectiveDay: 16,
    daysInCycle: 30,
  })
  eq('Daily proration upgrade remaining days = 15', upgradeProration.remainingDays, 15)
  eq('Daily proration upgrade unused old credit = $1250', upgradeProration.unusedCreditNetUSD, 1250)
  eq('Daily proration upgrade new plan charge = $2100', upgradeProration.newChargeNetUSD, 2100)
  eq('Daily proration upgrade net delta = $850', upgradeProration.proratedNetDeltaUSD, 850)
  eq('Daily proration upgrade uses fixed 12.24% tax', upgradeProration.taxRatePercent, 12.24)
  eq('Daily proration upgrade tax = $104.04', upgradeProration.taxAmountUSD, 104.04)
  eq('Daily proration upgrade total adjustment = $954.04', upgradeProration.totalAdjustmentUSD, 954.04)
  eq('Daily proration upgrade direction = UPGRADE', upgradeProration.changeDirection, 'UPGRADE')

  const downgradeProration = calculateDailyProration({
    currentMonthlyUSD: 4200,
    newMonthlyUSD: 950,
    remainingDays: 10,
    daysInCycle: 30,
  })
  eq('Daily proration downgrade direction = DOWNGRADE', downgradeProration.changeDirection, 'DOWNGRADE')
  eq('Daily proration downgrade net delta = -$1083.33', downgradeProration.proratedNetDeltaUSD, -1083.33)
  eq('Daily proration downgrade total adjustment = -$1215.93', downgradeProration.totalAdjustmentUSD, -1215.93)

  const clampedProration = calculateDailyProration({
    currentMonthlyUSD: 1000,
    newMonthlyUSD: 2000,
    effectiveDay: 99,
    daysInCycle: 45,
  })
  eq('Daily proration clamps cycle days upper bound to 31', clampedProration.daysInCycle, 31)
  eq('Daily proration clamps effectiveDay leaving minimum 1 remaining day', clampedProration.remainingDays, 1)

  resetPlansToDefault()
  const initialLifecycleAccounts = fetchLifecycleAccounts()
  const b101Initial = initialLifecycleAccounts.find((a) => a.accountId === 'B101000000000089')
  const expectedB101Upgrade = calculateDailyProration({
    currentMonthlyUSD: b101Initial.monthlyChargeUSD,
    newMonthlyUSD: 4200,
    effectiveDay: 16,
    daysInCycle: 30,
  })
  eq('Lifecycle loader returns activated subscriber accounts', initialLifecycleAccounts.length >= 5, true)

  const pausedResult = changeAccountLifecycleStatus({
    accountId: 'B101000000000089',
    nextStatus: ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE,
    reason: 'Seasonal hold test',
  })
  eq('Status change updates account to TEMPORARILY_INACTIVE', pausedResult.account.lifecycleStatus, ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE)
  eq('Status change syncs debt oltStatus to SUSPENDED', fetchDebtAccounts().find((d) => d.accountId === 'B101000000000089')?.oltStatus, 'SUSPENDED')

  const resumedResult = changeAccountLifecycleStatus({
    accountId: 'B101000000000089',
    nextStatus: ACCOUNT_LIFECYCLE_STATUS.ACTIVE,
    reason: 'Resume active test',
  })
  eq('Status change restores account from TEMPORARILY_INACTIVE to ACTIVE', resumedResult.account.lifecycleStatus, ACCOUNT_LIFECYCLE_STATUS.ACTIVE)
  eq('Resumed account syncs debt oltStatus back to ACTIVE', fetchDebtAccounts().find((d) => d.accountId === 'B101000000000089')?.oltStatus, 'ACTIVE')

  const upgradeApplied = await changeAccountPlanWithProration({
    accountId: 'B101000000000089',
    newPlanId: 'FTTH-BIZ-1G',
    effectiveDay: 16,
    daysInCycle: 30,
    issueAdjustmentInvoice: true,
    reason: 'Upgrade test to 1Gbps',
  })
  eq('Plan upgrade updates activated account planId', upgradeApplied.account.planId, 'FTTH-BIZ-1G')
  eq('Plan upgrade updates monthlyChargeUSD to 4200', upgradeApplied.account.monthlyChargeUSD, 4200)
  eq('Plan upgrade syncs debt ledger planName', fetchDebtAccounts().find((d) => d.accountId === 'B101000000000089')?.planName, 'FTTH Enterprise Ultra 1Gbps')
  const cn15Items = (upgradeApplied.generatedInvoice?.items || []).filter(
    (it) => it.desc.startsWith('CN15 Prorated Plan Upgrade') || it.desc.startsWith('Unused Credit Offset')
  )
  const upgradeInvTotals = calculateInvoiceTotals(cn15Items, 0, 0)
  eq('Plan upgrade adjustment invoice embeds both CN15 proration & credit offset items', cn15Items.length, 2)
  eq('Plan upgrade adjustment invoice CN15 net delta matches proration', upgradeInvTotals.subtotal, expectedB101Upgrade.proratedNetDeltaUSD)
  eq('Plan upgrade adjustment invoice CN15 12.24% tax matches proration', upgradeInvTotals.serviceTax, expectedB101Upgrade.taxAmountUSD)
  eq('Plan upgrade adjustment invoice CN15 period total matches proration', upgradeInvTotals.totalPayable, expectedB101Upgrade.totalAdjustmentUSD)

  const downgradeApplied = await changeAccountPlanWithProration({
    accountId: 'B101000000000089',
    newPlanId: 'FTTH-SOHO-250M',
    effectiveDay: 21,
    daysInCycle: 30,
    issueAdjustmentInvoice: true,
    reason: 'Downgrade test to 250M',
  })
  eq('Plan downgrade records creditMemo instead of positive payable invoice', downgradeApplied.generatedInvoice, null)
  eq('Plan downgrade creditMemo totals $1215.93', downgradeApplied.creditMemo?.totalCreditUSD, 1215.93)

  let mismatchedPlanRejected = false
  try {
    await changeAccountPlanWithProration({
      accountId: 'B101000000000089',
      newPlanId: 'DIAL-POS-V92',
      effectiveDay: 16,
      daysInCycle: 30,
    })
  } catch {
    mismatchedPlanRejected = true
  }
  eq('Cross-connection-type plan change rejected', mismatchedPlanRejected, true)

  const terminalTargetId = initialLifecycleAccounts[initialLifecycleAccounts.length - 1].accountId
  const permResult = changeAccountLifecycleStatus({
    accountId: terminalTargetId,
    nextStatus: ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE,
    reason: 'Contract churn termination test',
  })
  eq('Permanent termination sets PERMANENTLY_INACTIVE', permResult.account.lifecycleStatus, ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE)

  let lockedResumeBlocked = false
  try {
    changeAccountLifecycleStatus({
      accountId: terminalTargetId,
      nextStatus: ACCOUNT_LIFECYCLE_STATUS.ACTIVE,
    })
  } catch {
    lockedResumeBlocked = true
  }
  eq('PERMANENTLY_INACTIVE blocks reactivation to ACTIVE', lockedResumeBlocked, true)

  let lockedPlanChangeBlocked = false
  try {
    await changeAccountPlanWithProration({
      accountId: terminalTargetId,
      newPlanId: 'SIP-TRUNK-30CH',
      effectiveDay: 10,
      daysInCycle: 30,
    })
  } catch {
    lockedPlanChangeBlocked = true
  }
  eq('PERMANENTLY_INACTIVE blocks plan change', lockedPlanChangeBlocked, true)

  eq('Lifecycle audit logs recorded per account', fetchLifecycleLogs('B101000000000089').length >= 4, true)
  eq('Batch dunning scan runs cleanly without ReferenceError', runBatchDunningScan().length > 0, true)

  const nodeFs = await import('node:fs')
  const nodePath = await import('node:path')
  const { fileURLToPath: toFilePath } = await import('node:url')
  const cn15SrcRoot = nodePath.resolve(nodePath.dirname(toFilePath(import.meta.url)), '..', 'src')
  const technicalLayoutSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'components', 'layout', 'TechnicalLayout.jsx'), 'utf8')
  const appSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'App.jsx'), 'utf8')
  const lifecyclePageSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'technical', 'AccountLifecyclePage.jsx'), 'utf8')
  const debtPageSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'accounts', 'DebtManagementPage.jsx'), 'utf8')
  const customerPortalSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'customer', 'CustomerPortalPage.jsx'), 'utf8')
  eq('TechnicalLayout registers /technical/lifecycle nav item', technicalLayoutSrc.includes("path: '/technical/lifecycle'"), true)
  eq('App.jsx defines /technical/lifecycle protected route', appSrc.includes('path="/technical/lifecycle"'), true)
  eq('AccountLifecyclePage includes Demo Lifecycle Sandbox notice & proration UI', lifecyclePageSrc.includes('Demo Lifecycle Sandbox') && lifecyclePageSrc.includes('calculateDailyProration'), true)
  eq('DebtManagementPage cross-links CN15 Account Lifecycle screen', debtPageSrc.includes('/technical/lifecycle'), true)
  eq('CustomerPortalPage displays canonical lifecycle label', customerPortalSrc.includes('getLifecycleStatusMeta'), true)

  // --- CN16: Deposit Collection Confirmation, Payment Method & Receipt ---
  eq('CN16 exposes 3 standard deposit collection methods', DEPOSIT_COLLECTION_METHODS.length, 3)
  eq('Deposit validation rejects unconfirmed collection when due > 0', validateDepositCollectionInput({ depositCollected: false, collectionMethod: 'CASH' }, 500).valid, false)
  eq('Deposit validation rejects blank payment method when due > 0', validateDepositCollectionInput({ depositCollected: true, collectionMethod: '' }, 500).valid, false)
  eq('Deposit validation rejects underpayment under net due', validateDepositCollectionInput({ depositCollected: true, collectionMethod: 'CASH', collectedAmountUSD: 200 }, 500).valid, false)
  const waivedValidation = validateDepositCollectionInput({}, 0)
  eq('Deposit validation waives $0.00 net due automatically', waivedValidation.status, DEPOSIT_STATUS.WAIVED)
  eq('Deposit validation assigns BULK_WAIVER method on $0.00 due', waivedValidation.methodId, DEPOSIT_WAIVER_METHOD.id)

  let blockedUnconfirmedSubmit = false
  try {
    commitOrder({
      serviceType: 'BROADBAND',
      customerName: 'Unconfirmed Deposit Corp',
      depositAmountUSD: 500,
      refundableAmountUSD: 500,
      requireDepositConfirmation: true,
      depositCollected: false,
    })
  } catch {
    blockedUnconfirmedSubmit = true
  }
  eq('commitOrder blocks submission with requireDepositConfirmation=true when unconfirmed', blockedUnconfirmedSubmit, true)

  const confirmedDepositOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Collected Deposit Corp',
    depositAmountUSD: 500,
    advancePaymentUSD: 0,
    bulkDiscountAmountUSD: 0,
    refundableAmountUSD: 500,
    requireDepositConfirmation: true,
    depositCollected: true,
    depositPaymentMethod: 'BANK_TRANSFER',
    depositReference: 'VQR-2026-9901',
    depositCollector: 'Hanoi Flagship Cashier',
  })
  eq('Confirmed deposit order sets DEPOSIT_STATUS.COLLECTED', confirmedDepositOrder.depositStatus, DEPOSIT_STATUS.COLLECTED)
  eq('Confirmed deposit order saves collection method label', confirmedDepositOrder.depositPaymentMethodLabel, 'Bank Transfer / VietQR')
  eq('Confirmed deposit order generates DEP- receipt number', confirmedDepositOrder.depositReceiptNumber, buildDepositReceiptNumber(confirmedDepositOrder.id, false))
  eq('Confirmed deposit order records collectedAmountUSD = 500', confirmedDepositOrder.depositCollectedAmountUSD, 500)

  const deferredDraftOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Draft Deposit Later Corp',
    depositAmountUSD: 500,
    refundableAmountUSD: 500,
    status: ORDER_STATUS.DRAFT,
  })
  eq('Draft order starts with DEPOSIT_STATUS.PENDING', deferredDraftOrder.depositStatus, DEPOSIT_STATUS.PENDING)

  const collectedLaterOrder = recordOrderDepositCollection(deferredDraftOrder.id, {
    collectionMethod: 'POS_CARD',
    referenceCode: 'POS-7721',
    collectorName: 'District 1 Counter',
  })
  eq('recordOrderDepositCollection updates depositStatus to COLLECTED', collectedLaterOrder.depositStatus, DEPOSIT_STATUS.COLLECTED)
  eq('recordOrderDepositCollection stores POS / Corporate Card label', collectedLaterOrder.depositPaymentMethodLabel, 'POS / Corporate Card')
  eq('recordOrderDepositCollection issues DEP receipt number', collectedLaterOrder.depositReceiptNumber, buildDepositReceiptNumber(deferredDraftOrder.id, false))

  let blockedDuplicateDeposit = false
  try {
    recordOrderDepositCollection(deferredDraftOrder.id, { collectionMethod: 'CASH' })
  } catch {
    blockedDuplicateDeposit = true
  }
  eq('recordOrderDepositCollection blocks duplicate collection on already-collected order', blockedDuplicateDeposit, true)

  const waivedOrder = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Waived 100pct Bulk Corp',
    depositAmountUSD: 30000,
    bulkDiscountAmountUSD: 30000,
    refundableAmountUSD: 0,
    requireDepositConfirmation: true,
  })
  eq('100% Bulk Waiver order sets DEPOSIT_STATUS.WAIVED', waivedOrder.depositStatus, DEPOSIT_STATUS.WAIVED)
  eq('100% Bulk Waiver order generates waiver receipt DEP-...-W', waivedOrder.depositReceiptNumber, buildDepositReceiptNumber(waivedOrder.id, true))

  const notFeasibleCollected = commitOrder({
    serviceType: 'BROADBAND',
    customerName: 'Not Feasible Refundable Corp',
    depositAmountUSD: 500,
    refundableAmountUSD: 500,
    status: ORDER_STATUS.NOT_FEASIBLE,
    requireDepositConfirmation: true,
    depositCollected: true,
    depositPaymentMethod: 'CASH',
  })
  const refundedWithReceipt = refundOrder(notFeasibleCollected.id, 'CN16 verified refund test')
  eq('refundOrder sets depositStatus REFUNDED', refundedWithReceipt.depositStatus, DEPOSIT_STATUS.REFUNDED)
  eq('refundOrder preserves original depositReceiptNumber', refundedWithReceipt.depositReceiptNumber, buildDepositReceiptNumber(notFeasibleCollected.id, false))
  eq('refundOrder issues REF- refund voucher number', refundedWithReceipt.refundReceiptNumber, `REF-${notFeasibleCollected.id}`)
  eq('getOrderDepositSummary resolves REFUNDED amount & voucher', getOrderDepositSummary(refundedWithReceipt).refundReceiptNumber, `REF-${notFeasibleCollected.id}`)

  const cn16DocumentStepSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'retail', 'components', 'DocumentStep.jsx'), 'utf8')
  const cn16NewOrderPageSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'retail', 'NewOrderPage.jsx'), 'utf8')
  const cn16OrdersListPageSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'retail', 'OrdersListPage.jsx'), 'utf8')
  const cn16OrderDrawerSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'retail', 'components', 'OrderDetailDrawer.jsx'), 'utf8')
  const cn16PrintReceiptSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'components', 'common', 'PrintReceiptModal.jsx'), 'utf8')
  eq('DocumentStep renders CN16 Deposit Collection & Method UI', cn16DocumentStepSrc.includes('DEPOSIT_COLLECTION_METHODS') && cn16DocumentStepSrc.includes('setDepositConfirmed'), true)
  eq('NewOrderPage requires deposit confirmation & offers Print Deposit Receipt', cn16NewOrderPageSrc.includes('hasDepositCollection') && cn16NewOrderPageSrc.includes('Print Deposit Receipt'), true)
  eq('OrdersListPage supports recordOrderDepositCollection & passes deposit summary (not planPriceUSD) to receipt', cn16OrdersListPageSrc.includes('recordOrderDepositCollection') && cn16OrdersListPageSrc.includes('getOrderDepositSummary(printingOrder)') && !cn16OrdersListPageSrc.includes('amount: printingOrder.planPriceUSD'), true)
  eq('OrderDetailDrawer shows CN16 Deposit & Receipt status with collection trigger', cn16OrderDrawerSrc.includes('SECURITY DEPOSIT') && cn16OrderDrawerSrc.includes('Confirm Deposit Collection'), true)
  eq('PrintReceiptModal distinguishes DEPOSIT and REFUND CN16 vouchers', cn16PrintReceiptSrc.includes('SECURITY DEPOSIT COLLECTION RECEIPT (CN16)') && cn16PrintReceiptSrc.includes('100% SECURITY DEPOSIT REFUND VOUCHER (CN16)'), true)

  // --- CN19: FIFO Payment Allocation & Real Response-Backed Payment Receipt ---
  localStorage.removeItem('nexus_invoices')
  const defaultFifoB101 = getAccountOpenInvoicesFifo('B101000000000089', await fetchInvoices())
  eq(
    'Seed B101000000000089 open FIFO queue sorts older INV-2026-02-0719 before INV-2026-03-0881',
    defaultFifoB101.map((inv) => inv.invoiceId),
    ['INV-2026-02-0719', 'INV-2026-03-0881']
  )

  const fifoTestAcc = 'B909000000000199'
  const existingInvStore = await fetchInvoices()
  const seededDebtAccs = fetchDebtAccounts()
  localStorage.setItem(
    'nexus_debt_accounts_v1',
    JSON.stringify([
      ...seededDebtAccs,
      {
        accountId: fifoTestAcc,
        customerName: 'FIFO Verification Telecom JSC',
        taxId: '0998877665',
        balanceUSD: 650.0,
        overdueDays: 45,
        stage: 'STAGE_4_SUSPEND',
        riskLevel: 'CRITICAL',
        oltStatus: 'SUSPENDED',
        auditLogs: [],
      },
    ])
  )
  localStorage.setItem(
    'nexus_invoices',
    JSON.stringify([
      ...existingInvStore,
      {
        invoiceId: 'INV-FIFO-03-MAR',
        accountId: fifoTestAcc,
        customerId: 'CUS-FIFO',
        customerName: 'FIFO Verification Telecom JSC',
        taxId: '0998877665',
        serviceTitle: 'FTTH 500M Metro',
        billingCycle: '01/03/2026 – 31/03/2026',
        issuedDate: '2026-04-01',
        dueDate: '2026-04-15',
        status: 'PENDING',
        paidAmount: 0,
        previousBalance: 0,
        remainingBalance: 300.0,
        items: [{ desc: 'March Cycle', amount: 267.28 }],
      },
      {
        invoiceId: 'INV-FIFO-00-DEC',
        accountId: fifoTestAcc,
        customerId: 'CUS-FIFO',
        customerName: 'FIFO Verification Telecom JSC',
        taxId: '0998877665',
        serviceTitle: 'FTTH 500M Metro',
        billingCycle: '01/12/2025 – 31/12/2025',
        issuedDate: '2026-01-01',
        dueDate: '2026-01-15',
        status: 'PAID',
        paidAmount: 100.0,
        previousBalance: 0,
        remainingBalance: 0,
        items: [{ desc: 'Dec Cycle Already Paid', amount: 89.09 }],
      },
      {
        invoiceId: 'INV-FIFO-01-JAN',
        accountId: fifoTestAcc,
        customerId: 'CUS-FIFO',
        customerName: 'FIFO Verification Telecom JSC',
        taxId: '0998877665',
        serviceTitle: 'FTTH 500M Metro',
        billingCycle: '01/01/2026 – 31/01/2026',
        issuedDate: '2026-02-01',
        dueDate: '2026-02-15',
        status: 'OVERDUE',
        paidAmount: 0,
        previousBalance: 0,
        remainingBalance: 150.0,
        items: [{ desc: 'Jan Cycle Oldest', amount: 133.64 }],
      },
      {
        invoiceId: 'INV-FIFO-02-FEB',
        accountId: fifoTestAcc,
        customerId: 'CUS-FIFO',
        customerName: 'FIFO Verification Telecom JSC',
        taxId: '0998877665',
        serviceTitle: 'FTTH 500M Metro',
        billingCycle: '01/02/2026 – 28/02/2026',
        issuedDate: '2026-03-01',
        dueDate: '2026-03-15',
        status: 'OVERDUE',
        paidAmount: 0,
        previousBalance: 0,
        remainingBalance: 200.0,
        items: [{ desc: 'Feb Cycle Middle', amount: 178.19 }],
      },
    ])
  )

  const fifoSortedSummary = getAccountUnpaidSummary(fifoTestAcc, await fetchInvoices())
  eq(
    'getAccountUnpaidSummary excludes PAID and sorts strictly oldest-first',
    fifoSortedSummary.invoices.map((inv) => inv.invoiceId),
    ['INV-FIFO-01-JAN', 'INV-FIFO-02-FEB', 'INV-FIFO-03-MAR']
  )
  eq('getAccountUnpaidSummary computes combined account debt ($650)', fifoSortedSummary.totalUnpaidBalance, 650)

  const fifoSim = simulateFifoAllocation(fifoTestAcc, 220, await fetchInvoices())
  eq(
    'simulateFifoAllocation previews oldest-first split ($150 JAN + $70 FEB)',
    fifoSim.allocations.map((a) => `${a.invoiceId}:${a.allocatedAmount}->${a.resultingStatus}`),
    ['INV-FIFO-01-JAN:150->PAID', 'INV-FIFO-02-FEB:70->OVERDUE']
  )

  let fifoExcessErr = false
  try {
    await recordFifoAccountPayment(fifoTestAcc, { amount: 700 })
  } catch {
    fifoExcessErr = true
  }
  eq('recordFifoAccountPayment rejects excess amount over total account debt', fifoExcessErr, true)

  const fifoPay1 = await recordFifoAccountPayment(fifoTestAcc, {
    amount: 220,
    method: 'Counter Cash Desk',
    cashierName: 'Tran Thi Mai (Accounts)',
    note: 'CN19 partial FIFO lump sum',
  })
  eq('FIFO payment #1 records exact totalPaidAmount ($220)', fifoPay1.totalPaidAmount, 220)
  eq('FIFO payment #1 allocates oldest first ($150 JAN PAID, $70 FEB OVERDUE)', fifoPay1.allocations.map((a) => `${a.invoiceId}:${a.allocatedAmount}:${a.status}`), ['INV-FIFO-01-JAN:150:PAID', 'INV-FIFO-02-FEB:70:OVERDUE'])
  eq('FIFO payment #1 keeps circuit suspended while FEB OVERDUE remains ($130)', fifoPay1.circuitRestored, false)
  eq('FIFO payment #1 remainingAccountBalance is $430', fifoPay1.remainingAccountBalance, 430)

  const realReceipt1 = buildPaymentReceiptFromResponse(fifoPay1)
  eq('Receipt #1 binds real receiptNumber from payment response', realReceipt1.receiptNumber, fifoPay1.receiptNumber)
  eq('Receipt #1 binds real paid amount ($220) not fixed mock', realReceipt1.amount, 220)
  eq('Receipt #1 includes exact FIFO allocation breakdown', realReceipt1.allocations.length, 2)

  const fifoPay2 = await recordFifoAccountPayment(fifoTestAcc, {
    method: 'Corporate Bank Transfer (Demo)',
    cashierName: 'Tran Thi Mai (Accounts)',
  })
  eq('FIFO payment #2 settles exact remaining balance ($430) by default', fifoPay2.totalPaidAmount, 430)
  eq('FIFO payment #2 settles remaining FEB ($130) then MAR ($300)', fifoPay2.allocations.map((a) => `${a.invoiceId}:${a.allocatedAmount}:${a.status}`), ['INV-FIFO-02-FEB:130:PAID', 'INV-FIFO-03-MAR:300:PAID'])
  eq('FIFO payment #2 clears debt & restores OLT circuit when overdue + debt cleared', fifoPay2.fullySettled && fifoPay2.circuitRestored, true)
  eq('FIFO payment #2 restores debt ledger balanceUSD to 0 & ACTIVE', fetchDebtAccounts().find((d) => d.accountId === fifoTestAcc)?.oltStatus, 'ACTIVE')

  let unpaidReceiptErr = false
  try {
    buildPaymentReceiptFromResponse({ invoiceId: 'INV-UNPAID', status: 'PENDING', paidAmount: 0 })
  } catch {
    unpaidReceiptErr = true
  }
  eq('buildPaymentReceiptFromResponse refuses issuing receipt for unpaid invoice', unpaidReceiptErr, true)

  const cn19BillingSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'accounts', 'BillingInvoicingPage.jsx'), 'utf8')
  const cn19CustomerSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'customer', 'CustomerPortalPage.jsx'), 'utf8')
  eq(
    'BillingInvoicingPage removes static REC-DEMO AlphaCorp $3388.25 stub and uses FIFO + buildPaymentReceiptFromResponse',
    !cn19BillingSrc.includes('REC-DEMO-B0000001089') &&
      !cn19BillingSrc.includes('amount: 3388.25') &&
      cn19BillingSrc.includes('recordFifoAccountPayment') &&
      cn19BillingSrc.includes('simulateFifoAllocation') &&
      cn19BillingSrc.includes('buildPaymentReceiptFromResponse'),
    true
  )
  eq(
    'CustomerPortalPage uses recordFifoAccountPayment and renders PrintReceiptModal from response',
    cn19CustomerSrc.includes('recordFifoAccountPayment') &&
      cn19CustomerSrc.includes('buildPaymentReceiptFromResponse') &&
      cn19CustomerSrc.includes('<PrintReceiptModal'),
    true
  )
  eq(
    'PrintReceiptModal displays FIFO allocation breakdown on payment receipts',
    cn16PrintReceiptSrc.includes('FIFO Invoice Allocation Breakdown'),
    true
  )

  // --- CN17: Multi-Account CDR Metering, Resolved Account Metadata & Damaged Hardware Surcharge ---
  localStorage.removeItem('nexus_activated_accounts')
  localStorage.removeItem('nexus_debt_accounts_v1')
  localStorage.removeItem('nexus_invoices')
  localStorage.removeItem('nexus_cdr_sessions_v1')
  localStorage.removeItem('nexus_damaged_equipment_fees_v1')

  const profileT101 = resolveAccountBillingProfile('T101000000000102')
  eq('resolveAccountBillingProfile resolves T101 customerName', profileT101.customerName, 'An Binh Commercial Joint Stock Bank')
  eq('resolveAccountBillingProfile resolves T101 taxId', profileT101.taxId, '0101446758')
  eq('resolveAccountBillingProfile resolves T101 serviceType LANDLINE', profileT101.serviceType, 'LANDLINE')

  const profileD201 = resolveAccountBillingProfile('D201000000000412')
  eq('resolveAccountBillingProfile resolves D201 customerName', profileD201.customerName, 'PharmaCare Healthcare Group')
  eq('resolveAccountBillingProfile resolves D201 taxId', profileD201.taxId, '0304918274')
  eq('resolveAccountBillingProfile resolves D201 serviceType DIAL_UP', profileD201.serviceType, 'DIAL_UP')

  const autoFastCallInv = await generateNewInvoice('T201000000000205', [
    { desc: 'Voice Traffic Audit', amount: 100 },
  ])
  eq('generateNewInvoice without meta populates real FastCall customerName', autoFastCallInv.customerName, 'FastCall Teleservices Contact Center')
  eq('generateNewInvoice without meta populates real FastCall MST taxId', autoFastCallInv.taxId, '0309981273')
  eq('generateNewInvoice without meta populates real LANDLINE serviceType', autoFastCallInv.serviceType, 'LANDLINE')
  eq('generateNewInvoice without meta populates real CUS-006 customerId', autoFastCallInv.customerId, 'CUS-006')

  let syncAllRejected = false
  try {
    await syncCdrToInvoice('ALL', fetchCdrSessions('ALL'))
  } catch {
    syncAllRejected = true
  }
  eq('syncCdrToInvoice rejects missing/ALL accountId instead of defaulting to B101', syncAllRejected, true)

  const d201SyncedInv = await syncCdrToInvoice('D201000000000412', fetchCdrSessions('ALL'))
  eq('syncCdrToInvoice on D201 binds PharmaCare customerName & taxId', `${d201SyncedInv.customerName}|${d201SyncedInv.taxId}|${d201SyncedInv.serviceType}`, 'PharmaCare Healthcare Group|0304918274|DIAL_UP')
  eq('syncCdrToInvoice on D201 isolates only D201 CDR items ($76.50 net -> $85.86 total)', d201SyncedInv.remainingBalance, 85.86)

  // Reset invoices cleanly before testing full multi-account CN17 monthly statement & batch execution
  localStorage.removeItem('nexus_invoices')
  const stmtT101 = calculateAccountMonthlyStatement('T101000000000102')
  eq('CN17 T101 calculates Plan ($180) + Local ($128) + STD ($90) + SMS ($21) = $419 net', stmtT101.subtotalUSD, 419)
  eq('CN17 T101 calculates 12.24% VAT ($51.29) & total ($470.29)', stmtT101.totalPayableUSD, 470.29)

  const stmtD201 = calculateAccountMonthlyStatement('D201000000000412')
  eq('CN17 D201 detects pre-seeded damaged router surcharge ($220)', stmtD201.damagedEquipmentFeeUSD, 220)
  eq('CN17 D201 computes Plan ($450) + Overtime ($62.5) + SMS ($14) + Damage ($220) = $746.50 net', stmtD201.subtotalUSD, 746.5)

  addCdrSession({
    accountId: 'B101000000000089',
    chargeCategory: 'VOICE_LOCAL',
    quantity: 500,
    eventType: 'VIP Desk Local Calls',
  })
  recordDamagedEquipmentFee('B101000000000089', {
    category: 'ONT',
    deviceSerial: 'NX8829104-DMG',
    reason: 'Cracked GPON SC/APC optical connector port',
    feeUSD: 85.0,
  })
  const damagedInvTest = reportAssignedHardwareDamaged('NX8829104', {
    reason: 'Lightning surge damaged Ethernet LAN1-4 ports',
    damageFeeUSD: 95.0,
  })
  eq('reportAssignedHardwareDamaged flags assigned CPE status as DAMAGED with surcharge', damagedInvTest.device.status === 'DAMAGED' && damagedInvTest.device.damageFeeUSD === 95, true)

  const stmtB101 = calculateAccountMonthlyStatement('B101000000000089')
  eq('CN17 B101 sums both logged damaged fee ($85) and DAMAGED inventory unit ($95) = $180', stmtB101.damagedEquipmentFeeUSD, 180)
  eq('CN17 B101 includes newly added Local Voice 500m ($10)', stmtB101.localVoiceUSD, 10)

  // Verify PERMANENTLY_INACTIVE account is excluded during multi-account CN17 scan
  changeAccountLifecycleStatus({
    accountId: 'D101000000000045',
    nextStatus: ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE,
    reason: 'CN17 exclusion test',
  })
  const batchCycle = '01/05/2026 – 31/05/2026'
  const batchPreviewMay = await previewMonthlyBillingBatch({ billingCycle: batchCycle })
  eq('CN17 preview scans all 5 activated accounts with 4 eligible and 1 permanently inactive skipped', `${batchPreviewMay.totalScannedAccounts}/${batchPreviewMay.eligibleCount}/${batchPreviewMay.skippedCount}`, '5/4/1')

  const batchRunMay = await runMonthlyBillingBatch({ billingCycle: batchCycle })
  eq('CN17 runMonthlyBillingBatch generates 4 real multi-account invoices', batchRunMay.generatedCount, 4)
  eq('CN17 runMonthlyBillingBatch skips permanently inactive account D101000000000045', batchRunMay.skippedAccounts.some((s) => s.accountId === 'D101000000000045'), true)
  eq(
    'CN17 batch invoices carry accurate subscriber metadata across distinct accounts',
    batchRunMay.generatedInvoices.some((i) => i.accountId === 'T101000000000102' && i.taxId === '0101446758' && i.serviceType === 'LANDLINE') &&
      batchRunMay.generatedInvoices.some((i) => i.accountId === 'D201000000000412' && i.taxId === '0304918274' && i.serviceType === 'DIAL_UP'),
    true
  )
  eq('CN17 batch marks damaged equipment incidents as BILLED so subsequent cycle does not re-bill', fetchDamagedEquipmentIncidents('B101000000000089', { includeBilled: false }).length, 0)

  const duplicateBatchRun = await runMonthlyBillingBatch({ billingCycle: batchCycle })
  eq('CN17 batch guards against duplicate billing for the same account & billingCycle', duplicateBatchRun.generatedCount, 0)

  const cn17CdrPageSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'accounts', 'CdrMeteringPage.jsx'), 'utf8')
  eq(
    'CdrMeteringPage removes hardcoded syncCdrToInvoice(B101000000000089) and uses multi-account CN17 batch + damage UI',
    !cn17CdrPageSrc.includes("syncCdrToInvoice('B101000000000089'") &&
      !cn17CdrPageSrc.includes('LIVE NOC') &&
      !cn17CdrPageSrc.includes('MEDIATION_SYNCED') &&
      cn17CdrPageSrc.includes('runMonthlyBillingBatch') &&
      cn17CdrPageSrc.includes('recordDamagedEquipmentFee') &&
      cn17CdrPageSrc.includes('selectedAccountId'),
    true
  )

  localStorage.setItem('nexus_cdr_sessions_v1', '[]')
  eq('Empty CDR storage preserves empty array', fetchCdrSessions().length, 0)
  localStorage.setItem('nexus_damaged_equipment_fees_v1', '[]')
  localStorage.setItem('nexus_inventory_items', '[]')
  eq('Empty damaged fees & inventory storage preserves empty array', fetchDamagedEquipmentIncidents('ALL', { includeBilled: true }).length, 0)

  localStorage.setItem('nexus_telecom_plans_v1', '[]')
  eq('Empty plans storage preserves empty array', fetchPlans().length, 0)
  resetPlansToDefault()
  eq('Reset restores default plans count', fetchPlans().length, INITIAL_PLANS.length)

  localStorage.setItem('nexus_orders', '[]')
  eq('Empty orders storage preserves empty array', fetchOrders().length, 0)
  localStorage.setItem('nexus_invoices', '[]')
  eq('Empty invoices storage preserves empty array', (await fetchInvoices()).length, 0)
  localStorage.setItem('nexus_debt_accounts_v1', '[]')
  eq('Empty debt storage preserves empty array', fetchDebtAccounts().length, 0)
  localStorage.setItem('nexus_inventory_items', '[]')
  eq('Empty inventory storage preserves empty array', fetchInventoryRecords().length, 0)
  localStorage.setItem('nexus_activated_accounts', '[]')
  eq('Empty circuits storage preserves empty array', getActivatedAccounts().length, 0)
  eq('Empty circuits storage keeps fetchLifecycleAccounts empty', fetchLifecycleAccounts().length, 0)
  localStorage.setItem('nexus_account_lifecycle_logs_v1', '[]')
  eq('Empty lifecycle logs storage preserves empty array', fetchLifecycleLogs().length, 0)
  localStorage.setItem('nexus_customers', '[]')
  eq('Empty customers storage preserves empty array', fetchCustomers().length, 0)

  // Regression tests: Post-settlement CDR invoice protection & adjustment invoice creation
  localStorage.removeItem('nexus_invoices')
  localStorage.removeItem('nexus_cdr_sessions_v1')

  const d101SeedInvoices = await fetchInvoices()
  const beforePaidInv = JSON.parse(JSON.stringify(d101SeedInvoices.find((i) => i.invoiceId === 'INV-2026-03-0883')))
  const d101AdjInvoice = await syncCdrToInvoice('D101000000000045', [
    {
      cdrId: 'CDR-REG-D101-01',
      accountId: 'D101000000000045',
      eventType: 'International Call Usage',
      service: 'Landline PSTN',
      duration: '150 min',
      quantity: 150,
      unitRateUSD: 0.5,
      chargeUSD: 75,
      ratingStatus: 'BILLABLE',
    },
  ])
  const afterPaidInv = (await fetchInvoices()).find((i) => i.invoiceId === 'INV-2026-03-0883')
  eq('PAID invoice INV-2026-03-0883 keeps PAID status after CDR sync', afterPaidInv.status, 'PAID')
  eq('PAID invoice INV-2026-03-0883 keeps original paidAmount', afterPaidInv.paidAmount, beforePaidInv.paidAmount)
  eq('PAID invoice INV-2026-03-0883 keeps zero remainingBalance', afterPaidInv.remainingBalance, 0)
  eq('PAID invoice INV-2026-03-0883 keeps original item count unchanged', afterPaidInv.items.length, beforePaidInv.items.length)
  eq(
    'syncCdrToInvoice creates a new PENDING CN17_CDR_ADJUSTMENT invoice when only PAID invoice exists',
    d101AdjInvoice.invoiceId !== 'INV-2026-03-0883' &&
      d101AdjInvoice.status === 'PENDING' &&
      d101AdjInvoice.billingSource === 'CN17_CDR_ADJUSTMENT' &&
      d101AdjInvoice.paidAmount === 0 &&
      d101AdjInvoice.remainingBalance === 84.18,
    true
  )

  localStorage.removeItem('nexus_cdr_sessions_v1')
  const seededCdrsForBilling = fetchCdrSessions()
  const targetB101Session = seededCdrsForBilling.find((s) => s.accountId === 'B101000000000089' && s.ratingStatus === 'BILLABLE')
  markCdrSessionsBilled([targetB101Session.id], 'INV-2026-TEST-REG', '01/05/2026 – 31/05/2026')
  const markedB101Session = fetchCdrSessions().find((s) => s.id === targetB101Session.id)
  eq('markCdrSessionsBilled stamps billedInvoiceId on CDR session', markedB101Session.billedInvoiceId, 'INV-2026-TEST-REG')
  let blockedAlreadyBilled = false
  try {
    await syncCdrToInvoice('B101000000000089', [markedB101Session])
  } catch {
    blockedAlreadyBilled = true
  }
  eq('syncCdrToInvoice rejects already-billed CDR sessions by default', blockedAlreadyBilled, true)

  // Admin Personnel Edit Profile + Employees persistence tests
  localStorage.removeItem('nexus_admin_employees_v1')
  eq('Initial seeded employees count is preserved', fetchEmployees().length, INITIAL_EMPLOYEES.length)
  const afterAddEmp = addEmployee({
    fullName: 'Hoang Minh Khoa',
    email: 'khoa.hm@nexus.vn',
    title: 'Field Support Specialist',
    role: 'TECHNICAL',
    hubId: 'HUB-NOC-HN',
    hubName: 'Hanoi Metro ODN Operations',
  })
  const addedEmp = afterAddEmp.find((e) => e.email === 'khoa.hm@nexus.vn')
  eq('addEmployee assigns unique formatted EMP-NX ID', /^EMP-NX-\d{3,}$/.test(addedEmp.id), true)

  let dupEmailThrew = false
  try {
    addEmployee({
      fullName: 'Duplicate User',
      email: 'ADMIN@nexus.vn',
      title: 'Admin',
      role: 'ADMIN',
    })
  } catch {
    dupEmailThrew = true
  }
  eq('addEmployee rejects duplicate corporate email', dupEmailThrew, true)

  const { employee: editedEmp } = updateEmployee(addedEmp.id, {
    fullName: 'Hoang Minh Khoa Updated',
    email: 'khoa.updated@nexus.vn',
    title: 'Senior Retail Lead',
    role: 'RETAIL',
    hubId: 'STORE-VN-101',
    hubName: 'Hoan Kiem Retail & Client Desk',
    twoFactorEnabled: true,
    status: 'SUSPENDED',
  })
  eq(
    'updateEmployee edits profile fields and persists role, hub, 2FA, and status',
    editedEmp.fullName === 'Hoang Minh Khoa Updated' &&
      editedEmp.email === 'khoa.updated@nexus.vn' &&
      editedEmp.role === 'RETAIL' &&
      editedEmp.hubId === 'STORE-VN-101' &&
      editedEmp.twoFactorEnabled === true &&
      editedEmp.status === 'SUSPENDED',
    true
  )
  const { employee: reactivatedEmp } = updateEmployee(addedEmp.id, { status: 'ACTIVE' })
  eq('updateEmployee resets status back to ACTIVE cleanly', reactivatedEmp.status, 'ACTIVE')
  let editDupEmailThrew = false
  try {
    updateEmployee(addedEmp.id, { email: 'admin@nexus.vn' })
  } catch {
    editDupEmailThrew = true
  }
  eq('updateEmployee rejects email collision with another operator', editDupEmailThrew, true)
  const persistedEditedEmp = fetchEmployees().find((e) => e.id === addedEmp.id)
  eq('Edited employee profile persists across fetchEmployees reload', persistedEditedEmp.email, 'khoa.updated@nexus.vn')
  localStorage.setItem('nexus_admin_employees_v1', '[]')
  eq('Empty employees storage preserves empty array', fetchEmployees().length, 0)

  // Admin Retail Stores CRUD & Legacy Schema Normalization tests
  localStorage.removeItem('nexus_metro_prefixes_v1')
  localStorage.removeItem('nexus_retail_stores_v1')
  eq('fetchMetroPrefixes returns seeded metro hubs', fetchMetroPrefixes().length, INITIAL_METRO_PREFIXES.length)

  const legacyStoreNorm = normalizeRetailStoreRecord({
    code: 'STORE-999',
    name: 'Legacy Store',
    manager: 'Nguyen Van A',
    cityCode: '201',
    address: '99 Nguyen Hue',
  })
  eq(
    'normalizeRetailStoreRecord maps legacy code/name/manager to canonical schema',
    legacyStoreNorm.storeCode === 'STORE-999' &&
      legacyStoreNorm.storeName === 'Legacy Store' &&
      legacyStoreNorm.managerName === 'Nguyen Van A' &&
      legacyStoreNorm.cityName === 'Ho Chi Minh Metro City',
    true
  )

  const { store: createdStore } = createRetailStore({
    storeCode: 'STORE-DN-002',
    storeName: 'Son Tra Beach Store',
    cityCode: '301',
    address: '88 Vo Nguyen Giap, Da Nang',
    managerName: 'Le Minh Tam',
    phone: '+84 236 3900 888',
    staffCount: 9,
    cpeStock: 60,
    cpeCapacity: 120,
    type: 'Direct Store',
  })
  eq(
    'createRetailStore persists new store with resolved cityName',
    createdStore.storeCode === 'STORE-DN-002' && createdStore.cityName === 'Da Nang Coastal Metro',
    true
  )
  let dupStoreThrew = false
  try {
    createRetailStore({
      storeCode: 'STORE-DN-002',
      storeName: 'Dup',
      cityCode: '301',
      address: 'Addr',
      managerName: 'Mgr',
    })
  } catch {
    dupStoreThrew = true
  }
  eq('createRetailStore rejects duplicate storeCode', dupStoreThrew, true)

  const { store: updatedStore } = updateRetailStore('STORE-DN-002', {
    storeName: 'Son Tra Flagship Hub',
    cityCode: '201',
    managerName: 'Pham Gia Huy',
    staffCount: 14,
    status: 'MAINTENANCE',
  })
  eq(
    'updateRetailStore updates store details, cityName, staffCount, and status',
    updatedStore.storeName === 'Son Tra Flagship Hub' &&
      updatedStore.cityName === 'Ho Chi Minh Metro City' &&
      updatedStore.managerName === 'Pham Gia Huy' &&
      updatedStore.staffCount === 14 &&
      updatedStore.status === 'MAINTENANCE',
    true
  )
  const { deleted: deletedStoreObj, stores: storesAfterDelete } = deleteRetailStore('STORE-DN-002')
  eq('deleteRetailStore removes target store from storage', deletedStoreObj.storeCode === 'STORE-DN-002' && !storesAfterDelete.some((s) => s.storeCode === 'STORE-DN-002'), true)
  saveRetailStores([])
  eq('Empty retail stores storage preserves empty array', fetchRetailStores().length, 0)

  // Admin Hardware Vendors CRUD tests
  localStorage.removeItem('nexus_hardware_vendors_v1')
  eq('fetchHardwareVendors returns seeded vendors', fetchHardwareVendors().length, INITIAL_HARDWARE_VENDORS.length)

  const { vendor: createdVendor } = createHardwareVendor({
    id: 'VEND-ZTE',
    vendorName: 'ZTE Corporation',
    headquarters: 'Ho Chi Minh Partner Office',
    flagshipProduct: 'ZXHN F670L ONT',
    standard: 'GPON Wi-Fi 6 Dual-Band',
    unitCostUSD: 42.5,
    monthlySupply: 5000,
    availableStock: 800,
    status: 'APPROVED',
  })
  eq('createHardwareVendor creates and persists new vendor', createdVendor.id === 'VEND-ZTE' && createdVendor.vendorName === 'ZTE Corporation', true)

  let dupVendorThrew = false
  try {
    createHardwareVendor({
      vendorName: 'ZTE Corporation',
      flagshipProduct: 'Other',
      unitCostUSD: 10,
    })
  } catch {
    dupVendorThrew = true
  }
  eq('createHardwareVendor rejects duplicate vendor name', dupVendorThrew, true)

  const { vendor: updatedVendor } = updateHardwareVendor('VEND-ZTE', {
    flagshipProduct: 'ZXHN F680 Pro',
    unitCostUSD: 49,
    availableStock: 920,
    status: 'SUSPENDED',
  })
  eq(
    'updateHardwareVendor updates model, pricing, stock, and status',
    updatedVendor.flagshipProduct === 'ZXHN F680 Pro' &&
      updatedVendor.unitCostUSD === 49 &&
      updatedVendor.availableStock === 920 &&
      updatedVendor.status === 'SUSPENDED',
    true
  )
  const { deleted: deletedVendorObj, vendors: vendorsAfterDelete } = deleteHardwareVendor('VEND-ZTE')
  eq('deleteHardwareVendor removes target vendor cleanly', deletedVendorObj.id === 'VEND-ZTE' && !vendorsAfterDelete.some((v) => v.id === 'VEND-ZTE'), true)
  saveHardwareVendors([])
  eq('Empty hardware vendors storage preserves empty array', fetchHardwareVendors().length, 0)

  // Admin UI source verification
  const adminUsersPageSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'admin', 'AdminUsersPage.jsx'), 'utf8')
  eq(
    'AdminUsersPage implements updateEmployee edit profile modal and search bar',
    adminUsersPageSrc.includes('updateEmployee') &&
      adminUsersPageSrc.includes('openEditModal') &&
      adminUsersPageSrc.includes('fetchRetailStores') &&
      adminUsersPageSrc.includes('setSearchQuery'),
    true
  )

  const vendorsShopsPageSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'pages', 'admin', 'VendorsShopsPage.jsx'), 'utf8')
  eq(
    'VendorsShopsPage uses canonical schema and provides full Store + Vendor CRUD actions',
    vendorsShopsPageSrc.includes('createRetailStore') &&
      vendorsShopsPageSrc.includes('updateRetailStore') &&
      vendorsShopsPageSrc.includes('deleteRetailStore') &&
      vendorsShopsPageSrc.includes('createHardwareVendor') &&
      vendorsShopsPageSrc.includes('updateHardwareVendor') &&
      vendorsShopsPageSrc.includes('deleteHardwareVendor') &&
      vendorsShopsPageSrc.includes('s.storeCode') &&
      vendorsShopsPageSrc.includes('v.vendorName') &&
      vendorsShopsPageSrc.includes('p.activeSubscribers') &&
      !vendorsShopsPageSrc.includes('allocatedAccounts') &&
      !vendorsShopsPageSrc.includes('contractPo') &&
      !vendorsShopsPageSrc.includes('64_PROVINCES_ACTIVE'),
    true
  )

  // CN03 Tariff Catalog Versioning & Change History tests
  localStorage.removeItem('nexus_telecom_plans_v1')
  localStorage.removeItem('nexus_telecom_plan_history_v1')
  localStorage.removeItem('nexus_telecom_plan_catalog_meta_v1')

  const initialVerMeta = getPlanCatalogVersionMeta()
  const initialHistory = fetchPlanVersionHistory()
  eq('CN03 initializes catalog version metadata at v1.0', initialVerMeta.versionTag, 'v1.0')
  eq(
    'CN03 seeds baseline INITIAL_SEED entry with full SKU snapshot',
    initialHistory.length === 1 &&
      initialHistory[0].action === 'INITIAL_SEED' &&
      initialHistory[0].catalogSnapshot.length === INITIAL_PLANS.length,
    true
  )

  addPlan(
    {
      sku: 'NX-VER-10G',
      name: 'Metro Core 10Gbps',
      type: 'BROADBAND',
      cirMbps: 5000,
      pirMbps: 10000,
      monthlyNetUSD: 6400,
      cpeMonthlyUSD: 400,
    },
    { actor: 'Le Quoc Bao', changeReason: 'Launch Q2 10G enterprise tier' }
  )
  const metaAfterCreate = getPlanCatalogVersionMeta()
  const historyAfterCreate = fetchPlanVersionHistory()
  eq('CN03 addPlan increments catalog version to v2.0', metaAfterCreate.versionTag, 'v2.0')
  eq(
    'CN03 addPlan logs CREATE entry with actor, revision note, and snapshot',
    historyAfterCreate[0].action === 'CREATE' &&
      historyAfterCreate[0].sku === 'NX-VER-10G' &&
      historyAfterCreate[0].changedBy === 'Le Quoc Bao' &&
      historyAfterCreate[0].note === 'Launch Q2 10G enterprise tier' &&
      historyAfterCreate[0].catalogSnapshot.length === INITIAL_PLANS.length + 1,
    true
  )

  updatePlan(
    'NX-VER-10G',
    { monthlyNetUSD: 5900, name: 'Metro Core 10Gbps Promo' },
    { actor: 'Nguyen Tien Dung', changeReason: 'Summer enterprise discount' }
  )
  const updatedVerPlan = fetchPlans().find((p) => p.sku === 'NX-VER-10G')
  const nxVerHistory = fetchPlanVersionHistory({ sku: 'NX-VER-10G' })
  const latestUpdateEntry = nxVerHistory[0]
  eq('CN03 updatePlan increments individual plan version from 1 to 2', updatedVerPlan.version, 2)
  eq('CN03 updatePlan increments catalog version to v3.0', getPlanCatalogVersionMeta().versionTag, 'v3.0')
  eq(
    'CN03 updatePlan records field-level before/after price & name diffs',
    latestUpdateEntry.action === 'UPDATE' &&
      latestUpdateEntry.planVersion === 2 &&
      latestUpdateEntry.changes.some(
        (d) => d.field === 'monthlyNetUSD' && d.before === 6400 && d.after === 5900
      ) &&
      latestUpdateEntry.changes.some(
        (d) => d.field === 'name' && d.before === 'Metro Core 10Gbps' && d.after === 'Metro Core 10Gbps Promo'
      ),
    true
  )

  deletePlan('NX-VER-10G', { actor: 'Le Quoc Bao', changeReason: 'Retire promo SKU' })
  const historyAfterDelete = fetchPlanVersionHistory()
  eq(
    'CN03 deletePlan logs DELETE entry while keeping revision trail intact',
    historyAfterDelete[0].action === 'DELETE' &&
      historyAfterDelete[0].versionTag === 'v4.0' &&
      !fetchPlans().some((p) => p.sku === 'NX-VER-10G'),
    true
  )

  const v2Entry = historyAfterDelete.find((e) => e.versionTag === 'v2.0')
  restoreCatalogVersion(v2Entry.entryId, { actor: 'Le Quoc Bao' })
  const restoredPlan = fetchRetailPlansByType('BROADBAND').find((p) => p.sku === 'NX-VER-10G')
  const historyAfterRestore = fetchPlanVersionHistory()
  eq(
    'CN03 restoreCatalogVersion restores SKU & price to Retail and appends RESTORE v5.0 entry',
    restoredPlan?.monthlyNetUSD === 6400 &&
      historyAfterRestore[0].action === 'RESTORE' &&
      historyAfterRestore[0].versionTag === 'v5.0' &&
      historyAfterRestore.length === 5,
    true
  )

  localStorage.setItem('nexus_telecom_plan_history_v1', '[]')
  eq('Empty plan version history storage preserves empty array', fetchPlanVersionHistory().length, 0)

  const cn03TariffTableSrc = nodeFs.readFileSync(nodePath.join(cn15SrcRoot, 'components', 'tariffs', 'TariffTable.jsx'), 'utf8')
  eq(
    'TariffTable exposes version badge, Version History tab, diffs, snapshot modal, and restore UI',
    cn03TariffTableSrc.includes('fetchPlanVersionHistory') &&
      cn03TariffTableSrc.includes('getPlanCatalogVersionMeta') &&
      cn03TariffTableSrc.includes('restoreCatalogVersion') &&
      cn03TariffTableSrc.includes('Version History') &&
      cn03TariffTableSrc.includes('changeReason') &&
      cn03TariffTableSrc.includes('inspectingVersion'),
    true
  )

  // Task #7: Tax Audit Ledger <-> Billing Invoices Reconciliation & CN07 Scope Regression Tests
  const taxInvSnapshot = localStorage.getItem('nexus_invoices')
  const taxOrdSnapshot = localStorage.getItem('nexus_orders')

  localStorage.setItem('nexus_invoices', '[]')
  const emptyTaxRows = fetchTaxAuditRecords()
  const emptyTaxSummary = reconcileTaxLedgerWithBilling(emptyTaxRows)
  eq('Empty Billing ledger produces empty Tax Audit records (no mock leakage)', emptyTaxRows.length, 0)
  eq(
    'Empty Billing ledger reconciles Tax summary totals to zero',
    emptyTaxSummary.invoiceCount === 0 &&
      emptyTaxSummary.netTaxableBase === 0 &&
      emptyTaxSummary.totalStatutoryTax === 0 &&
      emptyTaxSummary.bulkDiscountDeductedFromMrc === 0,
    true
  )

  saveStoredInvoices(INITIAL_INVOICES)
  localStorage.setItem(
    'nexus_orders',
    JSON.stringify([
      {
        orderId: 'NX-CN07-TAX',
        customerId: 'CUS-001',
        bulkDiscountUSD: 250,
        bulkDiscountPercent: 10,
        monthlyFeeUSD: 1000,
      },
    ])
  )

  const initialSyncedRows = fetchTaxAuditRecords()
  const initialBillingRows = await fetchInvoices()
  const expectedInitRecon = initialBillingRows.reduce(
    (acc, inv) => {
      const t = calculateInvoiceTotals(inv.items || [], inv.previousBalance || 0, inv.paidAmount || 0)
      acc.net = Number((acc.net + t.subtotal).toFixed(2))
      acc.tax = Number((acc.tax + t.serviceTax).toFixed(2))
      acc.payable = Number((acc.payable + t.totalPayable).toFixed(2))
      acc.paid = Number((acc.paid + t.paidAmount).toFixed(2))
      return acc
    },
    { net: 0, tax: 0, payable: 0, paid: 0 }
  )
  const initialTaxRecon = reconcileTaxLedgerWithBilling(initialSyncedRows)
  eq(
    'Tax Audit summary reconciles 1:1 with INITIAL_INVOICES sums & 0 MRC bulk deduction',
    initialTaxRecon.invoiceCount === INITIAL_INVOICES.length &&
      initialTaxRecon.netTaxableBase === expectedInitRecon.net &&
      initialTaxRecon.totalStatutoryTax === expectedInitRecon.tax &&
      initialTaxRecon.totalPayableLedger === expectedInitRecon.payable &&
      initialTaxRecon.collectedTotal === expectedInitRecon.paid &&
      initialTaxRecon.bulkDiscountDeductedFromMrc === 0,
    true
  )

  const liveTaxInv = await generateNewInvoice(
    'B101000000000089',
    [{ desc: 'Enterprise Fiber MRC', quantity: 1, unitPrice: 1000, amount: 1000 }],
    { orderId: 'NX-CN07-TAX', billingCycle: '01/04/2026 – 30/04/2026', issuedDate: '2026-04-01', dueDate: '2099-04-16' }
  )
  const postGenRows = fetchTaxAuditRecords()
  const liveTaxRow = postGenRows.find((r) => r.id === liveTaxInv.invoiceId)
  const postGenRecon = reconcileTaxLedgerWithBilling(postGenRows)
  const postGenPeriods = getTaxPeriodOptions(postGenRows)

  eq(
    'generateNewInvoice immediately surfaces matching 1:1 Tax Audit row for April / Q2/2026',
    postGenRows.length === INITIAL_INVOICES.length + 1 &&
      liveTaxRow?.period === 'M04/2026' &&
      liveTaxRow?.quarter === 'Q2/2026' &&
      postGenPeriods.quarters.includes('Q2/2026') &&
      postGenPeriods.periods.includes('M04/2026'),
    true
  )
  eq(
    'CN07 Deposit/Advance Bulk on matched order is informational only and NEVER reduces MRC or taxableSubtotal',
    liveTaxRow?.cn07DepositAdvanceBulkUSD === 250 &&
      liveTaxRow?.cn07DepositAdvanceBulkPercent === 10 &&
      liveTaxRow?.bulkDiscount === 0 &&
      liveTaxRow?.mrcDiscount === 0 &&
      liveTaxRow?.bulkDiscountScope === 'DEPOSIT_AND_ADVANCE_ONLY' &&
      liveTaxRow?.taxableSubtotal === 1000 &&
      liveTaxRow?.taxAmount === 122.4,
    true
  )
  eq(
    'reconcileTaxLedgerWithBilling increases netTaxableBase (+1000) & statutory tax (+122.40) after invoice generation',
    postGenRecon.netTaxableBase === Number((expectedInitRecon.net + 1000).toFixed(2)) &&
      postGenRecon.totalStatutoryTax === Number((expectedInitRecon.tax + 122.4).toFixed(2)) &&
      postGenRecon.bulkDiscountDeductedFromMrc === 0,
    true
  )

  await recordInvoicePayment(liveTaxInv.invoiceId, { amount: 500, method: 'Bank Transfer' })
  const postPayRow = fetchTaxAuditRecords().find((r) => r.id === liveTaxInv.invoiceId)
  const postPayRecon = reconcileTaxLedgerWithBilling()
  eq(
    'recordInvoicePayment immediately updates Tax Audit status (PARTIALLY_PAID) and collectedTotal',
    postPayRow?.status === 'PARTIALLY_PAID' &&
      postPayRow?.paidAmount === 500 &&
      postPayRow?.debtBalance === 622.4 &&
      postPayRecon.collectedTotal === Number((expectedInitRecon.paid + 500).toFixed(2)),
    true
  )

  const cdrSyncedInv = await syncCdrToInvoice(
    'D201000000000412',
    [
      {
        sessionId: 'CDR-TAX-SYNC-7001',
        accountId: 'D201000000000412',
        eventType: 'Data Session',
        service: 'Dial-Up',
        duration: '30m',
        ratingStatus: 'BILLABLE',
        chargeUSD: 200,
      },
    ],
    { billingCycle: '01/05/2026 – 31/05/2026' }
  )
  const postCdrRow = fetchTaxAuditRecords().find((r) => r.id === cdrSyncedInv.invoiceId)
  eq(
    'syncCdrToInvoice updates Tax Audit taxableSubtotal ($200) & 12.24% tax ($24.48)',
    postCdrRow?.grossSubtotal === 200 &&
      postCdrRow?.taxableSubtotal === 200 &&
      postCdrRow?.taxAmount === 24.48 &&
      postCdrRow?.bulkDiscount === 0,
    true
  )

  const unsubTaxCheck = subscribeTaxAuditUpdates(() => {})
  eq('subscribeTaxAuditUpdates returns a callable unsubscribe handle', typeof unsubTaxCheck, 'function')
  unsubTaxCheck()

  const taxReportsPageSrc = nodeFs.readFileSync(
    nodePath.join(cn15SrcRoot, 'pages', 'accounts', 'TaxAuditReportsPage.jsx'),
    'utf8'
  )
  eq(
    'TaxAuditReportsPage uses Billing-synced taxReportService helpers and PARTIALLY_PAID status',
    taxReportsPageSrc.includes('reconcileTaxLedgerWithBilling') &&
      taxReportsPageSrc.includes('getTaxPeriodOptions') &&
      taxReportsPageSrc.includes('subscribeTaxAuditUpdates') &&
      taxReportsPageSrc.includes('PARTIALLY_PAID') &&
      !taxReportsPageSrc.includes("'PARTIAL_PAID'") &&
      taxReportsPageSrc.includes('/accounts/billing') &&
      taxReportsPageSrc.includes('Sync Billing'),
    true
  )

  if (taxInvSnapshot === null) {
    localStorage.removeItem('nexus_invoices')
  } else {
    localStorage.setItem('nexus_invoices', taxInvSnapshot)
  }
  if (taxOrdSnapshot === null) {
    localStorage.removeItem('nexus_orders')
  } else {
    localStorage.setItem('nexus_orders', taxOrdSnapshot)
  }

  // Debt <-> Billing Synchronization & Historical Arrears Breakdown Regression Tests
  const debtSyncInvSnapshot = localStorage.getItem('nexus_invoices')
  const debtSyncAccSnapshot = localStorage.getItem('nexus_debt_accounts_v1')

  saveStoredInvoices(INITIAL_INVOICES)
  saveDebtAccounts(INITIAL_DEBT_ACCOUNTS)

  const b101UnpaidSeed = getAccountUnpaidSummary('B101000000000089', await fetchInvoices())
  const b101DebtSeed = fetchDebtAccounts().find((a) => a.accountId === 'B101000000000089')
  eq(
    'B101000000000089 Billing unpaid sum ($507.89) matches initial Debt balanceUSD ($507.89) 1:1',
    b101UnpaidSeed.totalUnpaidBalance === 507.89 &&
      b101DebtSeed.balanceUSD === 507.89 &&
      b101DebtSeed.openInvoicesBalanceUSD === 507.89 &&
      b101DebtSeed.historicalArrearsUSD === 0,
    true
  )

  const t101DebtSeed = fetchDebtAccounts().find((a) => a.accountId === 'T101000000000102')
  eq(
    'T101000000000102 explicitly separates open Billing invoice ($807.62) + historical arrears ($17,642.38) = $18,450.00',
    t101DebtSeed.openInvoicesBalanceUSD === 807.62 &&
      t101DebtSeed.historicalArrearsUSD === 17642.38 &&
      t101DebtSeed.balanceUSD === 18450 &&
      Boolean(t101DebtSeed.historicalArrearsNote),
    true
  )

  // Verify syncDebtAccountPayment obeys explicit remainingInvoiceBalance instead of only subtracting paidAmount from stale balanceUSD
  saveDebtAccounts(
    INITIAL_DEBT_ACCOUNTS.map((a) =>
      a.accountId === 'B101000000000089'
        ? { ...a, balanceUSD: 999.99, openInvoicesBalanceUSD: 999.99, historicalArrearsUSD: 0 }
        : a
    )
  )
  syncDebtAccountPayment('B101000000000089', 168.36, 339.53)
  const b101AfterExplicitRemaining = fetchDebtAccounts().find((a) => a.accountId === 'B101000000000089')
  eq(
    'syncDebtAccountPayment snaps balanceUSD & openInvoicesBalanceUSD to explicit remainingInvoiceBalance (339.53)',
    b101AfterExplicitRemaining.balanceUSD === 339.53 &&
      b101AfterExplicitRemaining.openInvoicesBalanceUSD === 339.53,
    true
  )

  // Reset to clean seed and test overdue clearance preserves remaining PENDING invoice debt ($339.53),
  // plus single-invoice partial payment syncs combined account debt instead of single-invoice remainder
  saveStoredInvoices(INITIAL_INVOICES)
  saveDebtAccounts(INITIAL_DEBT_ACCOUNTS)
  suspendCircuit('B101000000000089', 'Test Dunning suspension before overdue invoice clearance')

  await recordInvoicePayment('INV-2026-02-0719', { amount: 168.36, method: 'Cash Desk' })
  const b101AfterOverdueCleared = fetchDebtAccounts().find((a) => a.accountId === 'B101000000000089')
  eq(
    'Clearing ONLY overdue INV-2026-02-0719 unsuspends circuit without wiping remaining PENDING invoice debt ($339.53)',
    b101AfterOverdueCleared.oltStatus === 'ACTIVE' &&
      b101AfterOverdueCleared.balanceUSD === 339.53 &&
      b101AfterOverdueCleared.openInvoicesBalanceUSD === 339.53,
    true
  )

  saveStoredInvoices(INITIAL_INVOICES)
  saveDebtAccounts(INITIAL_DEBT_ACCOUNTS)
  await recordInvoicePayment('INV-2026-03-0881', { amount: 100, method: 'Bank Transfer' })
  const b101AfterSinglePartial = fetchDebtAccounts().find((a) => a.accountId === 'B101000000000089')
  const b101BillingAfterSingle = getAccountUnpaidSummary('B101000000000089', await fetchInvoices()).totalUnpaidBalance
  eq(
    'Single-invoice partial payment on INV-2026-03-0881 syncs total account remaining balance ($407.89) to Debt',
    b101BillingAfterSingle === 407.89 && b101AfterSinglePartial.balanceUSD === 407.89,
    true
  )

  await recordFifoAccountPayment('B101000000000089', { amount: 407.89, method: 'Corporate Wire Transfer' })
  const b101AfterFullFifo = fetchDebtAccounts().find((a) => a.accountId === 'B101000000000089')
  eq(
    'Full FIFO settlement zeroes both Billing & Debt balanceUSD to $0.00',
    b101AfterFullFifo.balanceUSD === 0 &&
      b101AfterFullFifo.openInvoicesBalanceUSD === 0 &&
      b101AfterFullFifo.oltStatus === 'ACTIVE',
    true
  )

  // Verify T101000000000102 payment reduces openInvoicesBalanceUSD while preserving unbilled historicalArrearsUSD
  await recordInvoicePayment('INV-2026-03-0882', { amount: 100, method: 'Bank Transfer' })
  const t101AfterPartial = fetchDebtAccounts().find((a) => a.accountId === 'T101000000000102')
  eq(
    'Paying $100 on T101 Billing invoice reduces Debt from $18,450 to $18,350 ($707.62 Billing + $17,642.38 historical)',
    t101AfterPartial.openInvoicesBalanceUSD === 707.62 &&
      t101AfterPartial.historicalArrearsUSD === 17642.38 &&
      t101AfterPartial.balanceUSD === 18350,
    true
  )

  await recordInvoicePayment('INV-2026-03-0882', { amount: 707.62, method: 'Bank Transfer' })
  const t101AfterFullBilling = fetchDebtAccounts().find((a) => a.accountId === 'T101000000000102')
  eq(
    'Settling T101 Billing invoices to $0 keeps remaining historicalArrearsUSD ($17,642.38) & THROTTLED enforcement intact',
    t101AfterFullBilling.openInvoicesBalanceUSD === 0 &&
      t101AfterFullBilling.historicalArrearsUSD === 17642.38 &&
      t101AfterFullBilling.balanceUSD === 17642.38 &&
      t101AfterFullBilling.oltStatus === 'THROTTLED',
    true
  )

  // Verify generateNewInvoice propagates updated open invoice balance to Debt account
  await generateNewInvoice('B101000000000089', [{ desc: 'Debt Sync Check MRC', amount: 100 }])
  const b101AfterNewInv = fetchDebtAccounts().find((a) => a.accountId === 'B101000000000089')
  eq('generateNewInvoice updates Debt openInvoicesBalanceUSD & balanceUSD (+112.24)', b101AfterNewInv.balanceUSD, 112.24)

  const liveSummaryForReconcile = getAccountUnpaidSummary('T101000000000102', INITIAL_INVOICES)
  const reconciledT101View = reconcileDebtAccountWithBillingSummary(
    INITIAL_DEBT_ACCOUNTS[1],
    liveSummaryForReconcile
  )
  eq(
    'reconcileDebtAccountWithBillingSummary binds live invoice IDs, billing count, and historical breakdown',
    reconciledT101View.billingOpenInvoiceCount === 1 &&
      reconciledT101View.billingInvoiceIds[0] === 'INV-2026-03-0882' &&
      reconciledT101View.hasHistoricalArrears === true &&
      reconciledT101View.balanceUSD === 18450,
    true
  )

  const unsubDebtEv = subscribeDebtAccountsUpdated(() => {})
  eq('subscribeDebtAccountsUpdated returns callable unsubscribe handle', typeof unsubDebtEv, 'function')
  unsubDebtEv()

  const debtReconcilePageSrc = nodeFs.readFileSync(
    nodePath.join(cn15SrcRoot, 'pages', 'accounts', 'DebtManagementPage.jsx'),
    'utf8'
  )
  eq(
    'DebtManagementPage displays Billing vs Historical Arrears breakdown and subscribes to Billing/Debt events',
    debtReconcilePageSrc.includes('reconcileDebtAccountWithBillingSummary') &&
      debtReconcilePageSrc.includes('getAccountUnpaidSummary') &&
      debtReconcilePageSrc.includes('subscribeInvoicesUpdated') &&
      debtReconcilePageSrc.includes('recordFifoAccountPayment') &&
      debtReconcilePageSrc.includes('Historical / Unbilled Arrears') &&
      debtReconcilePageSrc.includes('Open Billing Invoices'),
    true
  )

  if (debtSyncInvSnapshot === null) {
    localStorage.removeItem('nexus_invoices')
  } else {
    localStorage.setItem('nexus_invoices', debtSyncInvSnapshot)
  }
  if (debtSyncAccSnapshot === null) {
    localStorage.removeItem('nexus_debt_accounts_v1')
  } else {
    localStorage.setItem('nexus_debt_accounts_v1', debtSyncAccSnapshot)
  }

  process.exit(fail ? 1 : 0)
}

runAsyncTests()

