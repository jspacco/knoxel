@echo off
rem Double-click this file to start Knoxel. Requires Node.js — https://nodejs.org
rem (the LTS version is fine). See README.txt for the full first-run walkthrough.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run Knoxel but wasn't found on this PC.
  echo Install it from https://nodejs.org (the LTS version), then double-click this file again.
  pause
  exit /b 1
)

node scripts\knoxel-server.js %*
pause
