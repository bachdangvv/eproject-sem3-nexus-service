import { getActivatedAccounts } from './activationService.js'
import { fetchInventoryRecords, saveInventoryRecords } from './inventoryService.js'
import { STATUTORY_TAX_RATE_PERCENT, calculateStatutoryTax } from './taxConfig.js'
import {
  fetchInvoices,
  getStoredInvoices,
  generateNewInvoice,
  resolveAccountBillingProfile,
} from './billingService.js'

export const CDR_STORAGE_KEY = 'nexus_cdr_sessions_v1'
export const DAMAGED_FEES_STORAGE_KEY = 'nexus_damaged_equipment_fees_v1'
export const DEFAULT_CN17_BILLING_CYCLE = '01/04/2026 – 30/04/2026'

export const CDR_UNIT_RATES = {
  VOICE_LOCAL: {
    code: 'VOICE_LOCAL',
    category: 'VOICE',
    rateUSD: 0.02,
    unit: 'min',
    label: 'Local PSTN Call Minutes',
  },
  VOICE_STD: {
    code: 'VOICE_STD',
    category: 'VOICE',
    rateUSD: 0.05,
    unit: 'min',
    label: 'STD Long-Distance Minutes',
  },
  SMS: {
    code: 'SMS',
    category: 'SMS',
    rateUSD: 0.01,
    unit: 'SMS',
    label: 'Corporate SMS Messages',
  },
  OVERTIME_BURST: {
    code: 'OVERTIME_BURST',
    category: 'BURST',
    rateUSD: 25.0,
    unit: 'hr',
    label: 'Excess Overtime / Peak Hours',
  },
  DATA_OVERAGE: {
    code: 'DATA_OVERAGE',
    category: 'BURST',
    rateUSD: 0.05,
    unit: 'GB',
    label: 'Out-of-Profile Bandwidth Overage',
  },
}

export const EQUIPMENT_DAMAGE_FEE_BY_CATEGORY = {
  ONT: 85.0,
  ROUTER: 220.0,
  VOIP: 180.0,
  MODEM: 65.0,
  DEFAULT: 100.0,
}

export const INITIAL_CDR_SESSIONS = [
  {
    id: 'CDR-20260402-B101-01',
    accountId: 'B101000000000089',
    timestamp: '02/04/2026 14:22:10',
    duration: '04:12:35',
    eventType: 'QoS Peak Burst Overtime',
    category: 'BURST',
    chargeCategory: 'OVERTIME_BURST',
    service: 'FTTH Dedicated 500Mbps',
    vlan: 'VLAN 402',
    quantity: 4,
    unit: 'hr',
    unitRateUSD: 25.0,
    totalVolumeGB: 450.0,
    peakRateMbps: 542.4,
    ratingStatus: 'BILLABLE',
    chargeUSD: 100.0,
    sourceIp: '113.190.244.18',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260401-B101-02',
    accountId: 'B101000000000089',
    timestamp: '01/04/2026 21:04:05',
    duration: '08:00:00',
    eventType: 'Optical Dedicated CIR Baseline',
    category: 'BASELINE',
    chargeCategory: 'BASELINE',
    service: 'FTTH Dedicated 500Mbps',
    vlan: 'VLAN 402',
    quantity: 1,
    unit: 'session',
    unitRateUSD: 0,
    totalVolumeGB: 420.0,
    peakRateMbps: 498.0,
    ratingStatus: 'INCLUDED_IN_PLAN',
    chargeUSD: 0.0,
    sourceIp: '113.190.244.18',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260402-T101-01',
    accountId: 'T101000000000102',
    timestamp: '02/04/2026 09:15:00',
    duration: '6,400 mins',
    eventType: 'Local PSTN Inbound & Outbound Trunk',
    category: 'VOICE',
    chargeCategory: 'VOICE_LOCAL',
    service: 'SIP Trunking 30CH',
    vlan: 'VLAN 508',
    quantity: 6400,
    unit: 'min',
    unitRateUSD: 0.02,
    totalVolumeGB: 6.4,
    peakRateMbps: 18.2,
    ratingStatus: 'BILLABLE',
    chargeUSD: 128.0,
    sourceIp: '118.70.185.14',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260402-T101-02',
    accountId: 'T101000000000102',
    timestamp: '02/04/2026 16:40:19',
    duration: '1,800 mins',
    eventType: 'STD Inter-Provincial Outbound Voice',
    category: 'VOICE',
    chargeCategory: 'VOICE_STD',
    service: 'SIP Trunking 30CH',
    vlan: 'VLAN 508',
    quantity: 1800,
    unit: 'min',
    unitRateUSD: 0.05,
    totalVolumeGB: 2.1,
    peakRateMbps: 12.0,
    ratingStatus: 'BILLABLE',
    chargeUSD: 90.0,
    sourceIp: '118.70.185.14',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260403-T101-03',
    accountId: 'T101000000000102',
    timestamp: '03/04/2026 11:30:22',
    duration: '2,100 SMS',
    eventType: 'Banking OTP SMS Gateway Broadcast',
    category: 'SMS',
    chargeCategory: 'SMS',
    service: 'Corporate SMS Gateway',
    vlan: 'API Rest',
    quantity: 2100,
    unit: 'SMS',
    unitRateUSD: 0.01,
    totalVolumeGB: 0.0,
    peakRateMbps: 0.0,
    ratingStatus: 'BILLABLE',
    chargeUSD: 21.0,
    sourceIp: '10.200.4.12',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260403-D101-01',
    accountId: 'D101000000000045',
    timestamp: '03/04/2026 23:10:00',
    duration: '03:00:00',
    eventType: 'POS V.92 Dial-In Excess Overtime Polling',
    category: 'BURST',
    chargeCategory: 'OVERTIME_BURST',
    service: 'Dial-Up POS V.92',
    vlan: 'VLAN 300',
    quantity: 3,
    unit: 'hr',
    unitRateUSD: 25.0,
    totalVolumeGB: 0.4,
    peakRateMbps: 0.056,
    ratingStatus: 'BILLABLE',
    chargeUSD: 75.0,
    sourceIp: '118.70.186.42',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260404-D201-01',
    accountId: 'D201000000000412',
    timestamp: '04/04/2026 17:45:00',
    duration: '02:30:00',
    eventType: 'Dedicated Link After-Hours Overtime Window',
    category: 'BURST',
    chargeCategory: 'OVERTIME_BURST',
    service: 'Leased Line 100M',
    vlan: 'VLAN 310',
    quantity: 2.5,
    unit: 'hr',
    unitRateUSD: 25.0,
    totalVolumeGB: 140.0,
    peakRateMbps: 108.5,
    ratingStatus: 'BILLABLE',
    chargeUSD: 62.5,
    sourceIp: '118.70.190.10',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260404-D201-02',
    accountId: 'D201000000000412',
    timestamp: '04/04/2026 18:10:00',
    duration: '1,400 SMS',
    eventType: 'Clinic Prescription Dispatch SMS Alerts',
    category: 'SMS',
    chargeCategory: 'SMS',
    service: 'Corporate SMS Gateway',
    vlan: 'API Rest',
    quantity: 1400,
    unit: 'SMS',
    unitRateUSD: 0.01,
    totalVolumeGB: 0.0,
    peakRateMbps: 0.0,
    ratingStatus: 'BILLABLE',
    chargeUSD: 14.0,
    sourceIp: '118.70.190.11',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260405-T201-01',
    accountId: 'T201000000000205',
    timestamp: '05/04/2026 10:00:00',
    duration: '9,500 mins',
    eventType: 'Contact Center Local Call Traffic',
    category: 'VOICE',
    chargeCategory: 'VOICE_LOCAL',
    service: 'SIP Trunking 30CH',
    vlan: 'VLAN 205',
    quantity: 9500,
    unit: 'min',
    unitRateUSD: 0.02,
    totalVolumeGB: 9.2,
    peakRateMbps: 22.4,
    ratingStatus: 'BILLABLE',
    chargeUSD: 190.0,
    sourceIp: '118.70.191.22',
    billedInvoiceId: null,
  },
  {
    id: 'CDR-20260405-T201-02',
    accountId: 'T201000000000205',
    timestamp: '05/04/2026 15:20:00',
    duration: '2,400 mins',
    eventType: 'National STD Support Hotline Calls',
    category: 'VOICE',
    chargeCategory: 'VOICE_STD',
    service: 'SIP Trunking 30CH',
    vlan: 'VLAN 205',
    quantity: 2400,
    unit: 'min',
    unitRateUSD: 0.05,
    totalVolumeGB: 2.8,
    peakRateMbps: 14.1,
    ratingStatus: 'BILLABLE',
    chargeUSD: 120.0,
    sourceIp: '118.70.191.22',
    billedInvoiceId: null,
  },
]

export const INITIAL_DAMAGED_EQUIPMENT_INCIDENTS = [
  {
    id: 'DMG-2026-001',
    accountId: 'D201000000000412',
    deviceSerial: 'FOC2239V0AB',
    deviceModel: 'Edge Router Cisco ASR-920 + Modem v.90',
    category: 'ROUTER',
    reason: 'Customer premise electrical surge damaged PSU bay (Non-warranty CPE repair)',
    feeUSD: 220.0,
    reportedAt: '2026-04-04',
    status: 'UNBILLED',
    billedInvoiceId: null,
  },
  {
    id: 'DMG-2026-002',
    accountId: 'T201000000000205',
    deviceSerial: 'AC800-9941-X7',
    deviceModel: 'AudioCodes Mediant 800 SBC Gateway',
    category: 'VOIP',
    reason: 'Damaged FXS analog port module during customer rack move',
    feeUSD: 180.0,
    reportedAt: '2026-04-05',
    status: 'UNBILLED',
    billedInvoiceId: null,
  },
]

function normalizeCdrChargeCategory(session = {}) {
  const explicit = String(session.chargeCategory || '').trim().toUpperCase()
  if (CDR_UNIT_RATES[explicit]) return explicit
  if (explicit === 'BASELINE') return 'BASELINE'

  const cat = String(session.category || '').trim().toUpperCase()
  const text = `${session.eventType || ''} ${session.service || ''}`.toLowerCase()
  if (cat === 'BASELINE' || session.ratingStatus === 'INCLUDED_IN_PLAN' || Number(session.chargeUSD) === 0) {
    return 'BASELINE'
  }
  if (cat === 'SMS' || text.includes('sms')) return 'SMS'
  if (cat === 'VOICE') {
    if (text.includes('std') || text.includes('inter-provincial') || text.includes('long')) {
      return 'VOICE_STD'
    }
    return 'VOICE_LOCAL'
  }
  if (text.includes('overage') && session.unit === 'GB') return 'DATA_OVERAGE'
  return 'OVERTIME_BURST'
}

export function fetchCdrSessions(accountId = null) {
  let sessions
  try {
    const raw = localStorage.getItem(CDR_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        sessions = parsed
      }
    }
  } catch {
  }

  if (!sessions) {
    sessions = INITIAL_CDR_SESSIONS
    try {
      localStorage.setItem(CDR_STORAGE_KEY, JSON.stringify(sessions))
    } catch {
    }
  }

  const enriched = sessions.map((s) => {
    const profile = resolveAccountBillingProfile(s.accountId)
    const chargeCategory = normalizeCdrChargeCategory(s)
    return {
      ...s,
      chargeCategory,
      customerName: s.customerName || profile.customerName,
      taxId: s.taxId || profile.taxId,
      serviceTitle: s.serviceTitle || profile.serviceTitle,
    }
  })

  if (!accountId || accountId === 'ALL') return enriched
  const target = String(accountId).trim()
  return enriched.filter((s) => s.accountId === target)
}

export function saveCdrSessions(sessions) {
  try {
    localStorage.setItem(CDR_STORAGE_KEY, JSON.stringify(Array.isArray(sessions) ? sessions : []))
  } catch {
  }
}

export function markCdrSessionsBilled(sessionIds = [], invoiceId, billingCycle = null) {
  const idSet = new Set(Array.isArray(sessionIds) ? sessionIds.filter(Boolean) : [])
  if (idSet.size === 0 || !invoiceId) return []
  const current = fetchCdrSessions('ALL').map((item) => {
    const clean = { ...item }
    delete clean.customerName
    delete clean.taxId
    delete clean.serviceTitle
    if (idSet.has(clean.id)) {
      clean.billedInvoiceId = invoiceId
      if (billingCycle) clean.billedCycle = billingCycle
    }
    return clean
  })
  saveCdrSessions(current)
  return current
}

export function addCdrSession(payload = {}) {
  const accountId = String(payload.accountId || '').trim()
  if (!accountId || accountId === 'ALL') {
    throw new Error('Select a valid subscriber Account ID to log a CDR session.')
  }
  const rateSpec = CDR_UNIT_RATES[payload.chargeCategory] || CDR_UNIT_RATES.VOICE_LOCAL
  const quantity = Math.max(0.1, Number(payload.quantity) || 1)
  const unitRateUSD =
    payload.unitRateUSD !== undefined && Number.isFinite(Number(payload.unitRateUSD))
      ? Math.max(0, Number(payload.unitRateUSD))
      : rateSpec.rateUSD
  const chargeUSD =
    payload.chargeUSD !== undefined && Number.isFinite(Number(payload.chargeUSD))
      ? Math.max(0, Number(Number(payload.chargeUSD).toFixed(2)))
      : Number((quantity * unitRateUSD).toFixed(2))

  const profile = resolveAccountBillingProfile(accountId)
  const entry = {
    id: payload.id || `CDR-${Date.now().toString().slice(-8)}-${Math.floor(10 + Math.random() * 89)}`,
    accountId,
    timestamp: payload.timestamp || new Date().toLocaleString('en-GB'),
    duration: payload.duration || `${quantity} ${rateSpec.unit}`,
    eventType: String(payload.eventType || rateSpec.label).trim(),
    category: rateSpec.category,
    chargeCategory: rateSpec.code,
    service: payload.service || profile.serviceTitle || 'Enterprise Telecom Circuit',
    vlan: payload.vlan || 'Carrier VLAN',
    quantity,
    unit: rateSpec.unit,
    unitRateUSD,
    totalVolumeGB: Number(payload.totalVolumeGB) || 0,
    peakRateMbps: Number(payload.peakRateMbps) || 0,
    ratingStatus: chargeUSD > 0 ? 'BILLABLE' : 'INCLUDED_IN_PLAN',
    chargeUSD,
    sourceIp: payload.sourceIp || '118.70.0.1',
    billedInvoiceId: null,
  }

  const current = fetchCdrSessions('ALL').map((item) => ({
    ...item,
    customerName: undefined,
    taxId: undefined,
    serviceTitle: undefined,
  }))
  const next = [entry, ...current]
  saveCdrSessions(next)
  return entry
}

export function fetchDamagedEquipmentIncidents(accountId = null, { includeBilled = true } = {}) {
  let stored = null
  try {
    const raw = localStorage.getItem(DAMAGED_FEES_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) stored = parsed
    }
  } catch {
  }

  if (!stored) {
    stored = INITIAL_DAMAGED_EQUIPMENT_INCIDENTS
    try {
      localStorage.setItem(DAMAGED_FEES_STORAGE_KEY, JSON.stringify(stored))
    } catch {
    }
  }

  const inventoryItems = fetchInventoryRecords()
  const knownSerialKeys = new Set(
    stored.map((item) => `${item.accountId}:${String(item.deviceSerial || '').toUpperCase()}`)
  )

  const fromInventory = inventoryItems
    .filter((unit) => {
      if (!unit.contractAccount) return false
      const st = String(unit.status || '').toUpperCase()
      const hasDamage = st === 'DAMAGED' || (st === 'FAULTY' && Number(unit.damageFeeUSD) > 0)
      if (!hasDamage) return false
      const key = `${unit.contractAccount}:${String(unit.serialNumber || unit.id || '').toUpperCase()}`
      return !knownSerialKeys.has(key)
    })
    .map((unit) => ({
      id: `INV-DMG-${unit.serialNumber || unit.id}`,
      accountId: unit.contractAccount,
      deviceSerial: unit.serialNumber || unit.id,
      deviceModel: unit.model,
      category: unit.category || 'ONT',
      reason: unit.damageReason || unit.batchPo || 'Customer premise hardware damage (Inventory)',
      feeUSD: Number(
        unit.damageFeeUSD ||
          EQUIPMENT_DAMAGE_FEE_BY_CATEGORY[unit.category] ||
          EQUIPMENT_DAMAGE_FEE_BY_CATEGORY.DEFAULT
      ),
      reportedAt: unit.damageReportedAt || new Date().toISOString().slice(0, 10),
      status: unit.lastBilledInvoiceId ? 'BILLED' : 'UNBILLED',
      billedInvoiceId: unit.lastBilledInvoiceId || null,
      source: 'INVENTORY',
    }))

  let combined = [...stored, ...fromInventory]
  if (accountId && accountId !== 'ALL') {
    const cleanAcc = String(accountId).trim()
    combined = combined.filter((item) => item.accountId === cleanAcc)
  }
  if (!includeBilled) {
    combined = combined.filter((item) => !item.billedInvoiceId && item.status !== 'BILLED')
  }
  return combined
}

export function saveDamagedEquipmentIncidents(incidents) {
  try {
    localStorage.setItem(
      DAMAGED_FEES_STORAGE_KEY,
      JSON.stringify(Array.isArray(incidents) ? incidents : [])
    )
  } catch {
  }
}

export function recordDamagedEquipmentFee(accountId, payload = {}) {
  const cleanAccountId = String(accountId || '').trim()
  if (!cleanAccountId || cleanAccountId === 'ALL') {
    throw new Error('Select a valid subscriber Account ID to record a damaged hardware surcharge.')
  }

  const profile = resolveAccountBillingProfile(cleanAccountId)
  const category = String(payload.category || 'ONT').trim().toUpperCase()
  const feeUSD =
    payload.feeUSD !== undefined && payload.feeUSD !== '' && Number.isFinite(Number(payload.feeUSD))
      ? Number(Number(payload.feeUSD).toFixed(2))
      : EQUIPMENT_DAMAGE_FEE_BY_CATEGORY[category] || EQUIPMENT_DAMAGE_FEE_BY_CATEGORY.DEFAULT

  if (feeUSD <= 0) {
    throw new Error('Damaged equipment surcharge fee must be greater than $0.00.')
  }

  const deviceSerial = String(
    payload.deviceSerial || profile.assignedHardware?.serialNumber || `CPE-${cleanAccountId.slice(-6)}`
  ).trim()
  const deviceModel = String(
    payload.deviceModel || profile.assignedHardware?.model || `${category} Subscriber CPE Unit`
  ).trim()
  const reason = String(payload.reason || 'Physical damage / Liquid ingress (Non-warranty CPE)').trim()

  const newEntry = {
    id: `DMG-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`,
    accountId: cleanAccountId,
    deviceSerial,
    deviceModel,
    category,
    reason,
    feeUSD,
    reportedAt: new Date().toISOString().slice(0, 10),
    status: 'UNBILLED',
    billedInvoiceId: null,
  }

  let currentStored = []
  try {
    const raw = localStorage.getItem(DAMAGED_FEES_STORAGE_KEY)
    currentStored = raw ? JSON.parse(raw) : [...INITIAL_DAMAGED_EQUIPMENT_INCIDENTS]
  } catch {
    currentStored = [...INITIAL_DAMAGED_EQUIPMENT_INCIDENTS]
  }
  const nextStored = [newEntry, ...currentStored]
  saveDamagedEquipmentIncidents(nextStored)
  return newEntry
}

/** Compute complete CN17 monthly statement breakdown for one subscriber account. */
export function calculateAccountMonthlyStatement(accountOrId, options = {}) {
  const accountId =
    typeof accountOrId === 'string' ? accountOrId : accountOrId?.accountId || ''
  const existingInvoices = Array.isArray(options.invoices) ? options.invoices : getStoredInvoices()
  const profile = resolveAccountBillingProfile(accountId, existingInvoices)
  const billingCycle = options.billingCycle || DEFAULT_CN17_BILLING_CYCLE

  const allSessions = Array.isArray(options.cdrSessions)
    ? options.cdrSessions.filter((s) => s.accountId === accountId)
    : fetchCdrSessions(accountId)

  const activeCdrSessions = allSessions.filter(
    (s) =>
      s.ratingStatus === 'BILLABLE' &&
      Number(s.chargeUSD) > 0 &&
      (options.includeBilledCdr || !s.billedInvoiceId)
  )

  const localSessions = activeCdrSessions.filter((s) => normalizeCdrChargeCategory(s) === 'VOICE_LOCAL')
  const stdSessions = activeCdrSessions.filter((s) => normalizeCdrChargeCategory(s) === 'VOICE_STD')
  const smsSessions = activeCdrSessions.filter((s) => normalizeCdrChargeCategory(s) === 'SMS')
  const overtimeSessions = activeCdrSessions.filter((s) => {
    const c = normalizeCdrChargeCategory(s)
    return c === 'OVERTIME_BURST' || c === 'DATA_OVERAGE'
  })

  const localMinutes = localSessions.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
  const localVoiceUSD = Number(localSessions.reduce((sum, s) => sum + (Number(s.chargeUSD) || 0), 0).toFixed(2))

  const stdMinutes = stdSessions.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
  const stdVoiceUSD = Number(stdSessions.reduce((sum, s) => sum + (Number(s.chargeUSD) || 0), 0).toFixed(2))

  const smsCount = smsSessions.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
  const smsFeeUSD = Number(smsSessions.reduce((sum, s) => sum + (Number(s.chargeUSD) || 0), 0).toFixed(2))

  const overtimeQty = overtimeSessions.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
  const overtimeBurstUSD = Number(overtimeSessions.reduce((sum, s) => sum + (Number(s.chargeUSD) || 0), 0).toFixed(2))

  const damagedIncidents = Array.isArray(options.damagedIncidents)
    ? options.damagedIncidents.filter(
        (d) => d.accountId === accountId && (options.includeBilledDamage || (!d.billedInvoiceId && d.status !== 'BILLED'))
      )
    : fetchDamagedEquipmentIncidents(accountId, { includeBilled: Boolean(options.includeBilledDamage) })

  const damagedEquipmentFeeUSD = Number(
    damagedIncidents.reduce((sum, d) => sum + (Number(d.feeUSD) || 0), 0).toFixed(2)
  )

  const subscriptionFeeUSD =
    options.includeSubscription === false || profile.isTerminated
      ? 0
      : Number(profile.monthlyPlanChargeUSD || 0)

  const items = []
  if (subscriptionFeeUSD > 0) {
    items.push({
      desc: `Monthly Plan Subscription: ${profile.planName || profile.serviceTitle}`,
      quantity: 1,
      unitPrice: subscriptionFeeUSD,
      amount: subscriptionFeeUSD,
    })
  }
  if (localVoiceUSD > 0) {
    items.push({
      desc: `CDR Local Voice Calls (${localMinutes.toLocaleString()} mins @ $0.02/min)`,
      quantity: localMinutes || 1,
      unitPrice: localMinutes > 0 ? Number((localVoiceUSD / localMinutes).toFixed(4)) : localVoiceUSD,
      amount: localVoiceUSD,
    })
  }
  if (stdVoiceUSD > 0) {
    items.push({
      desc: `CDR STD Long-Distance Calls (${stdMinutes.toLocaleString()} mins @ $0.05/min)`,
      quantity: stdMinutes || 1,
      unitPrice: stdMinutes > 0 ? Number((stdVoiceUSD / stdMinutes).toFixed(4)) : stdVoiceUSD,
      amount: stdVoiceUSD,
    })
  }
  if (smsFeeUSD > 0) {
    items.push({
      desc: `CDR SMS Gateway Usage (${smsCount.toLocaleString()} SMS @ $0.01/SMS)`,
      quantity: smsCount || 1,
      unitPrice: smsCount > 0 ? Number((smsFeeUSD / smsCount).toFixed(4)) : smsFeeUSD,
      amount: smsFeeUSD,
    })
  }
  if (overtimeBurstUSD > 0) {
    items.push({
      desc: `CDR Overtime / Excess Usage (${overtimeQty} units)`,
      quantity: overtimeQty || 1,
      unitPrice: overtimeQty > 0 ? Number((overtimeBurstUSD / overtimeQty).toFixed(2)) : overtimeBurstUSD,
      amount: overtimeBurstUSD,
    })
  }
  damagedIncidents.forEach((dmg) => {
    items.push({
      desc: `Damaged Equipment Surcharge: ${dmg.deviceModel} [SN: ${dmg.deviceSerial}] - ${dmg.reason}`,
      quantity: 1,
      unitPrice: Number(dmg.feeUSD),
      amount: Number(Number(dmg.feeUSD).toFixed(2)),
    })
  })

  const subtotalUSD = Number(
    (
      subscriptionFeeUSD +
      localVoiceUSD +
      stdVoiceUSD +
      smsFeeUSD +
      overtimeBurstUSD +
      damagedEquipmentFeeUSD
    ).toFixed(2)
  )
  const taxUSD = calculateStatutoryTax(subtotalUSD)
  const totalPayableUSD = Number((subtotalUSD + taxUSD).toFixed(2))

  const alreadyBilledInCycle = existingInvoices.find(
    (inv) =>
      inv.accountId === accountId &&
      inv.billingCycle === billingCycle &&
      inv.billingSource === 'CN17_MONTHLY_BATCH'
  )

  let billable = true
  let skipReason = null
  if (profile.isTerminated) {
    billable = false
    skipReason = 'Permanently Inactive account excluded from recurring monthly billing.'
  } else if (alreadyBilledInCycle && !options.allowDuplicateCycle) {
    billable = false
    skipReason = `Cycle already billed (${alreadyBilledInCycle.invoiceId}).`
  } else if (subtotalUSD <= 0) {
    billable = false
    skipReason = 'Zero billable charges in selected cycle.'
  }

  return {
    accountId: profile.accountId,
    profile,
    billingCycle,
    billable,
    skipReason,
    alreadyBilledInvoiceId: alreadyBilledInCycle?.invoiceId || null,
    subscriptionFeeUSD,
    localMinutes,
    localVoiceUSD,
    stdMinutes,
    stdVoiceUSD,
    smsCount,
    smsFeeUSD,
    overtimeQty,
    overtimeBurstUSD,
    damagedIncidents,
    damagedEquipmentCount: damagedIncidents.length,
    damagedEquipmentFeeUSD,
    includedCdrSessionIds: activeCdrSessions.map((s) => s.id),
    subtotalUSD,
    taxRatePercent: STATUTORY_TAX_RATE_PERCENT,
    taxUSD,
    totalPayableUSD,
    items,
  }
}

/** Preview monthly CN17 charges across all activated subscriber accounts without mutating ledger. */
export async function previewMonthlyBillingBatch(options = {}) {
  const invoices = await fetchInvoices()
  const activated = getActivatedAccounts()
  const targetAccounts = Array.isArray(options.accountIds) && options.accountIds.length > 0
    ? options.accountIds
    : activated.map((a) => a.accountId)

  const uniqueIds = Array.from(new Set(targetAccounts.filter(Boolean)))
  const allCdr = fetchCdrSessions('ALL')
  const allDamage = fetchDamagedEquipmentIncidents('ALL', { includeBilled: Boolean(options.includeBilledDamage) })

  const statements = uniqueIds.map((accId) =>
    calculateAccountMonthlyStatement(accId, {
      ...options,
      invoices,
      cdrSessions: allCdr.filter((s) => s.accountId === accId),
      damagedIncidents: allDamage.filter((d) => d.accountId === accId),
    })
  )

  const eligible = statements.filter((s) => s.billable)
  const skipped = statements.filter((s) => !s.billable)

  return {
    billingCycle: options.billingCycle || DEFAULT_CN17_BILLING_CYCLE,
    totalScannedAccounts: statements.length,
    eligibleCount: eligible.length,
    skippedCount: skipped.length,
    totalSubscriptionUSD: Number(eligible.reduce((s, x) => s + x.subscriptionFeeUSD, 0).toFixed(2)),
    totalUsageUSD: Number(
      eligible
        .reduce((s, x) => s + x.localVoiceUSD + x.stdVoiceUSD + x.smsFeeUSD + x.overtimeBurstUSD, 0)
        .toFixed(2)
    ),
    totalDamagedEquipmentUSD: Number(
      eligible.reduce((s, x) => s + x.damagedEquipmentFeeUSD, 0).toFixed(2)
    ),
    grandTotalNetUSD: Number(eligible.reduce((s, x) => s + x.subtotalUSD, 0).toFixed(2)),
    grandTotalTaxUSD: Number(eligible.reduce((s, x) => s + x.taxUSD, 0).toFixed(2)),
    grandTotalPayableUSD: Number(eligible.reduce((s, x) => s + x.totalPayableUSD, 0).toFixed(2)),
    statements,
  }
}

/** Execute multi-account monthly CN17 billing batch, issuing real invoices and marking included CDR/damage items billed. */
export async function runMonthlyBillingBatch(options = {}) {
  const batchPreview = await previewMonthlyBillingBatch(options)
  const billingCycle = batchPreview.billingCycle
  const issuedDate = options.issuedDate || new Date().toISOString().split('T')[0]

  const generatedInvoices = []
  const skippedAccounts = []
  const billedCdrMap = new Map()
  const billedDamageMap = new Map()

  for (const stmt of batchPreview.statements) {
    if (!stmt.billable) {
      skippedAccounts.push({
        accountId: stmt.accountId,
        customerName: stmt.profile.customerName,
        reason: stmt.skipReason,
      })
      continue
    }

    const inv = await generateNewInvoice(stmt.accountId, stmt.items, {
      customerId: stmt.profile.customerId,
      customerName: stmt.profile.customerName,
      taxId: stmt.profile.taxId,
      customerEmail: stmt.profile.customerEmail,
      orderId: stmt.profile.orderId,
      serviceTitle: stmt.profile.serviceTitle,
      serviceType: stmt.profile.serviceType,
      billingCycle,
      issuedDate,
      billingSource: 'CN17_MONTHLY_BATCH',
    })

    generatedInvoices.push({
      ...inv,
      cn17Summary: {
        subscriptionFeeUSD: stmt.subscriptionFeeUSD,
        localVoiceUSD: stmt.localVoiceUSD,
        stdVoiceUSD: stmt.stdVoiceUSD,
        smsFeeUSD: stmt.smsFeeUSD,
        overtimeBurstUSD: stmt.overtimeBurstUSD,
        damagedEquipmentFeeUSD: stmt.damagedEquipmentFeeUSD,
        subtotalUSD: stmt.subtotalUSD,
        taxUSD: stmt.taxUSD,
        totalPayableUSD: stmt.totalPayableUSD,
      },
    })

    stmt.includedCdrSessionIds.forEach((cid) => billedCdrMap.set(cid, inv.invoiceId))
    stmt.damagedIncidents.forEach((dmg) =>
      billedDamageMap.set(`${dmg.accountId}:${dmg.deviceSerial}`, inv.invoiceId)
    )
  }

  if (billedCdrMap.size > 0) {
    const currentCdr = fetchCdrSessions('ALL').map((item) => {
      const clean = { ...item }
      delete clean.customerName
      delete clean.taxId
      delete clean.serviceTitle
      if (billedCdrMap.has(clean.id)) {
        clean.billedInvoiceId = billedCdrMap.get(clean.id)
        clean.billedCycle = billingCycle
      }
      return clean
    })
    saveCdrSessions(currentCdr)
  }

  if (billedDamageMap.size > 0) {
    let rawDamage = []
    try {
      const txt = localStorage.getItem(DAMAGED_FEES_STORAGE_KEY)
      rawDamage = txt ? JSON.parse(txt) : [...INITIAL_DAMAGED_EQUIPMENT_INCIDENTS]
    } catch {
      rawDamage = [...INITIAL_DAMAGED_EQUIPMENT_INCIDENTS]
    }
    const nextDamage = rawDamage.map((d) => {
      const key = `${d.accountId}:${d.deviceSerial}`
      if (billedDamageMap.has(key)) {
        return {
          ...d,
          status: 'BILLED',
          billedInvoiceId: billedDamageMap.get(key),
          billedCycle: billingCycle,
        }
      }
      return d
    })
    saveDamagedEquipmentIncidents(nextDamage)

    const invItems = fetchInventoryRecords()
    let invChanged = false
    const updatedInv = invItems.map((unit) => {
      const key = `${unit.contractAccount}:${unit.serialNumber || unit.id}`
      if (unit.contractAccount && billedDamageMap.has(key)) {
        invChanged = true
        return {
          ...unit,
          lastBilledInvoiceId: billedDamageMap.get(key),
        }
      }
      return unit
    })
    if (invChanged) {
      saveInventoryRecords(updatedInv)
    }
  }

  return {
    billingCycle,
    issuedDate,
    generatedCount: generatedInvoices.length,
    skippedCount: skippedAccounts.length,
    generatedInvoices,
    skippedAccounts,
    totalNetUSD: batchPreview.grandTotalNetUSD,
    totalTaxUSD: batchPreview.grandTotalTaxUSD,
    totalBilledUSD: batchPreview.grandTotalPayableUSD,
    totalDamagedSurchargesUSD: batchPreview.totalDamagedEquipmentUSD,
  }
}

export { syncCdrToInvoice } from './billingService.js'
