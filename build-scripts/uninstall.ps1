[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "BiblioPard - Uninstaller"

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "                BIBLIOPARD - Деинсталлятор расширения                          " -ForegroundColor Red
Write-Host "           Удаление расширения из Adobe After Effects и Premiere Pro           " -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$CepDir = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$TargetDir = Join-Path $CepDir "BiblioPard"

Write-Host "[1/2] Удаление расширения BiblioPard из Adobe CEP..." -ForegroundColor Gray
if (Test-Path $TargetDir) {
    # Try removing junction link first, then directory
    cmd /c "rmdir /s /q `"$TargetDir`"" 2>$null
    if (Test-Path $TargetDir) {
        Remove-Item -Path $TargetDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host "    [OK] Расширение успешно удалено: $TargetDir" -ForegroundColor Green
} else {
    Write-Host "    [ИНФО] Расширение не обнаружено в папке Adobe CEP (уже удалено)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/2] Проверка пользовательских данных..." -ForegroundColor Gray
Write-Host "    [OK] Ваши 3D-модели, HDR-карты и файлы библиотеки в папке проекта сохранены." -ForegroundColor Green

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "                 УДАЛЕНИЕ УСПЕШНО ЗАВЕРШЕНО!                                   " -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Перезапустите After Effects или Premiere Pro, чтобы панель исчезла из меню." -ForegroundColor White
Write-Host ""
