from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

MODELS_DIR = Path(os.getenv("MODELS_DIR", str(REPO_ROOT / "models")))
DATA_PATH = Path(
    os.getenv("DATA_PATH", str(REPO_ROOT / "dataset" / "processed" / "players_clean.csv"))
)

_default_cors = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
_cors_env = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS: list[str] = (
    [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
    if _cors_env.strip()
    else _default_cors
)
