@echo off
cd /d "%~dp0backend"
echo Starting backend at http://localhost:4000 ...
npx ts-node-dev --transpile-only src/index.ts
pause
