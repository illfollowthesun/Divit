@echo off
cd /d "%~dp0"
node scripts\doctor.mjs --desktop
if errorlevel 1 (
  echo.
  echo Complete the missing prerequisites above, then open run.cmd again.
  echo For a browser preview without Rust, use preview.cmd.
  pause
  exit /b 1
)
call npm.cmd run desktop
if errorlevel 1 pause
