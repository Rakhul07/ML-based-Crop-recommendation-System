# ML-Based Crop Recommendation Web App (React + FastAPI)

A complete agriculture assistant application for farmers to select suitable crops based on soil, weather, season, and location.

## What this project includes

- React + Vite web frontend (responsive).
- FastAPI backend with ML model training/inference.
- 4 ML algorithms: KNN, Random Forest, Gradient Boosting, Naive Bayes.
- Model accuracy comparison and best-model selection.
- Top-3 crop recommendations with confidence.
- Climate risk alerts (drought/flood/heatwave).
- Crop substitutes, resilient crop suggestions, and crop management guidance.
- Weather integration (current + 7-day forecast via Open-Meteo API).
- GPS auto location + manual location selection.
- Camera/gallery image upload.
- Multilingual UI (English, Hindi, Tamil, Telugu, Malayalam, Kannada).
- Offline history storage in browser (localStorage).

## Project structure

```text
Mini-Project/
  src/
    App.jsx
    main.jsx
    styles.css
  index.html
  vite.config.js
  package.json
  backend/
    app/
      ml/model_manager.py
      main.py
      schemas.py
      history_store.py
      resources/crop_guidance.json
    requirements.txt
    run.py
```

## Prerequisites

1. Node.js 18+ (includes npm)
2. Chrome or Edge
3. Python 3.10-3.12

## Setup and run

### 1) Install frontend dependencies

```powershell
cmd /c npm install
```

### 3) Start backend API

Use script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_backend.ps1
```

Or manual:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Backend starts at `http://127.0.0.1:8000`.

### 4) Run app on Web (Chrome)

Open a new terminal at project root:

```powershell
cmd /c npm run dev
```

Vite dev server will print the local URL.

If your backend is running on a different host, set:

```powershell
$env:VITE_BACKEND_BASE_URL = "http://127.0.0.1:8000"
cmd /c npm run dev
```

## Main API endpoints

- `GET /health`
- `POST /predict`
- `GET /history?limit=20`
- `POST /retrain`

## Request format (`/predict`)

```json
{
  "latitude": 28.61,
  "longitude": 77.20,
  "location_name": "Delhi",
  "temperature": 31.2,
  "humidity": 64.0,
  "rainfall": 82.4,
  "N": 90,
  "P": 42,
  "K": 43,
  "ph": 6.4,
  "season": "Kharif",
  "image_path": "optional/local/path.jpg",
  "unavailable_crops": ["rice"]
}
```

## Notes

- Weather is fetched from Open-Meteo API (no API key required).
- If no crop dataset exists, backend auto-generates a synthetic dataset with realistic crop profiles and trains models.
- Recommendations are stored offline in browser localStorage.
- Use Python 3.10-3.12 for backend package compatibility (scikit-learn/numpy wheels).

## Optional improvements

1. Replace synthetic dataset with your real local/regional dataset in `backend/app/data/crop_recommendation.csv`.
2. Add voice guidance in regional languages.
3. Add mandi/market API for live price-based crop prioritization.
4. Deploy backend on cloud and set `BACKEND_BASE_URL` accordingly.
