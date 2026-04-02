import uvicorn


if __name__ == '__main__':
    print("=" * 60)
    print("Starting Crop Recommendation Backend API")
    print("=" * 60)
    print()
    print("Backend will be accessible at:")
    print("  - http://127.0.0.1:8000 (localhost)")
    print("  - http://0.0.0.0:8000 (all network interfaces)")
    print()
    print("To use on mobile device:")
    print("  1. Find your computer's local IP")
    print("  2. Use http://YOUR_IP:8000 in mobile app")
    print()
    print("API Documentation: http://127.0.0.1:8000/docs")
    print("=" * 60)
    print()
    
    uvicorn.run('app.main:app', host='0.0.0.0', port=8000, reload=True)