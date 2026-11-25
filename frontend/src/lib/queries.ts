import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import type { QueryParams } from '@/lib/api-client'
import type {
  HealthResponse,
  MetadataResponse,
  PlayerImageResponse,
  PlayerPredictResponse,
  PlayersListParams,
  PlayersListResponse,
  PredictRequest,
  PredictResponse,
} from '@/lib/types'

export function healthQueryOptions() {
  return queryOptions({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiFetch<HealthResponse>('/health', { signal }),
    retry: false,
  })
}

export function metadataQueryOptions() {
  return queryOptions({
    queryKey: ['metadata'],
    queryFn: ({ signal }) =>
      apiFetch<MetadataResponse>('/metadata', { signal }),
    staleTime: 10 * 60_000,
  })
}

function toPlayersQueryParams(params: PlayersListParams): QueryParams {
  return {
    search: params.search,
    position: params.position,
    league_group: params.league_group,
    status: params.status,
    is_top5_league: params.is_top5_league,
    max_age: params.max_age,
    max_contract_months: params.max_contract_months,
    fair_margin_pct: params.fair_margin_pct,
    sort_by: params.sort_by,
    order: params.order,
    limit: params.limit,
    offset: params.offset,
  }
}

export function playersQueryOptions(params: PlayersListParams) {
  return queryOptions({
    queryKey: ['players', params],
    queryFn: ({ signal }) =>
      apiFetch<PlayersListResponse>('/players', {
        params: toPlayersQueryParams(params),
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

export function playerPredictQueryOptions(
  playerId: number,
  fairMarginPct = 10,
  includeShap = true,
) {
  return queryOptions({
    queryKey: ['player-predict', playerId, fairMarginPct, includeShap],
    queryFn: ({ signal }) =>
      apiFetch<PlayerPredictResponse>(`/players/${playerId}/predict`, {
        params: {
          fair_margin_pct: fairMarginPct,
          include_shap: includeShap,
        },
        signal,
      }),
  })
}

export function playerImageQueryOptions(playerId: number) {
  return queryOptions({
    queryKey: ['player-image', playerId],
    queryFn: ({ signal }) =>
      apiFetch<PlayerImageResponse>(`/players/${playerId}/image`, { signal }),
    staleTime: 10 * 60_000,
  })
}

export function predictPlayerFeatures(
  payload: PredictRequest,
): Promise<PredictResponse> {
  return apiFetch<PredictResponse>('/predict', {
    method: 'POST',
    body: payload,
  })
}
