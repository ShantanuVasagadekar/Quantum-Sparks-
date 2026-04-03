@echo off
setlocal

echo ===================================================
echo   Invoice Management Blockchain - Local Dev Setup
echo ===================================================
echo.

echo [1/4] Checking Docker + PostgreSQL Container...
docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker is not running. Please start Docker Desktop and try again.
  pause
  exit /b 1
)

docker inspect invoice-postgres >nul 2>&1
if errorlevel 1 (
  echo Creating new PostgreSQL container...
  docker run -d --name invoice-postgres ^
    -e POSTGRES_USER=postgres ^
    -e POSTGRES_PASSWORD=postgres ^
    -e POSTGRES_DB=invoice_tracker ^
    -p 5432:5432 postgres:16
) else (
  echo Starting existing PostgreSQL container...
  docker start invoice-postgres >nul 2>&1
)

echo Waiting for PostgreSQL to be ready...
:wait_db
timeout /t 2 /nobreak >nul
docker exec invoice-postgres pg_isready -U postgres -d invoice_tracker >nul 2>&1
if errorlevel 1 goto wait_db
echo PostgreSQL is ready.

echo.
echo [2/4] Applying Database Schema...
docker exec -i invoice-postgres psql -U postgres -d invoice_tracker < database\prod_schema.sql
if errorlevel 1 (
  echo WARNING: Schema apply had errors. Check output above.
) else (
  echo Schema applied successfully.
)

echo.
echo [3/4] Starting Backend Server...
if not exist "backend\node_modules" (
  echo Installing backend dependencies...
  cd backend
  call npm install
  cd ..
)
start "Backend Server" cmd /k "color 0A && cd backend && npm run dev"

echo.
echo [4/4] Starting Frontend Dev Server...
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  cd frontend
  call npm install
  cd ..
)
start "Frontend Server" cmd /k "color 0B && cd frontend && npm run dev"

echo.
echo ===================================================
echo   All systems go!
echo.
echo   Backend  at: http://localhost:5000
echo   Frontend at: http://localhost:5173
echo ===================================================
echo.
pause
