@echo off
echo ========================================
echo Starting Smart Crop Advisor Backend
echo ========================================
echo.

cd backend

if not exist .venv (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv .venv
    echo Then: .venv\Scripts\activate
    echo Then: pip install -r requirements.txt
    pause
    exit /b 1
)

echo Activating virtual environment...
call .venv\Scripts\activate

echo.
echo Starting backend server...
echo.
echo Backend will be accessible at:
echo   - http://127.0.0.1:8000 (localhost)
echo   - http://YOUR_LOCAL_IP:8000 (for mobile devices on same WiFi)
echo.
echo To find your local IP, run: ipconfig
echo Look for "IPv4 Address" under your active network adapter
echo.
echo Press Ctrl+C to stop the server
echo.

python run.py
