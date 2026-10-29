@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 is required. Install it, then open this file again.
  pause
  exit /b 1
)
node scripts\doctor.mjs
if errorlevel 1 (
  echo.
  echo Installing the app packages in this project...
  call npm.cmd install --no-audit --no-fund --fetch-retries=0 --cache "%~dp0.tools\npm-cache"
  if errorlevel 1 goto failed
)
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo Opening the browser preview. Keep this window open while using Divit.
echo This preview uses browser storage. It does not open your desktop writing files.
call npm.cmd run dev -- --open
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Preview did not start. The error is shown above.
pause
exit /b 1
