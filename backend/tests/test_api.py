from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["models_loaded"] is True
    assert isinstance(data["best_model"], str) and len(data["best_model"]) > 0
    assert data["total_players"] == 10281


def test_metadata(client: TestClient) -> None:
    response = client.get("/metadata")
    assert response.status_code == 200
    data = response.json()
    expected_keys = {
        "best_model_name",
        "numeric_features",
        "categorical_features",
        "feature_cols",
        "categorical_options",
        "feature_ranges",
        "evaluation_metrics",
        "best_params",
    }
    assert expected_keys.issubset(data.keys())
    assert len(data["numeric_features"]) == 20
    assert len(data["categorical_features"]) == 3
    assert len(data["feature_cols"]) == 23
    for cat in data["categorical_features"]:
        assert len(data["categorical_options"][cat]) > 0
    for num in data["numeric_features"]:
        bounds = data["feature_ranges"][num]
        assert bounds["min"] <= bounds["median"] <= bounds["max"]


def test_players_default_and_prescored_fields(client: TestClient) -> None:
    response = client.get("/players")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 10281
    assert data["limit"] == 20
    assert data["offset"] == 0
    items = data["items"]
    assert len(items) == 20

    market_values = [item["market_value_in_eur"] for item in items]
    assert market_values == sorted(market_values, reverse=True)

    for item in items:
        assert item["predicted_value_eur"] > 0
        expected_diff_eur = item["predicted_value_eur"] - item["market_value_in_eur"]
        assert item["diff_eur"] == pytest.approx(expected_diff_eur, rel=1e-6, abs=1e-6)
        expected_diff_pct = (
            expected_diff_eur / item["market_value_in_eur"] * 100.0
            if item["market_value_in_eur"] > 0
            else 0.0
        )
        assert item["diff_pct"] == pytest.approx(expected_diff_pct, rel=1e-6, abs=1e-6)
        if abs(item["diff_pct"]) <= 10.0:
            assert item["valuation_status"] == "Fairly Valued"
        elif item["diff_eur"] > 0:
            assert item["valuation_status"] == "Undervalued"
        else:
            assert item["valuation_status"] == "Overvalued"


def test_players_status_filter_and_partition(client: TestClient) -> None:
    totals: dict[str, int] = {}
    for status in ("Undervalued", "Overvalued", "Fairly Valued"):
        resp = client.get("/players", params={"status": status, "limit": 25})
        assert resp.status_code == 200
        body = resp.json()
        totals[status] = body["total"]
        assert body["total"] > 0
        assert len(body["items"]) > 0
        for item in body["items"]:
            assert item["valuation_status"] == status
            if status == "Fairly Valued":
                assert abs(item["diff_pct"]) <= 10.0
            elif status == "Undervalued":
                assert abs(item["diff_pct"]) > 10.0 and item["diff_eur"] > 0
            else:
                assert abs(item["diff_pct"]) > 10.0 and item["diff_eur"] <= 0

    assert sum(totals.values()) == 10281


def test_players_dynamic_fair_margin_pct(client: TestClient) -> None:
    narrow = client.get(
        "/players", params={"status": "Fairly Valued", "fair_margin_pct": 5, "limit": 20}
    )
    wide = client.get(
        "/players",
        params={"status": "Fairly Valued", "fair_margin_pct": 25, "limit": 20},
    )
    assert narrow.status_code == 200
    assert wide.status_code == 200
    assert wide.json()["total"] > narrow.json()["total"]

    for item in narrow.json()["items"]:
        assert item["valuation_status"] == "Fairly Valued"
        assert abs(item["diff_pct"]) <= 5.0

    strict_undervalued = client.get(
        "/players",
        params={"status": "Undervalued", "fair_margin_pct": 25, "limit": 20},
    )
    assert strict_undervalued.status_code == 200
    assert strict_undervalued.json()["total"] > 0
    for item in strict_undervalued.json()["items"]:
        assert item["valuation_status"] == "Undervalued"
        assert item["diff_pct"] > 25.0
        assert item["diff_eur"] > 0

    zero_margin_sum = sum(
        client.get(
            "/players", params={"status": s, "fair_margin_pct": 0, "limit": 1}
        ).json()["total"]
        for s in ("Undervalued", "Overvalued", "Fairly Valued")
    )
    assert zero_margin_sum == 10281


def test_players_scout_shortlist_filters(client: TestClient) -> None:
    u23 = client.get("/players", params={"max_age": 23, "limit": 30})
    assert u23.status_code == 200
    assert u23.json()["total"] > 0
    assert all(p["age"] <= 23 for p in u23.json()["items"])

    expiring = client.get("/players", params={"max_contract_months": 12, "limit": 30})
    assert expiring.status_code == 200
    assert expiring.json()["total"] > 0
    assert all(p["contract_months_left"] <= 12 for p in expiring.json()["items"])

    expiring_zero = client.get(
        "/players", params={"max_contract_months": 0, "limit": 30}
    )
    assert expiring_zero.status_code == 200
    assert all(p["contract_months_left"] <= 0 for p in expiring_zero.json()["items"])

    top5 = client.get("/players", params={"is_top5_league": 1, "limit": 30})
    non_top5 = client.get("/players", params={"is_top5_league": 0, "limit": 30})
    assert top5.status_code == 200
    assert non_top5.status_code == 200
    assert top5.json()["total"] > 0
    assert non_top5.json()["total"] > 0
    assert top5.json()["total"] + non_top5.json()["total"] == 10281
    assert all(p["is_top5_league"] == 1 for p in top5.json()["items"])
    assert all(p["is_top5_league"] == 0 for p in non_top5.json()["items"])

    combined = client.get(
        "/players",
        params={
            "status": "Undervalued",
            "max_age": 23,
            "max_contract_months": 12,
            "is_top5_league": 1,
            "sort_by": "diff_eur",
            "order": "desc",
            "limit": 20,
        },
    )
    assert combined.status_code == 200
    items = combined.json()["items"]
    assert len(items) > 0
    diffs = [p["diff_eur"] for p in items]
    assert diffs == sorted(diffs, reverse=True)
    for p in items:
        assert p["valuation_status"] == "Undervalued"
        assert p["age"] <= 23
        assert p["contract_months_left"] <= 12
        assert p["is_top5_league"] == 1


@pytest.mark.parametrize(
    "sort_by",
    [
        "market_value_in_eur",
        "predicted_value_eur",
        "diff_eur",
        "diff_pct",
        "age",
        "name",
        "total_minutes",
    ],
)
def test_players_sorting(client: TestClient, sort_by: str) -> None:
    desc_resp = client.get(
        "/players", params={"sort_by": sort_by, "order": "desc", "limit": 25}
    )
    asc_resp = client.get(
        "/players", params={"sort_by": sort_by, "order": "asc", "limit": 25}
    )
    assert desc_resp.status_code == 200
    assert asc_resp.status_code == 200

    desc_vals = [item[sort_by] for item in desc_resp.json()["items"]]
    asc_vals = [item[sort_by] for item in asc_resp.json()["items"]]
    assert desc_vals == sorted(desc_vals, reverse=True)
    assert asc_vals == sorted(asc_vals)


def test_get_player_and_dynamic_fair_margin_without_cache_mutation(
    client: TestClient,
) -> None:
    # Find an undervalued player with diff_pct between 15% and 80% so margin 100 flips status
    resp = client.get(
        "/players",
        params={
            "status": "Undervalued",
            "fair_margin_pct": 15,
            "sort_by": "diff_pct",
            "order": "asc",
            "limit": 1,
        },
    )
    assert resp.status_code == 200
    target = resp.json()["items"][0]
    player_id = target["player_id"]
    assert 15.0 < target["diff_pct"] < 100.0

    default_resp = client.get(f"/players/{player_id}")
    assert default_resp.status_code == 200
    assert default_resp.json()["valuation_status"] == "Undervalued"

    wide_resp = client.get(f"/players/{player_id}", params={"fair_margin_pct": 100})
    assert wide_resp.status_code == 200
    assert wide_resp.json()["valuation_status"] == "Fairly Valued"

    # Re-fetch with default margin to verify cached player dict was not mutated
    after_resp = client.get(f"/players/{player_id}")
    assert after_resp.status_code == 200
    assert after_resp.json()["valuation_status"] == "Undervalued"


def test_get_player_predict_consistency(client: TestClient) -> None:
    sample_player = client.get("/players", params={"limit": 1}).json()["items"][0]
    player_id = sample_player["player_id"]

    for margin in (5.0, 10.0, 40.0):
        resp = client.get(
            f"/players/{player_id}/predict",
            params={"fair_margin_pct": margin, "include_shap": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        player = body["player"]
        prediction = body["prediction"]

        assert player["player_id"] == player_id
        assert player["predicted_value_eur"] == pytest.approx(
            prediction["predicted_value_eur"], rel=1e-5
        )
        assert prediction["valuation"] is not None
        assert player["diff_eur"] == pytest.approx(
            prediction["valuation"]["diff_eur"], rel=1e-5
        )
        assert player["diff_pct"] == pytest.approx(
            prediction["valuation"]["diff_pct"], rel=1e-5
        )
        assert player["valuation_status"] == prediction["valuation"]["status"]
        assert prediction["valuation"]["fair_margin_pct"] == pytest.approx(margin)
        assert len(prediction["model_comparisons"]) == 3
        assert prediction["shap"] is not None
        assert len(prediction["shap"]["contributions"]) == 23

    no_shap = client.get(
        f"/players/{player_id}/predict", params={"include_shap": False}
    )
    assert no_shap.status_code == 200
    assert no_shap.json()["prediction"]["shap"] is None


def test_post_predict(client: TestClient) -> None:
    metadata = client.get("/metadata").json()
    payload: dict[str, object] = {}
    for col in metadata["numeric_features"]:
        val = metadata["feature_ranges"][col]["median"]
        payload[col] = int(round(val)) if col == "is_top5_league" else val
    for col in metadata["categorical_features"]:
        payload[col] = metadata["categorical_options"][col][0]

    with_val = client.post(
        "/predict",
        json={
            **payload,
            "actual_market_value_eur": 5_000_000.0,
            "fair_margin_pct": 15.0,
            "include_shap": True,
        },
    )
    assert with_val.status_code == 200
    body = with_val.json()
    assert body["predicted_value_eur"] > 0
    assert len(body["model_comparisons"]) == 3
    assert body["valuation"] is not None
    assert body["valuation"]["actual_market_value_eur"] == 5_000_000.0
    assert body["valuation"]["fair_margin_pct"] == 15.0
    assert body["valuation"]["status"] in {
        "Undervalued",
        "Overvalued",
        "Fairly Valued",
    }
    assert body["shap"] is not None
    assert len(body["shap"]["contributions"]) == 23

    without_val = client.post(
        "/predict",
        json={**payload, "actual_market_value_eur": None, "include_shap": False},
    )
    assert without_val.status_code == 200
    body2 = without_val.json()
    assert body2["valuation"] is None
    assert body2["shap"] is None


def test_player_image_field_and_endpoint(client: TestClient) -> None:
    list_resp = client.get("/players", params={"limit": 5})
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert len(items) == 5
    for item in items:
        assert isinstance(item["image_url"], str) and item["image_url"].startswith(
            "http"
        )

    player_id = items[0]["player_id"]
    expected_url = items[0]["image_url"]

    detail_resp = client.get(f"/players/{player_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["image_url"] == expected_url

    image_resp = client.get(f"/players/{player_id}/image")
    assert image_resp.status_code == 200
    assert image_resp.json() == {
        "player_id": player_id,
        "image_url": expected_url,
    }


def test_not_found_and_validation_errors(client: TestClient) -> None:
    assert client.get("/players/999999999").status_code == 404
    assert client.get("/players/999999999/image").status_code == 404
    assert client.get("/players/999999999/predict").status_code == 404

    invalid_queries = [
        {"status": "Bargain"},
        {"is_top5_league": 2},
        {"is_top5_league": -1},
        {"max_age": 10},
        {"max_age": 60},
        {"max_contract_months": -1},
        {"fair_margin_pct": -0.1},
        {"fair_margin_pct": 100.1},
        {"sort_by": "goals_per_90"},
        {"order": "up"},
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
    ]
    for params in invalid_queries:
        resp = client.get("/players", params=params)
        assert resp.status_code == 422, f"Expected 422 for {params}, got {resp.status_code}"

    assert (
        client.get("/players/1", params={"fair_margin_pct": 120}).status_code == 422
    )
    assert client.post("/predict", json={"age": 10}).status_code == 422
