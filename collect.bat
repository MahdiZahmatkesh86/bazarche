@echo off
setlocal enabledelayedexpansion
set OUTPUT=project_code.txt
if exist %OUTPUT% del %OUTPUT%

echo Collecting project files...
echo. > %OUTPUT%

for /r %%f in (*.js *.html *.css *.json *.md) do (
    set "filepath=%%f"
    set "filepath=!filepath:%CD%\=!"
    echo !filepath! | findstr /i "node_modules _backup .bak .pre- .broken package-lock" >nul
    if errorlevel 1 (
        echo ============================================ >> %OUTPUT%
        echo FILE: !filepath! >> %OUTPUT%
        echo ============================================ >> %OUTPUT%
        type "%%f" >> %OUTPUT%
        echo. >> %OUTPUT%
        echo. >> %OUTPUT%
    )
)

echo Done! File created: %OUTPUT%
pause