@echo off
title Vexis Runtime Web UI
cd /d "%~dp0"
echo ========================================
echo   Vexis runtime (your copy: .runtime\vexis-runtime.exe)
echo   Official web interface
echo ========================================
echo.
echo The UI will open in your default browser.
echo Press Ctrl+C in this window to stop.
echo.
".runtime\vexis-runtime.exe" web --print-logs
pause
