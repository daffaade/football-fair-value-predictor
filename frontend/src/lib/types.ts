export type ValuationStatus = 'Undervalued' | 'Overvalued' | 'Fairly Valued'

export type PlayerSortBy =
  | 'market_value_in_eur'
  | 'predicted_value_eur'
  | 'diff_eur'
  | 'diff_pct'
  | 'age'
  | 'name'
  | 'total_minutes'

export type SortOrder = 'asc' | 'desc'

export interface PlayerFeatures {
  age: number
  height_in_cm: number
  contract_months_left: number
  total_minutes: number
  minutes_per_match: number
  goals_per_90: number
  assists_per_90: number
  yellow_cards_per_90: number
  red_cards_per_90: number
  international_caps: number
  cl_appearances: number
  el_appearances: number
  is_top5_league: number
  club_national_team_players: number
  club_stadium_seats: number
  club_foreigners_pct: number
  recent_minutes: number
  recent_goals_per_90: number
  recent_assists_per_90: number
  recent_cl_appearances: number
  position: string
  foot: string
  league_group: string
}

export interface PredictRequest extends PlayerFeatures {
  actual_market_value_eur?: number | null
  fair_margin_pct?: number
  include_shap?: boolean
}

export interface ModelPrediction {
  model_name: string
  predicted_value_eur: number
  predicted_log_value: number
}

export interface ValuationResult {
  actual_market_value_eur: number
  diff_eur: number
  diff_pct: number
  status: ValuationStatus
  fair_margin_pct: number
}

export interface ShapContribution {
  feature: string
  value: number | string
  shap_value: number
}

export interface ShapExplanation {
  base_value_log: number
  contributions: ShapContribution[]
}

export interface PredictResponse {
  best_model_name: string
  predicted_value_eur: number
  predicted_log_value: number
  model_comparisons: ModelPrediction[]
  valuation: ValuationResult | null
  shap: ShapExplanation | null
}

export interface PlayerRecord extends PlayerFeatures {
  player_id: number
  name: string
  current_club_name: string
  last_season: number
  market_value_in_eur: number
  predicted_value_eur: number
  diff_eur: number
  diff_pct: number
  valuation_status: ValuationStatus
}

export interface PlayersListResponse {
  total: number
  limit: number
  offset: number
  items: PlayerRecord[]
}

export interface PlayersListParams {
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
  limit?: number
  offset?: number
}

export interface PlayerPredictResponse {
  player: PlayerRecord
  prediction: PredictResponse
}

export interface HealthResponse {
  status: string
  models_loaded: boolean
  best_model: string
  total_players: number
}

export interface FeatureRange {
  min: number
  max: number
  median: number
}

export interface EvaluationMetricRow {
  Model: string
  [metric: string]: string | number
}

export interface MetadataResponse {
  best_model_name: string
  numeric_features: string[]
  categorical_features: string[]
  feature_cols: string[]
  categorical_options: Record<string, string[]>
  feature_ranges: Record<string, FeatureRange>
  evaluation_metrics: EvaluationMetricRow[]
  best_params: Record<string, Record<string, unknown>>
}
