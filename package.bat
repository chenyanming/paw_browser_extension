@echo off
REM Package script for paw extension (Windows)
REM Creates Chrome and Firefox packages for store submission

setlocal enabledelayedexpansion

REM Configuration
set EXTENSION_NAME=paw
set VERSION=
set CHROME_PACKAGE=
set FIREFOX_PACKAGE=
set OUTPUT_DIR=web-ext-artifacts

REM Get version from manifest.json
for /f "tokens=2 delims=:" %%a in ('findstr "version" manifest.json') do (
    set VERSION=%%a
    set VERSION=!VERSION:"=!
    set VERSION=!VERSION:,=!
    set VERSION=!VERSION: =!
)

set CHROME_PACKAGE=%EXTENSION_NAME%-chrome-%VERSION%.zip
set FIREFOX_PACKAGE=%EXTENSION_NAME%-firefox-%VERSION%.zip

echo Packaging %EXTENSION_NAME% v%VERSION%

REM Create output directory
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Create Chrome package
echo Creating Chrome package...
powershell -Command "Compress-Archive -Path 'manifest.json','background.js','content.js','popup.html','popup.js','popup.css','options.html','options.js','options.css','content_scripts.css','jquery-3.3.1.js','netflix-bridge.js','images' -DestinationPath '%OUTPUT_DIR%\%CHROME_PACKAGE%' -Force"

REM Create Firefox package using web-ext (if available)
echo Creating Firefox package...
where web-ext >nul 2>nul
if %errorlevel% equ 0 (
    REM Create Firefox-compatible manifest
    copy manifest-v2.json manifest.json >nul
    powershell -Command "(Get-Content manifest.json) -replace '\"version\": \".*\"', '\"version\": \"%VERSION%\"' | Set-Content manifest.json"
    web-ext build --source-dir . --artifacts-dir "%OUTPUT_DIR%" --filename "%FIREFOX_PACKAGE%"
    REM Restore original manifest.json
    copy manifest-v3.json manifest.json >nul
) else (
    echo web-ext not found. Installing...
    npm install -g web-ext
    REM Create Firefox-compatible manifest
    copy manifest-v2.json manifest.json >nul
    powershell -Command "(Get-Content manifest.json) -replace '\"version\": \".*\"', '\"version\": \"%VERSION%\"' | Set-Content manifest.json"
    web-ext build --source-dir . --artifacts-dir "%OUTPUT_DIR%" --filename "%FIREFOX_PACKAGE%"
    REM Restore original manifest.json
    copy manifest-v3.json manifest.json >nul
)

echo.
echo Package Information:
echo Extension: %EXTENSION_NAME%
echo Version: %VERSION%
echo Chrome Package: %CHROME_PACKAGE%
echo Firefox Package: %FIREFOX_PACKAGE%
echo Output Directory: %OUTPUT_DIR%
echo.

echo Store Submission Instructions:
echo.
echo Chrome Web Store:
echo 1. Go to https://chrome.google.com/webstore/devconsole/
echo 2. Upload: %OUTPUT_DIR%\%CHROME_PACKAGE%
echo 3. Fill in store listing details
echo 4. Submit for review
echo.
echo Firefox Add-ons:
echo 1. Go to https://addons.mozilla.org/developers/
echo 2. Upload: %OUTPUT_DIR%\%FIREFOX_PACKAGE%
echo 3. Fill in store listing details
echo 4. Submit for review
echo.

echo Packaging complete!
echo Packages are ready in: %OUTPUT_DIR%\
pause
