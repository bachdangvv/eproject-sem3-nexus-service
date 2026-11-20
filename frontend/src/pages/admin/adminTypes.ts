import {
  ApiError,
  type CityView,
  type CustomerView,
  type EmployeeView,
  type EquipmentStockView,
  type PlanView,
  type ProductView,
  type PurchaseOrderView,
  type RetailShopView,
  type ServiceTypeCode,
  type UserRole,
  type VendorPaymentMethod,
  type VendorPaymentView,
  type VendorView,
} from '../../types/nexus';

export type AdminSection =
  | 'plans'
  | 'products'
  | 'cities'
  | 'employees'
  | 'customers'
  | 'retail-shops'
  | 'vendors'
  | 'purchases'
  | 'vendor-payments';

export type PlanRow = PlanView & Record<string, unknown>;
export type ProductRow = ProductView & Record<string, unknown>;
export type CityRow = CityView & Record<string, unknown>;
export type EmployeeRow = EmployeeView & Record<string, unknown>;
export type CustomerRow = CustomerView & Record<string, unknown>;
export type RetailShopRow = RetailShopView & Record<string, unknown>;
export type VendorRow = VendorView & Record<string, unknown>;
export type PurchaseOrderRow = PurchaseOrderView & Record<string, unknown>;
export type VendorPaymentRow = VendorPaymentView & Record<string, unknown>;
export type EquipmentStockRow = EquipmentStockView & Record<string, unknown>;

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
  'retail-shops': {
    title: 'Retail Outlets & Shops',
    tokenLabel: 'Retail Shops',
    subtitle: 'Manage branch locations, city territories, customer walk-in centers, and outlet phone lines.',
    countLabel: 'outlets',
  },
  vendors: {
    title: 'Equipment Manufacturing Vendors',
    tokenLabel: 'Vendors',
    subtitle: 'Manage telecom hardware suppliers, contact representatives, and vendor procurement accounts.',
    countLabel: 'vendors',
  },
  purchases: {
    title: 'Hardware Purchase Orders',
    tokenLabel: 'Purchases',
    subtitle: 'Procure modems, routers, and installation hardware from vendors and manage inventory receiving.',
    countLabel: 'purchases',
  },
  'vendor-payments': {
    title: 'Vendor Payments & Settlements',
    tokenLabel: 'Payments',
    subtitle: 'Record and track disbursements, bank transfers, cheques, and cash payments for purchase orders.',
    countLabel: 'payments',
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

export const VENDOR_PAYMENT_METHOD_OPTIONS: Array<{ value: VendorPaymentMethod; label: string }> = [
  { value: 'BankTransfer', label: 'Bank Transfer' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Cash', label: 'Cash' },
];

export const PURCHASE_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All Orders' },
  { value: 'Ordered', label: 'Ordered' },
  { value: 'Received', label: 'Received' },
  { value: 'Cancelled', label: 'Cancelled' },
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

export function validatePositiveDecimal(raw: string, label: string):
  | { valid: true; value: number }
  | { valid: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, message: `${label} is required.` };
  }
  if (!PRICE_DECIMAL_REGEX.test(trimmed)) {
    return {
      valid: false,
      message: `Enter a valid ${label.toLowerCase()} ($0.00 or greater) with up to two decimal places.`,
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { valid: false, message: `${label} must be $0.00 or greater.` };
  }
  if (parsed > MAX_PLAN_PRICE) {
    return { valid: false, message: `${label} must not exceed 9,999,999,999.99.` };
  }
  return { valid: true, value: parsed };
}

export function validatePositiveInteger(raw: string, label: string):
  | { valid: true; value: number }
  | { valid: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, message: `${label} is required.` };
  }
  if (!/^\d+$/.test(trimmed)) {
    return {
      valid: false,
      message: `${label} must be a whole positive integer (e.g. 10).`,
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return { valid: false, message: `${label} must be 0 or greater.` };
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
