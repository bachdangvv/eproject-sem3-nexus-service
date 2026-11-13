import { fetchOrders, findOrderById, updateOrder } from '../orderService.js'
import { ORDER_STATUS } from '../../utils/orderStatus.js'
import {
  validateOrderDocumentsPresent,
  checkDocumentAvailability,
  isIndexedDbAvailable,
} from '../documentStorageService.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const MAX_SURVEY_DISTANCE_METERS = 500
export const MIN_OVERRIDE_REASON_LENGTH = 10

export const SURVEY_INFEASIBILITY_REASONS = [
  {
    code: 'DISTANCE_EXCEEDS_500M',
    label: 'Optical span exceeds 500m ODN standard limit',
  },
  {
    code: 'ODF_PORTS_EXHAUSTED',
    label: 'Target ODF cabinet ports exhausted',
  },
  {
    code: 'HIGH_ATTENUATION',
    label: 'Optical attenuation exceeds budget threshold',
  },
  {
    code: 'CONDUIT_BLOCKED',
    label: 'Underground conduit blocked / civil works required',
  },
  {
    code: 'BUILDING_NO_ACCESS',
    label: 'Building management denied riser / duct access',
  },
  {
    code: 'MISSING_DOCUMENTS',
    label: 'Missing or unreadable required verification documents (CCCD / Address Proof)',
  },
  {
    code: 'OTHER',
    label: 'Other technical infeasibility (specify details)',
  },
]

const CALLBACK_REQUESTS = []

const SURVEY_VISIBLE_STATUSES = new Set([
  ORDER_STATUS.PENDING_SURVEY,
  ORDER_STATUS.FEASIBLE,
  ORDER_STATUS.NOT_FEASIBLE,
])

function toSurveyOrder(order) {
  const serviceType = order.serviceType === 'DIALUP' ? 'DIAL_UP' : order.serviceType || 'BROADBAND'
  return {
    ...order,
    id: order.id || order.orderId,
    serviceType,
    serviceTitle: order.serviceTitle || order.planName || order.serviceName || serviceType,
    slaTimeRemaining: order.slaTimeRemaining || '2h 00m',
    isUrgent: Boolean(order.isUrgent || order.status === ORDER_STATUS.PENDING_SURVEY),
    distanceMeters: Number(order.distanceMeters) || 200,
    odfName: order.odfName || `ODF-CORE-${order.branchCode || order.cityCode || '101'}`,
    reservedPort: Number(order.reservedPort) || 4,
    conduitType: order.conduitType || 'HDPE 110mm Underground Duct',
  }
}

export async function fetchMockSurveyOrders() {
  const priority = {
    [ORDER_STATUS.PENDING_SURVEY]: 0,
    [ORDER_STATUS.FEASIBLE]: 1,
    [ORDER_STATUS.NOT_FEASIBLE]: 2,
  }
  return fetchOrders()
    .filter((ord) => SURVEY_VISIBLE_STATUSES.has(ord.status))
    .map(toSurveyOrder)
    .sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9))
}

export async function submitMockSurveyCallback(phone) {
  await delay(200)
  const entry = {
    id: `REQ-${Date.now()}`,
    phone,
    requestedAt: new Date().toISOString(),
    status: 'QUEUED',
  }
  CALLBACK_REQUESTS.push(entry)
  return { success: true, message: 'Callback request registered successfully.', entry }
}

async function validateSurveyDocumentsForApproval(order) {
  const verification = validateOrderDocumentsPresent(order)
  if (!verification.isComplete) {
    throw new Error(
      `Cannot approve survey as FEASIBLE: missing required verification document(s) (${verification.missing.join(', ')}).`
    )
  }

  const requiredDocs = [
    { label: 'Citizen ID / National ID (CCCD)', doc: verification.nationalId },
    { label: 'Proof of Installation Address', doc: verification.addressProof },
  ]

  for (const item of requiredDocs) {
    if (item.doc?.storageKey && !item.doc?.dataUrl && isIndexedDbAvailable()) {
      const existsInStorage = await checkDocumentAvailability(item.doc)
      if (!existsInStorage) {
        throw new Error(
          `Cannot approve survey as FEASIBLE: ${item.label} file is missing from document storage. Please ask Retail to re-upload the document.`
        )
      }
    }
  }
}

export async function approveMockSurvey(orderId, allocationPayload = {}) {
  await delay(200)
  const existing = findOrderById(orderId)
  if (!existing) {
    throw new Error(`Order ${orderId} not found in shared order store.`)
  }

  await validateSurveyDocumentsForApproval(existing)

  const parsedDistance = Number(allocationPayload.distanceMeters ?? existing.distanceMeters ?? 185)
  if (!Number.isFinite(parsedDistance) || parsedDistance <= 0) {
    throw new Error('Optical span distance must be a positive number of meters.')
  }
  const distanceMeters = Math.round(parsedDistance)

  const exceedsDistanceLimit = distanceMeters > MAX_SURVEY_DISTANCE_METERS
  const allowDistanceOverride = allocationPayload.allowDistanceOverride === true
  const overrideReason = String(allocationPayload.overrideReason || '').trim()

  if (exceedsDistanceLimit) {
    if (!allowDistanceOverride) {
      throw new Error(
        `Optical span ${distanceMeters}m exceeds the ${MAX_SURVEY_DISTANCE_METERS}m ODN standard limit. Mark the survey NOT FEASIBLE or provide an authorized Senior NOC override with technical justification.`
      )
    }
    if (overrideReason.length < MIN_OVERRIDE_REASON_LENGTH) {
      throw new Error(
        `Senior NOC >${MAX_SURVEY_DISTANCE_METERS}m distance override requires a technical justification of at least ${MIN_OVERRIDE_REASON_LENGTH} characters.`
      )
    }
  }

  const reservedPort = Math.max(1, Number(allocationPayload.reservedPort ?? existing.reservedPort ?? 4))
  const conduitType = String(
    allocationPayload.conduitType || existing.conduitType || 'HDPE 110mm Underground Duct'
  ).trim()
  const odfName = String(
    allocationPayload.odfName || existing.odfName || `ODF-CORE-${existing.branchCode || '101'}`
  ).trim()
  const rxPowerDbm = Number(allocationPayload.rxPowerDbm ?? existing.surveyRxDbm ?? -18.4)

  const updated = updateOrder(existing.id, {
    status: ORDER_STATUS.FEASIBLE,
    currentStep: 3,
    distanceMeters,
    distanceOverrideApproved: exceedsDistanceLimit && allowDistanceOverride,
    distanceOverrideReason: exceedsDistanceLimit && allowDistanceOverride ? overrideReason : '',
    reservedPort,
    conduitType,
    odfName,
    surveyRxDbm: rxPowerDbm,
    signalLoss: `${rxPowerDbm} dBm`,
    odnBox: `${odfName} • Port #${reservedPort} (${distanceMeters}m)`,
    rejectionReason: '',
    fieldEngineer: allocationPayload.fieldEngineer || 'Do Manh Cuong (NOC)',
    surveyApprovedAt: new Date().toISOString(),
  })

  return {
    success: true,
    orderId: updated.id,
    status: ORDER_STATUS.FEASIBLE,
    allocatedPort: reservedPort,
    reservationExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    order: toSurveyOrder(updated),
    message: exceedsDistanceLimit
      ? `Order ${updated.id} approved FEASIBLE via Senior NOC override (${distanceMeters}m). Soft-Reservation active for 60 minutes.`
      : `Order ${updated.id} approved FEASIBLE. Soft-Reservation active for 60 minutes.`,
  }
}

export async function rejectMockSurvey(orderId, reason, details = {}) {
  await delay(200)
  const existing = findOrderById(orderId)
  if (!existing) {
    throw new Error(`Order ${orderId} not found in shared order store.`)
  }

  const finalReason =
    String(reason || '').trim() || 'Optical span exceeds 500m ODN standard limit'
  const parsedDistance = Number(details.distanceMeters)
  const patch = {
    status: ORDER_STATUS.NOT_FEASIBLE,
    currentStep: 2,
    distanceOverrideApproved: false,
    distanceOverrideReason: '',
    rejectionReason: finalReason,
    signalLoss: 'Infeasible — Beyond Optical SLA',
    odnBox: `Survey Rejected: ${finalReason}`,
    surveyRejectedAt: new Date().toISOString(),
  }
  if (Number.isFinite(parsedDistance) && parsedDistance > 0) {
    patch.distanceMeters = Math.round(parsedDistance)
  }

  const updated = updateOrder(existing.id, patch)

  return {
    success: true,
    orderId: updated.id,
    status: ORDER_STATUS.NOT_FEASIBLE,
    reason: finalReason,
    refundInitiated: true,
    refundPercentage: 100,
    order: toSurveyOrder(updated),
    message: `Order ${updated.id} rejected. 100% deposit refund initiated (CN16).`,
  }
}
