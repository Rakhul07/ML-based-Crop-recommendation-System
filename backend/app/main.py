from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .history_store import HistoryStore
from .ml.model_manager import ModelManager
from .schemas import CropInput, RecommendationResponse

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'
RESOURCE_DIR = BASE_DIR / 'resources'

model_manager = ModelManager(data_dir=DATA_DIR, resource_dir=RESOURCE_DIR)
history_store = HistoryStore(db_path=DATA_DIR / 'history.db')

app = FastAPI(title='Crop Recommendation API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/predict', response_model=RecommendationResponse)
def predict(payload: CropInput) -> RecommendationResponse:
    payload_dict = payload.model_dump(by_alias=True)
    inference = model_manager.predict(payload_dict)

    response_payload = {
        'timestamp': datetime.utcnow(),
        **inference,
    }

    serializable_payload = {
        **response_payload,
        'timestamp': response_payload['timestamp'].isoformat(),
    }

    history_store.add(
        location_name=payload.location_name,
        input_payload=payload_dict,
        recommendation_payload=serializable_payload,
    )

    return RecommendationResponse(**response_payload)


@app.get('/history')
def history(limit: int = 20) -> dict[str, object]:
    records = history_store.list(limit=limit)
    return {'items': records, 'count': len(records)}


@app.post('/retrain')
def retrain() -> dict[str, object]:
    accuracies = model_manager.train_models()
    return {
        'message': 'Models retrained successfully',
        'best_model': model_manager.best_model_name,
        'accuracies': accuracies,
    }
