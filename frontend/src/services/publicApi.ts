/**
 * Anonymous public API client for live tariff plans, cities, and zero-PII order/account tracking.
 */
import type { CityView, PlanView, PublicTrackView } from '../types/nexus';
import { apiRequest } from './apiClient';

export function getPublicPlans(): Promise<PlanView[]> {
  return apiRequest<PlanView[]>('/public/plans');
}

export function getPublicCities(): Promise<CityView[]> {
  return apiRequest<CityView[]>('/public/cities');
}

export function trackOrder(code: string): Promise<PublicTrackView> {
  return apiRequest<PublicTrackView>(
    `/public/track/order/${encodeURIComponent(code.trim().toUpperCase())}`,
  );
}

export function trackAccount(accountId: string): Promise<PublicTrackView> {
  return apiRequest<PublicTrackView>(
    `/public/track/account/${encodeURIComponent(accountId.trim().toUpperCase())}`,
  );
}
