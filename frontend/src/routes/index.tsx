import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { API_BASE_URL, ApiError, apiFetch } from '@/lib/api-client'

interface HealthResponse {
  status: string
  models_loaded: boolean
  best_model: string
  total_players: number
}

const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: ({ signal }) => apiFetch<HealthResponse>('/health', { signal }),
  retry: false,
})

function IndexPage() {
  const healthQuery = useQuery(healthQueryOptions)

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          Scouting Workbench Plumbing
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          TanStack Router, TanStack Query, Tailwind CSS, and typed API client
          plumbing are configured. Backend endpoint target:{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
            {API_BASE_URL}/health
          </code>
          .
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-slate-200">
            Backend Health Check
          </h2>
          <button
            type="button"
            onClick={() => void healthQuery.refetch()}
            disabled={healthQuery.isFetching}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {healthQuery.isFetching ? 'Checking…' : 'Retry'}
          </button>
        </div>

        {healthQuery.isPending ? (
          <p className="mt-4 text-sm text-slate-400">
            Connecting to FastAPI backend…
          </p>
        ) : healthQuery.isError ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/30 p-4">
            <p className="text-sm font-medium text-amber-300">
              Backend offline or unreachable
            </p>
            <p className="mt-1 text-xs text-amber-200/80">
              {healthQuery.error instanceof ApiError
                ? `HTTP ${healthQuery.error.status}: ${healthQuery.error.message}`
                : healthQuery.error.message}
            </p>
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <dt className="text-xs text-slate-400">Status</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-400">
                {healthQuery.data.status}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <dt className="text-xs text-slate-400">Models Loaded</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-100">
                {healthQuery.data.models_loaded ? 'Yes' : 'No'}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <dt className="text-xs text-slate-400">Best Model</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-100">
                {healthQuery.data.best_model || '—'}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <dt className="text-xs text-slate-400">Total Players</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-100">
                {healthQuery.data.total_players.toLocaleString()}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  )
}

export const Route = createFileRoute('/')({
  component: IndexPage,
})
