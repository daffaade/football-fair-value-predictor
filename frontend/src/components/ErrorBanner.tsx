import { ApiError } from '@/lib/api-client'

interface ErrorBannerProps {
  title: string
  error: unknown
  onRetry?: () => void
}

export function ErrorBanner({ title, error, onRetry }: ErrorBannerProps) {
  const detail =
    error instanceof ApiError
      ? `HTTP ${error.status}: ${error.message}`
      : error instanceof Error
        ? error.message
        : 'Unknown error'

  return (
    <div className="rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-rose-400 bg-white px-2.5 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
          >
            Retry
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-rose-800">{detail}</p>
    </div>
  )
}
