import { useQuery } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useSearch,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { healthQueryOptions } from '@/lib/queries'
import type { RouterContext } from '@/router'

function HealthBadge() {
  const health = useQuery(healthQueryOptions())

  if (health.isPending) {
    return (
      <span className="rounded border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
        API: Checking…
      </span>
    )
  }

  if (health.isError) {
    return (
      <span className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800">
        API: Offline
      </span>
    )
  }

  const ready = health.data.models_loaded
  return (
    <span
      className={`rounded border px-2 py-0.5 text-xs font-medium ${
        ready
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-amber-300 bg-amber-50 text-amber-800'
      }`}
    >
      API: {ready ? 'Ready' : 'Loading'} ·{' '}
      {health.data.total_players.toLocaleString()} players
    </span>
  )
}

const navLinkBase =
  'border-b-2 border-transparent px-2 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900'
const navLinkActive =
  'border-b-2 border-neutral-900 px-2 py-3 text-sm font-semibold text-neutral-900'

function RootLayout() {
  const scoutSearch = useSearch({
    from: '/players/$playerId',
    shouldThrow: false,
    select: (search) => search.scout,
  })

  return (
    <div className="min-h-svh bg-neutral-50 text-neutral-900 antialiased">
      <header className="border-b border-neutral-300 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4">
          <div className="flex flex-wrap items-center gap-6">
            <Link
              to="/"
              search={scoutSearch}
              className="py-3 text-sm font-bold tracking-tight text-neutral-900"
            >
              Scouting Workbench
            </Link>

            <nav className="flex items-center gap-3" aria-label="Primary">
              <Link
                to="/"
                search={scoutSearch}
                activeOptions={{ exact: true }}
                className={navLinkBase}
                activeProps={{ className: navLinkActive }}
              >
                Scout Radar
              </Link>
              <Link
                to="/simulator"
                className={navLinkBase}
                activeProps={{ className: navLinkActive }}
              >
                What-If Simulator
              </Link>
              <Link
                to="/benchmarks"
                className={navLinkBase}
                activeProps={{ className: navLinkActive }}
              >
                Model Lab
              </Link>
            </nav>
          </div>

          <HealthBadge />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      {import.meta.env.DEV ? (
        <>
          <TanStackRouterDevtools position="bottom-left" />
          <ReactQueryDevtools buttonPosition="bottom-right" />
        </>
      ) : null}
    </div>
  )
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred.'

  return (
    <div className="mx-auto max-w-xl rounded border border-rose-300 bg-rose-50 p-6 text-neutral-900">
      <h1 className="text-lg font-semibold text-rose-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-rose-800">{message}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded border border-rose-400 bg-white px-3 py-1.5 text-sm font-medium text-rose-900 hover:bg-rose-100"
        >
          Try again
        </button>
        <Link
          to="/"
          className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
        >
          Back to Scout Radar
        </Link>
      </div>
    </div>
  )
}

function RootNotFoundComponent() {
  return (
    <div className="mx-auto max-w-xl rounded border border-neutral-300 bg-white p-6 text-neutral-900">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-neutral-600">
        The requested route does not exist in this workbench.
      </p>
      <Link
        to="/"
        className="mt-4 inline-block rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Return to Scout Radar
      </Link>
    </div>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
})
