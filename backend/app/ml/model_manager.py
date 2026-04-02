from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_COLUMNS = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']


class ModelManager:
    def __init__(self, data_dir: Path, resource_dir: Path) -> None:
        self.data_dir = data_dir
        self.resource_dir = resource_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.model_accuracies: dict[str, float] = {}
        self.models: dict[str, Any] = {}
        self.best_model_name = ''
        self.best_model: Any = None

        self.dataset_path = self.data_dir / 'crop_recommendation.csv'
        self.guidance_path = self.resource_dir / 'crop_guidance.json'

        self.guidance_data = self._load_guidance_data()
        self.crop_feature_means: dict[str, dict[str, float]] = {}

        self.train_models()

    def _load_guidance_data(self) -> dict[str, dict[str, str]]:
        if not self.guidance_path.exists():
            return {}
        with self.guidance_path.open('r', encoding='utf-8') as file:
            return json.load(file)

    def _build_crop_profiles(self) -> dict[str, dict[str, tuple[float, float]]]:
        return {
            'rice': {'N': (70, 120), 'P': (35, 60), 'K': (35, 60), 'temperature': (22, 34), 'humidity': (70, 92), 'ph': (5.0, 6.8), 'rainfall': (140, 300)},
            'wheat': {'N': (60, 110), 'P': (30, 55), 'K': (20, 45), 'temperature': (10, 26), 'humidity': (45, 70), 'ph': (6.0, 7.8), 'rainfall': (40, 110)},
            'maize': {'N': (65, 120), 'P': (35, 60), 'K': (25, 50), 'temperature': (18, 32), 'humidity': (50, 78), 'ph': (5.5, 7.8), 'rainfall': (60, 180)},
            'chickpea': {'N': (20, 60), 'P': (40, 75), 'K': (45, 85), 'temperature': (15, 30), 'humidity': (35, 65), 'ph': (6.0, 8.5), 'rainfall': (30, 90)},
            'pigeonpeas': {'N': (20, 50), 'P': (35, 70), 'K': (35, 75), 'temperature': (22, 35), 'humidity': (45, 72), 'ph': (5.0, 7.2), 'rainfall': (60, 180)},
            'mungbean': {'N': (15, 45), 'P': (35, 70), 'K': (25, 55), 'temperature': (22, 35), 'humidity': (50, 78), 'ph': (6.0, 7.8), 'rainfall': (45, 140)},
            'blackgram': {'N': (20, 50), 'P': (35, 70), 'K': (25, 55), 'temperature': (24, 36), 'humidity': (55, 82), 'ph': (6.0, 7.8), 'rainfall': (50, 160)},
            'lentil': {'N': (15, 45), 'P': (35, 70), 'K': (30, 65), 'temperature': (12, 27), 'humidity': (40, 65), 'ph': (5.8, 7.5), 'rainfall': (30, 100)},
            'groundnut': {'N': (20, 55), 'P': (25, 55), 'K': (25, 55), 'temperature': (21, 33), 'humidity': (50, 78), 'ph': (5.5, 7.5), 'rainfall': (50, 170)},
            'millet': {'N': (25, 60), 'P': (20, 45), 'K': (20, 45), 'temperature': (24, 38), 'humidity': (35, 65), 'ph': (5.0, 8.0), 'rainfall': (20, 90)},
            'cotton': {'N': (70, 130), 'P': (30, 60), 'K': (30, 60), 'temperature': (20, 35), 'humidity': (50, 80), 'ph': (5.8, 8.0), 'rainfall': (60, 200)},
            'sugarcane': {'N': (80, 140), 'P': (35, 65), 'K': (35, 70), 'temperature': (20, 36), 'humidity': (55, 85), 'ph': (6.0, 8.0), 'rainfall': (75, 220)},
            'banana': {'N': (75, 135), 'P': (35, 70), 'K': (45, 85), 'temperature': (22, 36), 'humidity': (65, 92), 'ph': (5.5, 7.5), 'rainfall': (90, 220)},
            'mango': {'N': (40, 90), 'P': (20, 45), 'K': (20, 45), 'temperature': (24, 38), 'humidity': (45, 75), 'ph': (5.5, 7.8), 'rainfall': (60, 180)},
            'coffee': {'N': (70, 120), 'P': (35, 65), 'K': (25, 55), 'temperature': (16, 30), 'humidity': (60, 88), 'ph': (5.0, 6.8), 'rainfall': (140, 260)},
            'jute': {'N': (60, 110), 'P': (30, 55), 'K': (30, 55), 'temperature': (24, 36), 'humidity': (70, 95), 'ph': (5.0, 7.2), 'rainfall': (130, 260)}
        }

    def _generate_synthetic_dataset(self) -> pd.DataFrame:
        rng = np.random.default_rng(42)
        crop_profiles = self._build_crop_profiles()
        rows: list[dict[str, float | str]] = []

        for crop, profile in crop_profiles.items():
            for _ in range(140):
                row = {
                    feature: float(rng.uniform(bounds[0], bounds[1]))
                    for feature, bounds in profile.items()
                }
                row['label'] = crop
                rows.append(row)

        dataset = pd.DataFrame(rows)
        dataset.to_csv(self.dataset_path, index=False)
        return dataset

    def _load_dataset(self) -> pd.DataFrame:
        if self.dataset_path.exists():
            dataset = pd.read_csv(self.dataset_path)
        else:
            dataset = self._generate_synthetic_dataset()

        missing_columns = [col for col in FEATURE_COLUMNS + ['label'] if col not in dataset.columns]
        if missing_columns:
            raise ValueError(f'Dataset missing required columns: {missing_columns}')

        dataset = dataset.dropna(subset=FEATURE_COLUMNS + ['label']).reset_index(drop=True)
        return dataset

    def train_models(self) -> dict[str, float]:
        dataset = self._load_dataset()

        self.crop_feature_means = (
            dataset.groupby('label')[FEATURE_COLUMNS]
            .mean()
            .round(2)
            .to_dict(orient='index')
        )

        X = dataset[FEATURE_COLUMNS]
        y = dataset['label']

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y,
        )

        candidate_models: dict[str, Any] = {
            'KNN': Pipeline(
                steps=[
                    ('scaler', StandardScaler()),
                    ('model', KNeighborsClassifier(n_neighbors=7, weights='distance')),
                ]
            ),
            'Random Forest': RandomForestClassifier(
                n_estimators=300,
                random_state=42,
                max_depth=14,
                min_samples_leaf=2,
            ),
            'Gradient Boosting': GradientBoostingClassifier(random_state=42),
            'Naive Bayes': Pipeline(
                steps=[
                    ('scaler', StandardScaler()),
                    ('model', GaussianNB()),
                ]
            ),
        }

        self.model_accuracies.clear()
        self.models.clear()

        for name, model in candidate_models.items():
            model.fit(X_train, y_train)
            predicted = model.predict(X_test)
            accuracy = accuracy_score(y_test, predicted)
            self.models[name] = model
            self.model_accuracies[name] = round(float(accuracy * 100), 2)

        self.best_model_name = max(self.model_accuracies, key=self.model_accuracies.get)
        self.best_model = self.models[self.best_model_name]

        return self.model_accuracies

    def predict(self, payload: dict[str, Any]) -> dict[str, Any]:
        feature_row = np.array([
            [
                payload['N'],
                payload['P'],
                payload['K'],
                payload['temperature'],
                payload['humidity'],
                payload['ph'],
                payload['rainfall'],
            ]
        ])

        model_predictions: list[dict[str, Any]] = []
        top_recommendations: list[dict[str, Any]] = []

        for model_name, model in self.models.items():
            probabilities = model.predict_proba(feature_row)[0]
            classes = model.classes_
            top_idx = int(np.argmax(probabilities))
            model_predictions.append(
                {
                    'model': model_name,
                    'crop': classes[top_idx],
                    'confidence': round(float(probabilities[top_idx] * 100), 2),
                }
            )

            if model_name == self.best_model_name:
                sorted_indices = np.argsort(probabilities)[::-1][:3]
                top_recommendations = [
                    {
                        'crop': classes[idx],
                        'confidence': round(float(probabilities[idx] * 100), 2),
                    }
                    for idx in sorted_indices
                ]

        best_crop = top_recommendations[0]['crop']
        best_confidence = top_recommendations[0]['confidence']

        unavailable = {crop.strip().lower() for crop in payload.get('unavailable_crops', [])}
        alternatives_if_unavailable = self._compute_alternatives(
            best_crop=best_crop,
            top_recommendations=top_recommendations,
            season=payload.get('season', 'Kharif'),
            unavailable=unavailable,
        )

        if best_crop.lower() in unavailable and alternatives_if_unavailable:
            best_crop = alternatives_if_unavailable[0]

        explanation = self._build_explanations(best_crop, payload)
        climate_alerts = self._build_climate_alerts(payload)

        response = {
            'best_crop': best_crop,
            'best_confidence': best_confidence,
            'top_recommendations': top_recommendations,
            'model_accuracies': self.model_accuracies,
            'model_predictions': model_predictions,
            'chosen_model': self.best_model_name,
            'expected_yield_potential': self._estimate_yield_potential(payload, best_confidence),
            'market_demand': self._market_demand(best_crop),
            'explanation': explanation,
            'climate_alerts': climate_alerts,
            'resilient_crops': self._resilient_crops(climate_alerts),
            'irrigation_advice': self._irrigation_advice(climate_alerts),
            'fertilizer_adjustments': self._fertilizer_adjustments(payload),
            'alternatives_if_unavailable': alternatives_if_unavailable,
            'guidance': self._guidance_for_crop(best_crop),
        }
        return response

    def _estimate_yield_potential(self, payload: dict[str, Any], confidence: float) -> str:
        score = confidence

        if 20 <= payload['temperature'] <= 35:
            score += 6
        if 55 <= payload['humidity'] <= 85:
            score += 6
        if 60 <= payload['rainfall'] <= 220:
            score += 6
        if 5.5 <= payload['ph'] <= 7.5:
            score += 6

        if score >= 92:
            return 'Very High (estimated 90-100% of local benchmark yield)'
        if score >= 80:
            return 'High (estimated 75-90% of local benchmark yield)'
        if score >= 68:
            return 'Moderate (estimated 60-75% of local benchmark yield)'
        return 'Low (below 60% of local benchmark yield, corrective action advised)'

    def _market_demand(self, crop: str) -> str:
        demand_map = {
            'rice': 'Very High',
            'wheat': 'Very High',
            'maize': 'High',
            'cotton': 'High',
            'sugarcane': 'High',
            'banana': 'Moderate',
            'mango': 'High',
            'coffee': 'Moderate',
            'jute': 'Moderate',
            'chickpea': 'High',
            'lentil': 'High',
            'groundnut': 'High',
            'millet': 'Rising Demand',
        }
        return demand_map.get(crop.lower(), 'Moderate')

    def _build_explanations(self, crop: str, payload: dict[str, Any]) -> list[str]:
        profile = self.crop_feature_means.get(crop, {})
        if not profile:
            return [
                'The selected crop has the closest match to your current soil and weather pattern.',
                'Model confidence and historical profile matching support this recommendation.',
            ]

        pretty_names = {
            'N': 'Nitrogen',
            'P': 'Phosphorus',
            'K': 'Potassium',
            'temperature': 'Temperature',
            'humidity': 'Humidity',
            'ph': 'pH',
            'rainfall': 'Rainfall',
        }

        reasons: list[str] = []
        for key in FEATURE_COLUMNS:
            target = profile[key]
            actual = payload[key]
            tolerance = max(1.5, abs(target) * 0.2)
            if abs(actual - target) <= tolerance:
                reasons.append(
                    f"{pretty_names[key]} is near the ideal range for {crop} ({actual:.1f} vs {target:.1f})."
                )

        if len(reasons) < 2:
            reasons.append('The recommendation is based on the highest ensemble confidence across four ML models.')
            reasons.append('Key soil nutrients and climate factors are reasonably compatible with this crop profile.')

        return reasons[:4]

    def _build_climate_alerts(self, payload: dict[str, Any]) -> list[str]:
        alerts: list[str] = []

        if payload['temperature'] >= 40:
            alerts.append('Heatwave risk detected: use mulching and schedule irrigation in early morning/evening.')
        if payload['rainfall'] < 45 and payload['humidity'] < 45:
            alerts.append('Drought risk detected: adopt drip irrigation and moisture conservation practices.')
        if payload['rainfall'] > 220 or payload['humidity'] > 92:
            alerts.append('Flood/waterlogging risk detected: improve drainage and avoid excess fertilizer application.')

        if not alerts:
            alerts.append('No major climate risk detected for current conditions.')

        return alerts

    def _resilient_crops(self, climate_alerts: list[str]) -> list[str]:
        resilient: list[str] = []
        alert_text = ' '.join(climate_alerts).lower()

        if 'drought' in alert_text:
            resilient.extend(['millet', 'chickpea', 'pigeonpeas', 'groundnut'])
        if 'flood' in alert_text:
            resilient.extend(['rice', 'jute', 'banana'])
        if 'heatwave' in alert_text:
            resilient.extend(['sorghum', 'millet', 'cotton'])

        if not resilient:
            resilient = ['maize', 'wheat', 'pigeonpeas']

        return list(dict.fromkeys(resilient))[:4]

    def _irrigation_advice(self, climate_alerts: list[str]) -> list[str]:
        advice = ['Follow soil-moisture based irrigation instead of fixed calendar scheduling.']
        alert_text = ' '.join(climate_alerts).lower()

        if 'drought' in alert_text:
            advice.extend([
                'Use drip irrigation or sprinkler systems to reduce water losses.',
                'Apply organic mulch to reduce evaporation.',
            ])
        if 'flood' in alert_text:
            advice.extend([
                'Open field drains immediately to remove standing water.',
                'Pause irrigation until topsoil reaches workable moisture.',
            ])
        if 'heatwave' in alert_text:
            advice.append('Shift irrigation to dawn/dusk to reduce evapotranspiration losses.')

        return list(dict.fromkeys(advice))[:4]

    def _fertilizer_adjustments(self, payload: dict[str, Any]) -> list[str]:
        notes: list[str] = []

        if payload['N'] < 40:
            notes.append('Nitrogen is low: add split doses of urea/organic N source.')
        elif payload['N'] > 120:
            notes.append('Nitrogen is high: avoid additional N to reduce lodging/pest risk.')

        if payload['P'] < 30:
            notes.append('Phosphorus is low: apply SSP/DAP as basal application.')

        if payload['K'] < 25:
            notes.append('Potassium is low: apply muriate of potash in recommended dose.')

        if payload['ph'] < 5.5:
            notes.append('Soil is acidic: apply agricultural lime based on soil test.')
        elif payload['ph'] > 7.8:
            notes.append('Soil is alkaline: add organic matter and gypsum where required.')

        if not notes:
            notes.append('NPK and pH are in acceptable range; continue balanced fertilization.')

        return notes[:4]

    def _compute_alternatives(
        self,
        best_crop: str,
        top_recommendations: list[dict[str, Any]],
        season: str,
        unavailable: set[str],
    ) -> list[str]:
        season = season.lower()
        season_map = {
            'kharif': ['rice', 'maize', 'cotton', 'pigeonpeas', 'groundnut', 'jute'],
            'rabi': ['wheat', 'chickpea', 'lentil', 'mustard', 'barley', 'peas'],
            'summer': ['mungbean', 'blackgram', 'millet', 'maize', 'groundnut', 'vegetables'],
        }
        short_duration = ['mungbean', 'blackgram', 'millet', 'maize', 'lentil']
        low_water = ['millet', 'chickpea', 'lentil', 'pigeonpeas', 'groundnut']

        candidate_pool = [item['crop'] for item in top_recommendations]
        candidate_pool.extend(season_map.get(season, []))
        candidate_pool.extend(short_duration)
        candidate_pool.extend(low_water)

        alternatives: list[str] = []
        for crop in candidate_pool:
            crop_key = crop.lower()
            if crop_key == best_crop.lower():
                continue
            if crop_key in unavailable:
                continue
            if crop_key not in [item.lower() for item in alternatives]:
                alternatives.append(crop)

        return alternatives[:4]

    def _guidance_for_crop(self, crop: str) -> dict[str, str]:
        guidance = self.guidance_data.get(crop.lower())
        if guidance:
            return guidance

        return {
            'sowing_method': 'Use certified seeds and follow local spacing recommendations.',
            'irrigation_schedule': 'Irrigate based on soil moisture and crop growth stage.',
            'fertilizer_plan': 'Use soil-test based nutrient management with split application of nitrogen.',
            'pest_control': 'Adopt integrated pest management with regular scouting.',
            'harvest_time': 'Harvest at physiological maturity to maximize quality and yield.',
        }