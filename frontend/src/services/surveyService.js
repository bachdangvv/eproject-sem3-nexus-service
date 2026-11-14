import {
  fetchMockSurveyOrders,
  submitMockSurveyCallback,
  approveMockSurvey,
  rejectMockSurvey,
  MAX_SURVEY_DISTANCE_METERS,
  MIN_OVERRIDE_REASON_LENGTH,
  SURVEY_INFEASIBILITY_REASONS,
} from './mock/mockSurveyService.js'

export {
  MAX_SURVEY_DISTANCE_METERS,
  MIN_OVERRIDE_REASON_LENGTH,
  SURVEY_INFEASIBILITY_REASONS,
}
import {
  fetchApiSurveyOrders,
  submitApiSurveyCallback,
  approveApiSurvey,
  rejectApiSurvey,
} from './api/surveyApi.js'
import { REVIEW1_API_MODE } from './review1Api.js'

const USE_MOCK = !REVIEW1_API_MODE

export async function fetchSurveyOrders() {
  if (USE_MOCK) {
    return await fetchMockSurveyOrders()
  }
  return await fetchApiSurveyOrders()
}

export async function requestSurveyCallback(phone) {
  if (USE_MOCK) {
    return await submitMockSurveyCallback(phone)
  }
  return await submitApiSurveyCallback(phone)
}

export async function approveSurveyFeasible(orderId, payload) {
  if (USE_MOCK) {
    return await approveMockSurvey(orderId, payload)
  }
  return await approveApiSurvey(orderId, payload)
}

export async function rejectSurveyUnfeasible(orderId, reason, details = {}) {
  if (USE_MOCK) {
    return await rejectMockSurvey(orderId, reason, details)
  }
  return await rejectApiSurvey(orderId, reason, details)
}

const surveyService = {
  fetchSurveyOrders,
  requestSurveyCallback,
  approveSurveyFeasible,
  rejectSurveyUnfeasible,
  approveFeasible: approveSurveyFeasible,
  rejectFeasible: rejectSurveyUnfeasible,
}

export default surveyService
