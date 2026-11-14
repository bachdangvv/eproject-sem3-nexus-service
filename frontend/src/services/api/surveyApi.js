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
  const { data } = await apiClient.post(`/orders/${encodeURIComponent(orderId)}/assessment`, {
    distanceOk: Number(payload.distanceMeters) <= 500 || payload.allowDistanceOverride === true,
    serverAvailable: true,
    landlineFeasible: payload.landlineFeasible ?? true,
    note: payload.allowDistanceOverride
      ? `Senior NOC override: ${payload.overrideReason || 'approved technical override'}`
      : payload.note || 'Technical feasibility approved.',
  })
  return { success: true, status: 'FEASIBLE', order: mapOrderFromApi(data) }
}

export async function rejectApiSurvey(orderId, reason, details = {}) {
  const { data } = await apiClient.post(`/orders/${encodeURIComponent(orderId)}/assessment`, {
    distanceOk: Number(details.distanceMeters) > 0 ? Number(details.distanceMeters) <= 500 : false,
    serverAvailable: false,
    landlineFeasible: details.landlineFeasible ?? false,
    note: reason || 'Technical assessment marked the order not feasible.',
  })
  return { success: true, status: 'NOT_FEASIBLE', reason, order: mapOrderFromApi(data) }
}
