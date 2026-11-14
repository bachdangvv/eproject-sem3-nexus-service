import apiClient from './apiClient'

export async function fetchApiTracking(type, id) {
  const endpoint = type === 'order' ? `/public/track/order/${id}` : `/public/track/account/${id}`
  const { data } = await apiClient.get(endpoint)
  return { type, id, ...data }
}

