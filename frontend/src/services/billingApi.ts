import type { BillingView } from '../types/nexus';
import { apiRequest } from './apiClient';

export function getBillingAccount(accountId: string): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}`,
  );
}

export function createBillingRecord(accountId: string): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}`,
    {
      method: 'POST',
    },
  );
}

export function recordPayment(accountId: string): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}/payment`,
    {
      method: 'POST',
    },
  );
}
