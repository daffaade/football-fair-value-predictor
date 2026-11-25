from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.config import CORS_ORIGINS, DATA_PATH, MODELS_DIR
from backend.schemas import (
    HealthResponse,
    PlayerPredictResponse,
    PlayerRecord,
    PlayersListResponse,
    PredictRequest,
    PredictResponse,
    ValuationStatus,
)
from backend.services.predictor import FairValueService


@asynccontextmanager
async def lifespan(app: FastAPI):
    service = FairValueService()
    service.load(models_dir=MODELS_DIR, data_path=DATA_PATH)
    app.state.service = service
    yield


app = FastAPI(
    title="Football Fair Market Value API",
    version="0.1.0",
    description="FastAPI backend serving Fair Market Value predictions, 3-model comparisons, valuation detection, and SHAP explainability.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_service(request: Request) -> FairValueService:
    return request.app.state.service


@app.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    service = _get_service(request)
    return HealthResponse(
        status="ok",
        models_loaded=service.loaded,
        best_model=str(service.metadata.get("best_model_name", "")),
        total_players=len(service.players_df),
    )


@app.get("/metadata")
def metadata(request: Request) -> dict[str, Any]:
    return _get_service(request).get_metadata()


@app.get("/players", response_model=PlayersListResponse)
def list_players(
    request: Request,
    search: str | None = Query(default=None),
    position: str | None = Query(default=None),
    league_group: str | None = Query(default=None),
    status: ValuationStatus | None = Query(default=None),
    is_top5_league: int | None = Query(default=None, ge=0, le=1),
    max_age: float | None = Query(default=None, ge=14, le=55),
    max_contract_months: float | None = Query(default=None, ge=0),
    fair_margin_pct: float = Query(default=10.0, ge=0, le=100),
    sort_by: Literal[
        "market_value_in_eur",
        "predicted_value_eur",
        "diff_eur",
        "diff_pct",
        "age",
        "name",
        "total_minutes",
    ] = Query(default="market_value_in_eur"),
    order: Literal["asc", "desc"] = Query(default="desc"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PlayersListResponse:
    return _get_service(request).list_players(
        search=search,
        position=position,
        league_group=league_group,
        status=status,
        is_top5_league=is_top5_league,
        max_age=max_age,
        max_contract_months=max_contract_months,
        fair_margin_pct=fair_margin_pct,
        sort_by=sort_by,
        order=order,
        limit=limit,
        offset=offset,
    )


@app.get("/players/{player_id}", response_model=PlayerRecord)
def get_player(
    player_id: int,
    request: Request,
    fair_margin_pct: float = Query(default=10.0, ge=0, le=100),
) -> PlayerRecord:
    player = _get_service(request).get_player(
        player_id, fair_margin_pct=fair_margin_pct
    )
    if player is None:
        raise HTTPException(status_code=404, detail=f"Player {player_id} not found")
    return player


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest, request: Request) -> PredictResponse:
    service = _get_service(request)
    features = payload.model_dump(include=set(service.feature_cols))
    return service.predict(
        features=features,
        actual_market_value_eur=payload.actual_market_value_eur,
        fair_margin_pct=payload.fair_margin_pct,
        include_shap=payload.include_shap,
    )


@app.get("/players/{player_id}/predict", response_model=PlayerPredictResponse)
def predict_player(
    player_id: int,
    request: Request,
    fair_margin_pct: float = Query(default=10.0, ge=0, le=100),
    include_shap: bool = Query(default=True),
) -> PlayerPredictResponse:
    service = _get_service(request)
    player = service.get_player(player_id, fair_margin_pct=fair_margin_pct)
    if player is None:
        raise HTTPException(status_code=404, detail=f"Player {player_id} not found")

    features = player.model_dump(include=set(service.feature_cols))
    prediction = service.predict(
        features=features,
        actual_market_value_eur=player.market_value_in_eur,
        fair_margin_pct=fair_margin_pct,
        include_shap=include_shap,
    )
    return PlayerPredictResponse(player=player, prediction=prediction)
