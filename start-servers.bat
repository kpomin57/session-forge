@echo off
REM Start both the backend Express server and the Vite frontend dev server.

start "Session Forge Backend" cmd /k "cd /d %~dp0session-forge-server && npm run dev"
start "Session Forge Frontend" cmd /k "cd /d %~dp0 && npm run dev"
