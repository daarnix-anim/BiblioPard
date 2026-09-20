@echo off
setlocal
title BiblioPard Uninstaller

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-scripts\uninstall.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Running fallback uninstaller...
    rmdir /s /q "%APPDATA%\Adobe\CEP\extensions\BiblioPard" 2>nul
    echo Extension removed from Adobe CEP.
)

echo.
pause
