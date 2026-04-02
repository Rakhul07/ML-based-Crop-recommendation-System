from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CropInput(BaseModel):
    latitude: float
    longitude: float
    location_name: str = Field(default='Unknown')
    temperature: float
    humidity: float
    rainfall: float
    nitrogen: float = Field(alias='N')
    phosphorus: float = Field(alias='P')
    potassium: float = Field(alias='K')
    ph: float
    season: str
    image_path: Optional[str] = None
    image_base64: Optional[str] = None
    unavailable_crops: List[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class ModelPrediction(BaseModel):
    model: str
    crop: str
    confidence: float


class CropOption(BaseModel):
    crop: str
    confidence: float


class Guidance(BaseModel):
    sowing_method: str
    irrigation_schedule: str
    fertilizer_plan: str
    pest_control: str
    harvest_time: str


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    timestamp: datetime
    best_crop: str
    best_confidence: float
    top_recommendations: List[CropOption]
    model_accuracies: dict[str, float]
    model_predictions: List[ModelPrediction]
    chosen_model: str
    expected_yield_potential: str
    market_demand: str
    explanation: List[str]
    climate_alerts: List[str]
    resilient_crops: List[str]
    irrigation_advice: List[str]
    fertilizer_adjustments: List[str]
    alternatives_if_unavailable: List[str]
    guidance: Guidance


class HistoryRecord(BaseModel):
    id: int
    timestamp: datetime
    location_name: str
    input_payload: dict
    recommendation_payload: dict
