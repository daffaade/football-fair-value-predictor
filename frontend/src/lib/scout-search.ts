import { parseEnum, parseNumber, parseString } from '@/lib/search-params'
import type { PlayerSortBy, SortOrder, ValuationStatus } from '@/lib/types'

export const VALUATION_STATUSES: readonly ValuationStatus[] = [
  'Undervalued',
  'Fairly Valued',
  'Overvalued',
]

export const SORT_BY_OPTIONS: readonly PlayerSortBy[] = [
  'market_value_in_eur',
  'predicted_value_eur',
  'diff_eur',
  'diff_pct',
  'age',
  'name',
  'total_minutes',
]

const SORT_ORDERS: readonly SortOrder[] = ['desc', 'asc']

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

export function validateScoutSearch(
  raw: Record<string, unknown>,
): ScoutSearchParams {
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
