import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { RouterContext } from '@/router'

function RootLayout() {
  return (
    <div className="min-h-svh bg-slate-950 text-slate-100 antialiased">
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="text-sm font-semibold tracking-tight text-slate-100 hover:text-emerald-400"
          >
            Football Fair Value — Scouting Workbench
          </Link>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            Scaffold
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
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
    <div className="mx-auto max-w-xl rounded-xl border border-rose-500/30 bg-rose-950/30 p-6 text-slate-100">
      <h1 className="text-lg font-semibold text-rose-300">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-300">{message}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-rose-500"
        >
          Try again
        </button>
        <Link
          to="/"
          className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Back home
        </Link>
      </div>
    </div>
  )
}

function RootNotFoundComponent() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-slate-100">
      <h1 className="text-lg font-semibold text-slate-100">Page not found</h1>
      <p className="mt-2 text-sm text-slate-400">
        The requested route does not exist yet in this workbench scaffold.
      </p>
      <Link
        to="/"
        className="mt-4 inline-block rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Return to overview
      </Link>
    </div>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
})
