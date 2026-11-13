import { Link } from 'react-router-dom'
import { Loader2, AlertTriangle, Inbox, RotateCw } from 'lucide-react'

export default function AsyncStatePanel({
  state = 'empty',
  title,
  description,
  icon: CustomIcon,
  onRetry,
  retryLabel = 'Retry',
  actionLabel,
  onAction,
  actionTo,
  compact = false,
  className = '',
}) {
  const paddingClass = compact ? 'p-6 sm:p-8' : 'p-10 md:p-12'

  if (state === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl border border-slate-200 bg-slate-50/70 ${paddingClass} text-center ${className}`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-brand-soft">
          <Loader2 size={compact ? 22 : 24} className="animate-spin" />
        </div>
        <h3 className="mt-4 text-sm sm:text-base font-extrabold text-navy">
          {title || 'Loading records...'}
        </h3>
        {description && (
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div
        role="alert"
        className={`rounded-2xl border border-rose-200 bg-rose-50/50 ${paddingClass} text-center ${className}`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <AlertTriangle size={compact ? 22 : 24} />
        </div>
        <h3 className="mt-4 text-sm sm:text-base font-extrabold text-navy">
          {title || 'Failed to load data'}
        </h3>
        {description && (
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
            {description}
          </p>
        )}
        {(onRetry || actionLabel) && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="btn-primary !px-4 !py-2 !text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw size={13} />
                <span>{retryLabel}</span>
              </button>
            )}
            {actionLabel && actionTo && (
              <Link
                to={actionTo}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                {actionLabel}
              </Link>
            )}
            {actionLabel && !actionTo && onAction && (
              <button
                type="button"
                onClick={onAction}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                {actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const EmptyIcon = CustomIcon || Inbox

  return (
    <div
      className={`rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 ${paddingClass} text-center ${className}`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-brand-soft">
        <EmptyIcon size={compact ? 22 : 24} />
      </div>
      <h3 className="mt-4 text-sm sm:text-base font-extrabold text-navy">
        {title || 'No data available'}
      </h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      {actionLabel && (actionTo || onAction) && (
        <div className="mt-5 flex justify-center">
          {actionTo ? (
            <Link
              to={actionTo}
              className="btn-primary !px-5 !py-2 !text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

