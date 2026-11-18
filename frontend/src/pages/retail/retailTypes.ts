import {
  ApiError,
  type CustomerStatus,
  type CustomerView,
  type OrderStatus,
  type OrderView,
  type RequestView,
  type ServiceTypeCode,
} from '../../types/nexus';

export type RetailSection = 'customers' | 'requests' | 'orders';

export type CustomerRow = CustomerView & Record<string, unknown>;
export type RequestRow = RequestView & Record<string, unknown>;
export type OrderRow = OrderView & Record<string, unknown>;

export interface RetailSectionMeta {
  title: string;
  tokenLabel: string;
  subtitle: string;
  countLabel: string;
}

export const RETAIL_SECTION_META: Record<RetailSection, RetailSectionMeta> = {
  customers: {
    title: 'Customer Directory & Registration',
    tokenLabel: 'Customers',
    subtitle:
      'Search subscriber profiles by CUS code, name, or phone, register new customers, and maintain territory details.',
    countLabel: 'customers',
  },
  requests: {
    title: 'Service Connection Requests',
    tokenLabel: 'Requests',
    subtitle:
      'Submit Dial-Up, Broadband, or Landline requests for active subscribers and confirm them into Pending orders.',
    countLabel: 'pending',
  },
  orders: {
    title: 'Orders & Customer Feedback',
    tokenLabel: 'Orders',
    subtitle:
      'Track retail service orders from placement through activation and record customer feedback for Connected orders.',
    countLabel: 'orders',
  },
};

export interface RetailSectionProps {
  refreshTrigger: number;
  onCountChange: (count: number | null) => void;
  onRefreshingChange: (refreshing: boolean) => void;
}

export const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
export const CITY_CODE_REGEX = /^[0-9]{3}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ORDER_CODE_REGEX = /^[DBT][0-9]{10}$/;

export function isValidOrderCode(raw: string): boolean {
  const upper = raw.trim().toUpperCase();
  if (!ORDER_CODE_REGEX.test(upper)) {
    return false;
  }
  const serial = Number(upper.slice(1));
  return Number.isInteger(serial) && serial >= 1;
}

export const SERVICE_TYPE_LABELS: Record<ServiceTypeCode, string> = {
  D: 'Dial-Up (D)',
  B: 'Broadband (B)',
  T: 'Landline (T)',
};

export const CUSTOMER_STATUS_OPTIONS: Array<{
  value: CustomerStatus;
  label: string;
  description: string;
}> = [
  {
    value: 'ACTIVE',
    label: 'ACTIVE',
    description: 'Customer can submit new service connection requests.',
  },
  {
    value: 'SUSPENDED',
    label: 'SUSPENDED',
    description: 'Blocked from placing new service connection requests.',
  },
];

export const CUSTOMER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Corporate', label: 'Corporate' },
  { value: 'Individual', label: 'Individual' },
  { value: 'Enterprise', label: 'Enterprise' },
  { value: 'Government', label: 'Government' },
];

export type OrderStatusFilter = 'ALL' | OrderStatus;

export const ORDER_STATUS_FILTER_ITEMS: Array<{
  value: OrderStatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Feasible', label: 'Feasible' },
  { value: 'NotFeasible', label: 'Not Feasible' },
  { value: 'Connected', label: 'Connected' },
];

export const FEEDBACK_RATING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
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
