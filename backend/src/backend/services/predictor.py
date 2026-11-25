from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap

from backend.schemas import (
    ModelPrediction,
    PlayerRecord,
    PlayersListResponse,
    PredictResponse,
    ShapContribution,
    ShapExplanation,
    ValuationResult,
)


def _log_to_eur(pred_log: float) -> float:
    """Convert log1p market value prediction back to EUR scale."""
    return float(np.expm1(np.clip(float(pred_log), 0.0, 20.0)))


def _to_python_scalar(value: Any) -> float | int | str:
    """Convert numpy/pandas scalar values to native Python types for JSON serialization."""
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (int, float, str)):
        return value
    return str(value)


class FairValueService:
    """Loads ML artifacts and cleaned player dataset, and serves predictions, SHAP, and player queries."""

    def __init__(self) -> None:
        self.best_model: Any = None
        self.all_models: dict[str, Any] = {}
        self.preprocessor: Any = None
        self.metadata: dict[str, Any] = {}
        self.feature_cols: list[str] = []
        self.numeric_features: list[str] = []
        self.categorical_features: list[str] = []
        self.transformed_feature_names: list[str] = []
        self.categorical_options: dict[str, list[str]] = {}
        self.feature_ranges: dict[str, dict[str, float]] = {}
        self.players_df: pd.DataFrame = pd.DataFrame()
        self.players_by_id: dict[int, dict[str, Any]] = {}
        self.shap_explainer: shap.TreeExplainer | None = None
        self.loaded: bool = False

    def load(self, models_dir: Path, data_path: Path) -> None:
        """Load serialized models, metadata, preprocessor, dataset, and initialize SHAP explainer."""
        self.best_model = joblib.load(models_dir / "best_model.joblib")
        self.all_models = joblib.load(models_dir / "all_models.joblib")
        self.preprocessor = joblib.load(models_dir / "preprocessor.joblib")
        self.metadata = joblib.load(models_dir / "model_metadata.joblib")

        self.feature_cols = list(self.metadata["feature_cols"])
        self.numeric_features = list(self.metadata["numeric_features"])
        self.categorical_features = list(self.metadata["categorical_features"])
        self.transformed_feature_names = list(self.preprocessor.get_feature_names_out())

        df = pd.read_csv(data_path)
        self.players_df = df

        self.categorical_options = {
            col: sorted(df[col].dropna().astype(str).unique().tolist())
            for col in self.categorical_features
        }
        self.feature_ranges = {
            col: {
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "median": float(df[col].median()),
            }
            for col in self.numeric_features
        }

        records = df.to_dict(orient="records")
        self.players_by_id = {
            int(row["player_id"]): self._normalize_player_dict(row)
            for row in records
        }

        estimator = self.best_model.named_steps["model"]
        self.shap_explainer = shap.TreeExplainer(estimator)
        self.loaded = True

    def _normalize_player_dict(self, row: dict[str, Any]) -> dict[str, Any]:
        """Convert a DataFrame row dict into native Python types matching PlayerRecord."""
        normalized: dict[str, Any] = {
            "player_id": int(row["player_id"]),
            "name": str(row["name"]),
            "current_club_name": str(row["current_club_name"]),
            "last_season": int(row["last_season"]),
            "market_value_in_eur": float(row["market_value_in_eur"]),
        }
        for col in self.numeric_features:
            if col == "is_top5_league":
                normalized[col] = int(row[col])
            else:
                normalized[col] = float(row[col])
        for col in self.categorical_features:
            normalized[col] = str(row[col])
        return normalized

    def _compute_valuation(
        self,
        predicted_value_eur: float,
        actual_market_value_eur: float,
        fair_margin_pct: float,
    ) -> ValuationResult:
        diff_eur = float(predicted_value_eur - actual_market_value_eur)
        diff_pct = (
            float(diff_eur / actual_market_value_eur * 100.0)
            if actual_market_value_eur > 0
            else 0.0
        )
        if abs(diff_pct) <= fair_margin_pct:
            status = "Fairly Valued"
        elif diff_eur > 0:
            status = "Undervalued"
        else:
            status = "Overvalued"

        return ValuationResult(
            actual_market_value_eur=float(actual_market_value_eur),
            diff_eur=diff_eur,
            diff_pct=diff_pct,
            status=status,
            fair_margin_pct=float(fair_margin_pct),
        )

    def _compute_shap(
        self, X_df: pd.DataFrame, features: dict[str, Any]
    ) -> ShapExplanation:
        if self.shap_explainer is None:
            raise RuntimeError("SHAP explainer is not initialized")

        X_transformed = self.preprocessor.transform(X_df)
        raw_shap = np.asarray(self.shap_explainer.shap_values(X_transformed)).reshape(-1)
        base_value = float(np.ravel(self.shap_explainer.expected_value)[0])

        aggregated: dict[str, float] = {col: 0.0 for col in self.feature_cols}
        cat_prefixes = {
            cat_col: f"cat__{cat_col}_" for cat_col in self.categorical_features
        }

        for feat_name, shap_val in zip(self.transformed_feature_names, raw_shap):
            val_float = float(shap_val)
            if feat_name.startswith("num__"):
                orig_col = feat_name[len("num__") :]
                if orig_col in aggregated:
                    aggregated[orig_col] += val_float
                continue

            matched = False
            for cat_col, prefix in cat_prefixes.items():
                if feat_name.startswith(prefix):
                    aggregated[cat_col] += val_float
                    matched = True
                    break
            if not matched and feat_name in aggregated:
                aggregated[feat_name] += val_float

        contributions = [
            ShapContribution(
                feature=col,
                value=_to_python_scalar(features[col]),
                shap_value=float(val),
            )
            for col, val in aggregated.items()
        ]
        contributions.sort(key=lambda c: abs(c.shap_value), reverse=True)

        return ShapExplanation(
            base_value_log=base_value,
            contributions=contributions,
        )

    def predict(
        self,
        features: dict[str, Any],
        actual_market_value_eur: float | None = None,
        fair_margin_pct: float = 10.0,
        include_shap: bool = True,
    ) -> PredictResponse:
        """Run inference across best_model and all_models, with optional valuation & SHAP."""
        X_df = pd.DataFrame([features])[self.feature_cols]

        best_pred_log = float(self.best_model.predict(X_df)[0])
        best_pred_eur = _log_to_eur(best_pred_log)

        comparisons: list[ModelPrediction] = []
        for model_name, pipe in self.all_models.items():
            pred_log = float(pipe.predict(X_df)[0])
            comparisons.append(
                ModelPrediction(
                    model_name=str(model_name),
                    predicted_value_eur=_log_to_eur(pred_log),
                    predicted_log_value=pred_log,
                )
            )

        valuation = (
            self._compute_valuation(
                predicted_value_eur=best_pred_eur,
                actual_market_value_eur=actual_market_value_eur,
                fair_margin_pct=fair_margin_pct,
            )
            if actual_market_value_eur is not None
            else None
        )

        shap_explanation = (
            self._compute_shap(X_df, features) if include_shap else None
        )

        return PredictResponse(
            best_model_name=str(self.metadata["best_model_name"]),
            predicted_value_eur=best_pred_eur,
            predicted_log_value=best_pred_log,
            model_comparisons=comparisons,
            valuation=valuation,
            shap=shap_explanation,
        )

    def list_players(
        self,
        search: str | None = None,
        position: str | None = None,
        league_group: str | None = None,
        sort_by: str = "market_value_in_eur",
        order: str = "desc",
        limit: int = 20,
        offset: int = 0,
    ) -> PlayersListResponse:
        """Filter, sort, and paginate players from the cleaned dataset."""
        df = self.players_df

        if search:
            q = search.strip()
            if q:
                mask = df["name"].str.contains(q, case=False, na=False) | df[
                    "current_club_name"
                ].str.contains(q, case=False, na=False)
                df = df[mask]

        if position:
            df = df[df["position"] == position]

        if league_group:
            df = df[df["league_group"] == league_group]

        ascending = order == "asc"
        df = df.sort_values(by=sort_by, ascending=ascending, kind="mergesort")

        total = int(len(df))
        page_df = df.iloc[offset : offset + limit]
        items = [
            PlayerRecord(**self._normalize_player_dict(row))
            for row in page_df.to_dict(orient="records")
        ]

        return PlayersListResponse(
            total=total,
            limit=limit,
            offset=offset,
            items=items,
        )

    def get_player(self, player_id: int) -> PlayerRecord | None:
        """Fetch a single player by player_id."""
        row = self.players_by_id.get(int(player_id))
        if row is None:
            return None
        return PlayerRecord(**row)

    def get_metadata(self) -> dict[str, Any]:
        """Return model metadata, valid categorical options, and numeric feature ranges."""
        return {
            "best_model_name": str(self.metadata["best_model_name"]),
            "numeric_features": self.numeric_features,
            "categorical_features": self.categorical_features,
            "feature_cols": self.feature_cols,
            "categorical_options": self.categorical_options,
            "feature_ranges": self.feature_ranges,
            "evaluation_metrics": self.metadata["evaluation_metrics"],
            "best_params": self.metadata["best_params"],
        }
