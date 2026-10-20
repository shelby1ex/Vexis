@echo off
title Vexis
cd /d "%~dp0"
echo Starting Vexis (the runtime engine starts hidden - no extra windows)...

rem --- Find Python (prefer 'python', fall back to 'py' launcher) ---
where python >nul 2>nul
if %errorlevel%==0 (
  set "PY=python"
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set "PY=py"
  ) else (
    echo [Vexis] ERROR: Python not found.
    echo [Vexis] Install Python 3.12 from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
    pause
    exit /b 1
  )
)

rem --- Self-heal: pywebview is required for the desktop window ---
%PY% -c "import webview" >nul 2>nul
if %errorlevel% neq 0 (
  echo [Vexis] Installing missing dependency: pywebview ...
  %PY% -m pip install pywebview
  if %errorlevel% neq 0 (
    echo [Vexis] ERROR: pip install pywebview failed.
    echo [Vexis] Run manually: %PY% -m pip install pywebview
    pause
    exit /b 1
  )
)

%PY% "%~dp0app_desktop.py"
if errorlevel 1 pause
