import apiClient from './apiClient'
import { toFrontendOrderStatus } from '../review1Api.js'

export async function fetchApiTracking(type, id) {
  const endpoint = type === 'order' ? `/public/track/order/${id}` : `/public/track/account/${id}`
  const { data } = await apiClient.get(endpoint)
  return { type, id, ...data, status: toFrontendOrderStatus(data.status) }
}

