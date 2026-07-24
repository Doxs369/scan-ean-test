@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo Aggiorno versione ScanEan...

:: Leggi versione attuale dal JSON
for /f "tokens=*" %%a in ('powershell -Command "(Get-Content version.json | ConvertFrom-Json).version"') do set "VERSION=%%a"

:: Incrementa patch (1.3.0 -> 1.3.1)
for /f "tokens=1,2,3 delims=." %%a in ("!VERSION!") do (
    set /a PATCH=%%c+1
    set "NEW_VERSION=%%a.%%b.!PATCH!"
)

:: Genera build timestamp
for /f "tokens=*" %%a in ('powershell -Command "Get-Date -Format yyyyMMdd-HHmm"') do set "BUILD=%%a"

:: Scrivi version.json
(
echo {
echo   "version": "!NEW_VERSION!",
echo   "build": "!BUILD!"
echo }
) > version.json

:: Scrivi version.js
(
echo const APP_VERSION = "!NEW_VERSION!";
echo const APP_BUILD = "!BUILD!";
) > version.js

echo Versione aggiornata: !NEW_VERSION! (build !BUILD!)
echo.
echo Ora puoi fare git add, commit e push.
pause