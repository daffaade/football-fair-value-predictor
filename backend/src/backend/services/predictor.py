from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap

from backend.schemas import (
    ModelPrediction,
    PlayerImageResponse,
    PlayerRecord,
    PlayersListResponse,
    PredictResponse,
    ShapContribution,
    ShapExplanation,
    ValuationResult,
    ValuationStatus,
)


def _log_to_eur(pred_log: float) -> float:
    """Convert log1p market value prediction back to EUR scale."""
    return float(np.expm1(np.clip(float(pred_log), 0.0, 20.0)))


def _classify_status(
    diff_eur: float, diff_pct: float, fair_margin_pct: float
) -> ValuationStatus:
    """Classify valuation status using fair_margin_pct tolerance band."""
    if abs(diff_pct) <= fair_margin_pct:
        return "Fairly Valued"
    if diff_eur > 0:
        return "Undervalued"
    return "Overvalued"


def _to_python_scalar(value: Any) -> float | int | str:
    """Convert numpy/pandas scalar values to native Python types for JSON serialization."""
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (int, float, str)):
        return value
    return str(value)


def _normalize_image_url(value: Any) -> str | None:
    """Normalize an image URL value from pandas/CSV into a clean string or None."""
    if value is None or pd.isna(value):
        return None
    cleaned = str(value).strip()
    return cleaned if cleaned else None


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

    def load(
        self,
        models_dir: Path,
        data_path: Path,
        raw_players_path: Path | None = None,
    ) -> None:
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
        if "image_url" not in df.columns:
            if raw_players_path is not None and raw_players_path.exists():
                raw_images = pd.read_csv(
                    raw_players_path, usecols=["player_id", "image_url"]
                )
                raw_images = raw_images.dropna(subset=["player_id", "image_url"])
                raw_images = raw_images.drop_duplicates(
                    subset=["player_id"], keep="first"
                )
                image_map = dict(
                    zip(
                        raw_images["player_id"].astype(int),
                        raw_images["image_url"].astype(str),
                    )
                )
                df["image_url"] = df["player_id"].astype(int).map(image_map)
            else:
                df["image_url"] = None

        pred_logs = np.asarray(
            self.best_model.predict(df[self.feature_cols]), dtype=float
        )
        predicted_values = np.expm1(np.clip(pred_logs, 0.0, 20.0))
        actual_values = df["market_value_in_eur"].to_numpy(dtype=float)
        diff_eur = predicted_values - actual_values
        with np.errstate(divide="ignore", invalid="ignore"):
            diff_pct = np.where(
                actual_values > 0, diff_eur / actual_values * 100.0, 0.0
            )

        df["predicted_value_eur"] = predicted_values
        df["diff_eur"] = diff_eur
        df["diff_pct"] = diff_pct
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

    def _normalize_player_dict(
        self, row: dict[str, Any], fair_margin_pct: float = 10.0
    ) -> dict[str, Any]:
        """Convert a DataFrame row dict into native Python types matching PlayerRecord."""
        predicted_value_eur = float(row["predicted_value_eur"])
        diff_eur = float(row["diff_eur"])
        diff_pct = float(row["diff_pct"])
        normalized: dict[str, Any] = {
            "player_id": int(row["player_id"]),
            "name": str(row["name"]),
            "current_club_name": str(row["current_club_name"]),
            "last_season": int(row["last_season"]),
            "market_value_in_eur": float(row["market_value_in_eur"]),
            "predicted_value_eur": predicted_value_eur,
            "diff_eur": diff_eur,
            "diff_pct": diff_pct,
            "valuation_status": _classify_status(diff_eur, diff_pct, fair_margin_pct),
            "image_url": _normalize_image_url(row.get("image_url")),
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
        status = _classify_status(diff_eur, diff_pct, fair_margin_pct)

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
        status: str | None = None,
        is_top5_league: int | None = None,
        max_age: float | None = None,
        max_contract_months: float | None = None,
        fair_margin_pct: float = 10.0,
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
                mask = df["name"].str.contains(
                    q, case=False, na=False, regex=False
                ) | df["current_club_name"].str.contains(
                    q, case=False, na=False, regex=False
                )
                df = df[mask]

        if position:
            df = df[df["position"] == position]

        if league_group:
            df = df[df["league_group"] == league_group]

        if is_top5_league is not None:
            df = df[df["is_top5_league"] == is_top5_league]

        if max_age is not None:
            df = df[df["age"] <= max_age]

        if max_contract_months is not None:
            df = df[df["contract_months_left"] <= max_contract_months]

        if status is not None:
            is_fair = df["diff_pct"].abs() <= fair_margin_pct
            if status == "Fairly Valued":
                df = df[is_fair]
            elif status == "Undervalued":
                df = df[(~is_fair) & (df["diff_eur"] > 0)]
            elif status == "Overvalued":
                df = df[(~is_fair) & (df["diff_eur"] <= 0)]
            else:
                raise ValueError(f"Unsupported valuation status filter: {status}")

        ascending = order == "asc"
        df = df.sort_values(by=sort_by, ascending=ascending, kind="mergesort")

        total = int(len(df))
        page_df = df.iloc[offset : offset + limit]
        items = [
            PlayerRecord(
                **self._normalize_player_dict(row, fair_margin_pct=fair_margin_pct)
            )
            for row in page_df.to_dict(orient="records")
        ]

        return PlayersListResponse(
            total=total,
            limit=limit,
            offset=offset,
            items=items,
        )

    def get_player(
        self, player_id: int, fair_margin_pct: float = 10.0
    ) -> PlayerRecord | None:
        """Fetch a single player by player_id with valuation_status for fair_margin_pct."""
        row = self.players_by_id.get(int(player_id))
        if row is None:
            return None
        status = _classify_status(
            diff_eur=row["diff_eur"],
            diff_pct=row["diff_pct"],
            fair_margin_pct=fair_margin_pct,
        )
        return PlayerRecord(**{**row, "valuation_status": status})

    def get_player_image(self, player_id: int) -> PlayerImageResponse | None:
        """Fetch a player's image URL by player_id."""
        row = self.players_by_id.get(int(player_id))
        if row is None:
            return None
        return PlayerImageResponse(
            player_id=row["player_id"],
            image_url=row["image_url"],
        )

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
