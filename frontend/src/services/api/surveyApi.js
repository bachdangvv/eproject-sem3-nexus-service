import apiClient from './apiClient.js'

export async function fetchApiSurveyOrders() {
  const { data } = await apiClient.get('/technical/surveys')
  return data
}

export async function submitApiSurveyCallback(phone) {
  const { data } = await apiClient.post('/public/survey/callback', { phone })
  return data
}

export async function approveApiSurvey(orderId, payload) {
  const { data } = await apiClient.post(`/technical/surveys/${orderId}/approve`, payload)
  return data
}

export async function rejectApiSurvey(orderId, reason, details = {}) {
  const { data } = await apiClient.post(`/technical/surveys/${orderId}/reject`, {
    reason,
    ...details,
  })
  return data
}
