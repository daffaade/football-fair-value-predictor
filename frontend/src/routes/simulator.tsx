import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ModelComparisonTable } from '@/components/ModelComparisonTable'
import { ShapChart } from '@/components/ShapChart'
import { ValuationBadge } from '@/components/ValuationBadge'
import {
  formatEurCompact,
  formatSignedEurCompact,
  formatSignedPct,
} from '@/lib/format'
import {
  metadataQueryOptions,
  playerPredictQueryOptions,
  predictPlayerFeatures,
} from '@/lib/queries'
import { parseNumber } from '@/lib/search-params'
import type { MetadataResponse, PlayerFeatures } from '@/lib/types'

interface SimulatorSearch {
  playerId?: number
}

type NumericFeatureKey = Exclude<
  keyof PlayerFeatures,
  'position' | 'foot' | 'league_group' | 'is_top5_league'
>

interface NumericFieldConfig {
  key: NumericFeatureKey
  label: string
  step?: number
  min?: number
  max?: number
}

interface FieldGroup {
  title: string
  fields: readonly NumericFieldConfig[]
}

const FEATURE_GROUPS: readonly FieldGroup[] = [
  {
    title: 'Profile & Contract',
    fields: [
      { key: 'age', label: 'Age (yrs)', step: 1, min: 14, max: 55 },
      { key: 'height_in_cm', label: 'Height (cm)', step: 1, min: 120, max: 230 },
      {
        key: 'contract_months_left',
        label: 'Contract Left (months)',
        step: 1,
        min: 0,
      },
    ],
  },
  {
    title: 'All-Time Career',
    fields: [
      { key: 'total_minutes', label: 'Career Minutes', step: 90, min: 0 },
      {
        key: 'minutes_per_match',
        label: 'Minutes / Match',
        step: 1,
        min: 0,
        max: 120,
      },
      { key: 'goals_per_90', label: 'Goals / 90', step: 0.05, min: 0 },
      { key: 'assists_per_90', label: 'Assists / 90', step: 0.05, min: 0 },
      {
        key: 'yellow_cards_per_90',
        label: 'Yellow Cards / 90',
        step: 0.05,
        min: 0,
      },
      { key: 'red_cards_per_90', label: 'Red Cards / 90', step: 0.01, min: 0 },
    ],
  },
  {
    title: 'Recent Form',
    fields: [
      { key: 'recent_minutes', label: 'Recent Minutes', step: 90, min: 0 },
      {
        key: 'recent_goals_per_90',
        label: 'Recent Goals / 90',
        step: 0.05,
        min: 0,
      },
      {
        key: 'recent_assists_per_90',
        label: 'Recent Assists / 90',
        step: 0.05,
        min: 0,
      },
      {
        key: 'recent_cl_appearances',
        label: 'Recent CL Apps',
        step: 1,
        min: 0,
      },
    ],
  },
  {
    title: 'International & Club',
    fields: [
      {
        key: 'international_caps',
        label: 'International Caps',
        step: 1,
        min: 0,
      },
      { key: 'cl_appearances', label: 'CL Appearances', step: 1, min: 0 },
      { key: 'el_appearances', label: 'EL Appearances', step: 1, min: 0 },
      {
        key: 'club_national_team_players',
        label: 'Club Intl Players',
        step: 1,
        min: 0,
      },
      {
        key: 'club_stadium_seats',
        label: 'Club Stadium Seats',
        step: 1000,
        min: 0,
      },
      {
        key: 'club_foreigners_pct',
        label: 'Club Foreigners (%)',
        step: 1,
        min: 0,
        max: 100,
      },
    ],
  },
]

function buildDefaultFeatures(metadata: MetadataResponse): PlayerFeatures {
  const med = (key: string, fallback: number): number => {
    const val = metadata.feature_ranges[key]?.median
    return val !== undefined && Number.isFinite(val) ? Number(val.toFixed(2)) : fallback
  }

  return {
    age: Math.round(med('age', 24)),
    height_in_cm: Math.round(med('height_in_cm', 181)),
    contract_months_left: Math.round(med('contract_months_left', 24)),
    total_minutes: Math.round(med('total_minutes', 5000)),
    minutes_per_match: med('minutes_per_match', 70),
    goals_per_90: med('goals_per_90', 0.15),
    assists_per_90: med('assists_per_90', 0.1),
    yellow_cards_per_90: med('yellow_cards_per_90', 0.15),
    red_cards_per_90: med('red_cards_per_90', 0.01),
    international_caps: Math.round(med('international_caps', 2)),
    cl_appearances: Math.round(med('cl_appearances', 0)),
    el_appearances: Math.round(med('el_appearances', 0)),
    is_top5_league: Math.round(med('is_top5_league', 1)) === 1 ? 1 : 0,
    club_national_team_players: Math.round(
      med('club_national_team_players', 5),
    ),
    club_stadium_seats: Math.round(med('club_stadium_seats', 35000)),
    club_foreigners_pct: med('club_foreigners_pct', 45),
    recent_minutes: Math.round(med('recent_minutes', 1500)),
    recent_goals_per_90: med('recent_goals_per_90', 0.15),
    recent_assists_per_90: med('recent_assists_per_90', 0.1),
    recent_cl_appearances: Math.round(med('recent_cl_appearances', 0)),
    position: metadata.categorical_options.position?.[0] ?? 'Midfield',
    foot: metadata.categorical_options.foot?.[0] ?? 'right',
    league_group:
      metadata.categorical_options.league_group?.[0] ?? 'Top-5 League',
  }
}

function extractPlayerFeatures(player: PlayerFeatures): PlayerFeatures {
  return {
    age: player.age,
    height_in_cm: player.height_in_cm,
    contract_months_left: player.contract_months_left,
    total_minutes: player.total_minutes,
    minutes_per_match: player.minutes_per_match,
    goals_per_90: player.goals_per_90,
    assists_per_90: player.assists_per_90,
    yellow_cards_per_90: player.yellow_cards_per_90,
    red_cards_per_90: player.red_cards_per_90,
    international_caps: player.international_caps,
    cl_appearances: player.cl_appearances,
    el_appearances: player.el_appearances,
    is_top5_league: player.is_top5_league,
    club_national_team_players: player.club_national_team_players,
    club_stadium_seats: player.club_stadium_seats,
    club_foreigners_pct: player.club_foreigners_pct,
    recent_minutes: player.recent_minutes,
    recent_goals_per_90: player.recent_goals_per_90,
    recent_assists_per_90: player.recent_assists_per_90,
    recent_cl_appearances: player.recent_cl_appearances,
    position: player.position,
    foot: player.foot,
    league_group: player.league_group,
  }
}

interface SimulatorFormProps {
  metadata: MetadataResponse
  initialFeatures: PlayerFeatures
  initialActualValueEur: number | null
  prefilledPlayerLabel: string | null
}

function SimulatorForm({
  metadata,
  initialFeatures,
  initialActualValueEur,
  prefilledPlayerLabel,
}: SimulatorFormProps) {
  const [features, setFeatures] = useState<PlayerFeatures>(initialFeatures)
  const [actualMarketValueInput, setActualMarketValueInput] = useState<string>(
    initialActualValueEur !== null ? String(initialActualValueEur) : '',
  )
  const [fairMarginPct, setFairMarginPct] = useState<number>(10)

  const mutation = useMutation({
    mutationFn: predictPlayerFeatures,
  })

  const updateNumeric = (key: NumericFeatureKey, rawValue: string) => {
    const parsed = Number(rawValue)
    setFeatures((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedActual = actualMarketValueInput.trim()
    const parsedActual =
      trimmedActual === '' ? null : Number(trimmedActual)

    mutation.mutate({
      ...features,
      actual_market_value_eur:
        parsedActual !== null && Number.isFinite(parsedActual)
          ? parsedActual
          : null,
      fair_margin_pct: fairMarginPct,
      include_shap: true,
    })
  }

  const handleReset = () => {
    setFeatures(initialFeatures)
    setActualMarketValueInput(
      initialActualValueEur !== null ? String(initialActualValueEur) : '',
    )
    setFairMarginPct(10)
    mutation.reset()
  }

  const positions = metadata.categorical_options.position ?? []
  const feet = metadata.categorical_options.foot ?? []
  const leagues = metadata.categorical_options.league_group ?? []

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <form onSubmit={handleSubmit} className="space-y-4 lg:col-span-7">
        {prefilledPlayerLabel ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-300 bg-neutral-100 px-3 py-2 text-xs text-neutral-800">
            <span>
              Prefilled from: <strong>{prefilledPlayerLabel}</strong>
            </span>
            <Link
              to="/simulator"
              className="underline hover:text-neutral-950"
            >
              Clear prefill (use medians)
            </Link>
          </div>
        ) : null}

        {FEATURE_GROUPS.map((group) => (
          <fieldset
            key={group.title}
            className="rounded border border-neutral-300 bg-white p-3"
          >
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
              {group.title}
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.fields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`sim-${field.key}`}
                    className="block text-[11px] font-medium text-neutral-600"
                  >
                    {field.label}
                  </label>
                  <input
                    id={`sim-${field.key}`}
                    type="number"
                    step="any"
                    min={field.min}
                    max={field.max}
                    value={features[field.key]}
                    onChange={(e) => updateNumeric(field.key, e.target.value)}
                    className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums text-neutral-900"
                  />
                </div>
              ))}

              {group.title === 'International & Club' ? (
                <div>
                  <label
                    htmlFor="sim-is_top5_league"
                    className="block text-[11px] font-medium text-neutral-600"
                  >
                    Top-5 League
                  </label>
                  <select
                    id="sim-is_top5_league"
                    value={String(features.is_top5_league)}
                    onChange={(e) =>
                      setFeatures((prev) => ({
                        ...prev,
                        is_top5_league: e.target.value === '1' ? 1 : 0,
                      }))
                    }
                    className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
                  >
                    <option value="1">1 — Yes (Top 5)</option>
                    <option value="0">0 — No</option>
                  </select>
                </div>
              ) : null}
            </div>
          </fieldset>
        ))}

        {/* Categoricals */}
        <fieldset className="rounded border border-neutral-300 bg-white p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
            Categoricals
          </legend>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="sim-position"
                className="block text-[11px] font-medium text-neutral-600"
              >
                Position
              </label>
              <select
                id="sim-position"
                value={features.position}
                onChange={(e) =>
                  setFeatures((prev) => ({ ...prev, position: e.target.value }))
                }
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              >
                {positions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sim-foot"
                className="block text-[11px] font-medium text-neutral-600"
              >
                Preferred Foot
              </label>
              <select
                id="sim-foot"
                value={features.foot}
                onChange={(e) =>
                  setFeatures((prev) => ({ ...prev, foot: e.target.value }))
                }
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              >
                {feet.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sim-league_group"
                className="block text-[11px] font-medium text-neutral-600"
              >
                League Group
              </label>
              <select
                id="sim-league_group"
                value={features.league_group}
                onChange={(e) =>
                  setFeatures((prev) => ({
                    ...prev,
                    league_group: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              >
                {leagues.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Optional Actual Value & Margin */}
        <fieldset className="rounded border border-neutral-300 bg-white p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
            Valuation Comparison (Optional)
          </legend>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sim-actual-eur"
                className="block text-[11px] font-medium text-neutral-600"
              >
                Actual Market Value (€)
              </label>
              <input
                id="sim-actual-eur"
                type="number"
                min={0}
                step="any"
                value={actualMarketValueInput}
                placeholder="Leave blank to skip gap check"
                onChange={(e) => setActualMarketValueInput(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums text-neutral-900"
              />
            </div>

            <div>
              <label
                htmlFor="sim-margin"
                className="block text-[11px] font-medium text-neutral-600"
              >
                Fair Margin (%)
              </label>
              <input
                id="sim-margin"
                type="number"
                min={0}
                max={100}
                step="any"
                value={fairMarginPct}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v >= 0 && v <= 100) {
                    setFairMarginPct(v)
                  }
                }}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums text-neutral-900"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {mutation.isPending ? 'Running Prediction…' : 'Run Prediction'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Reset Inputs
          </button>
        </div>
      </form>

      {/* Output Panel */}
      <div className="space-y-4 lg:col-span-5">
        {mutation.isError ? (
          <ErrorBanner
            title="Prediction request failed"
            error={mutation.error}
          />
        ) : null}

        {!mutation.data ? (
          <div className="rounded border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-600">
            Adjust any of the 23 player attributes on the left and click{' '}
            <strong>Run Prediction</strong> to compute Fair Market Value,
            3-model comparisons, and SHAP drivers.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded border border-neutral-300 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase text-neutral-500">
                    Predicted Fair Value ({mutation.data.best_model_name})
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
                    {formatEurCompact(mutation.data.predicted_value_eur)}
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-neutral-500">
                    log1p: {mutation.data.predicted_log_value.toFixed(4)}
                  </div>
                </div>

                {mutation.data.valuation ? (
                  <ValuationBadge status={mutation.data.valuation.status} />
                ) : null}
              </div>

              {mutation.data.valuation ? (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-neutral-200 pt-3 text-xs">
                  <div>
                    <span className="text-neutral-500">Actual Input: </span>
                    <span className="font-medium tabular-nums text-neutral-900">
                      {formatEurCompact(
                        mutation.data.valuation.actual_market_value_eur,
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Valuation Gap: </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        mutation.data.valuation.diff_eur >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {formatSignedEurCompact(mutation.data.valuation.diff_eur)}{' '}
                      ({formatSignedPct(mutation.data.valuation.diff_pct)})
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                3-Model Comparison
              </h2>
              <ModelComparisonTable
                comparisons={mutation.data.model_comparisons}
                bestModelName={mutation.data.best_model_name}
                actualMarketValueEur={
                  mutation.data.valuation?.actual_market_value_eur ?? null
                }
              />
            </div>

            <ShapChart shap={mutation.data.shap} maxItems={10} />
          </div>
        )}
      </div>
    </div>
  )
}

function SimulatorPage() {
  const { playerId } = Route.useSearch()

  const metadataQuery = useQuery(metadataQueryOptions())
  const playerQuery = useQuery({
    ...playerPredictQueryOptions(playerId ?? 0, 10, false),
    enabled: playerId !== undefined,
  })

  if (metadataQuery.isPending || (playerId !== undefined && playerQuery.isPending)) {
    return (
      <div className="rounded border border-neutral-300 bg-white p-6 text-sm text-neutral-600">
        Loading simulator metadata{playerId ? ` and player #${playerId}` : ''}…
      </div>
    )
  }

  if (metadataQuery.isError) {
    return (
      <ErrorBanner
        title="Failed to load simulator metadata"
        error={metadataQuery.error}
        onRetry={() => void metadataQuery.refetch()}
      />
    )
  }

  const metadata = metadataQuery.data
  const prefilledPlayer =
    playerId !== undefined && playerQuery.isSuccess
      ? playerQuery.data.player
      : null

  const initialFeatures = prefilledPlayer
    ? extractPlayerFeatures(prefilledPlayer)
    : buildDefaultFeatures(metadata)

  const formKey = prefilledPlayer
    ? `player-${prefilledPlayer.player_id}`
    : 'dataset-medians'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">
          What-If Fair Value Simulator
        </h1>
        <p className="text-xs text-neutral-600">
          Simulate hypothetical player profiles or tweak an existing player&apos;s
          23 features to test sensitivity across all 3 models.
        </p>
      </div>

      {playerId !== undefined && playerQuery.isError ? (
        <ErrorBanner
          title={`Could not load player #${playerId}; using dataset medians instead`}
          error={playerQuery.error}
        />
      ) : null}

      <SimulatorForm
        key={formKey}
        metadata={metadata}
        initialFeatures={initialFeatures}
        initialActualValueEur={
          prefilledPlayer ? prefilledPlayer.market_value_in_eur : null
        }
        prefilledPlayerLabel={
          prefilledPlayer
            ? `${prefilledPlayer.name} (${prefilledPlayer.current_club_name})`
            : null
        }
      />
    </div>
  )
}

export const Route = createFileRoute('/simulator')({
  validateSearch: (raw: Record<string, unknown>): SimulatorSearch => ({
    playerId: parseNumber(raw.playerId, { integer: true, min: 1 }),
  }),
  component: SimulatorPage,
})
