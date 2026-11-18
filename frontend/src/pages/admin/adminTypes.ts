import {
  ApiError,
  type CityView,
  type CustomerView,
  type EmployeeView,
  type PlanView,
  type ProductView,
  type ServiceTypeCode,
  type UserRole,
} from '../../types/nexus';

export type AdminSection = 'plans' | 'products' | 'cities' | 'employees' | 'customers';

export type PlanRow = PlanView & Record<string, unknown>;
export type ProductRow = ProductView & Record<string, unknown>;
export type CityRow = CityView & Record<string, unknown>;
export type EmployeeRow = EmployeeView & Record<string, unknown>;
export type CustomerRow = CustomerView & Record<string, unknown>;

export interface AdminSectionMeta {
  title: string;
  tokenLabel: string;
  subtitle: string;
  countLabel: string;
}

export const ADMIN_SECTION_META: Record<AdminSection, AdminSectionMeta> = {
  plans: {
    title: 'Service Plans Catalog',
    tokenLabel: 'Plans',
    subtitle: 'Create, update, reactivate, and archive Dial-Up, Broadband, and Landline tariff plans.',
    countLabel: 'plans',
  },
  products: {
    title: 'Hardware & Equipment Products',
    tokenLabel: 'Products',
    subtitle: 'Manage modems, routers, and installation hardware available in the catalog.',
    countLabel: 'products',
  },
  cities: {
    title: 'Territory Cities',
    tokenLabel: 'Cities',
    subtitle: 'Register 3-digit numeric city codes used across customer records and Account IDs.',
    countLabel: 'cities',
  },
  employees: {
    title: 'Staff Accounts & Roles',
    tokenLabel: 'Employees',
    subtitle: 'Inspect the staff roster and register department accounts for Admin, Retail, Technical, and Billing.',
    countLabel: 'staff',
  },
  customers: {
    title: 'Customer Directory',
    tokenLabel: 'Customers',
    subtitle: 'Search subscriber records by CUS code, full name, or phone number and inspect telemetry.',
    countLabel: 'customers',
  },
};

export interface AdminSectionProps {
  refreshTrigger: number;
  onCountChange: (count: number | null) => void;
  onRefreshingChange: (refreshing: boolean) => void;
}

export const CITY_CODE_REGEX = /^[0-9]{3}$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,40}$/;
export const PRICE_DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;
export const MAX_PLAN_PRICE = 9999999999.99;

export const SERVICE_TYPE_OPTIONS: Array<{ value: ServiceTypeCode; label: string }> = [
  { value: 'D', label: 'Dial-Up (D)' },
  { value: 'B', label: 'Broadband (B)' },
  { value: 'T', label: 'Landline (T)' },
];

export const STAFF_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Technical', label: 'Technical' },
  { value: 'Billing', label: 'Billing' },
];

export function validatePlanPrice(raw: string):
  | { valid: true; value: number }
  | { valid: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, message: 'Monthly price is required.' };
  }
  if (!PRICE_DECIMAL_REGEX.test(trimmed)) {
    return {
      valid: false,
      message: 'Enter a valid price ($0.00 or greater) with up to two decimal places (e.g. 29.99).',
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { valid: false, message: 'Price must be $0.00 or greater.' };
  }
  if (parsed > MAX_PLAN_PRICE) {
    return { valid: false, message: 'Price must not exceed 9,999,999,999.99.' };
  }
  return { valid: true, value: parsed };
}

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
