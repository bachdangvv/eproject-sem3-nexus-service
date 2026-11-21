/**
 * Shared types, section metadata, and Order ID validation helpers for the Technical Portal.
 */
import {
  ApiError,
  type OrderStatus,
  type OrderView,
  type ServiceTypeCode,
} from '../../types/nexus';

export type TechnicalSection =
  | 'assessments'
  | 'connections'
  | 'equipment'
  | 'orders'
  | 'lifecycle'
  | 'plan-changes';

export type OrderRow = OrderView & Record<string, unknown>;

export interface TechnicalSectionMeta {
  title: string;
  tokenLabel: string;
  subtitle: string;
  countLabel: string;
}

export const TECHNICAL_SECTION_META: Record<TechnicalSection, TechnicalSectionMeta> = {
  assessments: {
    title: 'Feasibility Assessments',
    tokenLabel: 'Assessments',
    subtitle:
      'Evaluate Pending orders for loop distance, server port capacity, and Dial-Up landline feasibility.',
    countLabel: 'pending',
  },
  connections: {
    title: 'Connection Activation',
    tokenLabel: 'Connections',
    subtitle:
      'Activate Feasible orders to provision subscriber lines and generate 16-character Account IDs.',
    countLabel: 'ready',
  },
  equipment: {
    title: 'Equipment & Maintenance',
    tokenLabel: 'Equipment',
    subtitle:
      'Monitor hardware stock in hand, replacement fees, and record customer-damaged equipment incidents.',
    countLabel: 'incidents',
  },
  orders: {
    title: 'Technical Orders Registry',
    tokenLabel: 'All Orders',
    subtitle:
      'Inspect all service orders across Pending, Feasible, Not Feasible, and Connected states with full audit history.',
    countLabel: 'orders',
  },
  lifecycle: {
    title: 'Subscriber Connection Lifecycle',
    tokenLabel: 'Lifecycle',
    subtitle:
      'Manage active subscriber lines, execute temporary suspensions, line reactivations, and permanent terminations with deposit refund determination.',
    countLabel: 'connections',
  },
  'plan-changes': {
    title: 'Subscriber Plan Change Reviews',
    tokenLabel: 'Plan Changes',
    subtitle:
      'Review, approve, or reject subscriber service plan migration requests and update active line tariffs.',
    countLabel: 'requests',
  },
};

export interface TechnicalSectionProps {
  refreshTrigger: number;
  onCountChange: (count: number | null) => void;
  onRefreshingChange: (refreshing: boolean) => void;
}

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

export const ORDER_CODE_REGEX = /^[DBT][0-9]{10}$/i;
export const MAX_ASSESSMENT_NOTE_LENGTH = 500;

export const SERVICE_TYPE_LABELS: Record<ServiceTypeCode, string> = {
  D: 'Dial-Up (D)',
  B: 'Broadband (B)',
  T: 'Landline (T)',
};

export function isValidOrderCode(raw: string): boolean {
  const upper = raw.trim().toUpperCase();
  if (!ORDER_CODE_REGEX.test(upper)) {
    return false;
  }
  const serial = Number(upper.slice(1));
  return Number.isInteger(serial) && serial >= 1;
}

export function requiresLandlineCheck(order: OrderView): boolean {
  return order.request.type === 'D' && !order.request.hasNexusLandline;
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
