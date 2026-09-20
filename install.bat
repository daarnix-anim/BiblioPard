@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

title BiblioPard v0.0.1 - Installer for Adobe After Effects & Premiere Pro
color 0B

echo ===============================================================================
echo                BIBLIOPARD v0.0.1 - 3D & Media Asset Library
echo           Установщик расширения для Adobe After Effects и Premiere Pro
echo ===============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
:: Remove trailing slash
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "CEP_DIR=%APPDATA%\Adobe\CEP\extensions"
set "TARGET_DIR=%CEP_DIR%\BiblioPard"

echo [1/3] Проверка папки расширений Adobe CEP...
if not exist "%CEP_DIR%" (
    echo     Создание каталога: "%CEP_DIR%"
    mkdir "%CEP_DIR%"
)

echo [2/3] Подключение расширения BiblioPard...
if exist "%TARGET_DIR%" (
    echo     Обнаружена предыдущая версия. Удаление старой связи...
    rmdir "%TARGET_DIR%" 2>nul
    if exist "%TARGET_DIR%" (
        rmdir /s /q "%TARGET_DIR%" 2>nul
    )
)

echo     Создание системной связи (Directory Junction)...
mklink /J "%TARGET_DIR%" "%SCRIPT_DIR%" > nul
if %ERRORLEVEL% NEQ 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Не удалось создать прямую связь. Копирование файлов...
    xcopy /E /I /Y /Q "%SCRIPT_DIR%" "%TARGET_DIR%" > nul
)
echo     [OK] Расширение успешно связано: "%TARGET_DIR%"

echo.
echo [3/3] Настройка Adobe PlayerDebugMode в реестре Windows...
for %%V in (10 11 12 13 14) do (
    reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f > nul 2>&1
    echo     [OK] CSXS.%%V PlayerDebugMode активирован
)

echo.
echo ===============================================================================
echo                 УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА! (v0.0.1)
echo ===============================================================================
echo.
echo Как открыть в After Effects или Premiere Pro:
echo 1. Перезапустите After Effects или Premiere Pro (если они были открыты).
echo 2. В верхнем меню выберите:
echo    Window (Окно) -> Extensions (Расширения) -> BiblioPard
echo.
echo Нажмите любую клавишу для выхода...
pause > nul
