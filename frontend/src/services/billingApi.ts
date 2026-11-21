import type {
  BillingView,
  CreateInvoiceInput,
  RecordPaymentInput,
  RefundDepositInput,
} from '../types/nexus';
import { apiRequest } from './apiClient';

export interface BillingFilterParams {
  q?: string;
  status?: string;
  cityCode?: string;
}

function buildQuery(params?: BillingFilterParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.status && params.status !== 'ALL') search.set('status', params.status);
  if (params.cityCode?.trim()) search.set('cityCode', params.cityCode.trim());
  const queryString = search.toString();
  return queryString ? `?${queryString}` : '';
}

// Billing Department APIs (Role = Billing)
export function getBillingAccounts(params?: BillingFilterParams): Promise<BillingView[]> {
  return apiRequest<BillingView[]>(`/billing/accounts${buildQuery(params)}`);
}

export function getBillingAccount(accountId: string): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}`,
  );
}

export function createBillingRecord(
  accountId: string,
  input?: CreateInvoiceInput,
): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}`,
    {
      method: 'POST',
      body: input ? JSON.stringify(input) : undefined,
    },
  );
}

export function recordPayment(
  accountId: string,
  input?: RecordPaymentInput,
): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}/payment`,
    {
      method: 'POST',
      body: input ? JSON.stringify(input) : undefined,
    },
  );
}

export function refundDeposit(
  accountId: string,
  input?: RefundDepositInput,
): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}/refund`,
    {
      method: 'POST',
      body: input ? JSON.stringify(input) : undefined,
    },
  );
}

// Retail Department In-Store Billing & Payments (Role = Retail)
export function getRetailBillingAccounts(
  params?: BillingFilterParams,
): Promise<BillingView[]> {
  return apiRequest<BillingView[]>(`/retail/billing/accounts${buildQuery(params)}`);
}

export function getRetailBillingAccount(accountId: string): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/retail/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}`,
  );
}

export function recordRetailPayment(
  accountId: string,
  input?: RecordPaymentInput,
): Promise<BillingView> {
  return apiRequest<BillingView>(
    `/retail/billing/accounts/${encodeURIComponent(accountId.trim().toUpperCase())}/payment`,
    {
      method: 'POST',
      body: input ? JSON.stringify(input) : undefined,
    },
  );
}
