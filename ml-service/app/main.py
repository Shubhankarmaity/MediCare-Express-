from datetime import datetime
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Ambulance ML Prediction Service", version="1.0.0")


class PredictionInput(BaseModel):
    traffic_index: float = Field(..., ge=0, le=1)
    vehicle_count: int = Field(..., ge=0)
    rain_mm: float = Field(..., ge=0)
    visibility_km: float = Field(..., ge=0)
    hour_of_day: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    current_eta_seconds: int = Field(..., ge=0)
    weather_condition: Literal["clear", "cloudy", "rain", "storm", "fog"]


class PredictionOutput(BaseModel):
    model_version: str
    predicted_delay_seconds: int
    congestion_score: float
    predicted_travel_time_seconds: int
    generated_at: datetime


def weather_penalty(condition: str) -> float:
    penalties = {
        "clear": 0.02,
        "cloudy": 0.05,
        "rain": 0.12,
        "storm": 0.25,
        "fog": 0.18,
    }
    return penalties[condition]


@app.get("/health")
def health() -> dict:
    return {"service": "ambulance-ml-service", "status": "ok"}


@app.post("/predict", response_model=PredictionOutput)
def predict(payload: PredictionInput) -> PredictionOutput:
    peak_hour_factor = 0.18 if payload.hour_of_day in {8, 9, 10, 17, 18, 19} else 0.05
    weekend_factor = 0.04 if payload.day_of_week in {5, 6} else 0.08
    weather_factor = weather_penalty(payload.weather_condition)
    visibility_factor = 0.15 if payload.visibility_km < 2 else 0.08 if payload.visibility_km < 5 else 0.02
    volume_factor = min(payload.vehicle_count / 300, 1.0) * 0.25

    congestion_score = min(
        1.0,
        (
            payload.traffic_index * 0.38
            + volume_factor
            + weather_factor
            + visibility_factor
            + peak_hour_factor
            + weekend_factor
        ),
    )

    predicted_delay_seconds = int(payload.current_eta_seconds * congestion_score * 0.55 + payload.rain_mm * 8)
    predicted_travel_time_seconds = payload.current_eta_seconds + predicted_delay_seconds

    return PredictionOutput(
        model_version="baseline-v1",
        predicted_delay_seconds=predicted_delay_seconds,
        congestion_score=round(congestion_score, 4),
        predicted_travel_time_seconds=predicted_travel_time_seconds,
        generated_at=datetime.utcnow(),
    )
