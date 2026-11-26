import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BoundedNumberInput } from '@/components/BoundedNumberInput'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ModelComparisonTable } from '@/components/ModelComparisonTable'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ShapChart } from '@/components/ShapChart'
import { ValuationBadge } from '@/components/ValuationBadge'
import {
  formatEurCompact,
  formatFeatureName,
  formatSignedEurCompact,
  formatSignedPct,
} from '@/lib/format'
import { playerPredictQueryOptions } from '@/lib/queries'
import { validateScoutSearch } from '@/lib/scout-search'
import type { ScoutSearchParams } from '@/lib/scout-search'
import { parseNumber } from '@/lib/search-params'
import type { PlayerFeatures } from '@/lib/types'

interface PlayerInspectorSearch {
  fair_margin_pct?: number
  scout?: ScoutSearchParams
}

const INSPECTOR_FEATURES: ReadonlyArray<keyof PlayerFeatures> = [
  'age',
  'height_in_cm',
  'contract_months_left',
  'position',
  'foot',
  'league_group',
  'is_top5_league',
  'total_minutes',
  'minutes_per_match',
  'goals_per_90',
  'assists_per_90',
  'yellow_cards_per_90',
  'red_cards_per_90',
  'recent_minutes',
  'recent_goals_per_90',
  'recent_assists_per_90',
  'recent_cl_appearances',
  'international_caps',
  'cl_appearances',
  'el_appearances',
  'club_national_team_players',
  'club_stadium_seats',
  'club_foreigners_pct',
]

function validatePlayerInspectorSearch(
  raw: Record<string, unknown>,
): PlayerInspectorSearch {
  const scout = raw.scout
  return {
    fair_margin_pct: parseNumber(raw.fair_margin_pct, {
      min: 0,
      max: 100,
    }),
    scout:
      scout !== null && typeof scout === 'object' && !Array.isArray(scout)
        ? validateScoutSearch(scout as Record<string, unknown>)
        : undefined,
  }
}

function PlayerInspectorPage() {
  const { playerId: rawPlayerId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const fair_margin_pct = search.fair_margin_pct ?? 10

  const playerId = Number(rawPlayerId)
  const isValidId = Number.isInteger(playerId) && playerId > 0

  const query = useQuery({
    ...playerPredictQueryOptions(isValidId ? playerId : 0, fair_margin_pct, true),
    enabled: isValidId,
  })

  if (!isValidId) {
    return (
      <div className="space-y-4">
        <div className="rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          Invalid player ID: <code>{rawPlayerId}</code>
        </div>
        <Link
          to="/"
          search={search.scout}
          className="inline-block rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-100"
        >
          ← Back to Scout Radar
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            search={search.scout}
            className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            ← Scout Radar
          </Link>
          <span className="text-xs text-neutral-500">
            Player ID #{playerId}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-700">
            <span>Fair Margin %</span>
            <BoundedNumberInput
              min={0}
              max={100}
              allowEmpty={false}
              value={fair_margin_pct}
              onCommit={(next) => {
                if (next !== undefined) {
                  void navigate({
                    search: (prev) => ({ ...prev, fair_margin_pct: next }),
                    replace: true,
                  })
                }
              }}
              className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </label>

          <Link
            to="/simulator"
            search={{ playerId }}
            className="rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Open in Simulator
          </Link>
        </div>
      </div>

      {query.isPending ? (
        <div className="rounded border border-neutral-300 bg-white p-6 text-sm text-neutral-600">
          Loading player valuation and SHAP breakdown…
        </div>
      ) : query.isError ? (
        <ErrorBanner
          title="Failed to load player prediction"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="space-y-5">
          {/* Player Heading */}
          <div className="rounded border border-neutral-300 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <PlayerAvatar
                  src={query.data.player.image_url}
                  name={query.data.player.name}
                />
                <div>
                  <h1 className="text-xl font-bold text-neutral-900">
                    {query.data.player.name}
                  </h1>
                  <p className="text-sm text-neutral-600">
                    {query.data.player.current_club_name} ·{' '}
                    {query.data.player.league_group} ·{' '}
                    {query.data.player.position} · Season{' '}
                    {query.data.player.last_season}
                  </p>
                </div>
              </div>
              {query.data.prediction.valuation ? (
                <ValuationBadge
                  status={query.data.prediction.valuation.status}
                />
              ) : null}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-neutral-300 bg-white p-3">
              <div className="text-xs uppercase text-neutral-500">
                Actual Market Value
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-neutral-900">
                {formatEurCompact(query.data.player.market_value_in_eur)}
              </div>
            </div>

            <div className="rounded border border-neutral-300 bg-white p-3">
              <div className="text-xs uppercase text-neutral-500">
                Fair Value ({query.data.prediction.best_model_name})
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-neutral-900">
                {formatEurCompact(query.data.prediction.predicted_value_eur)}
              </div>
            </div>

            <div className="rounded border border-neutral-300 bg-white p-3">
              <div className="text-xs uppercase text-neutral-500">
                Valuation Gap (€ / %)
              </div>
              {query.data.prediction.valuation ? (
                <div
                  className={`mt-1 text-xl font-bold tabular-nums ${
                    query.data.prediction.valuation.diff_eur >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {formatSignedEurCompact(
                    query.data.prediction.valuation.diff_eur,
                  )}{' '}
                  <span className="text-sm font-semibold">
                    (
                    {formatSignedPct(query.data.prediction.valuation.diff_pct)}
                    )
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-xl font-bold text-neutral-400">—</div>
              )}
            </div>

            <div className="rounded border border-neutral-300 bg-white p-3">
              <div className="text-xs uppercase text-neutral-500">
                Status (±{fair_margin_pct}% Margin)
              </div>
              <div className="mt-2">
                {query.data.prediction.valuation ? (
                  <ValuationBadge
                    status={query.data.prediction.valuation.status}
                  />
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>

          {/* 3-Model Comparison */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              3-Model Comparison
            </h2>
            <ModelComparisonTable
              comparisons={query.data.prediction.model_comparisons}
              bestModelName={query.data.prediction.best_model_name}
              actualMarketValueEur={query.data.player.market_value_in_eur}
            />
          </section>

          {/* SHAP Contributions */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Explainability (SHAP)
            </h2>
            <ShapChart shap={query.data.prediction.shap} />
          </section>

          {/* Key Stats */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Player Feature Profile (23 Model Inputs)
            </h2>
            <dl className="grid grid-cols-2 gap-2 rounded border border-neutral-300 bg-white p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {INSPECTOR_FEATURES.map((key) => {
                const rawVal = query.data.player[key]
                const displayVal =
                  key === 'is_top5_league'
                    ? rawVal === 1
                      ? 'Yes (1)'
                      : 'No (0)'
                    : typeof rawVal === 'number'
                      ? Number.isInteger(rawVal)
                        ? rawVal.toLocaleString()
                        : rawVal.toFixed(2)
                      : rawVal

                return (
                  <div
                    key={key}
                    className="rounded border border-neutral-200 bg-neutral-50 p-2"
                  >
                    <dt className="text-[11px] text-neutral-500">
                      {formatFeatureName(key)}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums text-neutral-900">
                      {displayVal}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        </div>
      )}
    </div>
  )
}

export const Route = createFileRoute('/players/$playerId')({
  validateSearch: validatePlayerInspectorSearch,
  component: PlayerInspectorPage,
})
