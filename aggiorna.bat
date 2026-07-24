@echo off
setlocal EnableDelayedExpansion

echo ==========================================
echo   ScanEan - Aggiornamento Versione
echo ==========================================
echo.

:: Leggi versione corrente da version.json
if not exist version.json (
    echo {"version":"1.0.0","build":"unknown"} > version.json
)

for /f "tokens=*" %%a in ('powershell -Command "(Get-Content version.json | ConvertFrom-Json).version"') do set "VERSION=%%a"

if "!VERSION!"=="" set "VERSION=1.0.0"

:: Incrementa patch (es. 1.3.0 -> 1.3.1)
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

echo.
echo [OK] version.js e version.json aggiornati.
echo     Versione: !NEW_VERSION!  (build !BUILD!)
echo.

:: === AGGIORNA INDEX.HTML ===
echo [..] Aggiorno cache-busting in index.html...

powershell -Command "
    $v='!NEW_VERSION!';
    $c=Get-Content index.html -Raw;
    # Sostituisci tutti i ?v=qualcosa con ?v=nuova_versione
    $c=$c -replace '\?v=[^"'']*', "?v=$v";
    # Se manifest.json non ha ?v, aggiungilo
    if($c -notmatch 'manifest\.json\?v='){
        $c=$c -replace 'manifest\.json("|'')', "manifest.json?v=$v\`$1";
    }
    $c | Set-Content index.html -NoNewline -Encoding UTF8;
"

echo [OK] index.html aggiornato con ?v=!NEW_VERSION!
echo.

:: === AGGIORNA MANIFEST.JSON ===
echo [..] Aggiorno campo version in manifest.json...

powershell -Command "
    $v='!NEW_VERSION!';
    $f=Get-Content manifest.json -Raw;
    if($f -match '"version"'){
        $f=$f -replace '"version"\s*:\s*"[^"]*"', "\"version\": \"$v\"";
    } else {
        $f=$f -replace '\}$', ",
  \"version\": \"$v\"
}";
    }
    $f | Set-Content manifest.json -NoNewline -Encoding UTF8;
"

echo [OK] manifest.json aggiornato.
echo.
echo ==========================================
echo   FATTO! Nuova versione: !NEW_VERSION!
echo ==========================================
echo.
echo Ora puoi fare git add, commit e push.
pause
