@echo off
cd /d "%~dp0"
node scripts\doctor.mjs --desktop
if errorlevel 1 (
  echo Complete the missing prerequisites above, then open build.cmd again.
  pause
  exit /b 1
)
call npm.cmd run package
if errorlevel 1 pause
