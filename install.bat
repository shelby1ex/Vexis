@echo off
title Vexis setup
cd /d "%~dp0"
echo === Vexis first-time setup ===

where python >nul 2>nul
if %errorlevel% neq 0 (
  echo [setup] ERROR: Python 3.12 not found. Install it from https://www.python.org/downloads/
  echo [setup] and tick "Add python.exe to PATH", then run install.bat again.
  pause
  exit /b 1
)

echo [setup] installing dependencies (pywebview, Pillow, pytest)...
python -m pip install --upgrade pip >nul
python -m pip install pywebview Pillow pytest
if %errorlevel% neq 0 (
  echo [setup] ERROR: pip failed. Check your connection and retry.
  pause
  exit /b 1
)

if not exist .env (
  echo [setup] creating .env with a fresh local secret...
  copy /y .env.example .env >nul
  python -c "import secrets,re; p='.env'; s=open(p,encoding='utf-8').read(); s=re.sub(r'(?m)^VEXIS_SECRET_KEY=.*','VEXIS_SECRET_KEY='+secrets.token_hex(32),s); open(p,'w',encoding='utf-8').write(s)"
)

echo [setup] creating Desktop shortcut...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'),'Vexis.lnk')); $s.TargetPath='%~dp0vexis_ui\run.bat'; $s.WorkingDirectory='%~dp0vexis_ui'; $s.Save()"

echo.
echo === Done. Double-click vexis_ui\run.bat (or the Desktop shortcut). ===
pause
