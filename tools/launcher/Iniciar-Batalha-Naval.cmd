@echo off
setlocal
REM Portable Windows launcher: process-only execution policy, no permanent changes.
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0BN-Launcher.ps1"
if errorlevel 1 (
  echo.
  echo O inicializador encontrou um problema. Verifique os arquivos .ps1.
  pause
)
endlocal
