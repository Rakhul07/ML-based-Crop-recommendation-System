import socket
import json
import os
import re
from pathlib import Path

def get_local_ip():
    """Get the local network IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception as e:
        print(f"Could not detect local IP: {e}")
        return "192.168.1.100"

def update_frontend_config(backend_url):
    """Update the frontend App.jsx with the backend URL"""
    app_jsx_path = Path(__file__).parent / 'src' / 'App.jsx'
    
    if not app_jsx_path.exists():
        print(f"Error: {app_jsx_path} not found!")
        return False
    
    try:
        with open(app_jsx_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        pattern = r"const API_BASE = import\.meta\.env\.VITE_BACKEND_BASE_URL \|\| '[^']*';"
        replacement = f"const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL || '{backend_url}';"
        
        new_content = re.sub(pattern, replacement, content)
        
        if new_content == content:
            print("Warning: Could not find API_BASE line to replace")
            return False
        
        with open(app_jsx_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✓ Updated App.jsx with backend URL: {backend_url}")
        return True
    
    except Exception as e:
        print(f"Error updating App.jsx: {e}")
        return False

def create_env_file(backend_url):
    """Create .env file for development"""
    env_path = Path(__file__).parent / '.env'
    
    try:
        with open(env_path, 'w') as f:
            f.write(f"VITE_BACKEND_BASE_URL={backend_url}\n")
        print(f"✓ Created .env file with backend URL: {backend_url}")
        return True
    except Exception as e:
        print(f"Error creating .env file: {e}")
        return False

def main():
    print("=" * 60)
    print("Backend URL Configuration for Mobile APK")
    print("=" * 60)
    print()
    
    print("Choose configuration mode:")
    print()
    print("1. Auto-detect local network IP (for testing on same WiFi)")
    print("2. Enter deployed backend URL (for production)")
    print("3. Use ngrok URL (for testing with tunneling)")
    print("4. Keep localhost (for web development only)")
    print()
    
    choice = input("Enter choice (1-4): ").strip()
    
    backend_url = None
    
    if choice == "1":
        local_ip = get_local_ip()
        backend_url = f"http://{local_ip}:8000"
        print(f"\n✓ Detected local IP: {local_ip}")
        print(f"Backend URL will be: {backend_url}")
        print("\nIMPORTANT: Start backend with:")
        print(f"  cd backend")
        print(f"  .venv\\Scripts\\activate")
        print(f"  python run.py")
        print(f"\nMake sure your phone and computer are on the same WiFi network!")
        
    elif choice == "2":
        backend_url = input("\nEnter your deployed backend URL (e.g., https://api.example.com): ").strip()
        if not backend_url:
            print("Error: URL cannot be empty")
            return
        print(f"\n✓ Using deployed backend: {backend_url}")
        
    elif choice == "3":
        print("\nIMPORTANT: First start ngrok in a separate terminal:")
        print("  1. cd backend")
        print("  2. .venv\\Scripts\\activate")
        print("  3. python run.py")
        print("  4. In new terminal: ngrok http 8000")
        print()
        backend_url = input("Enter your ngrok URL (e.g., https://abc123.ngrok.io): ").strip()
        if not backend_url:
            print("Error: URL cannot be empty")
            return
        print(f"\n✓ Using ngrok URL: {backend_url}")
        
    elif choice == "4":
        backend_url = "http://127.0.0.1:8000"
        print(f"\n✓ Using localhost: {backend_url}")
        print("WARNING: This will ONLY work for web development, NOT on mobile devices!")
        
    else:
        print("Invalid choice!")
        return
    
    print("\n" + "=" * 60)
    print("Updating configuration files...")
    print("=" * 60)
    print()
    
    if update_frontend_config(backend_url):
        print("✓ Frontend configured successfully")
    else:
        print("✗ Failed to update frontend")
        return
    
    create_env_file(backend_url)
    
    print("\n" + "=" * 60)
    print("Configuration complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Start your backend (if using local IP or ngrok)")
    print("2. Build the APK: run build-apk-cli.bat")
    print("3. Install APK on your Android device")
    print()
    input("Press Enter to continue...")

if __name__ == "__main__":
    main()
