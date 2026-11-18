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
      'Collect and record full manual payments for billed accounts currently in Unpaid status.',
    countLabel: 'unpaid',
  },
  registry: {
    title: 'Billing Session Registry',
    tokenLabel: 'Registry',
    subtitle:
      'Browse, filter, and refresh connected accounts inspected or processed during this session.',
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
