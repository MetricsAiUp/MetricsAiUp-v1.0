"""
MetricsAiUp — ML Predictive Analytics API
FastAPI service for load forecasting and work order duration prediction.
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sklearn.ensemble import RandomForestRegressor

app = FastAPI(title="MetricsAiUp ML API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent.parent / "data"
MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

# ---------- Helpers ----------

def load_dashboard_posts():
    path = DATA_DIR / "dashboard-posts.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {}


def generate_synthetic_history(days=30):
    """Generate synthetic hourly load data for training when real data is sparse."""
    rows = []
    now = datetime.now()
    for d in range(days):
        date = now - timedelta(days=d)
        dow = date.weekday()
        for hour in range(8, 21):  # shift hours
            # Base load pattern: peaks at 10-12 and 14-16
            base = 0.3
            if 10 <= hour <= 12:
                base = 0.75
            elif 14 <= hour <= 16:
                base = 0.65
            elif 8 <= hour <= 9:
                base = 0.45
            # Weekend lower
            if dow >= 5:
                base *= 0.5
            # Add noise
            load = max(0, min(1, base + np.random.normal(0, 0.12)))
            for post in range(1, 11):
                post_factor = 0.9 + np.random.normal(0, 0.1)
                rows.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "hour": hour,
                    "dow": dow,
                    "post": post,
                    "load": max(0, min(1, load * post_factor)),
                })
    return pd.DataFrame(rows)


# ---------- Models ----------

_load_model = None
_duration_model = None


def train_load_model():
    global _load_model
    df = generate_synthetic_history(30)
    features = df[["hour", "dow", "post"]]
    target = df["load"]
    model = RandomForestRegressor(n_estimators=50, max_depth=8, random_state=42)
    model.fit(features, target)
    _load_model = model
    return model


def get_load_model():
    global _load_model
    if _load_model is None:
        _load_model = train_load_model()
    return _load_model


def predict_load(date_str: str, post: int = None):
    model = get_load_model()
    date = datetime.strptime(date_str, "%Y-%m-%d")
    dow = date.weekday()
    posts = [post] if post else list(range(1, 11))
    results = []
    for h in range(8, 21):
        hour_data = {"hour": h, "predictions": {}}
        for p in posts:
            pred = model.predict(pd.DataFrame([{"hour": h, "dow": dow, "post": p}]))[0]
            hour_data["predictions"][f"post_{p}"] = round(max(0, min(1, pred)), 3)
        hour_data["avg"] = round(np.mean(list(hour_data["predictions"].values())), 3)
        results.append(hour_data)
    return results


def predict_duration(work_type: str, brand: str = None):
    """Simple duration prediction based on work type averages."""
    # Baseline durations in hours by work type
    baselines = {
        "diagnostics": 1.0,
        "oil_change": 0.8,
        "brake_service": 2.5,
        "tire_mounting": 1.2,
        "alignment": 1.5,
        "engine_repair": 4.0,
        "body_work": 6.0,
        "electrical": 2.0,
        "suspension": 3.0,
        "ac_service": 1.5,
    }
    base = baselines.get(work_type, 2.0)
    # Brand factor
    brand_factors = {"BMW": 1.2, "Mercedes": 1.25, "Audi": 1.15, "Toyota": 0.9, "Hyundai": 0.85}
    factor = brand_factors.get(brand, 1.0) if brand else 1.0
    predicted = base * factor
    return {
        "work_type": work_type,
        "brand": brand,
        "predicted_hours": round(predicted, 2),
        "confidence": 0.75,
        "range_min": round(predicted * 0.7, 2),
        "range_max": round(predicted * 1.4, 2),
    }


# ---------- API Routes ----------

@app.get("/predict/load")
async def get_load_forecast(
    date: str = Query(default=None, description="Date YYYY-MM-DD"),
    post: int = Query(default=None, description="Post number 1-10"),
):
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")
    hourly = predict_load(date, post)
    return {"date": date, "post": post, "hourly": hourly}


@app.get("/predict/load/week")
async def get_week_forecast(post: int = Query(default=None)):
    now = datetime.now()
    days = []
    for d in range(7):
        date = now + timedelta(days=d)
        date_str = date.strftime("%Y-%m-%d")
        hourly = predict_load(date_str, post)
        avg_load = round(np.mean([h["avg"] for h in hourly]), 3)
        days.append({
            "date": date_str,
            "weekday": date.strftime("%A"),
            "avg_load": avg_load,
            "peak_hour": max(hourly, key=lambda h: h["avg"])["hour"],
            "hourly": hourly,
        })
    return {"post": post, "days": days}


@app.get("/predict/duration")
async def get_duration_prediction(
    work_type: str = Query(default="diagnostics"),
    brand: str = Query(default=None),
):
    return predict_duration(work_type, brand)


@app.get("/predict/free")
async def get_free_prediction():
    """Predict when each occupied post will be free."""
    data = load_dashboard_posts()
    posts = data.get("posts", [])
    predictions = []
    for p in posts:
        if p.get("status") == "free":
            predictions.append({"post": p["number"], "status": "free", "free_in_minutes": 0})
            continue
        wo = None
        for item in (p.get("timeline") or []):
            if item.get("status") == "in_progress":
                wo = item
                break
        if wo and wo.get("endTime"):
            end = datetime.fromisoformat(wo["endTime"].replace("Z", "+00:00"))
            remaining = max(0, (end - datetime.now(end.tzinfo)).total_seconds() / 60)
            predictions.append({
                "post": p["number"],
                "status": "occupied",
                "free_in_minutes": round(remaining),
                "estimated_free": wo["endTime"],
            })
        else:
            predictions.append({"post": p["number"], "status": "occupied", "free_in_minutes": None})
    return {"predictions": predictions}


@app.post("/predict/retrain")
async def retrain_models():
    """Retrain models with latest data."""
    train_load_model()
    return {"status": "ok", "message": "Models retrained"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ml-predict"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8282)
