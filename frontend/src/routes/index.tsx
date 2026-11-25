import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BoundedNumberInput } from '@/components/BoundedNumberInput'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ValuationBadge } from '@/components/ValuationBadge'
import {
  formatEurCompact,
  formatSignedEurCompact,
  formatSignedPct,
} from '@/lib/format'
import { metadataQueryOptions, playersQueryOptions } from '@/lib/queries'
import {
  parseEnum,
  parseNumber,
  parseString,
} from '@/lib/search-params'
import type {
  PlayerSortBy,
  SortOrder,
  ValuationStatus,
} from '@/lib/types'

const PAGE_SIZE = 20

const VALUATION_STATUSES: readonly ValuationStatus[] = [
  'Undervalued',
  'Fairly Valued',
  'Overvalued',
]

const SORT_BY_OPTIONS: readonly PlayerSortBy[] = [
  'market_value_in_eur',
  'predicted_value_eur',
  'diff_eur',
  'diff_pct',
  'age',
  'name',
  'total_minutes',
]

const SORT_ORDERS: readonly SortOrder[] = ['desc', 'asc']

const SORT_LABELS: Record<PlayerSortBy, string> = {
  market_value_in_eur: 'Actual Value (€)',
  predicted_value_eur: 'Predicted Value (€)',
  diff_eur: 'Gap (€)',
  diff_pct: 'Gap (%)',
  age: 'Age',
  name: 'Name',
  total_minutes: 'Career Minutes',
}

export interface ScoutSearchParams {
  search?: string
  position?: string
  league_group?: string
  status?: ValuationStatus
  is_top5_league?: 0 | 1
  max_age?: number
  max_contract_months?: number
  fair_margin_pct?: number
  sort_by?: PlayerSortBy
  order?: SortOrder
  page?: number
}

function validateScoutSearch(raw: Record<string, unknown>): ScoutSearchParams {
  const top5Raw = parseNumber(raw.is_top5_league, {
    min: 0,
    max: 1,
    integer: true,
  })

  return {
    search: parseString(raw.search),
    position: parseString(raw.position),
    league_group: parseString(raw.league_group),
    status: parseEnum(raw.status, VALUATION_STATUSES),
    is_top5_league: top5Raw === 0 || top5Raw === 1 ? top5Raw : undefined,
    max_age: parseNumber(raw.max_age, { min: 14, max: 55 }),
    max_contract_months: parseNumber(raw.max_contract_months, { min: 0 }),
    fair_margin_pct: parseNumber(raw.fair_margin_pct, { min: 0, max: 100 }),
    sort_by: parseEnum(raw.sort_by, SORT_BY_OPTIONS),
    order: parseEnum(raw.order, SORT_ORDERS),
    page: parseNumber(raw.page, { min: 1, integer: true }),
  }
}

function ScoutRadarPage() {
  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()

  const fairMarginPct = searchParams.fair_margin_pct ?? 10
  const sortBy = searchParams.sort_by ?? 'market_value_in_eur'
  const sortOrder = searchParams.order ?? 'desc'
  const page = searchParams.page ?? 1

  const updateFilters = (patch: Partial<ScoutSearchParams>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
    })
  }

  const applyPreset = (next: Partial<ScoutSearchParams>) => {
    void navigate({
      search: {
        fair_margin_pct: fairMarginPct,
        sort_by: 'market_value_in_eur',
        order: 'desc',
        page: 1,
        ...next,
      },
    })
  }

  const metadataQuery = useQuery(metadataQueryOptions())

  const playersQuery = useQuery(
    playersQueryOptions({
      search: searchParams.search,
      position: searchParams.position,
      league_group: searchParams.league_group,
      status: searchParams.status,
      is_top5_league: searchParams.is_top5_league,
      max_age: searchParams.max_age,
      max_contract_months: searchParams.max_contract_months,
      fair_margin_pct: fairMarginPct,
      sort_by: sortBy,
      order: sortOrder,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  )

  const positions = metadataQuery.data?.categorical_options.position ?? []
  const leagues = metadataQuery.data?.categorical_options.league_group ?? []

  const total = playersQuery.data?.total ?? 0
  const items = playersQuery.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(total, page * PAGE_SIZE)

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const raw = formData.get('search')
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    updateFilters({ search: trimmed.length > 0 ? trimmed : undefined })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            Scout Radar — Fair Market Value Shortlist
          </h1>
          <p className="text-xs text-neutral-600">
            Compare actual Transfermarkt market value against model-predicted
            fair value across the dataset.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset({})}
            className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
          >
            All Players
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset({
                status: 'Undervalued',
                sort_by: 'diff_eur',
                order: 'desc',
              })
            }
            className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
          >
            Top Undervalued
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset({
                status: 'Undervalued',
                max_age: 23,
                sort_by: 'diff_pct',
                order: 'desc',
              })
            }
            className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
          >
            U-23 Hidden Gems
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset({
                status: 'Undervalued',
                max_contract_months: 12,
                sort_by: 'diff_eur',
                order: 'desc',
              })
            }
            className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
          >
            Expiring &lt; 12m
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded border border-neutral-300 bg-white p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <form onSubmit={handleSearchSubmit} className="sm:col-span-2">
            <label
              htmlFor="scout-search"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              Player / Club Search
            </label>
            <div className="mt-1 flex gap-1.5">
              <input
                key={searchParams.search ?? '__empty__'}
                id="scout-search"
                name="search"
                type="text"
                defaultValue={searchParams.search ?? ''}
                placeholder="Name or club..."
                className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900"
              />
              <button
                type="submit"
                className="rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Go
              </button>
              {searchParams.search ? (
                <button
                  type="button"
                  onClick={() => updateFilters({ search: undefined })}
                  className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </form>

          <div>
            <label
              htmlFor="scout-position"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              Position
            </label>
            <select
              id="scout-position"
              value={searchParams.position ?? ''}
              onChange={(e) =>
                updateFilters({
                  position: e.target.value || undefined,
                })
              }
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              <option value="">All Positions</option>
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="scout-league"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              League Group
            </label>
            <select
              id="scout-league"
              value={searchParams.league_group ?? ''}
              onChange={(e) =>
                updateFilters({
                  league_group: e.target.value || undefined,
                })
              }
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              <option value="">All Leagues</option>
              {leagues.map((lg) => (
                <option key={lg} value={lg}>
                  {lg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="scout-status"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              Valuation Status
            </label>
            <select
              id="scout-status"
              value={searchParams.status ?? ''}
              onChange={(e) =>
                updateFilters({
                  status: (e.target.value || undefined) as
                    | ValuationStatus
                    | undefined,
                })
              }
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              <option value="">All Statuses</option>
              {VALUATION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="scout-top5"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              Top-5 League
            </label>
            <select
              id="scout-top5"
              value={
                searchParams.is_top5_league === undefined
                  ? ''
                  : String(searchParams.is_top5_league)
              }
              onChange={(e) => {
                const val = e.target.value
                updateFilters({
                  is_top5_league:
                    val === '1' ? 1 : val === '0' ? 0 : undefined,
                })
              }}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              <option value="">All</option>
              <option value="1">Top-5 Only</option>
              <option value="0">Outside Top-5</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="scout-max-age"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              Max Age
            </label>
            <BoundedNumberInput
              id="scout-max-age"
              min={14}
              max={55}
              value={searchParams.max_age}
              placeholder="e.g. 23"
              onCommit={(next) => updateFilters({ max_age: next })}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>

          <div>
            <label
              htmlFor="scout-max-contract"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              Max Contract (mo)
            </label>
            <BoundedNumberInput
              id="scout-max-contract"
              min={0}
              value={searchParams.max_contract_months}
              placeholder="e.g. 12"
              onCommit={(next) => updateFilters({ max_contract_months: next })}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>

          <div>
            <label
              htmlFor="scout-margin"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              Fair Margin (%)
            </label>
            <BoundedNumberInput
              id="scout-margin"
              min={0}
              max={100}
              allowEmpty={false}
              value={fairMarginPct}
              onCommit={(next) => {
                if (next !== undefined) {
                  updateFilters({ fair_margin_pct: next })
                }
              }}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </div>

          <div>
            <label
              htmlFor="scout-sort"
              className="block text-[11px] font-medium uppercase text-neutral-600"
            >
              Sort By
            </label>
            <div className="mt-1 flex gap-1.5">
              <select
                id="scout-sort"
                value={sortBy}
                onChange={(e) =>
                  updateFilters({
                    sort_by: e.target.value as PlayerSortBy,
                  })
                }
                className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                {SORT_BY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {SORT_LABELS[opt]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  updateFilters({
                    order: sortOrder === 'desc' ? 'asc' : 'desc',
                  })
                }
                title="Toggle sort direction"
                className="rounded border border-neutral-300 bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-200"
              >
                {sortOrder === 'desc' ? 'Desc' : 'Asc'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      {playersQuery.isError ? (
        <ErrorBanner
          title="Failed to load players"
          error={playersQuery.error}
          onRetry={() => void playersQuery.refetch()}
        />
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-300 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-neutral-300 bg-neutral-100 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">Player / Club</th>
                <th className="px-3 py-2 font-medium">Pos</th>
                <th className="px-3 py-2 text-right font-medium">Age</th>
                <th className="px-3 py-2 text-right font-medium">Contract</th>
                <th className="px-3 py-2 text-right font-medium">Actual €</th>
                <th className="px-3 py-2 text-right font-medium">
                  Predicted €
                </th>
                <th className="px-3 py-2 text-right font-medium">Gap € / %</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {playersQuery.isPending ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-sm text-neutral-500"
                  >
                    Loading players…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-sm text-neutral-500"
                  >
                    No players match the current filters.
                  </td>
                </tr>
              ) : (
                items.map((player) => (
                  <tr
                    key={player.player_id}
                    className="hover:bg-neutral-50"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to="/players/$playerId"
                        params={{ playerId: String(player.player_id) }}
                        search={{
                          fair_margin_pct: fairMarginPct,
                        }}
                        className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
                      >
                        {player.name}
                      </Link>
                      <div className="text-xs text-neutral-500">
                        {player.current_club_name} · {player.league_group}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-neutral-700">
                      {player.position}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                      {player.age.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-700">
                      {player.contract_months_left.toFixed(0)}m
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-900">
                      {formatEurCompact(player.market_value_in_eur)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-neutral-900">
                      {formatEurCompact(player.predicted_value_eur)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        player.diff_eur >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      <div>{formatSignedEurCompact(player.diff_eur)}</div>
                      <div className="text-xs">
                        {formatSignedPct(player.diff_pct)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <ValuationBadge status={player.valuation_status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to="/players/$playerId"
                        params={{ playerId: String(player.player_id) }}
                        search={{
                          fair_margin_pct: fairMarginPct,
                        }}
                        className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            <div>
              Showing{' '}
              <span className="font-medium text-neutral-900">
                {rangeStart}–{rangeEnd}
              </span>{' '}
              of{' '}
              <span className="font-medium text-neutral-900">
                {total.toLocaleString()}
              </span>{' '}
              players
              {playersQuery.isFetching ? ' · Updating…' : ''}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateFilters({ page: Math.max(1, page - 1) })}
                className="rounded border border-neutral-300 bg-white px-2.5 py-1 font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="tabular-nums text-neutral-700">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() =>
                  updateFilters({
                    page: Math.min(totalPages, page + 1),
                  })
                }
                className="rounded border border-neutral-300 bg-white px-2.5 py-1 font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const Route = createFileRoute('/')({
  validateSearch: validateScoutSearch,
  component: ScoutRadarPage,
})
