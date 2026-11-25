from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ValuationStatus = Literal["Undervalued", "Overvalued", "Fairly Valued"]


class PlayerFeatures(BaseModel):
    age: float = Field(..., ge=14, le=55)
    height_in_cm: float = Field(..., ge=120, le=230)
    contract_months_left: float = Field(..., ge=0)
    total_minutes: float = Field(..., ge=0)
    minutes_per_match: float = Field(..., ge=0, le=120)
    goals_per_90: float = Field(..., ge=0)
    assists_per_90: float = Field(..., ge=0)
    yellow_cards_per_90: float = Field(..., ge=0)
    red_cards_per_90: float = Field(..., ge=0)
    international_caps: float = Field(..., ge=0)
    cl_appearances: float = Field(..., ge=0)
    el_appearances: float = Field(..., ge=0)
    is_top5_league: int = Field(..., ge=0, le=1)
    club_national_team_players: float = Field(..., ge=0)
    club_stadium_seats: float = Field(..., ge=0)
    club_foreigners_pct: float = Field(..., ge=0, le=100)
    recent_minutes: float = Field(..., ge=0)
    recent_goals_per_90: float = Field(..., ge=0)
    recent_assists_per_90: float = Field(..., ge=0)
    recent_cl_appearances: float = Field(..., ge=0)
    position: str
    foot: str
    league_group: str


class PredictRequest(PlayerFeatures):
    actual_market_value_eur: float | None = Field(default=None, ge=0)
    fair_margin_pct: float = Field(default=10.0, ge=0, le=100)
    include_shap: bool = True


class ModelPrediction(BaseModel):
    model_name: str
    predicted_value_eur: float
    predicted_log_value: float


class ValuationResult(BaseModel):
    actual_market_value_eur: float
    diff_eur: float
    diff_pct: float
    status: ValuationStatus
    fair_margin_pct: float


class ShapContribution(BaseModel):
    feature: str
    value: float | int | str
    shap_value: float


class ShapExplanation(BaseModel):
    base_value_log: float
    contributions: list[ShapContribution]


class PredictResponse(BaseModel):
    best_model_name: str
    predicted_value_eur: float
    predicted_log_value: float
    model_comparisons: list[ModelPrediction]
    valuation: ValuationResult | None = None
    shap: ShapExplanation | None = None


class PlayerRecord(PlayerFeatures):
    player_id: int
    name: str
    current_club_name: str
    last_season: int
    market_value_in_eur: float
    predicted_value_eur: float
    diff_eur: float
    diff_pct: float
    valuation_status: ValuationStatus
    image_url: str | None = None


class PlayerImageResponse(BaseModel):
    player_id: int
    image_url: str | None = None


class PlayersListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[PlayerRecord]


class PlayerPredictResponse(BaseModel):
    player: PlayerRecord
    prediction: PredictResponse


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    best_model: str
    total_players: int
