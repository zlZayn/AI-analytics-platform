@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
pushd "%~dp0" || exit /b 1

set "PORT=3000"
set "URL=http://localhost:%PORT%"
set "TMPFILE=%TEMP%\aiap_http_%PORT%.txt"
set "SERVER_LOG=%TEMP%\aiap_server_%PORT%.log"

REM ---- ANSI å½©è²ï¼æåç»¿ / å¤±è´¥çº¢ / è­¦åç¥ç / ä¿¡æ¯è / æ¬¡è¦ç°ï¼----
set "ESC="
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C_OK=%ESC%[38;2;22;163;74m"
set "C_ERR=%ESC%[38;2;220;38;38m"
set "C_INFO=%ESC%[38;2;37;99;235m"
set "C_WARN=%ESC%[38;2;217;119;6m"
set "C_RST=%ESC%[0m"

REM ============================================================
REM  [1/4] Node.js æ£æ¥
REM ============================================================
where node >nul 2>nul
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% æªæ¾å° Node.jsï¼è¯·åå®è£ï¼https://nodejs.org/
    pause
    exit /b 1
)

REM ============================================================
REM  [2/4] ä¾èµæ£æ¥ï¼node_modules ç¼ºå¤±æ¶èªå¨å®è£
REM ============================================================
if not exist node_modules (
    echo %C_INFO%[INFO]%C_RST% é¦æ¬¡è¿è¡ï¼æ­£å¨å®è£ä¾èµ ...
    call npm install
    if errorlevel 1 (
        echo %C_ERR%[ERROR]%C_RST% npm install å¤±è´¥ãè¯·æå¨æ§è¡: npm install
        pause
        exit /b 1
    )
    echo %C_OK%[OK]%C_RST% ä¾èµå®è£å®æã
)

REM ============================================================
REM  [3/4] ç¯å¢ä¸ Prisma å®¢æ·ç«¯æ£æ¥
REM ============================================================
if not exist .env (
    echo %C_ERR%[ERROR]%C_RST% ç¼ºå° .env éç½®æä»¶ã
    echo   è¯·å¤å¶ .env.example ä¸º .env å¹¶å¡«åä»¥ä¸å¿éé¡¹ï¼
    echo     - DATABASE_URL    PostgreSQL è¿æ¥ä¸²ï¼å¹³å°åæ°æ®åºï¼
    echo     - ENCRYPTION_KEY  è³å° 32 å­ç¬¦éæºå¼ï¼è¿æ¥å¯ç å å¯ï¼
    echo     - AI_API_BASE / AI_API_KEY / AI_MODEL   å¯éï¼çç©ºå¯ç¦»çº¿å¼å
    echo   çæå¯é¥åè: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
    start notepad "%~dp0.env.example"
    pause
    exit /b 1
)

if not exist src\generated\prisma\client.ts (
    echo %C_INFO%[INFO]%C_RST% Prisma å®¢æ·ç«¯æªçæï¼æ­£å¨çæ ...
    call npx prisma generate
    if errorlevel 1 (
        echo %C_ERR%[ERROR]%C_RST% prisma generate å¤±è´¥ãè¯·æå¨æ§è¡: npx prisma generate
        pause
        exit /b 1
    )
    echo %C_OK%[OK]%C_RST% Prisma å®¢æ·ç«¯çæå®æã
)

REM ============================================================
REM  [4/4] ç«¯å£æ¢æµï¼å·²å¨è¿è¡åç´æ¥æå¼æµè§å¨
REM ============================================================
set "SRV_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do set "SRV_PID=%%p"
if defined SRV_PID (
    echo %C_OK%[OK]%C_RST% æå¡å·²å¨è¿è¡ï¼PID !SRV_PID!ï¼ï¼ç´æ¥æå¼æµè§å¨
    start "" "%URL%"
    exit /b 0
)

echo %C_INFO%[INFO]%C_RST% æå¡æªè¿è¡ï¼æ­£å¨å¯å¨å¼åæå¡å¨ ...

REM ---- åå°å¯å¨ dev serverï¼æ¥å¿åå¥ä¸´æ¶æä»¶ï¼----
start "" /b cmd /c "npm run dev > "%SERVER_LOG%" 2>&1"

REM ---- ç­å¾æå¡å°±ç»ªï¼æé¿ 30 ç§ï¼----
set /a TRIES=0
:wait
set /a TRIES+=1
if !TRIES! GTR 30 goto fail
timeout /t 1 /nobreak >nul
curl -s -o nul -w "%%{http_code}" "%URL%" > "%TMPFILE%" 2>nul
set /p CODE=<"%TMPFILE%"
if not "!CODE!"=="200" goto wait

echo %C_OK%[OK]%C_RST% æå¡å·²å°±ç»ªï¼æ­£å¨æå¼æµè§å¨ ...
start "" "%URL%"
echo.
echo %C_DIM%æå¡è¿è¡ä¸­ï¼æ¥å¿: %SERVER_LOG%%C_RST%
echo %C_DIM%æ Q åæ­¢æå¡å¹¶éåºï¼ç´æ¥åè½¦ä¿æè¿è¡ã%C_RST%
set /p QUIT=
if /i "!QUIT!"=="Q" (
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do set "SRV_PID=%%p"
    if defined SRV_PID taskkill /PID !SRV_PID! /F >nul 2>&1
    echo %C_OK%[OK]%C_RST% æå¡å·²åæ­¢ã
)
exit /b 0

:fail
echo %C_ERR%[ERROR]%C_RST% æå¡ 30 ç§åæªå°±ç»ªï¼è¯·æ¥çæ¥å¿: %SERVER_LOG%
pause
exit /b 1