@echo off
chcp 65001 >nul
setlocal
pushd "%~dp0" || exit /b 1

set "ESC="
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C_OK=%ESC%[38;2;22;163;74m"
set "C_ERR=%ESC%[38;2;220;38;38m"
set "C_INFO=%ESC%[38;2;37;99;235m"
set "C_RST=%ESC%[0m"

where node >nul 2>nul
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% æªæ¾å° Node.jsï¼è¯·åå®è£ï¼https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo %C_INFO%[INFO]%C_RST% ä¾èµæªå®è£ï¼æ­£å¨å®è£ ...
    call npm install
    if errorlevel 1 (
        echo %C_ERR%[ERROR]%C_RST% npm install å¤±è´¥ã
        pause
        exit /b 1
    )
)

echo %C_INFO%[INFO]%C_RST% ç±»åæ£æ¥ ...
call npm run typecheck
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% ç±»åæ£æ¥å¤±è´¥ã
    pause
    exit /b 1
)

echo %C_INFO%[INFO]%C_RST% æå»ºçäº§çæ¬ ...
call npm run build
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% æå»ºå¤±è´¥ã
    pause
    exit /b 1
)

echo.
echo %C_OK%[OK]%C_RST% æå»ºå®æã
echo åå¸è¿è¡: npm run start
echo æ¥å¸¸å¼å: åå»"å¯å¨ AI åæå¹³å°.cmd"
pause