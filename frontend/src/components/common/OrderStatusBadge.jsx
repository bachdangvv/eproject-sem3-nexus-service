import { getOrderStatusMeta } from '../../utils/orderStatus'

export default function OrderStatusBadge({ status, showDot = false, className = '' }) {
  const meta = getOrderStatusMeta(status)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${meta.badgeClass} ${className}`}
    >
      {showDot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotClass}`} />}
      <span>{meta.label}</span>
    </span>
  )
}

