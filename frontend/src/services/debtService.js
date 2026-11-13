import { updateAccountConnectionStatus } from './activationService.js'

const STORAGE_KEY = 'nexus_debt_accounts_v1'
export const DEBTS_UPDATED_EVENT = 'nexus:debt-accounts-updated'

function notifyDebtAccountsUpdated() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(DEBTS_UPDATED_EVENT))
  }
}

export function subscribeDebtAccountsUpdated(callback) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }
  const onUpdate = () => callback?.()
  const onStorage = (event) => {
    if (!event || event.key === STORAGE_KEY) {
      callback?.()
    }
  }
  window.addEventListener(DEBTS_UPDATED_EVENT, onUpdate)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(DEBTS_UPDATED_EVENT, onUpdate)
    window.removeEventListener('storage', onStorage)
  }
}

export function normalizeDebtAccountRecord(acc = {}) {
  const historicalArrearsUSD = Math.max(
    0,
    Number(Number(acc.historicalArrearsUSD ?? 0).toFixed(2)) || 0
  )
  const hasExplicitOpen =
    acc.openInvoicesBalanceUSD !== undefined && acc.openInvoicesBalanceUSD !== null
  const rawBalance = Math.max(0, Number(Number(acc.balanceUSD ?? 0).toFixed(2)) || 0)
  const openInvoicesBalanceUSD = hasExplicitOpen
    ? Math.max(0, Number(Number(acc.openInvoicesBalanceUSD).toFixed(2)) || 0)
    : Math.max(0, Number((rawBalance - historicalArrearsUSD).toFixed(2)))
  const balanceUSD = Number((openInvoicesBalanceUSD + historicalArrearsUSD).toFixed(2))

  return {
    ...acc,
    balanceUSD,
    openInvoicesBalanceUSD,
    historicalArrearsUSD,
    historicalArrearsNote: acc.historicalArrearsNote || '',
    auditLogs: Array.isArray(acc.auditLogs) ? acc.auditLogs : [],
  }
}

export const INITIAL_DEBT_ACCOUNTS = [
  {
    accountId: 'B101000000000089',
    customerName: 'AlphaCorp Technology Solutions JSC',
    taxId: '0108881948',
    plan: 'FTTH B2B 500M',
    vlanInfo: 'VLAN: 402 - Static IP',
    balanceUSD: 507.89,
    openInvoicesBalanceUSD: 507.89,
    historicalArrearsUSD: 0,
    historicalArrearsNote: '',
    overdueDays: 6,
    stage: 'STAGE_1_SMS',
    riskLevel: 'MEDIUM',
    oltStatus: 'ACTIVE',
    portLabel: 'PORT #04',
    oltNode: 'VN-HN01-R02',
    ponSlot: 'PON-02',
    odfPort: 'SP-HK-04 (Port 04)',
    ontSerial: 'NX08829104',
    contactPerson: 'Nguyen Van Hung',
    contactPhone: '0912.839.201',
    contactRole: 'Tech Lead',
    contactEmail: 'accounting@alphacorp.vn',
    virtualAccount: 'VPB - 9988 1010 0000 0089',
    invoiceRef: '#INV-2026-02-0719, #INV-2026-03-0881',
    dueDate: '15/03/2026',
    auditLogs: [
      { id: 'log-1', timestamp: '18/03/2026 08:30:12', message: 'SMS Dunning broadcasted to 0912.839.201 - Status: DELIVERED' },
      { id: 'log-2', timestamp: '20/03/2026 09:15:00', message: 'Email e-Invoice & payment reminder sent to accounting@alphacorp.vn' },
      { id: 'log-3', timestamp: 'Today 00:00:04', message: 'Reconciled with Billing open invoices: #INV-2026-02-0719 ($168.36) + #INV-2026-03-0881 ($339.53) = $507.89' },
    ],
  },
  {
    accountId: 'T101000000000102',
    customerName: 'Dong A Transport & Logistics Group',
    taxId: '0310294821',
    plan: 'SIP Trunk 30CH + FTTH 300M',
    vlanInfo: 'VLAN: 508 - IMS Trunking',
    balanceUSD: 18450.0,
    openInvoicesBalanceUSD: 807.62,
    historicalArrearsUSD: 17642.38,
    historicalArrearsNote: 'Legacy PRI trunking arrears carried forward outside Billing invoice list (#LEG-2026-088)',
    overdueDays: 18,
    stage: 'STAGE_3_THROTTLE',
    riskLevel: 'HIGH',
    oltStatus: 'THROTTLED',
    portLabel: 'PORT #12',
    oltNode: 'VN-SG01-R01',
    ponSlot: 'PON-04',
    odfPort: 'SP-Q1-12 (Port 12)',
    ontSerial: 'NX08829440',
    contactPerson: 'Tran Duc Thang',
    contactPhone: '0983.441.229',
    contactRole: 'Chief Financial Officer',
    contactEmail: 'finance@donga-logistics.vn',
    virtualAccount: 'VPB - 9988 1010 0000 0102',
    invoiceRef: '#INV-2026-03-0882 (+ Legacy #LEG-2026-088)',
    dueDate: '03/03/2026',
    auditLogs: [
      { id: 'log-1', timestamp: '06/03/2026 08:00:00', message: 'SMS Dunning Tier 1 sent to CFO mobile' },
      { id: 'log-2', timestamp: '10/03/2026 14:20:00', message: 'Automated AI VoiceBot called finance hotline (Duration: 42s)' },
      { id: 'log-3', timestamp: '13/03/2026 00:00:00', message: 'RADIUS CoS Throttled to 1Mbps. Barring outgoing SIP calls active' },
    ],
  },
  {
    accountId: 'D101000000000045',
    customerName: 'Phuc An International Medical Center',
    taxId: '0109923841',
    plan: 'Leased Line Internet 100M Dedicated',
    vlanInfo: 'Circuit ID: LL-HN-0912',
    balanceUSD: 42120.0,
    openInvoicesBalanceUSD: 0,
    historicalArrearsUSD: 42120.0,
    historicalArrearsNote: 'Pre-migration multi-site leased line arrears outside Billing invoice list (#LEG-2026-072)',
    overdueDays: 32,
    stage: 'STAGE_4_SUSPEND',
    riskLevel: 'CRITICAL',
    oltStatus: 'SUSPENDED',
    portLabel: 'PORT #01',
    oltNode: 'VN-HN02-R01',
    ponSlot: 'PON-01',
    odfPort: 'SP-CG-01 (Port 01)',
    ontSerial: 'NX08828901',
    contactPerson: 'Le Bao Ngoc',
    contactPhone: '0904.551.992',
    contactRole: 'Director of Operations',
    contactEmail: 'admin@phucan-medical.vn',
    virtualAccount: 'VPB - 9988 1010 0000 0045',
    invoiceRef: '#INV-2026-03-0883 (Paid) + Legacy #LEG-2026-072',
    dueDate: '18/02/2026',
    auditLogs: [
      { id: 'log-1', timestamp: '21/02/2026 09:00:00', message: 'SMS Tier 1 & email dunning dispatched' },
      { id: 'log-2', timestamp: '25/02/2026 10:30:00', message: 'AI VoiceBot contacted finance line' },
      { id: 'log-3', timestamp: '28/02/2026 00:00:00', message: 'Bandwidth throttled to 512Kbps' },
      { id: 'log-4', timestamp: '05/03/2026 00:01:10', message: 'OMCI Deauth signal sent to OLT. Optical port deauthorized (SUSPENDED)' },
    ],
  },
  {
    accountId: 'B102000000000210',
    customerName: 'Grand Marina Saigon Luxury Hotel',
    taxId: '0309918231',
    plan: 'FTTH B2B 1Gbps + IPTV Multi-Play',
    vlanInfo: 'VLAN: 880 - Multi-Play QoS',
    balanceUSD: 9870.0,
    openInvoicesBalanceUSD: 0,
    historicalArrearsUSD: 9870.0,
    historicalArrearsNote: 'Legacy hospitality setup & multi-play arrears outside Billing invoice list (#LEG-2026-095)',
    overdueDays: 4,
    stage: 'STAGE_1_SMS',
    riskLevel: 'LOW',
    oltStatus: 'ACTIVE',
    portLabel: 'PORT #08',
    oltNode: 'VN-SG02-R03',
    ponSlot: 'PON-03',
    odfPort: 'SP-Q7-08 (Port 08)',
    ontSerial: 'NX08829912',
    contactPerson: 'Vo Kim Loan',
    contactPhone: '0938.129.888',
    contactRole: 'IT Systems Manager',
    contactEmail: 'it.lead@grandmarinasaigon.vn',
    virtualAccount: 'VPB - 9988 1020 0000 0210',
    invoiceRef: 'Legacy #LEG-2026-095 (Outside Billing)',
    dueDate: '17/03/2026',
    auditLogs: [
      { id: 'log-1', timestamp: '20/03/2026 09:00:00', message: 'SMS reminder sent to IT Manager' },
    ],
  },
]

export function fetchDebtAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((acc) => normalizeDebtAccountRecord(acc))
      }
    }
  } catch {}
  saveDebtAccounts(INITIAL_DEBT_ACCOUNTS)
  return INITIAL_DEBT_ACCOUNTS.map((acc) => normalizeDebtAccountRecord(acc))
}

export function saveDebtAccounts(accounts) {
  try {
    const normalized = Array.isArray(accounts)
      ? accounts.map((acc) => normalizeDebtAccountRecord(acc))
      : []
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    notifyDebtAccountsUpdated()
  } catch {}
}

export function suspendCircuit(accountId, reason = 'Overdue invoice SLA exceeded') {
  const accounts = fetchDebtAccounts()
  const updated = accounts.map((acc) => {
    if (acc.accountId === accountId) {
      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('en-GB'),
        message: `Manual OLT Disconnect executed by NOC engineer: ${reason}`,
      }
      return {
        ...acc,
        oltStatus: 'SUSPENDED',
        riskLevel: 'CRITICAL',
        auditLogs: [newLog, ...acc.auditLogs],
      }
    }
    return acc
  })
  saveDebtAccounts(updated)
  try {
    updateAccountConnectionStatus(accountId, 'SUSPENDED')
  } catch {}
  return updated
}

export function unsuspendCircuit(accountId, reason = 'Payment reconciled via Virtual Account', options = {}) {
  const preserveRemainingBalance = Boolean(options?.preserveRemainingBalance)
  const accounts = fetchDebtAccounts()
  const updated = accounts.map((acc) => {
    if (acc.accountId === accountId) {
      const normalized = normalizeDebtAccountRecord(acc)
      const nextBalance = preserveRemainingBalance ? normalized.balanceUSD : 0
      const nextOpenInvoices = preserveRemainingBalance ? normalized.openInvoicesBalanceUSD : 0
      const nextHistorical = preserveRemainingBalance ? normalized.historicalArrearsUSD : 0
      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('en-GB'),
        message: `OMCI Authentication restored: ${reason}`,
      }
      return {
        ...normalized,
        oltStatus: 'ACTIVE',
        balanceUSD: nextBalance,
        openInvoicesBalanceUSD: nextOpenInvoices,
        historicalArrearsUSD: nextHistorical,
        overdueDays: nextBalance <= 0 ? 0 : normalized.overdueDays,
        stage: nextBalance <= 0 ? 'RESOLVED' : 'STAGE_1_SMS',
        riskLevel: nextBalance <= 0 ? 'LOW' : 'MEDIUM',
        auditLogs: [newLog, ...normalized.auditLogs],
      }
    }
    return acc
  })
  saveDebtAccounts(updated)
  try {
    updateAccountConnectionStatus(accountId, 'ACTIVE')
  } catch {}
  return updated
}

export function extendGracePeriod(accountId, days = 3) {
  const accounts = fetchDebtAccounts()
  const updated = accounts.map((acc) => {
    if (acc.accountId === accountId) {
      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('en-GB'),
        message: `Grace period whitelist extended by +${days} days by Financial Lead`,
      }
      return {
        ...acc,
        auditLogs: [newLog, ...acc.auditLogs],
      }
    }
    return acc
  })
  saveDebtAccounts(updated)
  return updated
}

export function batchSuspendAccounts(accountIds) {
  const accounts = fetchDebtAccounts()
  const set = new Set(accountIds)
  const nowStr = new Date().toLocaleString('en-GB')
  const updated = accounts.map((acc) => {
    if (set.has(acc.accountId)) {
      return {
        ...acc,
        oltStatus: 'SUSPENDED',
        riskLevel: 'CRITICAL',
        auditLogs: [
          {
            id: `log-${Date.now()}-${acc.accountId}`,
            timestamp: nowStr,
            message: 'Batch Dunning cut-off executed: OMCI port deauthorized',
          },
          ...acc.auditLogs,
        ],
      }
    }
    return acc
  })
  saveDebtAccounts(updated)
  set.forEach((id) => {
    try {
      updateAccountConnectionStatus(id, 'SUSPENDED')
    } catch {}
  })
  return updated
}

export function syncDebtAccountPayment(accountId, paidAmount, remainingInvoiceBalance = undefined) {
  const accounts = fetchDebtAccounts()
  const nowStr = new Date().toLocaleString('en-GB')
  let found = false
  const numericPaid = Math.max(0, Number(Number(paidAmount || 0).toFixed(2)) || 0)
  const hasExplicitRemaining =
    remainingInvoiceBalance !== undefined &&
    remainingInvoiceBalance !== null &&
    Number.isFinite(Number(remainingInvoiceBalance))

  const updated = accounts.map((acc) => {
    if (acc.accountId === accountId) {
      found = true
      const normalized = normalizeDebtAccountRecord(acc)
      let nextOpenInvoices = normalized.openInvoicesBalanceUSD
      let nextHistoricalArrears = normalized.historicalArrearsUSD

      if (hasExplicitRemaining) {
        nextOpenInvoices = Math.max(0, Number(Number(remainingInvoiceBalance).toFixed(2)) || 0)
      } else {
        nextOpenInvoices = Math.max(0, Number((normalized.openInvoicesBalanceUSD - numericPaid).toFixed(2)))
        const overflowPaid = Math.max(0, Number((numericPaid - normalized.openInvoicesBalanceUSD).toFixed(2)))
        nextHistoricalArrears = Math.max(0, Number((normalized.historicalArrearsUSD - overflowPaid).toFixed(2)))
      }

      const newBalance = Number((nextOpenInvoices + nextHistoricalArrears).toFixed(2))
      const isCleared = newBalance <= 0

      let logMessage
      if (isCleared) {
        logMessage = `Full payment of $${numericPaid.toFixed(2)} received. Total debt cleared ($0.00), OMCI circuit ACTIVE.`
      } else if (nextHistoricalArrears > 0) {
        logMessage = `Billing payment of $${numericPaid.toFixed(2)} applied. Remaining Billing invoices: $${nextOpenInvoices.toFixed(2)} + Historical unbilled arrears: $${nextHistoricalArrears.toFixed(2)} = $${newBalance.toFixed(2)}.`
      } else {
        logMessage = `Billing payment of $${numericPaid.toFixed(2)} applied. Remaining Billing invoice balance: $${newBalance.toFixed(2)}.`
      }

      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: nowStr,
        message: logMessage,
      }

      return {
        ...normalized,
        balanceUSD: newBalance,
        openInvoicesBalanceUSD: nextOpenInvoices,
        historicalArrearsUSD: nextHistoricalArrears,
        overdueDays: isCleared ? 0 : normalized.overdueDays,
        oltStatus: isCleared ? 'ACTIVE' : normalized.oltStatus,
        stage: isCleared ? 'RESOLVED' : normalized.stage,
        riskLevel: isCleared ? 'LOW' : newBalance < 1000 ? 'MEDIUM' : normalized.riskLevel,
        auditLogs: [newLog, ...normalized.auditLogs],
      }
    }
    return acc
  })

  if (found) {
    saveDebtAccounts(updated)
    const target = updated.find((a) => a.accountId === accountId)
    if (target && target.balanceUSD <= 0) {
      try {
        updateAccountConnectionStatus(accountId, 'ACTIVE')
      } catch {}
    }
  }
  return updated
}

export function syncDebtAccountInvoiceBalance(accountId, openInvoicesBalanceUSD, options = {}) {
  const accounts = fetchDebtAccounts()
  let found = false
  const nextOpenInvoices = Math.max(0, Number(Number(openInvoicesBalanceUSD || 0).toFixed(2)) || 0)

  const updated = accounts.map((acc) => {
    if (acc.accountId !== accountId) return acc
    found = true
    const normalized = normalizeDebtAccountRecord(acc)
    const newBalance = Number((nextOpenInvoices + normalized.historicalArrearsUSD).toFixed(2))
    return {
      ...normalized,
      openInvoicesBalanceUSD: nextOpenInvoices,
      balanceUSD: newBalance,
      ...(options.invoiceRef ? { invoiceRef: options.invoiceRef } : {}),
    }
  })

  if (found) {
    saveDebtAccounts(updated)
  }
  return updated
}

export function reconcileDebtAccountWithBillingSummary(acc = {}, billingSummary = null) {
  const normalized = normalizeDebtAccountRecord(acc)
  if (!billingSummary) {
    return {
      ...normalized,
      billingOpenInvoiceCount: 0,
      billingInvoiceIds: [],
      hasHistoricalArrears: normalized.historicalArrearsUSD > 0,
      billingSyncedBalanceUSD: normalized.openInvoicesBalanceUSD,
    }
  }

  const billingOpenUSD = Math.max(
    0,
    Number(Number(billingSummary.totalUnpaidBalance || 0).toFixed(2)) || 0
  )
  const reconciledTotal = Number((billingOpenUSD + normalized.historicalArrearsUSD).toFixed(2))

  return {
    ...normalized,
    openInvoicesBalanceUSD: billingOpenUSD,
    billingSyncedBalanceUSD: billingOpenUSD,
    balanceUSD: reconciledTotal,
    billingOpenInvoiceCount: Number(billingSummary.count || 0),
    billingInvoiceIds: Array.isArray(billingSummary.invoices)
      ? billingSummary.invoices.map((inv) => inv.invoiceId)
      : [],
    hasHistoricalArrears: normalized.historicalArrearsUSD > 0,
  }
}

export function runBatchDunningScan() {
  const accounts = fetchDebtAccounts()
  const nowStr = new Date().toLocaleString('en-GB')
  const updated = accounts.map((acc) => ({
    ...acc,
    auditLogs: [
      {
        id: `log-${Date.now()}-${acc.accountId}`,
        timestamp: nowStr,
        message: 'Scheduled 00:00 Dunning scan verified ledger balance',
      },
      ...acc.auditLogs,
    ],
  }))
  saveDebtAccounts(updated)
  return updated
}
