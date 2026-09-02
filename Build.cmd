@echo off
setlocal enabledelayedexpansion
pushd "%~dp0" || exit /b 1

set "ESC="
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C_OK=%ESC%[38;2;22;163;74m"
set "C_ERR=%ESC%[38;2;220;38;38m"
set "C_INFO=%ESC%[38;2;37;99;235m"
set "C_WARN=%ESC%[38;2;217;119;6m"
set "C_RST=%ESC%[0m"
set "BUILDSTATE=%TEMP%\aiap_buildstate_build.txt"

where node >nul 2>nul
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% 未找到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo %C_INFO%[INFO]%C_RST% 依赖未安装，正在安装 ...
    call npm install
    if errorlevel 1 (
        echo %C_ERR%[ERROR]%C_RST% npm install 失败。
        pause
        exit /b 1
    )
)

REM ---- 构建新鲜度检查：src/prisma（排除 generated）是否比 .next\BUILD_ID 新 ----
powershell -NoProfile -Command "$f=Get-ChildItem 'src','prisma' -Recurse -File -EA SilentlyContinue | Where-Object { $_.FullName -notmatch '\\generated\\' }; $t=$null; foreach($x in $f){if(-not $t -or $x.LastWriteTime -gt $t){$t=$x.LastWriteTime}}; if(-not (Test-Path '.next\BUILD_ID')){'NOT_BUILT'}elseif($t -gt (Get-Item '.next\BUILD_ID').LastWriteTime){'STALE'}else{'OK'}" > "%BUILDSTATE%" 2>nul
set /p BUILD_STATE=<"%BUILDSTATE%"

if "%BUILD_STATE%"=="OK" (
    echo %C_OK%[OK]%C_RST% 构建产物已是最新，无需重新构建。
    set /p FORCE=%C_DIM%仍要强制重建？^（回车=退出 / F=强制构建）: %C_RST%
    if /i not "!FORCE!"=="F" exit /b 0
)

echo %C_INFO%[INFO]%C_RST% 类型检查 ...
call npm run typecheck
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% 类型检查失败。
    pause
    exit /b 1
)

echo %C_INFO%[INFO]%C_RST% 构建生产版本 ...
call npm run build
if errorlevel 1 (
    echo %C_ERR%[ERROR]%C_RST% 构建失败。
    pause
    exit /b 1
)

echo.
echo %C_OK%[OK]%C_RST% 构建完成。
echo 发布运行: npm run start
echo 日常开发: 双击 "Start Dev.cmd"
pause