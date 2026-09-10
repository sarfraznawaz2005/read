@echo off
if not "%READ_APP_NO_AUTORUN%"=="1" (
    set READ_APP_NO_AUTORUN=1
    cmd /D /c "%~f0" %*
    exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"

