[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "BiblioPard v0.0.1 - Installer"

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "                BIBLIOPARD v0.0.1 - 3D & Media Asset Library                  " -ForegroundColor Yellow
Write-Host "           Установщик расширения для Adobe After Effects и Premiere Pro       " -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $PSScriptRoot
$CepDir = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$TargetDir = Join-Path $CepDir "BiblioPard"

Write-Host "[1/3] Проверка папки расширений Adobe CEP..." -ForegroundColor Gray
if (-not (Test-Path $CepDir)) {
    Write-Host "    Создание каталога: $CepDir" -ForegroundColor Gray
    New-Item -ItemType Directory -Path $CepDir -Force | Out-Null
}

Write-Host "[2/3] Подключение расширения BiblioPard..." -ForegroundColor Gray
if (Test-Path $TargetDir) {
    Write-Host "    Обнаружена предыдущая версия. Удаление старой связи..." -ForegroundColor Yellow
    cmd /c "rmdir /s /q `"$TargetDir`"" 2>$null
}

Write-Host "    Создание системной связи (Directory Junction)..." -ForegroundColor Gray
$cmdOutput = cmd /c "mklink /J `"$TargetDir`" `"$ScriptDir`"" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "    [OK] Расширение успешно связано: $TargetDir" -ForegroundColor Green
} else {
    Write-Host "    [ПРЕДУПРЕЖДЕНИЕ] mklink завершился с кодом $LASTEXITCODE. Копирование файлов..." -ForegroundColor Yellow
    Copy-Item -Path $ScriptDir -Destination $TargetDir -Recurse -Force -Exclude "node_modules", ".git"
    Write-Host "    [OK] Файлы расширения успешно скопированы: $TargetDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/3] Настройка Adobe PlayerDebugMode в реестре Windows..." -ForegroundColor Gray
$versions = @("10", "11", "12", "13", "14")
foreach ($ver in $versions) {
    $regPath = "HKCU:\Software\Adobe\CSXS.$ver"
    if (-not (Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -Path $regPath -Name "PlayerDebugMode" -Value "1" -Type String -Force
    Write-Host "    [OK] CSXS.$ver PlayerDebugMode активирован" -ForegroundColor Green
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "                 УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА! (v0.0.1)                         " -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Как открыть в After Effects или Premiere Pro:" -ForegroundColor White
Write-Host "1. Перезапустите After Effects или Premiere Pro (если они были открыты)." -ForegroundColor Gray
Write-Host "2. В верхнем меню выберите: Window -> Extensions -> BiblioPard" -ForegroundColor Yellow
Write-Host ""
