const BULK_TIERS_STORAGE_KEY = 'nexus_bulk_scheme_tiers_v1'

export const SIMULATOR_MIN_ENDPOINTS = 1
export const SIMULATOR_MAX_ENDPOINTS = 500

export const DEPOSIT_USD = {
  DIAL_UP: 325,
  BROADBAND: 500,
  LANDLINE: 250,
}

export const SERVICE_NAMES = {
  BROADBAND: 'Broadband FTTx ($500 Deposit / Endpoint)',
  DIAL_UP: 'Dial-Up POS/ATM ($325 Deposit / Endpoint)',
  LANDLINE: 'Landline & SIP Trunk ($250 Deposit / Endpoint)',
}

export const DEFAULT_BULK_TIERS = [
  {
    id: 'single',
    tier: 'Tier 0: Single Location (Standard)',
    shortName: 'Single Location',
    minEndpoints: 1,
    maxEndpoints: 9,
    discountPercent: 0,
    freeGpon: false,
    benefit: 'Standard commercial pricing applies (0% Deposit Waiver)',
  },
  {
    id: 'sme',
    tier: 'Tier 1: Mid-Market Enterprise',
    shortName: 'Mid-Market Enterprise',
    minEndpoints: 10,
    maxEndpoints: 15,
    discountPercent: 25,
    freeGpon: false,
    benefit: 'Standard Commercial MRC + 25% Deposit Waiver',
  },
  {
    id: 'expansion',
    tier: 'Tier 2: Expanding Chain',
    shortName: 'Expanding Chain',
    minEndpoints: 16,
    maxEndpoints: 25,
    discountPercent: 50,
    freeGpon: true,
    benefit: '50% Deposit Waiver + Free GPON ONT',
  },
  {
    id: 'chain',
    tier: 'Tier 3: Large Retail Chain',
    shortName: 'Large Retail Chain',
    minEndpoints: 26,
    maxEndpoints: 50,
    discountPercent: 75,
    freeGpon: true,
    benefit: '75% Deposit Waiver + Free GPON ONT',
  },
  {
    id: 'enterprise',
    tier: 'Tier 4: Multinational Enterprise',
    shortName: 'Multinational Enterprise',
    minEndpoints: 51,
    maxEndpoints: null,
    discountPercent: 100,
    freeGpon: true,
    benefit: '100% Deposit Waiver + Priority NOC SLA',
  },
]

function cloneDefaultTiers() {
  return DEFAULT_BULK_TIERS.map((tier) => ({ ...tier }))
}

export function getDepositUnitUSD(serviceType = 'BROADBAND') {
  const key = String(serviceType || 'BROADBAND').toUpperCase()
  if (key === 'DIALUP' || key === 'DIAL_UP') return DEPOSIT_USD.DIAL_UP
  if (key === 'LANDLINE') return DEPOSIT_USD.LANDLINE
  return DEPOSIT_USD.BROADBAND
}

export function clampSimulatorEndpoints(value) {
  const num = Math.trunc(Number(value))
  if (!Number.isFinite(num)) return SIMULATOR_MIN_ENDPOINTS
  return Math.min(SIMULATOR_MAX_ENDPOINTS, Math.max(SIMULATOR_MIN_ENDPOINTS, num))
}

export function formatTierRange(tier, siteUnit = false) {
  if (!tier) return ''
  const min = Number(tier.minEndpoints) || 1
  const max = tier.maxEndpoints == null ? null : Number(tier.maxEndpoints)
  if (siteUnit) {
    return max == null ? `>${min - 1} sites` : `${min} - ${max} sites`
  }
  return max == null ? `> ${min - 1} Endpoints` : `${min} – ${max} Endpoints`
}

export function validateBulkSchemeTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return { valid: false, error: 'At least one policy tier is required.' }
  }
  const sorted = [...tiers].sort((a, b) => Number(a.minEndpoints) - Number(b.minEndpoints))
  if (Number(sorted[0].minEndpoints) !== 1) {
    return { valid: false, error: 'The lowest tier must start at 1 endpoint.' }
  }

  for (let i = 0; i < sorted.length; i += 1) {
    const curr = sorted[i]
    const min = Number(curr.minEndpoints)
    const max = curr.maxEndpoints == null ? null : Number(curr.maxEndpoints)
    const pct = Number(curr.discountPercent)

    if (!String(curr.tier || '').trim()) {
      return { valid: false, error: 'Tier name is required.' }
    }
    if (!String(curr.benefit || '').trim()) {
      return { valid: false, error: 'Hardware / SLA benefit description is required.' }
    }
    if (!Number.isInteger(min) || min < 1) {
      return { valid: false, error: 'Minimum endpoints must be a positive integer.' }
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { valid: false, error: 'Deposit waiver percentage must be between 0 and 100.' }
    }
    if (i < sorted.length - 1) {
      if (max == null || !Number.isInteger(max) || max < min) {
        return { valid: false, error: 'Non-final tiers must define an integer max >= min endpoints.' }
      }
      const nextMin = Number(sorted[i + 1].minEndpoints)
      if (nextMin !== max + 1) {
        return {
          valid: false,
          error: `Tier boundaries must be contiguous without gaps or overlaps (${max} -> ${nextMin}).`,
        }
      }
    } else if (max !== null) {
      return { valid: false, error: 'The highest tier must remain open-ended (> previous limit).' }
    }
  }

  return { valid: true, sorted }
}

export function fetchBulkSchemeTiers() {
  try {
    const raw = localStorage.getItem(BULK_TIERS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const check = validateBulkSchemeTiers(parsed)
      if (check.valid) return check.sorted
    }
  } catch {
  }
  const defaults = cloneDefaultTiers()
  saveBulkSchemeTiers(defaults)
  return defaults
}

export function saveBulkSchemeTiers(tiers) {
  const check = validateBulkSchemeTiers(tiers)
  if (!check.valid) {
    throw new Error(check.error)
  }
  try {
    localStorage.setItem(BULK_TIERS_STORAGE_KEY, JSON.stringify(check.sorted))
  } catch {
  }
  return check.sorted
}

export function resetBulkSchemeTiers() {
  const defaults = cloneDefaultTiers()
  return saveBulkSchemeTiers(defaults)
}

export function updateBulkSchemeTier(tierId, updates) {
  const tiers = fetchBulkSchemeTiers().map((t) => ({ ...t }))
  const idx = tiers.findIndex((t) => t.id === tierId)
  if (idx === -1) {
    throw new Error('Bulk scheme tier not found.')
  }

  const isFirst = idx === 0
  const isLast = idx === tiers.length - 1
  const current = tiers[idx]

  const tierName = String(updates.tier ?? current.tier).trim()
  if (!tierName) {
    throw new Error('Tier name is required.')
  }
  const shortName = String(
    updates.shortName ?? (tierName.replace(/^Tier\s+\d+:\s*/i, '').trim() || tierName)
  )
  const benefit = String(updates.benefit ?? current.benefit).trim()
  if (!benefit) {
    throw new Error('Hardware / SLA benefit description is required.')
  }

  const discountRaw = Number(updates.discountPercent ?? current.discountPercent)
  if (!Number.isFinite(discountRaw) || discountRaw < 0 || discountRaw > 100) {
    throw new Error('Deposit waiver percentage must be between 0 and 100.')
  }
  const discountPercent = Number(discountRaw.toFixed(1))

  const newMin = isFirst ? 1 : Number(updates.minEndpoints ?? current.minEndpoints)
  const newMax = isLast ? null : Number(updates.maxEndpoints ?? current.maxEndpoints)

  if (!Number.isInteger(newMin) || newMin < 1) {
    throw new Error('Minimum endpoints must be a positive whole number.')
  }
  if (!isLast && (!Number.isInteger(newMax) || newMax < newMin)) {
    throw new Error('Maximum endpoints must be a whole number >= minimum endpoints.')
  }

  if (!isFirst) {
    const prevTier = tiers[idx - 1]
    if (newMin <= prevTier.minEndpoints) {
      throw new Error(
        `Minimum endpoints must be greater than ${prevTier.minEndpoints} so ${prevTier.shortName} keeps at least 1 endpoint.`
      )
    }
    prevTier.maxEndpoints = newMin - 1
  }

  if (!isLast) {
    const nextTier = tiers[idx + 1]
    if (nextTier.maxEndpoints !== null && newMax >= nextTier.maxEndpoints) {
      throw new Error(
        `Maximum endpoints must be less than ${nextTier.maxEndpoints} so ${nextTier.shortName} keeps at least 1 endpoint.`
      )
    }
    nextTier.minEndpoints = newMax + 1
  }

  tiers[idx] = {
    ...current,
    tier: tierName,
    shortName,
    minEndpoints: newMin,
    maxEndpoints: newMax,
    discountPercent,
    freeGpon: Boolean(updates.freeGpon ?? current.freeGpon),
    benefit,
  }

  return saveBulkSchemeTiers(tiers)
}

export function findTierForEndpoints(connections, tiers = null) {
  const activeTiers = Array.isArray(tiers) && tiers.length > 0 ? tiers : fetchBulkSchemeTiers()
  const count = Math.max(1, Math.trunc(Number(connections)) || 1)
  const matched = activeTiers.find((t) => {
    const min = Number(t.minEndpoints) || 1
    const max = t.maxEndpoints == null ? Infinity : Number(t.maxEndpoints)
    return count >= min && count <= max
  })
  return matched || activeTiers[0]
}

export function bulkDiscountRate(connections, tiers = null) {
  const tier = findTierForEndpoints(connections, tiers)
  return Number(((Number(tier?.discountPercent) || 0) / 100).toFixed(4))
}

export function getTierInfo(connections, tiers = null) {
  const matched = findTierForEndpoints(connections, tiers)
  const percent = Number(matched?.discountPercent) || 0
  return {
    id: matched.id,
    percent,
    tierName: `${matched.shortName} (${formatTierRange(matched, true)})`,
    tierKey: matched.id,
    freeGpon: Boolean(matched.freeGpon),
    desc: matched.benefit,
  }
}

export function calcBulk(connections, serviceType = 'BROADBAND', tiers = null) {
  const count = Math.max(1, Math.trunc(Number(connections)) || 1)
  const rate = bulkDiscountRate(count, tiers)
  const depositUnit = getDepositUnitUSD(serviceType)
  const gross = depositUnit * count
  const saved = Number((gross * rate).toFixed(2))

  return {
    rate,
    gross,
    saved,
    payable: Number((gross - saved).toFixed(2)),
  }
}

export function auditOrderBulkScheme(order, tiers = null) {
  const rawEndpoints = Number(order?.endpoints)
  const endpoints = Number.isFinite(rawEndpoints) && rawEndpoints >= 1 ? Math.trunc(rawEndpoints) : 1
  const expectedTier = getTierInfo(endpoints, tiers)
  const expectedPercent = Number(expectedTier.percent) || 0

  const rawDiscount = order?.bulkDiscountPercent
  const hasRecordedDiscount =
    rawDiscount !== undefined &&
    rawDiscount !== null &&
    rawDiscount !== '' &&
    Number.isFinite(Number(rawDiscount))

  const actualPercent = hasRecordedDiscount ? Number(rawDiscount) : null

  let auditStatus = 'UNRECORDED'
  if (hasRecordedDiscount) {
    auditStatus = Math.abs(actualPercent - expectedPercent) < 0.001 ? 'MATCHED' : 'MISMATCH'
  }

  const rawDeposit = Number(order?.depositAmountUSD)
  const grossDepositUSD =
    Number.isFinite(rawDeposit) && rawDeposit >= 0
      ? Number(rawDeposit.toFixed(2))
      : Number((getDepositUnitUSD(order?.serviceType) * endpoints).toFixed(2))

  const expectedSavedUSD = Number((grossDepositUSD * (expectedPercent / 100)).toFixed(2))
  const actualSavedUSD = hasRecordedDiscount
    ? Number((grossDepositUSD * (actualPercent / 100)).toFixed(2))
    : null

  return {
    endpoints,
    expectedTier,
    expectedPercent,
    hasRecordedDiscount,
    actualPercent,
    auditStatus,
    grossDepositUSD,
    expectedSavedUSD,
    actualSavedUSD,
  }
}

export const formatUSD = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
