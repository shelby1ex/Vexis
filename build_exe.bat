@echo off
title Build Vexis.exe
cd /d "%~dp0vexis_ui"
where python >nul 2>nul || (echo Install Python 3.12 first & pause & exit /b 1)
python -m pip install pyinstaller pywebview Pillow pytest >nul
rem Use Vexis.spec: windowed (no console), logo.ico icon, same --add-data as
rem the release. Building with ad-hoc flags produced a console app before.
python -m PyInstaller --noconfirm --clean Vexis.spec
if errorlevel 1 (echo Build failed. & pause & exit /b 1)
copy /y dist\Vexis.exe Vexis.exe
echo Built vexis_ui\Vexis.exe
pause
