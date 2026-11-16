import apiClient from './apiClient.js'
import { mapOrderFromApi } from '../review1Api.js'

export async function fetchApiSurveyOrders() {
  const { data } = await apiClient.get('/orders')
  return data.map(mapOrderFromApi)
    .filter((order) => ['PENDING_SURVEY', 'FEASIBLE', 'NOT_FEASIBLE'].includes(order.status))
    .map((order) => ({
    ...order,
    isUrgent: true,
    distanceMeters: Number(order.distanceMeters || 200),
    reservedPort: Number(order.reservedPort || 4),
    conduitType: order.conduitType || 'ODN route pending backend survey',
    odfName: order.odfName || `ODF-CORE-${order.cityCode || '101'}`,
    }))
}

export async function submitApiSurveyCallback(phone) {
  return { success: false, message: `Callback request is not part of Review 1 API yet (${phone}).` }
}

export async function approveApiSurvey(orderId, payload) {
  const distanceOk =
    typeof payload.distanceOk === 'boolean'
      ? payload.distanceOk
      : Number(payload.distanceMeters) <= 500 || payload.allowDistanceOverride === true
  const serverAvailable =
    typeof payload.serverAvailable === 'boolean' ? payload.serverAvailable : true

  const { data } = await apiClient.post(`/orders/${encodeURIComponent(orderId)}/assessment`, {
    distanceOk,
    serverAvailable,
    landlineFeasible: payload.landlineFeasible ?? null,
    note: payload.allowDistanceOverride
      ? `Senior NOC override: ${payload.overrideReason || 'approved technical override'}`
      : payload.note || 'Technical feasibility approved.',
  })
  return { success: true, status: 'FEASIBLE', order: mapOrderFromApi(data) }
}

export async function rejectApiSurvey(orderId, reason, details = {}) {
  const distanceOk =
    typeof details.distanceOk === 'boolean'
      ? details.distanceOk
      : Number(details.distanceMeters) > 0
      ? Number(details.distanceMeters) <= 500
      : false
  const serverAvailable =
    typeof details.serverAvailable === 'boolean' ? details.serverAvailable : false

  const { data } = await apiClient.post(`/orders/${encodeURIComponent(orderId)}/assessment`, {
    distanceOk,
    serverAvailable,
    landlineFeasible: details.landlineFeasible ?? null,
    note: reason || 'Technical assessment marked the order not feasible.',
  })
  return { success: true, status: 'NOT_FEASIBLE', reason, order: mapOrderFromApi(data) }
}
