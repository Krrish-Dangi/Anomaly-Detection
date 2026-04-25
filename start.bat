@echo off
setlocal enabledelayedexpansion
title SentinelAI - Setup ^& Launch
color 0b

echo ===================================================
echo              SentinelAI - 1-Click Setup
echo ===================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your system PATH. 
    echo Please install Python 3.9 or higher and try again.
    pause
    exit /b
)

:: 2. Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your system PATH. 
    echo Please install Node.js and try again.
    pause
    exit /b
)

:: 3. Check for supabase.js
if not exist "src\lib\supabase.js" (
    color 0e
    echo [WARNING] Supabase Configuration Missing!
    echo Copying example configuration...
    copy "src\lib\supabase.js.example" "src\lib\supabase.js" >nul
    echo.
    echo ACTION REQUIRED:
    echo 1. I have created "src\lib\supabase.js" for you.
    echo 2. Open this file in your code editor.
    echo 3. Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY with your actual keys.
    echo.
    pause
    color 0b
)

echo.
echo [1/4] Setting up Python Virtual Environment...
cd backend
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo [2/4] Installing/Verifying Backend Dependencies (This may take a minute)...
pip install -r requirements.txt >nul
cd ..

echo.
echo [3/4] Installing/Verifying Frontend Dependencies...
call npm install >nul

echo.
echo [4/4] Launching SentinelAI...

:: Start backend in a new window
echo - Starting Backend Server (FastAPI)...
start "SentinelAI Backend" cmd /c "title SentinelAI Backend && cd backend && call venv\Scripts\activate && uvicorn main:app --port 8000"

:: Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
echo - Starting Frontend Server (Vite)...
start "SentinelAI Frontend" cmd /c "title SentinelAI Frontend && npm run dev"

:: Wait a moment for Vite server to boot
timeout /t 3 /nobreak >nul

:: Open browser
echo - Opening Website in your default browser...
start http://localhost:5173

echo.
echo ===================================================
echo     SentinelAI is successfully running! 
echo     - To stop the system, simply close the two 
echo       new command prompt windows that opened.
echo ===================================================
echo.
pause
