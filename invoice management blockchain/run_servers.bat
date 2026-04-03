@echo off
setlocal

echo ===================================================
echo   Invoice Management Blockchain - Quick Start
echo ===================================================
echo.

:: Re-apply DB schema to pick up any migrations
echo [1/3] Applying latest DB schema...
docker exec -i invoice-postgres psql -U postgres -d invoice_tracker < database\prod_schema.sql >nul 2>&1
if errorlevel 1 (
  echo WARNING: Could not apply schema. Is Docker running and invoice-postgres container up?
  echo          Run start.bat first to set up the database container.
  echo.
) else (
  echo Schema up-to-date.
)

echo.
echo [2/3] Starting Backend Server...
if not exist "backend\node_modules" (
  echo Installing backend dependencies...
  cd backend
  call npm install
  cd ..
)
start "Backend Server" cmd /k "color 0A && cd backend && npm run dev"

echo.
echo [3/3] Starting Frontend Dev Server...
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  cd frontend
  call npm install
  cd ..
)
start "Frontend Server" cmd /k "color 0B && cd frontend && npm run dev"

echo.
echo ===================================================
echo   Servers started in separate windows!
echo.
echo   Backend  at: http://localhost:5000
echo   Frontend at: http://localhost:5173
echo ===================================================
echo.
pause
