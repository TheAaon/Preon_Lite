@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
start "" http://localhost:1420
call npm run dev
