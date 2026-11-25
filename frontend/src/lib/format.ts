import type { ValuationStatus } from '@/lib/types'

const FEATURE_LABELS: Record<string, string> = {
  age: 'Age (yrs)',
  height_in_cm: 'Height (cm)',
  contract_months_left: 'Contract Left (mo)',
  total_minutes: 'Career Minutes',
  minutes_per_match: 'Minutes / Match',
  goals_per_90: 'Goals / 90',
  assists_per_90: 'Assists / 90',
  yellow_cards_per_90: 'Yellow Cards / 90',
  red_cards_per_90: 'Red Cards / 90',
  international_caps: 'International Caps',
  cl_appearances: 'CL Appearances',
  el_appearances: 'EL Appearances',
  is_top5_league: 'Top 5 League',
  club_national_team_players: 'Club Intl Players',
  club_stadium_seats: 'Club Stadium Seats',
  club_foreigners_pct: 'Club Foreigners (%)',
  recent_minutes: 'Recent Minutes',
  recent_goals_per_90: 'Recent Goals / 90',
  recent_assists_per_90: 'Recent Assists / 90',
  recent_cl_appearances: 'Recent CL Apps',
  position: 'Position',
  foot: 'Preferred Foot',
  league_group: 'League Group',
}

export function formatEurCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) {
    return `${sign}€${(abs / 1_000_000_000).toFixed(2)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}€${(abs / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 1_000) {
    return `${sign}€${(abs / 1_000).toFixed(0)}K`
  }
  return `${sign}€${Math.round(abs).toLocaleString()}`
}

export function formatSignedEurCompact(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  if (value > 0) {
    return `+${formatEurCompact(value)}`
  }
  return formatEurCompact(value)
}

export function formatSignedPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export function formatFeatureName(feature: string): string {
  if (feature in FEATURE_LABELS) {
    return FEATURE_LABELS[feature]
  }

  const cleaned = feature.replace(/^(num__|cat__)/, '')
  if (cleaned in FEATURE_LABELS) {
    return FEATURE_LABELS[cleaned]
  }

  return cleaned
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getValuationStatusStyles(status: ValuationStatus): string {
  switch (status) {
    case 'Undervalued':
      return 'border-emerald-300 bg-emerald-50 text-emerald-800'
    case 'Overvalued':
      return 'border-rose-300 bg-rose-50 text-rose-800'
    case 'Fairly Valued':
      return 'border-neutral-300 bg-neutral-100 text-neutral-700'
  }
}
