import { ORDER_STATUS, normalizeOrderStatus } from './orderStatus.js'

export const PUBLIC_TRACKING_STAGES = [
  { step: 1, key: 'RECEPTION', shortLabel: 'Order', title: 'Order Registered' },
  { step: 2, key: 'SURVEY', shortLabel: 'Survey', title: 'ODN Feasibility Survey' },
  { step: 3, key: 'EQUIPMENT', shortLabel: 'Provision', title: 'CPE & Port Allocation' },
  { step: 4, key: 'ACCOUNT', shortLabel: 'Account ID', title: '16-Char Account ID Issued' },
  { step: 5, key: 'ACTIVATION', shortLabel: 'Active', title: 'Circuit Active & Operational' },
]

export function maskCustomerName(rawName) {
  const cleaned = String(rawName || '').trim()
  if (!cleaned) return 'Verified Subscriber (Masked)'

  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length === 1) {
    const word = tokens[0]
    if (word.length <= 2) return `${word[0]}*`
    return `${word[0]}${'*'.repeat(Math.min(4, word.length - 1))}`
  }

  return tokens
    .slice(0, 3)
    .map((word) => {
      if (word.length <= 1) return '*'
      return `${word[0]}***`
    })
    .join(' ')
}

export function maskPublicRoute({
  cityCode = '',
  branchCode = '',
  branchName = '',
  route = '',
  address = '',
} = {}) {
  const normalizedCode = String(cityCode || branchCode || '').trim().toUpperCase()
  if (normalizedCode === '101' || normalizedCode === '001' || normalizedCode === 'HN' || normalizedCode === 'HNI' || normalizedCode.startsWith('HN')) {
    return 'Hanoi Metro Region (Route Masked)'
  }
  if (
    normalizedCode === '201' ||
    normalizedCode === '002' ||
    normalizedCode === 'SGN' ||
    normalizedCode === 'HCM' ||
    normalizedCode === 'HCMC' ||
    normalizedCode.startsWith('SG')
  ) {
    return 'Ho Chi Minh Metro Region (Route Masked)'
  }
  if (normalizedCode === '301' || normalizedCode === '003' || normalizedCode === 'DN' || normalizedCode === 'DAD' || normalizedCode.startsWith('DN')) {
    return 'Da Nang Metro Region (Route Masked)'
  }
  if (normalizedCode === 'HP' || normalizedCode === 'HPH') {
    return 'Hai Phong Metro Region (Route Masked)'
  }
  if (normalizedCode === 'CT' || normalizedCode === 'VCA') {
    return 'Can Tho Metro Region (Route Masked)'
  }

  const combined = `${branchName} ${route} ${address}`.toLowerCase()
  if (
    combined.includes('hanoi') ||
    combined.includes('ha noi') ||
    combined.includes('hoan kiem') ||
    combined.includes('ba dinh') ||
    combined.includes('hai ba trung') ||
    combined.includes('cau giay') ||
    /\b(hn|hni)\b/.test(combined)
  ) {
    return 'Hanoi Metro Region (Route Masked)'
  }
  if (
    combined.includes('ho chi minh') ||
    combined.includes('hcmc') ||
    combined.includes('saigon') ||
    combined.includes('district ') ||
    combined.includes('binh thanh') ||
    combined.includes('thu duc') ||
    combined.includes('sgn') ||
    /\b(hcm)\b/.test(combined)
  ) {
    return 'Ho Chi Minh Metro Region (Route Masked)'
  }
  if (
    combined.includes('da nang') ||
    combined.includes('danang') ||
    combined.includes('hai chau') ||
    combined.includes('thanh khe') ||
    combined.includes('ngu hanh son') ||
    /\b(dn|dad)\b/.test(combined)
  ) {
    return 'Da Nang Metro Region (Route Masked)'
  }
  if (combined.includes('hai phong') || /\b(hp|hph)\b/.test(combined)) {
    return 'Hai Phong Metro Region (Route Masked)'
  }
  if (combined.includes('can tho') || /\b(ct|vca)\b/.test(combined)) {
    return 'Can Tho Metro Region (Route Masked)'
  }

  return 'Protected Regional POP (Route Masked)'
}

export function formatPublicServiceLabel(serviceType) {
  const normalized = String(serviceType || '').trim().toUpperCase()
  if (normalized === 'DIALUP' || normalized === 'DIAL_UP') return 'Dial-Up / Leased Line'
  if (normalized === 'LANDLINE' || normalized === 'SIP_TRUNK') return 'Telephone / SIP'
  return 'Broadband FTTx'
}

export function buildPublicTrackingTimeline(rawStatus) {
  const upper = String(rawStatus || '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  const canonicalOrder = normalizeOrderStatus(upper, null)

  let states = ['done', 'active', 'pending', 'pending', 'pending']
  let activeStep = 2
  let isHalted = false
  let isFailed = false
  let summaryLabel = 'Stage 2 of 5 • Pending Technical Survey'

  if (upper === ORDER_STATUS.DRAFT || canonicalOrder === ORDER_STATUS.DRAFT) {
    states = ['active', 'pending', 'pending', 'pending', 'pending']
    activeStep = 1
    summaryLabel = 'Stage 1 of 5 • Draft Registered (Awaiting Submission)'
  } else if (
    upper === ORDER_STATUS.PENDING_SURVEY ||
    upper === 'IN_SURVEY' ||
    upper === 'QUEUED' ||
    canonicalOrder === ORDER_STATUS.PENDING_SURVEY
  ) {
    states = ['done', 'active', 'pending', 'pending', 'pending']
    activeStep = 2
    summaryLabel = 'Stage 2 of 5 • Awaiting ODN Feasibility Survey'
  } else if (
    upper === ORDER_STATUS.FEASIBLE ||
    upper === 'IN_PROGRESS' ||
    canonicalOrder === ORDER_STATUS.FEASIBLE
  ) {
    states = ['done', 'done', 'active', 'pending', 'pending']
    activeStep = 3
    summaryLabel = 'Stage 3 of 5 • Survey Passed, Provisioning CPE'
  } else if (upper === 'PROVISIONING') {
    states = ['done', 'done', 'done', 'active', 'pending']
    activeStep = 4
    summaryLabel = 'Stage 4 of 5 • Assigning 16-Char Account ID'
  } else if (
    upper === 'ACTIVE' ||
    upper === ORDER_STATUS.ACTIVATED ||
    canonicalOrder === ORDER_STATUS.ACTIVATED
  ) {
    states = ['done', 'done', 'done', 'done', 'done']
    activeStep = 5
    summaryLabel = 'Stage 5 of 5 • Circuit Provisioned & Active'
  } else if (
    upper === 'LOCKED' ||
    upper === 'TEMPORARILY_INACTIVE' ||
    upper === 'SUSPENDED'
  ) {
    states = ['done', 'done', 'done', 'done', 'warning']
    activeStep = 5
    summaryLabel = 'Stage 5 of 5 • Circuit Provisioned (Billing Attention Required)'
  } else if (upper === 'TERMINATED' || upper === 'PERMANENTLY_INACTIVE') {
    states = ['done', 'done', 'done', 'done', 'failed']
    activeStep = 5
    isHalted = true
    isFailed = true
    summaryLabel = 'Stage 5 of 5 • Circuit Terminated'
  } else if (upper === ORDER_STATUS.NOT_FEASIBLE || canonicalOrder === ORDER_STATUS.NOT_FEASIBLE) {
    states = ['done', 'failed', 'halted', 'halted', 'halted']
    activeStep = 2
    isHalted = true
    isFailed = true
    summaryLabel = 'Halted at Stage 2 of 5 • ODN Survey Not Feasible'
  } else if (upper === ORDER_STATUS.CANCELLED || canonicalOrder === ORDER_STATUS.CANCELLED) {
    states = ['done', 'halted', 'halted', 'halted', 'halted']
    activeStep = 1
    isHalted = true
    summaryLabel = 'Stopped • Order Cancelled'
  } else if (upper === ORDER_STATUS.REFUNDED || canonicalOrder === ORDER_STATUS.REFUNDED) {
    states = ['done', 'failed', 'halted', 'halted', 'halted']
    activeStep = 2
    isHalted = true
    summaryLabel = 'Closed • 100% Deposit Refunded'
  }

  const stages = PUBLIC_TRACKING_STAGES.map((stage, idx) => ({
    ...stage,
    state: states[idx],
  }))
  const completedSteps = stages.filter((s) => s.state === 'done').length

  return {
    stages,
    completedSteps,
    totalSteps: PUBLIC_TRACKING_STAGES.length,
    activeStep,
    isHalted,
    isFailed,
    summaryLabel,
  }
}

export function sanitizePublicTrackingPayload(raw) {
  if (!raw || typeof raw !== 'object') return raw

  const rawAccountId = raw.accountId ? String(raw.accountId).trim().toUpperCase() : null
  const validAccountId = rawAccountId && /^[DBT]\d{15}$/.test(rawAccountId) ? rawAccountId : null

  const normalizedServiceType =
    raw.serviceType === 'DIALUP' ? 'DIAL_UP' : raw.serviceType || 'BROADBAND'

  const maskedCustomer = raw.maskedCustomer || maskCustomerName(raw.customerName)
  const maskedRoute =
    raw.maskedRoute ||
    maskPublicRoute({
      cityCode: raw.cityCode,
      branchCode: raw.branchCode,
      branchName: raw.branchName,
      route: raw.route,
      address: raw.address,
    })

  return {
    type: raw.type,
    id: raw.id,
    ...(raw.orderId ? { orderId: raw.orderId } : {}),
    ...(validAccountId ? { accountId: validAccountId } : {}),
    serviceType: normalizedServiceType,
    serviceLabel: raw.serviceLabel || formatPublicServiceLabel(normalizedServiceType),
    status: raw.status,
    maskedCustomer,
    maskedRoute,
    ...(raw.bandwidth ? { bandwidth: raw.bandwidth } : {}),
    timeline: buildPublicTrackingTimeline(raw.status),
  }
}
