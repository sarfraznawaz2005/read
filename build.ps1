Set-Location -Path $PSScriptRoot
Write-Host "Building Read! for Windows (production .exe)..." -ForegroundColor Cyan
npm run build:win
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild done. Find the installer in the 'dist' folder." -ForegroundColor Green
} else {
    Write-Host "`nBuild failed. See errors above." -ForegroundColor Red
}
