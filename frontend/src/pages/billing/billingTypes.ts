/**
 * Shared types, section metadata, and Account ID validation helpers for the Billing Portal.
 */
import {
  ApiError,
  type BillingStatus,
  type BillingView,
  type ServiceTypeCode,
} from '../../types/nexus';

export type BillingSection = 'lookup' | 'payments' | 'registry';

export type BillingRow = BillingView & Record<string, unknown>;

export type BillingStatusFilter = 'ALL' | BillingStatus;

export interface BillingSectionMeta {
  title: string;
  tokenLabel: string;
  subtitle: string;
  countLabel: string;
}

export const BILLING_SECTION_META: Record<BillingSection, BillingSectionMeta> = {
  lookup: {
    title: 'Account Lookup & Invoicing',
    tokenLabel: 'Accounts',
    subtitle:
      'Look up a connected 16-character Account ID, generate its billing record, and record full manual payment.',
    countLabel: 'tracked',
  },
  payments: {
    title: 'Payment Processing',
    tokenLabel: 'Payments',
    subtitle:
      'Collect and record manual payments for billed accounts in Unpaid or Partially Paid status.',
    countLabel: 'pending',
  },
  registry: {
    title: 'Billing Accounts Registry',
    tokenLabel: 'Registry',
    subtitle:
      'Browse, filter, and refresh connected billing accounts from the live registry.',
    countLabel: 'accounts',
  },
};

export interface BillingSectionProps {
  records: BillingView[];
  selectedAccountId: string | null;
  citiesByCode: Record<string, string>;
  refreshTrigger: number;
  onRecordUpsert: (record: BillingView) => void;
  onBatchRefresh: (records: BillingView[]) => void;
  onSelectAccount: (accountId: string | null) => void;
  onCountChange: (count: number | null) => void;
  onRefreshingChange: (refreshing: boolean) => void;
}

export const BILLING_STATUS_FILTER_ITEMS: Array<{
  value: BillingStatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'NotBilled', label: 'Not Billed' },
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'PartiallyPaid', label: 'Partially Paid' },
  { value: 'Paid', label: 'Paid' },
];

export const ACCOUNT_ID_REGEX = /^[DBT][0-9]{15}$/;

export function normalizeAccountId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidAccountId(raw: string): boolean {
  const upper = normalizeAccountId(raw);
  if (!ACCOUNT_ID_REGEX.test(upper)) {
    return false;
  }
  const serial = Number(upper.slice(4));
  return Number.isInteger(serial) && serial >= 1;
}

export interface ParsedAccountMeta {
  serviceType: ServiceTypeCode;
  cityCode: string;
  connectionSerial: string;
}

export function parseAccountIdMetadata(accountId: string): ParsedAccountMeta | null {
  const upper = normalizeAccountId(accountId);
  if (!ACCOUNT_ID_REGEX.test(upper)) {
    return null;
  }
  const typeChar = upper[0];
  if (typeChar !== 'D' && typeChar !== 'B' && typeChar !== 'T') {
    return null;
  }
  return {
    serviceType: typeChar,
    cityCode: upper.slice(1, 4),
    connectionSerial: upper.slice(4),
  };
}

export function formatCityLabel(
  cityCode: string | null | undefined,
  citiesByCode: Record<string, string>,
): string {
  if (!cityCode) {
    return 'Unknown Territory';
  }
  const cityName = citiesByCode[cityCode];
  return cityName ? `${cityName} (${cityCode})` : `City ${cityCode}`;
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

export function formatBillingError(
  err: unknown,
  accountId: string,
  fallback: string,
): string {
  if (err instanceof ApiError && err.status === 404) {
    return `No connected account found for Account ID "${accountId}". Verify the 16-character ID ({D|B|T}{CityCode}{12-digit serial}) and confirm Technical has activated the connection.`;
  }
  return extractErrorMessage(err, fallback);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeCollectedAmount(
  prev: BillingView | null | undefined,
  updated: BillingView,
  requestedAmount?: number,
): number {
  if (prev && prev.invoiceId != null && prev.invoiceId === updated.invoiceId) {
    if (updated.payments && prev.payments) {
      const priorIds = new Set(prev.payments.map((p) => p.id));
      const newSum = updated.payments
        .filter((p) => !priorIds.has(p.id))
        .reduce((acc, p) => acc + p.amount, 0);
      if (newSum > 0) {
        return roundCurrency(newSum);
      }
    }
    if (updated.paidAmount !== undefined) {
      const delta = roundCurrency(updated.paidAmount - (prev.paidAmount ?? 0));
      if (delta > 0) {
        return delta;
      }
    }
  }

  const prevDue =
    prev?.dueAmount ?? (prev?.status === 'Paid' ? 0 : prev?.amount ?? 0);
  if (requestedAmount !== undefined && prevDue > 0) {
    return roundCurrency(Math.min(requestedAmount, prevDue));
  }
  if (prevDue > 0) {
    return roundCurrency(prevDue);
  }
  return roundCurrency(updated.paidAmount ?? updated.amount);
}

export function validatePositiveCurrency(
  raw: string,
  fieldLabel = 'payment amount',
): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, error: `Enter a ${fieldLabel}.` };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      value: null,
      error: `Enter a valid positive ${fieldLabel} with up to two decimal places.`,
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      value: null,
      error: `${fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1)} must be greater than $0.00.`,
    };
  }
  return { value: parsed, error: null };
}

export function validateNonNegativeCurrency(
  raw: string,
  fieldLabel: string,
): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: 0, error: null };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      value: null,
      error: `Enter a valid ${fieldLabel} ($0.00 or greater, up to two decimal places).`,
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null, error: `${fieldLabel} must be $0.00 or greater.` };
  }
  return { value: parsed, error: null };
}

export function validateNonNegativeInt(
  raw: string,
  fieldLabel: string,
): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: 0, error: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return {
      value: null,
      error: `${fieldLabel} must be a non-negative whole number.`,
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return { value: null, error: `${fieldLabel} must be 0 or greater.` };
  }
  return { value: parsed, error: null };
}
