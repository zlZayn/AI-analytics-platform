@echo off
setlocal enabledelayedexpansion
pushd "%~dp0" || exit /b 1

set "PORT=3000"
set "URL=http://localhost:%PORT%"
set "TMPFILE=%TEMP%\aiap_http_%PORT%.txt"
set "SERVER_LOG=%TEMP%\aiap_server_%PORT%.log"
set "BUILDSTATE=%TEMP%\aiap_buildstate_%PORT%.txt"
set "MODE=start"

REM ---- ANSI 彩色（成功绿 / 失败红 / 警告琥珀 / 信息蓝 / 次要灰）----
set "ESC="
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C_OK=%ESC%[38;2;22;163;74m"
set "C_ERR=%ESC%[38;2;220;38;38m"
set "C_INFO=%ESC%[38;2;37;99;235m"
set "C_WARN=%ESC%[38;2;217;119;6m"
set "C_DIM=%ESC%[38;2;107;114;128m"
set "C_RST=%ESC%[0m"

REM ============================================================
REM  [1/5] Node.js 检查
REM ============================================================
where node >nul 2>nul
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% 未找到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

REM ============================================================
REM  [2/5] 依赖检查：node_modules 缺失时自动安装
REM ============================================================
if not exist node_modules (
    echo %C_INFO%[INFO]%C_RST% 首次运行，正在安装依赖 ...
    call npm install
    if errorlevel 1 (
        echo %C_ERR%[ERROR]%C_RST% npm install 失败。请手动执行: npm install
        pause
        exit /b 1
    )
    echo %C_OK%[OK]%C_RST% 依赖安装完成。
)

REM ============================================================
REM  [3/5] 环境与 Prisma 客户端检查
REM ============================================================
if not exist .env (
    echo %C_ERR%[ERROR]%C_RST% 缺少 .env 配置文件。
    echo   请复制 .env.example 为 .env 并填写以下必需项：
    echo     - DATABASE_URL    PostgreSQL 连接串（平台元数据库）
    echo     - ENCRYPTION_KEY  至少 32 字符随机值（连接密码加密）
    echo     - AI_API_BASE / AI_API_KEY / AI_MODEL   可选，留空可离线开发
    echo   生成密钥参考: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
    start notepad "%~dp0.env.example"
    pause
    exit /b 1
)

if not exist src\generated\prisma\client.ts (
    echo %C_INFO%[INFO]%C_RST% Prisma 客户端未生成，正在生成 ...
    call npx prisma generate
    if errorlevel 1 (
        echo %C_ERR%[ERROR]%C_RST% prisma generate 失败。请手动执行: npx prisma generate
        pause
        exit /b 1
    )
    echo %C_OK%[OK]%C_RST% Prisma 客户端生成完成。
)

REM ============================================================
REM  [4/5] 构建新鲜度检查：src/prisma 是否比 .next\BUILD_ID 新
REM   OK        -> 产物最新，跳过构建，直接生产启动
REM   STALE     -> 源码有更新，询问是否重新构建
REM   NOT_BUILT -> 从未构建，询问是否构建
REM ============================================================
powershell -NoProfile -Command "$f=@(Get-ChildItem 'src','prisma' -Recurse -File -EA SilentlyContinue ^| Where-Object { $_.FullName -notmatch '\\generated\\' }) + @(Get-Item 'next.config.ts','package.json','tsconfig.json' -EA SilentlyContinue); $t=$null; foreach($x in $f){if(-not $t -or $x.LastWriteTime -gt $t){$t=$x.LastWriteTime}}; if(-not (Test-Path '.next\BUILD_ID')){'NOT_BUILT'}elseif($t -gt (Get-Item '.next\BUILD_ID').LastWriteTime){'STALE'}else{'OK'}" > "%BUILDSTATE%" 2>nul
set /p BUILD_STATE=<"%BUILDSTATE%"

if "%BUILD_STATE%"=="STALE" (
    echo %C_WARN%[WARN]%C_RST% 检测到源码更新，构建产物已过期
    set /p DOBUILD=%C_DIM%是否重新构建？^（回车=是 / D=直接进开发模式 / N=跳过）: %C_RST%
    if /i "!DOBUILD!"=="D" (
        set "MODE=dev"
        goto check_running
    )
    if /i not "!DOBUILD!"=="N" goto build
)
if "%BUILD_STATE%"=="NOT_BUILT" (
    echo %C_WARN%[WARN]%C_RST% 尚未构建（.next 缺失）
    set /p DOBUILD=%C_DIM%是否现在构建？^（回车=是 / D=直接进开发模式 / N=跳过）: %C_RST%
    if /i "!DOBUILD!"=="D" (
        set "MODE=dev"
        goto check_running
    )
    if /i not "!DOBUILD!"=="N" goto build
)
if "%BUILD_STATE%"=="OK" (
    echo %C_OK%[OK]%C_RST% 构建产物已是最新，跳过构建
)

REM ============================================================
REM  [5/5] 端口探测：已在运行则直接打开浏览器
REM ============================================================
:check_running
set "SRV_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do set "SRV_PID=%%p"
if defined SRV_PID (
    echo %C_OK%[OK]%C_RST% 服务已在运行（PID !SRV_PID!），直接打开浏览器
    start "" "%URL%"
    exit /b 0
)

if "%MODE%"=="dev" (
    echo %C_INFO%[INFO]%C_RST% 正在启动开发服务器（热更新）...
    start "" /b cmd /c "npm run dev -- -p %PORT% > "%SERVER_LOG%" 2>&1"
) else (
    echo %C_INFO%[INFO]%C_RST% 服务未运行，正在启动生产服务器 ...
    start "" /b cmd /c "npm run start -- -p %PORT% > "%SERVER_LOG%" 2>&1"
)

REM ---- 等待服务就绪（最长 30 秒）----
set /a TRIES=0
:wait
set /a TRIES+=1
if !TRIES! GTR 30 goto fail
timeout /t 1 /nobreak >nul
curl -s -o nul -w "%%{http_code}" "%URL%" > "%TMPFILE%" 2>nul
set /p CODE=<"%TMPFILE%"
if not "!CODE!"=="200" goto wait

echo %C_OK%[OK]%C_RST% 服务已就绪，正在打开浏览器 ...
start "" "%URL%"
echo.
echo %C_DIM%服务运行中，日志: %SERVER_LOG%%C_RST%
echo %C_DIM%按 Q 停止服务并退出；直接回车保持运行。%C_RST%
set /p QUIT=
if /i "!QUIT!"=="Q" (
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do set "SRV_PID=%%p"
    if defined SRV_PID taskkill /PID !SRV_PID! /F >nul 2>&1
    echo %C_OK%[OK]%C_RST% 服务已停止。
)
exit /b 0

:build
echo %C_INFO%[INFO]%C_RST% 正在构建（本机字体自托管，无需联网）...
call npm run build
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% 构建失败。
    pause
    exit /b 1
)
echo %C_OK%[OK]%C_RST% 构建完成。
goto check_running

:fail
echo %C_ERR%[ERROR]%C_RST% 服务 30 秒内未就绪，请查看日志: %SERVER_LOG%
pause
exit /b 1