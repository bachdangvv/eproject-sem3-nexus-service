import { fetchMockTracking } from './mock/mockTrackingService.js'
import { fetchApiTracking } from './api/trackingApi.js'
import { ORDER_STATUS_LIST, ORDER_STATUS_MAP, normalizeOrderStatus } from '../utils/orderStatus.js'
import { sanitizePublicTrackingPayload } from '../utils/publicTracking.js'
import { REVIEW1_API_MODE } from './review1Api.js'

const USE_MOCK = !REVIEW1_API_MODE

export const ORDER_ID_REGEX = /^[DBT]\d{10}$/
export const ACCOUNT_ID_REGEX = /^[DBT]\d{15}$/

export function detectIdType(raw) {
  const id = raw.trim().toUpperCase()
  if (ORDER_ID_REGEX.test(id)) return { type: 'order', id }
  if (ACCOUNT_ID_REGEX.test(id)) return { type: 'account', id }
  return { type: null, id }
}

export async function trackById(rawId) {
  const { type, id } = detectIdType(rawId)
  if (!type) {
    throw new Error(
      'Invalid identifier syntax. Order ID must be 11 characters (e.g. B0000000001), Account ID must be 16 characters (e.g. B001000000000001).'
    )
  }

  if (USE_MOCK) {
    return sanitizePublicTrackingPayload(await fetchMockTracking(type, id))
  }

  try {
    return sanitizePublicTrackingPayload(await fetchApiTracking(type, id))
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message
    throw new Error(errorMsg || `Could not track ${type} ${id}.`)
  }
}

const ORDER_TRACKING_STATUS_LABELS = Object.fromEntries(
  ORDER_STATUS_LIST.map((item) => [item.code, { text: item.label, tone: item.tone }])
)

export const STATUS_LABEL = {
  ...ORDER_TRACKING_STATUS_LABELS,
  IN_SURVEY: { text: 'In Survey', tone: 'blue' },
  QUEUED: { text: 'Queued', tone: 'amber' },
  IN_PROGRESS: { text: 'In Progress', tone: 'amber' },
  PROVISIONING: { text: 'Provisioning Terminal', tone: 'blue' },
  ACTIVE: { text: 'Online / Operational', tone: 'green' },
  LOCKED: { text: 'Suspended / Overdue', tone: 'red' },
  TERMINATED: { text: 'Terminated', tone: 'red' },
}

export function getStatusLabel(status) {
  if (status && STATUS_LABEL[status]) {
    return STATUS_LABEL[status]
  }

  const normalizedOrderStatus = normalizeOrderStatus(status, null)
  if (normalizedOrderStatus && ORDER_STATUS_MAP[normalizedOrderStatus]) {
    const meta = ORDER_STATUS_MAP[normalizedOrderStatus]
    return {
      text: meta.label,
      tone: meta.tone,
    }
  }

  const normalized = status ? String(status).replace(/_/g, ' ') : 'Processing'
  const titleCase = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()

  return {
    text: titleCase,
    tone: 'blue',
  }
}
