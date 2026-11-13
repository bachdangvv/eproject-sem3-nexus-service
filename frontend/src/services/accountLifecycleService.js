import { getActivatedAccounts } from './activationService.js'
import { fetchPlans, findPlanById, normalizePlanConnectionType } from './planService.js'
import { STATUTORY_TAX_RATE_PERCENT } from './taxConfig.js'
import { fetchDebtAccounts, saveDebtAccounts } from './debtService.js'
import { generateNewInvoice } from './billingService.js'

export const ACTIVATED_ACCOUNTS_STORAGE_KEY = 'nexus_activated_accounts'
export const LIFECYCLE_LOGS_STORAGE_KEY = 'nexus_account_lifecycle_logs_v1'
export const LIFECYCLE_UPDATED_EVENT = 'nexus:lifecycle-updated'

export const ACCOUNT_LIFECYCLE_STATUS = {
  ACTIVE: 'ACTIVE',
  TEMPORARILY_INACTIVE: 'TEMPORARILY_INACTIVE',
  PERMANENTLY_INACTIVE: 'PERMANENTLY_INACTIVE',
}

export const ACCOUNT_LIFECYCLE_LIST = [
  ACCOUNT_LIFECYCLE_STATUS.ACTIVE,
  ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE,
  ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE,
]

export const ACCOUNT_LIFECYCLE_META = {
  [ACCOUNT_LIFECYCLE_STATUS.ACTIVE]: {
    value: ACCOUNT_LIFECYCLE_STATUS.ACTIVE,
    label: 'Active',
    shortLabel: 'Active',
    badgeTone: 'emerald',
    isTerminal: false,
    canChangePlan: true,
    description:
      'Subscriber line is active and billable. Demo simulation state pending authoritative OLT/RADIUS integration.',
  },
  [ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE]: {
    value: ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE,
    label: 'Temporarily Inactive',
    shortLabel: 'Temp. Inactive',
    badgeTone: 'amber',
    isTerminal: false,
    canChangePlan: true,
    description:
      'Reversible suspension (customer temporary hold or >7-day overdue dunning under CN20). Assigned hardware is kept and service can return to Active.',
  },
  [ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE]: {
    value: ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE,
    label: 'Permanently Inactive',
    shortLabel: 'Perm. Inactive',
    badgeTone: 'rose',
    isTerminal: true,
    canChangePlan: false,
    description:
      'Terminal disconnection / churn. Plan changes and reactivation are locked permanently in this workflow.',
  },
}

function notifyLifecycleUpdated() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(LIFECYCLE_UPDATED_EVENT))
  }
}

export function subscribeLifecycleUpdated(callback) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }
  const handleCustom = () => callback()
  const handleStorage = (event) => {
    if (
      !event ||
      event.key === null ||
      event.key === ACTIVATED_ACCOUNTS_STORAGE_KEY ||
      event.key === LIFECYCLE_LOGS_STORAGE_KEY
    ) {
      callback()
    }
  }
  window.addEventListener(LIFECYCLE_UPDATED_EVENT, handleCustom)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(LIFECYCLE_UPDATED_EVENT, handleCustom)
    window.removeEventListener('storage', handleStorage)
  }
}

export function normalizeLifecycleStatus(rawStatus) {
  const token = String(rawStatus || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

  if (token === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE || token === 'TERMINATED' || token === 'CANCELLED' || token === 'DECOMMISSIONED' || token === 'DISCONNECTED') {
    return ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE
  }
  if (
    token === ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE ||
    token === 'SUSPENDED' ||
    token === 'THROTTLED' ||
    token === 'LOCKED' ||
    token === 'ON_HOLD' ||
    token === 'INACTIVE_TEMP'
  ) {
    return ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE
  }
  return ACCOUNT_LIFECYCLE_STATUS.ACTIVE
}

export function getLifecycleStatusMeta(rawStatus) {
  const normalized = normalizeLifecycleStatus(rawStatus)
  return ACCOUNT_LIFECYCLE_META[normalized] || ACCOUNT_LIFECYCLE_META[ACCOUNT_LIFECYCLE_STATUS.ACTIVE]
}

export function canTransitionAccountStatus(currentRawStatus, nextRawStatus) {
  const current = normalizeLifecycleStatus(currentRawStatus)
  const next = normalizeLifecycleStatus(nextRawStatus)

  if (current === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE) {
    return {
      allowed: false,
      current,
      next,
      reason: 'Permanently Inactive accounts are terminal and cannot transition to another state.',
    }
  }

  if (current === next) {
    return {
      allowed: false,
      current,
      next,
      reason: `Account is already ${getLifecycleStatusMeta(current).label}.`,
    }
  }

  return {
    allowed: true,
    current,
    next,
    reason: null,
  }
}

export function fetchLifecycleLogs(accountId = null) {
  let logs = []
  try {
    const raw = localStorage.getItem(LIFECYCLE_LOGS_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        logs = parsed
      }
    }
  } catch {}

  if (!accountId) return logs
  const target = String(accountId).trim()
  return logs.filter((entry) => entry.accountId === target)
}

function appendLifecycleLog(entry) {
  const current = fetchLifecycleLogs()
  const updated = [entry, ...current].slice(0, 200)
  try {
    localStorage.setItem(LIFECYCLE_LOGS_STORAGE_KEY, JSON.stringify(updated))
  } catch {}
  return entry
}

function saveActivatedAccountsList(accounts) {
  try {
    localStorage.setItem(ACTIVATED_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts))
  } catch {}
}

export function inferConnectionTypeFromAccount(account = {}, matchedPlan = null) {
  if (matchedPlan?.connectionType) {
    return normalizePlanConnectionType(matchedPlan.connectionType)
  }
  if (account.connectionType || account.serviceType) {
    return normalizePlanConnectionType(account.connectionType || account.serviceType)
  }
  const id = String(account.accountId || '').trim().toUpperCase()
  if (id.startsWith('D')) return 'DIALUP'
  if (id.startsWith('T')) return 'LANDLINE'
  return 'BROADBAND'
}

export function resolveAccountPlan(account = {}, plans = null) {
  const catalog = Array.isArray(plans) ? plans : fetchPlans()
  const explicitId = String(account.planId || account.planSku || '').trim().toLowerCase()
  if (explicitId) {
    const direct = catalog.find(
      (p) => p.id.toLowerCase() === explicitId || p.sku.toLowerCase() === explicitId
    )
    if (direct) return direct
  }

  const label = String(account.planName || account.serviceTitle || '').trim().toLowerCase()
  if (label) {
    const exactName = catalog.find((p) => p.name.toLowerCase() === label)
    if (exactName) return exactName

    const partial = catalog.find(
      (p) => label.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(label)
    )
    if (partial) return partial
  }

  const inferredType = inferConnectionTypeFromAccount(account, null)
  return (
    catalog.find((p) => p.connectionType === inferredType && p.recommended) ||
    catalog.find((p) => p.connectionType === inferredType) ||
    null
  )
}

export function resolveEffectiveLifecycleStatus(account = {}, debtAccount = null) {
  const rawLifecycle = String(account.lifecycleStatus || '').trim()
  const rawStatus = String(account.status || '').trim()

  if (
    normalizeLifecycleStatus(rawLifecycle) === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE ||
    normalizeLifecycleStatus(rawStatus) === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE
  ) {
    return ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE
  }

  if (rawStatus) {
    const fromAccountStatus = normalizeLifecycleStatus(rawStatus)
    if (fromAccountStatus !== ACCOUNT_LIFECYCLE_STATUS.ACTIVE) {
      return fromAccountStatus
    }
    if (!account.lifecycleUpdatedAt && debtAccount?.oltStatus && debtAccount.oltStatus !== 'ACTIVE') {
      return normalizeLifecycleStatus(debtAccount.oltStatus)
    }
    return ACCOUNT_LIFECYCLE_STATUS.ACTIVE
  }

  if (rawLifecycle) {
    return normalizeLifecycleStatus(rawLifecycle)
  }

  if (debtAccount?.oltStatus) {
    return normalizeLifecycleStatus(debtAccount.oltStatus)
  }

  return ACCOUNT_LIFECYCLE_STATUS.ACTIVE
}

export function fetchLifecycleAccounts() {
  const activated = getActivatedAccounts()
  if (!Array.isArray(activated) || activated.length === 0) {
    return []
  }

  const plans = fetchPlans()
  const debtAccounts = fetchDebtAccounts()
  const logs = fetchLifecycleLogs()

  return activated.map((acc) => {
    const debtRecord = debtAccounts.find((d) => d.accountId === acc.accountId) || null
    const matchedPlan = resolveAccountPlan(acc, plans)
    const connectionType = inferConnectionTypeFromAccount(acc, matchedPlan)
    const lifecycleStatus = resolveEffectiveLifecycleStatus(acc, debtRecord)
    const statusMeta = getLifecycleStatusMeta(lifecycleStatus)
    const monthlyNetUSD = Number(
      Math.max(
        0,
        Number(acc.monthlyChargeUSD ?? acc.monthlyNetUSD ?? matchedPlan?.monthlyNetUSD ?? 0) || 0
      ).toFixed(2)
    )
    const availableUpgradePlans = plans.filter(
      (p) => p.status === 'ACTIVE' && p.connectionType === connectionType
    )

    return {
      ...acc,
      lifecycleStatus,
      lifecycleLabel: statusMeta.label,
      statusMeta,
      matchedPlan,
      planId: acc.planId || matchedPlan?.id || null,
      planSku: acc.planSku || matchedPlan?.sku || null,
      planName: acc.planName || acc.serviceTitle || matchedPlan?.name || 'Custom Enterprise Profile',
      connectionType,
      monthlyChargeUSD: monthlyNetUSD,
      monthlyNetUSD,
      debtRecord,
      availablePlans: availableUpgradePlans,
      auditHistory: logs.filter((entry) => entry.accountId === acc.accountId),
    }
  })
}

export function calculateDailyProration({
  currentMonthlyUSD = 0,
  newMonthlyUSD = 0,
  effectiveDay = new Date().getDate(),
  daysInCycle = 30,
  remainingDays: explicitRemainingDays = null,
  billingCycleLabel = '',
} = {}) {
  const parsedCycle = Math.round(Number(daysInCycle) || 30)
  const safeDaysInCycle = Math.max(28, Math.min(31, parsedCycle))

  let remainingDays
  let clampedEffectiveDay
  if (explicitRemainingDays !== null && explicitRemainingDays !== undefined && explicitRemainingDays !== '') {
    remainingDays = Math.max(0, Math.min(safeDaysInCycle, Math.round(Number(explicitRemainingDays) || 0)))
    clampedEffectiveDay = Math.max(1, safeDaysInCycle - remainingDays + 1)
  } else {
    const rawDay = Math.round(Number(effectiveDay) || 1)
    clampedEffectiveDay = Math.max(1, Math.min(safeDaysInCycle, rawDay))
    remainingDays = safeDaysInCycle - clampedEffectiveDay + 1
  }

  const usedDays = safeDaysInCycle - remainingDays
  const oldMonthlyNetUSD = Number(Math.max(0, Number(currentMonthlyUSD) || 0).toFixed(2))
  const newMonthlyNetUSD = Number(Math.max(0, Number(newMonthlyUSD) || 0).toFixed(2))

  const oldDailyRateUSD = Number((oldMonthlyNetUSD / safeDaysInCycle).toFixed(4))
  const newDailyRateUSD = Number((newMonthlyNetUSD / safeDaysInCycle).toFixed(4))
  const unusedCreditNetUSD = Number(((oldMonthlyNetUSD * remainingDays) / safeDaysInCycle).toFixed(2))
  const newChargeNetUSD = Number(((newMonthlyNetUSD * remainingDays) / safeDaysInCycle).toFixed(2))
  const proratedNetDeltaUSD = Number((newChargeNetUSD - unusedCreditNetUSD).toFixed(2))

  const taxRatePercent = STATUTORY_TAX_RATE_PERCENT
  const taxAmountUSD = Number(((proratedNetDeltaUSD * taxRatePercent) / 100).toFixed(2))
  const totalAdjustmentUSD = Number((proratedNetDeltaUSD + taxAmountUSD).toFixed(2))

  const changeDirection =
    proratedNetDeltaUSD > 0 ? 'UPGRADE' : proratedNetDeltaUSD < 0 ? 'DOWNGRADE' : 'LATERAL'

  const prorationRatioPercent = Number(((remainingDays / safeDaysInCycle) * 100).toFixed(2))

  return {
    daysInCycle: safeDaysInCycle,
    effectiveDay: clampedEffectiveDay,
    usedDays,
    remainingDays,
    prorationRatioPercent,
    billingCycleLabel:
      String(billingCycleLabel || '').trim() ||
      `Day ${clampedEffectiveDay} of ${safeDaysInCycle}-day billing cycle (${remainingDays} days remaining)`,
    currentMonthlyUSD: oldMonthlyNetUSD,
    newMonthlyUSD: newMonthlyNetUSD,
    oldDailyRateUSD,
    newDailyRateUSD,
    unusedCreditNetUSD,
    newChargeNetUSD,
    proratedNetDeltaUSD,
    taxRatePercent,
    taxAmountUSD,
    totalAdjustmentUSD,
    changeDirection,
  }
}

export function changeAccountLifecycleStatus({
  accountId,
  nextStatus,
  reason = '',
  actorName = 'Technical Operations (Demo)',
} = {}) {
  const targetId = String(accountId || '').trim()
  if (!targetId) {
    throw new Error('Subscriber Account ID is required.')
  }

  const activated = getActivatedAccounts()
  const idx = activated.findIndex((a) => a.accountId === targetId)
  if (idx === -1) {
    throw new Error(`Activated subscriber account "${targetId}" was not found.`)
  }

  const existing = activated[idx]
  const debtAccounts = fetchDebtAccounts()
  const matchedDebt = debtAccounts.find((d) => d.accountId === targetId) || null
  const currentStatus = resolveEffectiveLifecycleStatus(existing, matchedDebt)

  const transitionCheck = canTransitionAccountStatus(currentStatus, nextStatus)
  if (!transitionCheck.allowed) {
    throw new Error(transitionCheck.reason)
  }

  const canonicalNext = transitionCheck.next
  const meta = getLifecycleStatusMeta(canonicalNext)
  const nowIso = new Date().toISOString()
  const cleanReason =
    String(reason || '').trim() || `Lifecycle transition to ${meta.label} recorded in demo console.`

  const updatedAccount = {
    ...existing,
    status: canonicalNext,
    lifecycleStatus: canonicalNext,
    lifecycleLabel: meta.label,
    lifecycleReason: cleanReason,
    lifecycleUpdatedAt: nowIso,
    lifecycleUpdatedBy: actorName,
  }

  const nextActivatedList = [...activated]
  nextActivatedList[idx] = updatedAccount
  saveActivatedAccountsList(nextActivatedList)

  if (matchedDebt) {
    const debtStatus =
      canonicalNext === ACCOUNT_LIFECYCLE_STATUS.ACTIVE ? 'ACTIVE' : 'SUSPENDED'
    const nowDisplay = new Date().toLocaleString('en-GB')
    const updatedDebtList = debtAccounts.map((acc) => {
      if (acc.accountId !== targetId) return acc
      return {
        ...acc,
        oltStatus: debtStatus,
        lifecycleStatus: canonicalNext,
        stage:
          canonicalNext === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE
            ? 'PERMANENTLY_INACTIVE'
            : acc.stage,
        auditLogs: [
          {
            id: `lc-debt-${Date.now()}`,
            timestamp: nowDisplay,
            message: `[CN15 Lifecycle] ${currentStatus} -> ${canonicalNext} (${meta.label}): ${cleanReason}`,
          },
          ...(acc.auditLogs || []),
        ],
      }
    })
    saveDebtAccounts(updatedDebtList)
  }

  const logEntry = appendLifecycleLog({
    id: `LC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    type: 'STATUS_CHANGE',
    accountId: targetId,
    customerName: existing.customerName || 'Enterprise Subscriber',
    previousStatus: currentStatus,
    nextStatus: canonicalNext,
    nextStatusLabel: meta.label,
    reason: cleanReason,
    actorName,
    timestamp: nowIso,
    demoSimulated: true,
  })

  notifyLifecycleUpdated()

  return {
    account: updatedAccount,
    previousStatus: currentStatus,
    nextStatus: canonicalNext,
    meta,
    logEntry,
  }
}

export async function changeAccountPlanWithProration({
  accountId,
  newPlanId,
  effectiveDay = new Date().getDate(),
  daysInCycle = 30,
  remainingDays = null,
  billingCycleLabel = '',
  issueAdjustmentInvoice = true,
  reason = '',
  actorName = 'Technical Operations (Demo)',
} = {}) {
  const targetId = String(accountId || '').trim()
  if (!targetId) {
    throw new Error('Subscriber Account ID is required.')
  }

  const activated = getActivatedAccounts()
  const idx = activated.findIndex((a) => a.accountId === targetId)
  if (idx === -1) {
    throw new Error(`Activated subscriber account "${targetId}" was not found.`)
  }

  const existing = activated[idx]
  const debtAccounts = fetchDebtAccounts()
  const matchedDebt = debtAccounts.find((d) => d.accountId === targetId) || null
  const currentStatus = resolveEffectiveLifecycleStatus(existing, matchedDebt)

  if (currentStatus === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE) {
    throw new Error('Plan change blocked: Permanently Inactive accounts cannot change tariff plans.')
  }

  const targetPlan = findPlanById(newPlanId)
  if (!targetPlan) {
    throw new Error(`Target plan "${newPlanId}" was not found in the unified tariff catalog.`)
  }
  if (targetPlan.status !== 'ACTIVE') {
    throw new Error(`Plan "${targetPlan.name}" is inactive and cannot be assigned.`)
  }

  const currentPlan = resolveAccountPlan(existing)
  const accountConnectionType = inferConnectionTypeFromAccount(existing, currentPlan)
  if (targetPlan.connectionType !== accountConnectionType) {
    throw new Error(
      `Plan "${targetPlan.name}" (${targetPlan.connectionType}) does not match account service type (${accountConnectionType}).`
    )
  }

  const previousPlanId = existing.planId || currentPlan?.id || null
  if (previousPlanId && previousPlanId.toLowerCase() === targetPlan.id.toLowerCase()) {
    throw new Error('Select a different target plan to apply a plan change.')
  }

  const previousPlanName =
    existing.planName || existing.serviceTitle || currentPlan?.name || 'Previous Service Plan'
  const oldMonthlyUSD = Number(
    existing.monthlyChargeUSD ?? existing.monthlyNetUSD ?? currentPlan?.monthlyNetUSD ?? 0
  )

  const proration = calculateDailyProration({
    currentMonthlyUSD: oldMonthlyUSD,
    newMonthlyUSD: targetPlan.monthlyNetUSD,
    effectiveDay,
    daysInCycle,
    remainingDays,
    billingCycleLabel,
  })

  const nowIso = new Date().toISOString()
  const cleanReason =
    String(reason || '').trim() ||
    `CN15 mid-cycle plan ${proration.changeDirection.toLowerCase()} from ${previousPlanName} to ${targetPlan.name}`

  const updatedAccount = {
    ...existing,
    previousPlanId,
    previousPlanName,
    planId: targetPlan.id,
    planSku: targetPlan.sku,
    planName: targetPlan.name,
    serviceTitle: targetPlan.name,
    connectionType: targetPlan.connectionType,
    monthlyChargeUSD: targetPlan.monthlyNetUSD,
    monthlyNetUSD: targetPlan.monthlyNetUSD,
    monthlyGrossUSD: targetPlan.monthlyGrossUSD,
    lastPlanChangedAt: nowIso,
    lastProrationSummary: proration,
    lifecycleStatus: currentStatus,
    lifecycleLabel: getLifecycleStatusMeta(currentStatus).label,
  }

  const nextActivatedList = [...activated]
  nextActivatedList[idx] = updatedAccount
  saveActivatedAccountsList(nextActivatedList)

  if (matchedDebt) {
    const nowDisplay = new Date().toLocaleString('en-GB')
    const updatedDebtList = debtAccounts.map((acc) => {
      if (acc.accountId !== targetId) return acc
      return {
        ...acc,
        planName: targetPlan.name,
        auditLogs: [
          {
            id: `lc-plan-${Date.now()}`,
            timestamp: nowDisplay,
            message: `[CN15 Plan Change] ${previousPlanName} -> ${targetPlan.name} (${proration.remainingDays}/${proration.daysInCycle} days, net delta ${proration.proratedNetDeltaUSD >= 0 ? '+' : ''}$${proration.proratedNetDeltaUSD.toFixed(2)}).`,
          },
          ...(acc.auditLogs || []),
        ],
      }
    })
    saveDebtAccounts(updatedDebtList)
  }

  let generatedInvoice = null
  let creditMemo = null

  if (issueAdjustmentInvoice && proration.proratedNetDeltaUSD > 0) {
    try {
      generatedInvoice = await generateNewInvoice(
        targetId,
        [
          {
            desc: `CN15 Prorated Plan Upgrade (${proration.remainingDays}/${proration.daysInCycle} days): ${targetPlan.name}`,
            amount: proration.newChargeNetUSD,
          },
          {
            desc: `Unused Credit Offset (${proration.remainingDays}/${proration.daysInCycle} days): ${previousPlanName}`,
            amount: -proration.unusedCreditNetUSD,
          },
        ],
        {
          customerName: existing.customerName || existing.company || 'Enterprise Subscriber',
          company: existing.company || existing.customerName || 'Enterprise Subscriber',
          serviceTitle: `Proration Adjustment • ${targetPlan.name}`,
          customerId: existing.customerId || null,
        }
      )
    } catch {
      generatedInvoice = null
    }
  } else if (proration.proratedNetDeltaUSD < 0) {
    creditMemo = {
      accountId: targetId,
      creditNetUSD: Math.abs(proration.proratedNetDeltaUSD),
      creditTaxUSD: Math.abs(proration.taxAmountUSD),
      totalCreditUSD: Math.abs(proration.totalAdjustmentUSD),
      remainingDays: proration.remainingDays,
      daysInCycle: proration.daysInCycle,
      note: 'Downgrade credit simulated in client ledger; production backend will offset next monthly billing run.',
    }
  }

  const logEntry = appendLifecycleLog({
    id: `LC-PLAN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    type: 'PLAN_CHANGE',
    accountId: targetId,
    customerName: existing.customerName || 'Enterprise Subscriber',
    previousPlanId,
    previousPlanName,
    newPlanId: targetPlan.id,
    newPlanName: targetPlan.name,
    proration,
    generatedInvoiceId: generatedInvoice?.id || null,
    creditMemo,
    reason: cleanReason,
    actorName,
    timestamp: nowIso,
    demoSimulated: true,
  })

  notifyLifecycleUpdated()

  return {
    account: updatedAccount,
    previousPlan: currentPlan,
    newPlan: targetPlan,
    proration,
    generatedInvoice,
    creditMemo,
    logEntry,
  }
}

