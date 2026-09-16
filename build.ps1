Set-Location -Path $PSScriptRoot
Write-Host "Building Read! for Windows (unpacked production build)..." -ForegroundColor Cyan

# Setup installer / portable builds are disabled for now — only the unpacked
# .exe is produced. Re-enable by uncommenting the line below (and commenting
# out the build:unpack line) once installer builds are needed again.
# npm run build:win

npm run build:unpack
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild done. Find the app in the 'dist\win-unpacked' folder." -ForegroundColor Green
} else {
    Write-Host "`nBuild failed. See errors above." -ForegroundColor Red
}
