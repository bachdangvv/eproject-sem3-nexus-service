import type { PublicTrackView } from '../types/nexus';
import { apiRequest } from './apiClient';

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
