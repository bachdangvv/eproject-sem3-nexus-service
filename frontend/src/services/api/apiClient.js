import axios from 'axios'

let csrfToken = null

const apiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const method = String(config.method || 'get').toLowerCase()
  if (method !== 'get' && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    if (response.config?.url?.endsWith('/session') && response.data?.csrfToken) {
      csrfToken = response.data.csrfToken
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      csrfToken = null
      localStorage.removeItem('nexus_token')
      localStorage.removeItem('nexus_user')
    }
    return Promise.reject(error)
  }
)

export function getCsrfToken() {
  return csrfToken
}

export function clearCsrfToken() {
  csrfToken = null
}

export default apiClient

