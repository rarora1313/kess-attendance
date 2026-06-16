@echo off
title Timesheet App Launcher
echo ================================================
echo   Timesheet Sign In / Sign Out System
echo ================================================
echo.
echo Starting backend (port 4000)...
start "Backend - DO NOT CLOSE" cmd /k "cd /d "%~dp0backend" && npx ts-node-dev --transpile-only src/index.ts"

timeout /t 4 /nobreak > nul

echo Starting frontend (port 3000)...
start "Frontend - DO NOT CLOSE" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 5 /nobreak > nul

echo.
echo ================================================
echo   App is running!
echo   Kiosk:  http://localhost:3000/kiosk
echo   Login:  http://localhost:3000/login
echo   Admin:  admin@company.com / admin123
echo ================================================
echo.
echo Opening in browser...
start http://localhost:3000/login

echo.
echo You can close this window.
echo Keep the two BLACK windows open to keep the app running.
pause
