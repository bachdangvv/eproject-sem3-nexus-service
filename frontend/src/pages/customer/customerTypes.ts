/**
 * Shared types, metadata, option lists, and validation helpers for the Customer Portal sections.
 */
import {
  ApiError,
  type BillingView,
  type CityView,
  type ConnectionLifecycleView,
  type CustomerQueryCategory,
  type CustomerQueryView,
  type InvoiceItemView,
  type OrderView,
  type PaymentItemView,
  type PlanChangeRequestView,
  type RequestView,
} from '../../types/nexus';

export type CustomerSection = 'profile' | 'orders' | 'billing' | 'support';

export interface CustomerSectionMeta {
  title: string;
  tokenLabel: string;
  subtitle: string;
  countLabel: string;
}

export const CUSTOMER_SECTION_META: Record<CustomerSection, CustomerSectionMeta> = {
  profile: {
    title: 'Subscriber Profile & Account',
    tokenLabel: 'Profile',
    subtitle:
      'Review your customer code, account status, and update your installation contact details.',
    countLabel: 'account',
  },
  orders: {
    title: 'Service Requests & Orders',
    tokenLabel: 'Orders & Requests',
    subtitle:
      'Request new Dial-Up, Broadband, or Landline connections, track feasibility, and submit feedback.',
    countLabel: 'orders',
  },
  billing: {
    title: 'Connections & Online Billing',
    tokenLabel: 'Billing',
    subtitle:
      'Monitor active or suspended connections, inspect itemized invoices, and pay balances online.',
    countLabel: 'accounts',
  },
  support: {
    title: 'Support, Plan Changes & FAQ',
    tokenLabel: 'Support',
    subtitle:
      'Submit customer queries, request service plan upgrades, and browse the Nexus FAQ catalog.',
    countLabel: 'tickets',
  },
};

export interface CustomerSectionProps {
  refreshTrigger: number;
  onCountChange: (count: number | null) => void;
  onRefreshingChange: (refreshing: boolean) => void;
}

export type RequestRow = RequestView & Record<string, unknown>;
export type OrderRow = OrderView & Record<string, unknown>;
export type ConnectionRow = ConnectionLifecycleView & Record<string, unknown>;
export type BillingRow = BillingView & Record<string, unknown>;
export type InvoiceRow = InvoiceItemView & Record<string, unknown>;
export type PaymentRow = PaymentItemView & Record<string, unknown>;
export type PlanChangeRow = PlanChangeRequestView & Record<string, unknown>;
export type CustomerQueryRow = CustomerQueryView & Record<string, unknown>;

export const CUSTOMER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Individual', label: 'Individual' },
  { value: 'Residential', label: 'Residential' },
  { value: 'Corporate', label: 'Corporate' },
  { value: 'Enterprise', label: 'Enterprise' },
  { value: 'Government', label: 'Government' },
];

export const QUERY_CATEGORY_OPTIONS: Array<{ value: CustomerQueryCategory; label: string }> = [
  { value: 'Billing', label: 'Billing' },
  { value: 'Technical', label: 'Technical' },
  { value: 'Plan', label: 'Plan' },
  { value: 'General', label: 'General' },
];

export const FEEDBACK_RATING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '5', label: '5 - Excellent' },
  { value: '4', label: '4 - Very Good' },
  { value: '3', label: '3 - Satisfactory' },
  { value: '2', label: '2 - Fair' },
  { value: '1', label: '1 - Needs Improvement' },
];

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.detail || err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export function extractFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.errors) {
    return {};
  }
  const mapped: Record<string, string> = {};
  for (const [key, messages] of Object.entries(err.errors)) {
    if (Array.isArray(messages) && messages.length > 0 && messages[0]) {
      mapped[key.toLowerCase()] = messages[0];
    }
  }
  return mapped;
}

export function formatCityDisplay(cityCode: string, cities: CityView[]): string {
  const match = cities.find((c) => c.code === cityCode);
  return match ? `${match.code} — ${match.name}` : cityCode;
}

export function formatChannelLabel(channel: string): string {
  if (channel === 'CustomerPortal') return 'Customer Portal';
  if (channel === 'RetailOutlet') return 'Retail Outlet';
  if (channel === 'CityOffice') return 'City Office';
  return channel || 'City Office';
}

export function validatePositiveCurrency(
  raw: string,
): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, error: 'Payment amount is required.' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      value: null,
      error: 'Enter a valid positive amount with up to two decimal places.',
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0.01) {
    return { value: null, error: 'Payment amount must be at least $0.01.' };
  }
  return { value: parsed, error: null };
}
