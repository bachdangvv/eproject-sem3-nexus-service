export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_SURVEY: 'PENDING_SURVEY',
  FEASIBLE: 'FEASIBLE',
  NOT_FEASIBLE: 'NOT_FEASIBLE',
  ACTIVATED: 'ACTIVATED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
}

export const ORDER_STATUS_LIST = [
  {
    code: ORDER_STATUS.DRAFT,
    label: 'Draft',
    description: 'Saved draft order awaiting submission',
    badgeClass: 'bg-slate-100 text-slate-700 ring-slate-300 border-slate-200',
    dotClass: 'bg-slate-400',
    tone: 'slate',
    step: 1,
  },
  {
    code: ORDER_STATUS.PENDING_SURVEY,
    label: 'Pending Survey',
    description: 'Awaiting ODN fiber feasibility survey',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200 border-amber-200',
    dotClass: 'bg-amber-500',
    tone: 'amber',
    step: 2,
  },
  {
    code: ORDER_STATUS.FEASIBLE,
    label: 'Feasible',
    description: 'Feasible route — ready for CPE & port assignment',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200 border-emerald-200',
    dotClass: 'bg-emerald-500',
    tone: 'green',
    step: 3,
  },
  {
    code: ORDER_STATUS.NOT_FEASIBLE,
    label: 'Not Feasible',
    description: 'ODN infrastructure unfeasible — refund eligible',
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200 border-rose-200',
    dotClass: 'bg-rose-500',
    tone: 'red',
    step: 2,
  },
  {
    code: ORDER_STATUS.ACTIVATED,
    label: 'Activated',
    description: 'Circuit commissioned with active Account ID',
    badgeClass: 'bg-indigo-50 text-indigo-700 ring-indigo-200 border-indigo-200',
    dotClass: 'bg-indigo-600',
    tone: 'green',
    step: 5,
  },
  {
    code: ORDER_STATUS.CANCELLED,
    label: 'Cancelled',
    description: 'Order cancelled and provisioning voided',
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200 border-rose-200',
    dotClass: 'bg-rose-500',
    tone: 'red',
    step: 0,
  },
  {
    code: ORDER_STATUS.REFUNDED,
    label: 'Refunded',
    description: '100% deposit refunded to subscriber',
    badgeClass: 'bg-purple-50 text-purple-700 ring-purple-200 border-purple-200',
    dotClass: 'bg-purple-500',
    tone: 'purple',
    step: 0,
  },
]

export const ORDER_STATUS_MAP = Object.fromEntries(
  ORDER_STATUS_LIST.map((item) => [item.code, item])
)

const ORDER_STATUS_ALIASES = {
  ACTIVE: ORDER_STATUS.ACTIVATED,
  COMMISSIONED: ORDER_STATUS.ACTIVATED,
  SURVEY_PASSED: ORDER_STATUS.FEASIBLE,
  SURVEY_FAILED: ORDER_STATUS.NOT_FEASIBLE,
  INFEASIBLE: ORDER_STATUS.NOT_FEASIBLE,
  UNFEASIBLE: ORDER_STATUS.NOT_FEASIBLE,
  CANCELED: ORDER_STATUS.CANCELLED,
}

export function normalizeOrderStatus(status, fallback = ORDER_STATUS.PENDING_SURVEY) {
  if (!status) return fallback
  const normalized = String(status).trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (ORDER_STATUS_MAP[normalized]) return normalized
  if (ORDER_STATUS_ALIASES[normalized]) return ORDER_STATUS_ALIASES[normalized]
  return normalized
}

export function getOrderStatusMeta(status) {
  const code = normalizeOrderStatus(status, null)
  if (code && ORDER_STATUS_MAP[code]) {
    return ORDER_STATUS_MAP[code]
  }
  return {
    code: code || ORDER_STATUS.PENDING_SURVEY,
    label: status ? String(status) : 'Unknown',
    description: '',
    badgeClass: 'bg-slate-100 text-slate-700 ring-slate-200 border-slate-200',
    dotClass: 'bg-slate-400',
    tone: 'slate',
    step: 1,
  }
}

const ORDER_MODIFICATION_LOCKED_STATUSES = new Set([
  ORDER_STATUS.ACTIVATED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED,
])

export function isOrderTerminalStatus(status) {
  const code = normalizeOrderStatus(status)
  return code === ORDER_STATUS.CANCELLED || code === ORDER_STATUS.REFUNDED
}

export function isOrderModificationLocked(status) {
  const code = normalizeOrderStatus(status)
  return ORDER_MODIFICATION_LOCKED_STATUSES.has(code)
}

export function canModifyOrCancelOrder(status) {
  return !isOrderModificationLocked(status)
}

export function getRetailEditableStatuses(currentStatus) {
  const code = normalizeOrderStatus(currentStatus)
  if (code === ORDER_STATUS.DRAFT) {
    return [ORDER_STATUS_MAP[ORDER_STATUS.DRAFT], ORDER_STATUS_MAP[ORDER_STATUS.PENDING_SURVEY]]
  }
  return []
}

export function withNormalizedOrderStatus(order) {
  if (!order) return order
  const meta = getOrderStatusMeta(order.status)
  return {
    ...order,
    status: meta.code,
    statusLabel: meta.label,
    statusColor: meta.badgeClass,
    currentStep: order.currentStep ?? meta.step,
  }
}

