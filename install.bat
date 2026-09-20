@echo off
setlocal
title BiblioPard Installer

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-scripts\install.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Running fallback installer...
    node "%~dp0build-scripts\install-extension.js"
)

echo.
pause
