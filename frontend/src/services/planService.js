import { STATUTORY_TAX_RATE_PERCENT, calculateStatutoryTax } from './taxConfig.js'

const STORAGE_KEY = 'nexus_telecom_plans_v1'
const TAX_KEY = 'nexus_telecom_tax_rate_v1'
const VERSION_HISTORY_KEY = 'nexus_telecom_plan_history_v1'
const CATALOG_META_KEY = 'nexus_telecom_plan_catalog_meta_v1'

export const DEFAULT_TAX_RATE = STATUTORY_TAX_RATE_PERCENT
export const PLANS_UPDATED_EVENT = 'nexus:plans-updated'
const DEFAULT_PLAN_BASELINE_AT = '2026-04-01T09:00:00.000Z'

const TRACKED_PLAN_FIELDS = [
  { field: 'sku', label: 'SKU Code' },
  { field: 'name', label: 'Plan Name' },
  { field: 'type', label: 'Service Type' },
  { field: 'monthlyNetUSD', label: 'Monthly Net ($)' },
  { field: 'cpeMonthlyUSD', label: 'CPE Rental ($)' },
  { field: 'cirMbps', label: 'CIR (Mbps)' },
  { field: 'pirMbps', label: 'PIR (Mbps)' },
  { field: 'domesticSpeed', label: 'Bandwidth Label' },
  { field: 'ipStatic', label: 'IP / VLAN Allocation' },
  { field: 'cpeModel', label: 'CPE Hardware' },
  { field: 'status', label: 'Catalog Status' },
  { field: 'recommended', label: 'Popular Flag' },
]

export const PLAN_TYPE_OPTIONS = [
  { value: 'BROADBAND', label: 'BROADBAND (FTTH)', connectionType: 'BROADBAND' },
  { value: 'DIAL_UP', label: 'DIAL_UP (Dial-Up / Legacy)', connectionType: 'DIALUP' },
  { value: 'LEASED_LINE', label: 'LEASED_LINE (Dedicated Metro)', connectionType: 'DIALUP' },
  { value: 'LANDLINE', label: 'LANDLINE (Voice)', connectionType: 'LANDLINE' },
  { value: 'SIP_TRUNK', label: 'SIP_TRUNK (Enterprise PBX)', connectionType: 'LANDLINE' },
]

export const INITIAL_PLANS = [
  {
    id: 'FTTH-PRO-500M',
    sku: 'FTTH-PRO-500M',
    name: 'FTTH Dedicated 500Mbps',
    type: 'BROADBAND',
    connectionType: 'BROADBAND',
    category: 'B2B Core',
    customerRef: 'AlphaCorp SKU',
    vlan: 'VLAN 402',
    sla: 'SLA 99.9%',
    cirMbps: 200,
    pirMbps: 500,
    burstLimitMbps: 542,
    qosProfile: 'WFQ CoS=5 (Voice/Data VIP)',
    domesticSpeed: '200 Mbps CIR / 500 Mbps PIR',
    ipStatic: 'VLAN 402 • 01 Public Static IPv4',
    recommended: true,
    monthlyNetUSD: 2500.0,
    vatPercent: STATUTORY_TAX_RATE_PERCENT,
    monthlyGrossUSD: 2806.0,
    cpeModel: 'Nexus Wi-Fi 6 GPON Model NX-G820',
    cpeMonthlyUSD: 200.0,
    status: 'ACTIVE',
    assignedSubscribers: 384,
  },
  {
    id: 'FTTH-BIZ-1G',
    sku: 'FTTH-BIZ-1G',
    name: 'FTTH Enterprise Ultra 1Gbps',
    type: 'BROADBAND',
    connectionType: 'BROADBAND',
    category: 'Ultra QoS',
    customerRef: 'Enterprise VIP',
    vlan: 'VLAN 1104',
    sla: 'SLA 99.95%',
    cirMbps: 400,
    pirMbps: 1000,
    burstLimitMbps: 1050,
    qosProfile: 'WFQ CoS=6 (Ultra Low Latency)',
    domesticSpeed: '400 Mbps CIR / 1000 Mbps PIR',
    ipStatic: 'VLAN 1104 • Subnet /29 (8 IPs)',
    recommended: false,
    monthlyNetUSD: 4200.0,
    vatPercent: STATUTORY_TAX_RATE_PERCENT,
    monthlyGrossUSD: 4714.08,
    cpeModel: 'Huawei OptiXstar B650G Enterprise',
    cpeMonthlyUSD: 350.0,
    status: 'ACTIVE',
    assignedSubscribers: 142,
  },
  {
    id: 'LEASED-LINK-100M',
    sku: 'LEASED-LINK-100M',
    name: 'Dedicated Leased Line 100M',
    type: 'LEASED_LINE',
    connectionType: 'DIALUP',
    category: 'Mission Critical',
    customerRef: 'Core Banking',
    vlan: 'VLAN 4801',
    sla: 'SLA 99.99%',
    cirMbps: 100,
    pirMbps: 100,
    burstLimitMbps: 100,
    qosProfile: "Strict Priority CoS=7 (1:1 Int'l)",
    domesticSpeed: '100 Mbps 1:1 Symmetrical CIR',
    ipStatic: 'VLAN 4801 • Subnet /28 Static IP',
    recommended: true,
    monthlyNetUSD: 8900.0,
    vatPercent: STATUTORY_TAX_RATE_PERCENT,
    monthlyGrossUSD: 9989.36,
    cpeModel: 'Cisco Catalyst PON 800 Series',
    cpeMonthlyUSD: 600.0,
    status: 'ACTIVE',
    assignedSubscribers: 82,
  },
  {
    id: 'SIP-TRUNK-30CH',
    sku: 'SIP-TRUNK-30CH',
    name: 'Voice SIP Trunking 30 CH',
    type: 'SIP_TRUNK',
    connectionType: 'LANDLINE',
    category: 'VoIP Backbone',
    customerRef: 'Contact Center',
    vlan: 'VLAN 2100',
    sla: 'SLA 99.95%',
    cirMbps: 2,
    pirMbps: 2,
    burstLimitMbps: 4,
    qosProfile: 'DSCP EF 46 (Jitter < 2ms)',
    domesticSpeed: '30 Concurrent SIP Channels',
    ipStatic: 'VLAN 2100 • Direct SIP Gateway',
    recommended: true,
    monthlyNetUSD: 1800.0,
    vatPercent: STATUTORY_TAX_RATE_PERCENT,
    monthlyGrossUSD: 2020.32,
    cpeModel: 'Grandstream UCM6302 IP-PBX',
    cpeMonthlyUSD: 180.0,
    status: 'ACTIVE',
    assignedSubscribers: 124,
  },
  {
    id: 'DIAL-POS-V92',
    sku: 'DIAL-POS-V92',
    name: 'Dial-Up POS V.92 / ATM Dedicated',
    type: 'DIAL_UP',
    connectionType: 'DIALUP',
    category: 'Financial POS',
    customerRef: 'Retail POS Chain',
    vlan: 'V.92 / RJ11 Sync',
    sla: 'SLA 99.5%',
    cirMbps: 0.056,
    pirMbps: 0.056,
    burstLimitMbps: 0.056,
    qosProfile: 'Low Latency Priority (< 15ms)',
    domesticSpeed: '56 Kbps Analog V.92 Sync',
    ipStatic: 'Dynamic Polling Pool',
    recommended: false,
    monthlyNetUSD: 450.0,
    vatPercent: STATUTORY_TAX_RATE_PERCENT,
    monthlyGrossUSD: 505.08,
    cpeModel: 'Modem POS V.92 Rackmount (Included)',
    cpeMonthlyUSD: 0.0,
    status: 'ACTIVE',
    assignedSubscribers: 512,
  },
  {
    id: 'FTTH-SOHO-250M',
    sku: 'FTTH-SOHO-250M',
    name: 'FTTH SOHO Pro 250M',
    type: 'BROADBAND',
    connectionType: 'BROADBAND',
    category: 'SOHO / SME',
    customerRef: 'Small Office',
    vlan: 'VLAN 1105',
    sla: 'SLA 99.8%',
    cirMbps: 80,
    pirMbps: 250,
    burstLimitMbps: 260,
    qosProfile: 'WFQ CoS=3 (Business Internet)',
    domesticSpeed: '80 Mbps CIR / 250 Mbps PIR',
    ipStatic: 'VLAN 1105 • 01 Internal Static IP',
    recommended: false,
    monthlyNetUSD: 950.0,
    vatPercent: STATUTORY_TAX_RATE_PERCENT,
    monthlyGrossUSD: 1066.28,
    cpeModel: 'ONT Nokia G-140W-MD Dual-Band',
    cpeMonthlyUSD: 90.0,
    status: 'ACTIVE',
    assignedSubscribers: 248,
  },
]

function notifyPlansUpdated() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(PLANS_UPDATED_EVENT))
  }
}

export function normalizePlanConnectionType(rawType) {
  const value = String(rawType || 'BROADBAND').trim().toUpperCase()
  if (value === 'BROADBAND' || value === 'FTTH') return 'BROADBAND'
  if (
    value === 'DIALUP' ||
    value === 'DIAL_UP' ||
    value === 'LEASED_LINE' ||
    value === 'LEASED'
  ) {
    return 'DIALUP'
  }
  if (
    value === 'LANDLINE' ||
    value === 'SIP_TRUNK' ||
    value === 'TELEPHONE' ||
    value === 'VOIP'
  ) {
    return 'LANDLINE'
  }
  return 'BROADBAND'
}

export function normalizePlanRecord(rawPlan = {}) {
  const resolvedId = String(
    rawPlan.id || rawPlan.sku || `PLAN-${Date.now().toString().slice(-4)}`
  ).trim()
  const resolvedSku = String(rawPlan.sku || resolvedId).trim().toUpperCase()
  const type = String(rawPlan.type || 'BROADBAND').trim().toUpperCase()
  const connectionType = normalizePlanConnectionType(type)
  const monthlyNetUSD = Math.round(
    Math.max(0, Number(rawPlan.monthlyNetUSD ?? rawPlan.priceUSD ?? 0) || 0) * 100
  ) / 100
  const cpeMonthlyUSD = Math.round(
    Math.max(0, Number(rawPlan.cpeMonthlyUSD ?? 0) || 0) * 100
  ) / 100
  const cirMbps = Math.max(0, Number(rawPlan.cirMbps ?? 0) || 0)
  const pirMbps = Math.max(0, Number(rawPlan.pirMbps ?? cirMbps) || 0)
  const monthlyGrossUSD = Number((monthlyNetUSD + calculateStatutoryTax(monthlyNetUSD)).toFixed(2))
  const status = String(rawPlan.status || 'ACTIVE').trim().toUpperCase() === 'INACTIVE'
    ? 'INACTIVE'
    : 'ACTIVE'

  return {
    ...rawPlan,
    id: resolvedId,
    sku: resolvedSku,
    name: String(rawPlan.name || resolvedSku).trim(),
    type,
    connectionType,
    cirMbps,
    pirMbps,
    monthlyNetUSD,
    priceUSD: monthlyNetUSD,
    cpeMonthlyUSD,
    vatPercent: STATUTORY_TAX_RATE_PERCENT,
    monthlyGrossUSD,
    cpeModel: String(rawPlan.cpeModel || 'Standard Carrier CPE').trim(),
    domesticSpeed:
      String(rawPlan.domesticSpeed || '').trim() ||
      (pirMbps > 0 ? `${cirMbps} Mbps CIR / ${pirMbps} Mbps PIR` : 'Standard Dedicated Profile'),
    ipStatic:
      String(rawPlan.ipStatic || rawPlan.vlan || rawPlan.qosProfile || '').trim() ||
      'Static IP Provisioned',
    recommended: Boolean(rawPlan.recommended),
    status,
    assignedSubscribers: Math.max(0, Number(rawPlan.assignedSubscribers ?? 0) || 0),
    version: Math.max(1, Number(rawPlan.version) || 1),
    updatedAt: rawPlan.updatedAt || DEFAULT_PLAN_BASELINE_AT,
  }
}

function resolveCurrentActorName(explicitActor) {
  const provided = String(explicitActor || '').trim()
  if (provided) return provided
  try {
    const rawUser = localStorage.getItem('nexus_user')
    if (rawUser) {
      const parsed = JSON.parse(rawUser)
      if (parsed?.fullName && parsed?.email) {
        return `${parsed.fullName} (${parsed.email})`
      }
      if (parsed?.fullName || parsed?.email || parsed?.identifier) {
        return String(parsed.fullName || parsed.email || parsed.identifier)
      }
    }
  } catch {}
  return 'Admin Catalog Operator'
}

function buildPlanSnapshotSummary(plans = []) {
  return plans.map((plan) => ({
    id: plan.id,
    sku: plan.sku,
    name: plan.name,
    type: plan.type,
    connectionType: plan.connectionType,
    cirMbps: plan.cirMbps,
    pirMbps: plan.pirMbps,
    domesticSpeed: plan.domesticSpeed,
    ipStatic: plan.ipStatic,
    cpeModel: plan.cpeModel,
    monthlyNetUSD: plan.monthlyNetUSD,
    cpeMonthlyUSD: plan.cpeMonthlyUSD,
    vatPercent: STATUTORY_TAX_RATE_PERCENT,
    monthlyGrossUSD: plan.monthlyGrossUSD,
    status: plan.status,
    recommended: Boolean(plan.recommended),
    version: plan.version || 1,
    updatedAt: plan.updatedAt || DEFAULT_PLAN_BASELINE_AT,
  }))
}

function diffPlanFields(beforePlan = {}, afterPlan = {}) {
  const diffs = []
  TRACKED_PLAN_FIELDS.forEach(({ field, label }) => {
    const beforeVal = beforePlan[field]
    const afterVal = afterPlan[field]
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diffs.push({
        field,
        label,
        before: beforeVal,
        after: afterVal,
      })
    }
  })
  return diffs
}

function createInitialVersionHistory() {
  const baselinePlans = INITIAL_PLANS.map((plan) => normalizePlanRecord(plan))
  return [
    {
      entryId: 'VER-0001',
      versionNumber: 1,
      versionTag: 'v1.0',
      action: 'INITIAL_SEED',
      planId: 'CATALOG',
      sku: 'ALL_SKUS',
      planName: `Master Tariff Schedule (${baselinePlans.length} SKUs)`,
      planVersion: 1,
      changedAt: DEFAULT_PLAN_BASELINE_AT,
      changedBy: 'System Seed (Admin)',
      note: `Baseline telecom catalog published at ${STATUTORY_TAX_RATE_PERCENT}% statutory VAT.`,
      changes: baselinePlans.map((p) => ({
        field: p.sku,
        label: p.name,
        before: null,
        after: `$${p.monthlyNetUSD}/mo (${p.status})`,
      })),
      previousRecord: null,
      nextRecord: null,
      catalogSnapshot: buildPlanSnapshotSummary(baselinePlans),
    },
  ]
}

function saveCatalogMeta(meta) {
  try {
    localStorage.setItem(CATALOG_META_KEY, JSON.stringify(meta))
  } catch {}
}

export function savePlanVersionHistory(history) {
  try {
    localStorage.setItem(
      VERSION_HISTORY_KEY,
      JSON.stringify(Array.isArray(history) ? history : [])
    )
  } catch {}
}

export function fetchPlanVersionHistory(options = {}) {
  let history = null
  try {
    const raw = localStorage.getItem(VERSION_HISTORY_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        history = parsed
      }
    }
  } catch {}

  if (!history) {
    history = createInitialVersionHistory()
    savePlanVersionHistory(history)
    saveCatalogMeta({
      currentVersionNumber: 1,
      versionTag: 'v1.0',
      lastUpdatedAt: DEFAULT_PLAN_BASELINE_AT,
      lastUpdatedBy: 'System Seed (Admin)',
    })
  }

  const targetPlan = String(options.planId || options.sku || '').trim().toUpperCase()
  const targetAction = String(options.action || '').trim().toUpperCase()

  return history.filter((entry) => {
    const matchPlan =
      !targetPlan ||
      String(entry.planId || '').toUpperCase() === targetPlan ||
      String(entry.sku || '').toUpperCase() === targetPlan
    const matchAction =
      !targetAction || targetAction === 'ALL' || String(entry.action || '').toUpperCase() === targetAction
    return matchPlan && matchAction
  })
}

export function getPlanCatalogVersionMeta() {
  const history = fetchPlanVersionHistory()
  try {
    const rawMeta = localStorage.getItem(CATALOG_META_KEY)
    if (rawMeta) {
      const parsed = JSON.parse(rawMeta)
      if (parsed && Number.isFinite(Number(parsed.currentVersionNumber))) {
        return {
          ...parsed,
          totalRevisions: history.length,
        }
      }
    }
  } catch {}

  const latest = history[0]
  const currentVersionNumber = Math.max(1, Number(latest?.versionNumber) || 1)
  return {
    currentVersionNumber,
    versionTag: `v${currentVersionNumber}.0`,
    lastUpdatedAt: latest?.changedAt || DEFAULT_PLAN_BASELINE_AT,
    lastUpdatedBy: latest?.changedBy || 'System Seed (Admin)',
    totalRevisions: history.length,
  }
}

function appendPlanVersionEntry({
  action,
  plan,
  planVersion = 1,
  changes = [],
  previousRecord = null,
  nextRecord = null,
  catalogPlans = [],
  actor,
  note,
}) {
  const currentHistory = fetchPlanVersionHistory()
  const currentMeta = getPlanCatalogVersionMeta()
  const maxVersion = currentHistory.reduce(
    (max, item) => Math.max(max, Number(item?.versionNumber) || 0),
    currentMeta.currentVersionNumber || 1
  )
  const nextVersionNumber = maxVersion + 1
  const changedAt = new Date().toISOString()
  const changedBy = resolveCurrentActorName(actor)
  const entry = {
    entryId: `VER-${String(nextVersionNumber).padStart(4, '0')}`,
    versionNumber: nextVersionNumber,
    versionTag: `v${nextVersionNumber}.0`,
    action,
    planId: plan?.id || 'CATALOG',
    sku: plan?.sku || 'ALL_SKUS',
    planName: plan?.name || 'Master Tariff Catalog',
    planVersion,
    changedAt,
    changedBy,
    note: String(note || '').trim() || `${action} applied to ${plan?.sku || 'tariff catalog'}`,
    changes,
    previousRecord: previousRecord ? buildPlanSnapshotSummary([previousRecord])[0] : null,
    nextRecord: nextRecord ? buildPlanSnapshotSummary([nextRecord])[0] : null,
    catalogSnapshot: buildPlanSnapshotSummary(catalogPlans),
  }

  const updatedHistory = [entry, ...currentHistory]
  savePlanVersionHistory(updatedHistory)
  saveCatalogMeta({
    currentVersionNumber: nextVersionNumber,
    versionTag: entry.versionTag,
    lastUpdatedAt: changedAt,
    lastUpdatedBy: changedBy,
  })
  return entry
}

export function subscribePlansUpdated(callback) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }
  const handleCustom = () => callback()
  const handleStorage = (event) => {
    if (
      !event ||
      event.key === null ||
      event.key === STORAGE_KEY ||
      event.key === TAX_KEY ||
      event.key === VERSION_HISTORY_KEY ||
      event.key === CATALOG_META_KEY
    ) {
      callback()
    }
  }
  window.addEventListener(PLANS_UPDATED_EVENT, handleCustom)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(PLANS_UPDATED_EVENT, handleCustom)
    window.removeEventListener('storage', handleStorage)
  }
}

/**
 * Returns the fixed statutory telecom service tax rate (%) and reconciles any stale stored value.
 */
export function fetchTaxRate() {
  try {
    const expected = String(STATUTORY_TAX_RATE_PERCENT)
    if (localStorage.getItem(TAX_KEY) !== expected) {
      localStorage.setItem(TAX_KEY, expected)
    }
  } catch {}
  return STATUTORY_TAX_RATE_PERCENT
}

/**
 * Rejects modifications because the statutory telecom tax rate is fixed and read-only.
 */
export function saveTaxRate() {
  throw new Error(`Statutory telecom service tax (${STATUTORY_TAX_RATE_PERCENT}%) is fixed by mandate and is read-only.`)
}

export function savePlans(plans) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
    notifyPlansUpdated()
  } catch {}
}

export function fetchPlans(options = {}) {
  const { activeOnly = false } = options
  fetchTaxRate()
  let list = null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        list = parsed.map((plan) => normalizePlanRecord(plan))
      }
    }
  } catch {}

  if (!list) {
    list = INITIAL_PLANS.map((plan) => normalizePlanRecord(plan))
    savePlans(list)
  }

  return activeOnly ? list.filter((plan) => plan.status === 'ACTIVE') : list
}

export function fetchRetailPlansByType(connectionType, options = { activeOnly: true }) {
  const targetType = normalizePlanConnectionType(connectionType)
  return fetchPlans(options).filter((plan) => plan.connectionType === targetType)
}

export function getPlansGroupedByConnectionType(options = { activeOnly: true }) {
  const plans = fetchPlans(options)
  return {
    BROADBAND: plans.filter((plan) => plan.connectionType === 'BROADBAND'),
    DIALUP: plans.filter((plan) => plan.connectionType === 'DIALUP'),
    LANDLINE: plans.filter((plan) => plan.connectionType === 'LANDLINE'),
  }
}

export function findPlanById(planId) {
  const target = String(planId || '').trim().toLowerCase()
  if (!target) return null
  return (
    fetchPlans().find(
      (plan) => plan.id.toLowerCase() === target || plan.sku.toLowerCase() === target
    ) || null
  )
}

export function addPlan(planData, options = {}) {
  const current = fetchPlans()
  const sku = String(planData?.sku || planData?.id || '').trim().toUpperCase()
  const name = String(planData?.name || '').trim()
  const netPrice = Number(planData?.monthlyNetUSD ?? planData?.priceUSD)

  if (!sku) {
    throw new Error('Plan SKU code is required.')
  }
  if (!name) {
    throw new Error('Plan commercial name is required.')
  }
  if (!Number.isFinite(netPrice) || netPrice <= 0) {
    throw new Error('Monthly net price must be greater than $0.')
  }

  const hasDuplicate = current.some(
    (plan) => plan.sku.toLowerCase() === sku.toLowerCase() || plan.id.toLowerCase() === sku.toLowerCase()
  )
  if (hasDuplicate) {
    throw new Error(`Plan SKU "${sku}" already exists in the tariff catalog.`)
  }

  const nowIso = new Date().toISOString()
  const newRecord = normalizePlanRecord({
    ...planData,
    id: String(planData?.id || sku).trim(),
    sku,
    name,
    monthlyNetUSD: netPrice,
    status: planData?.status || 'ACTIVE',
    assignedSubscribers: 0,
    version: 1,
    updatedAt: nowIso,
  })

  const updated = [newRecord, ...current]
  appendPlanVersionEntry({
    action: 'CREATE',
    plan: newRecord,
    planVersion: newRecord.version,
    changes: [
      { field: 'sku', label: 'SKU Code', before: null, after: newRecord.sku },
      { field: 'name', label: 'Plan Name', before: null, after: newRecord.name },
      { field: 'monthlyNetUSD', label: 'Monthly Net ($)', before: null, after: newRecord.monthlyNetUSD },
      { field: 'cpeMonthlyUSD', label: 'CPE Rental ($)', before: null, after: newRecord.cpeMonthlyUSD },
      { field: 'status', label: 'Catalog Status', before: null, after: newRecord.status },
    ],
    previousRecord: null,
    nextRecord: newRecord,
    catalogPlans: updated,
    actor: options.actor,
    note: options.changeReason || `Published new tariff plan ${newRecord.sku} ($${newRecord.monthlyNetUSD}/mo)`,
  })
  savePlans(updated)
  return updated
}

export function updatePlan(planId, patch = {}, options = {}) {
  const current = fetchPlans()
  const index = current.findIndex((plan) => plan.id === planId || plan.sku === planId)
  if (index === -1) {
    throw new Error(`Tariff plan "${planId}" not found.`)
  }

  const existing = current[index]
  const nextSku = String(patch.sku ?? existing.sku).trim().toUpperCase()
  const nextName = String(patch.name ?? existing.name).trim()
  const nextNetPrice = Number(
    patch.monthlyNetUSD !== undefined ? patch.monthlyNetUSD : existing.monthlyNetUSD
  )

  if (!nextSku) {
    throw new Error('Plan SKU code is required.')
  }
  if (!nextName) {
    throw new Error('Plan commercial name is required.')
  }
  if (!Number.isFinite(nextNetPrice) || nextNetPrice <= 0) {
    throw new Error('Monthly net price must be greater than $0.')
  }

  const duplicateOther = current.some(
    (plan, idx) => idx !== index && plan.sku.toLowerCase() === nextSku.toLowerCase()
  )
  if (duplicateOther) {
    throw new Error(`Another tariff already uses SKU "${nextSku}".`)
  }

  const speedFieldsChanged = patch.cirMbps !== undefined || patch.pirMbps !== undefined
  const nextCir = Number(patch.cirMbps !== undefined ? patch.cirMbps : existing.cirMbps) || 0
  const nextPir = Number(patch.pirMbps !== undefined ? patch.pirMbps : existing.pirMbps) || 0
  const nextDomesticSpeed =
    patch.domesticSpeed !== undefined
      ? patch.domesticSpeed
      : speedFieldsChanged
      ? `${nextCir} Mbps CIR / ${nextPir} Mbps PIR`
      : existing.domesticSpeed

  const tentativeMerged = normalizePlanRecord({
    ...existing,
    ...patch,
    id: existing.id,
    sku: nextSku,
    name: nextName,
    monthlyNetUSD: nextNetPrice,
    domesticSpeed: nextDomesticSpeed,
    version: existing.version || 1,
    updatedAt: existing.updatedAt,
  })

  const fieldDiffs = diffPlanFields(existing, tentativeMerged)
  if (fieldDiffs.length === 0 && !options.changeReason) {
    return current
  }

  const nextPlanVersion = Math.max(1, Number(existing.version) || 1) + 1
  const nowIso = new Date().toISOString()
  const merged = {
    ...tentativeMerged,
    version: nextPlanVersion,
    updatedAt: nowIso,
  }

  const updated = [...current]
  updated[index] = merged

  appendPlanVersionEntry({
    action: 'UPDATE',
    plan: merged,
    planVersion: nextPlanVersion,
    changes: fieldDiffs,
    previousRecord: existing,
    nextRecord: merged,
    catalogPlans: updated,
    actor: options.actor,
    note:
      options.changeReason ||
      (fieldDiffs.length > 0
        ? `Updated ${fieldDiffs.map((d) => d.label).join(', ')} on ${merged.sku}`
        : `Saved revision v${nextPlanVersion} for ${merged.sku}`),
  })

  savePlans(updated)
  return updated
}

export function deletePlan(planId, options = {}) {
  const current = fetchPlans()
  const target = current.find((p) => p.id === planId || p.sku === planId)
  const updated = current.filter((p) => p.id !== planId && p.sku !== planId)
  if (target) {
    appendPlanVersionEntry({
      action: 'DELETE',
      plan: target,
      planVersion: Math.max(1, Number(target.version) || 1),
      changes: [
        { field: 'status', label: 'Catalog Presence', before: target.status, after: 'REMOVED' },
        { field: 'monthlyNetUSD', label: 'Monthly Net ($)', before: target.monthlyNetUSD, after: null },
      ],
      previousRecord: target,
      nextRecord: null,
      catalogPlans: updated,
      actor: options.actor,
      note: options.changeReason || `Removed tariff SKU ${target.sku} from active catalog`,
    })
  }
  savePlans(updated)
  return updated
}

export function resetPlansToDefault(options = {}) {
  const nowIso = new Date().toISOString()
  const defaults = INITIAL_PLANS.map((plan) =>
    normalizePlanRecord({
      ...plan,
      version: 1,
      updatedAt: nowIso,
    })
  )
  appendPlanVersionEntry({
    action: 'RESET',
    plan: {
      id: 'CATALOG',
      sku: 'ALL_SKUS',
      name: `Master Tariff Schedule (${defaults.length} SKUs)`,
    },
    planVersion: 1,
    changes: [
      {
        field: 'catalogCount',
        label: 'Catalog SKUs',
        before: fetchPlans().length,
        after: defaults.length,
      },
    ],
    previousRecord: null,
    nextRecord: null,
    catalogPlans: defaults,
    actor: options.actor,
    note: options.changeReason || 'Restored default master tariff catalog',
  })
  savePlans(defaults)
  return defaults
}

export function restoreCatalogVersion(entryId, options = {}) {
  const history = fetchPlanVersionHistory()
  const targetEntry = history.find((e) => e.entryId === entryId)
  if (!targetEntry || !Array.isArray(targetEntry.catalogSnapshot)) {
    throw new Error(`Tariff catalog snapshot "${entryId}" was not found.`)
  }

  const currentPlans = fetchPlans()
  const nowIso = new Date().toISOString()
  const restoredPlans = targetEntry.catalogSnapshot.map((item) =>
    normalizePlanRecord({
      ...item,
      updatedAt: nowIso,
    })
  )

  appendPlanVersionEntry({
    action: 'RESTORE',
    plan: {
      id: 'CATALOG',
      sku: `FROM_${targetEntry.versionTag}`,
      name: `Restored Snapshot ${targetEntry.versionTag} (${restoredPlans.length} SKUs)`,
    },
    planVersion: targetEntry.versionNumber || 1,
    changes: [
      {
        field: 'catalogSnapshot',
        label: 'Catalog Version Restored',
        before: getPlanCatalogVersionMeta().versionTag,
        after: `${targetEntry.versionTag} (${restoredPlans.length} SKUs, was ${currentPlans.length})`,
      },
    ],
    previousRecord: null,
    nextRecord: null,
    catalogPlans: restoredPlans,
    actor: options.actor,
    note: options.changeReason || `Rolled back tariff catalog to ${targetEntry.versionTag} (${targetEntry.entryId})`,
  })

  savePlans(restoredPlans)
  return { restoredEntry: targetEntry, plans: restoredPlans }
}

