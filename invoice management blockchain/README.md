# Invoice Tracking & Collection Management

Professional invoice management system with realtime updates, partial payments, Algorand proof anchoring, and downloadable PDF invoices.

## Stack

- Frontend: React + Vite + Tailwind + Recharts
- Backend: Node.js + Express + pg + zod + algosdk + pdfkit
- Database: PostgreSQL
- Realtime: SSE (`/api/events/stream`)
- Blockchain: Algorand Testnet (real + simulated fallback)

## Project Structure

```text
invoice management blockchain/
  backend/
  frontend/
  database/
    schema.sql
    seed.sql
    migrations/
  dev-up.ps1
```

## Quick Start (Recommended)

Run from project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\dev-up.ps1
```

Do not run `cd scripts` (there is no `scripts/` directory in this repo).

`dev-up.ps1` will:

- create/start Docker Postgres container `invoice-postgres`
- wait for Postgres readiness
- apply `database/schema.sql`, `database/seed.sql`, and all `database/migrations/*.sql`
- ensure `backend/.env` and `frontend/.env` exist
- install dependencies (if missing)
- start backend (`:5000`) and frontend (`:5173`) in new terminals

## Manual Setup

### 1) Database

```powershell
docker run -d --name invoice-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=invoice_tracker `
  -p 5432:5432 postgres:16

Get-Content .\database\schema.sql | docker exec -i invoice-postgres psql -U postgres -d invoice_tracker
Get-Content .\database\seed.sql | docker exec -i invoice-postgres psql -U postgres -d invoice_tracker
Get-ChildItem .\database\migrations\*.sql | Sort-Object Name | ForEach-Object {
  Get-Content $_.FullName | docker exec -i invoice-postgres psql -U postgres -d invoice_tracker
}
```

### 2) Backend

```powershell
cd .\backend
copy .env.example .env
npm install
npm run dev
```

### 3) Frontend

```powershell
cd .\frontend
copy .env.example .env
npm install
npm run dev
```

## Local URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- API Health: `http://localhost:5000/health`

## Environment Variables

### Backend (`backend/.env`)

- `PORT=5000`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/invoice_tracker`
- `CORS_ORIGIN=http://localhost:5173`
- `DEMO_USER_ID=11111111-1111-1111-1111-111111111111`
- `ALGORAND_ALGOD_SERVER=https://testnet-api.algonode.cloud`
- `ALGORAND_ALGOD_PORT=443`
- `ALGORAND_ALGOD_TOKEN=`
- `ALGORAND_ANCHOR_MNEMONIC=`
- `ALGORAND_ANCHOR_RECEIVER=`
- `ALGORAND_EXPLORER_BASE_URL=https://testnet.algoexplorer.io/tx/`
- `BUSINESS_NAME=Your Business Name`
- `BUSINESS_ADDRESS=123 Street Address`
- `BUSINESS_CITY_STATE=Mumbai, MH 400001`
- `BUSINESS_PHONE=(000) 000-0000`
- `BUSINESS_EMAIL=contact@yourbusiness.com`
- `OVERDUE_JOB_INTERVAL_MS=60000`

If mnemonic/receiver are not set, anchor and verification run in demo (simulated) mode.

### Frontend (`frontend/.env`)

- `VITE_API_URL=http://localhost:5000/api`
- `VITE_DEMO_USER_ID=11111111-1111-1111-1111-111111111111`

## Algorand Testnet Wallet Setup

Generate a wallet:

```powershell
node -e "const a=require('algosdk');const k=a.generateAccount();console.log(a.secretKeyToMnemonic(k.sk),k.addr)"
```

Fund with Testnet Algo:

- https://bank.testnet.algorand.network/

Then set `ALGORAND_ANCHOR_MNEMONIC` and `ALGORAND_ANCHOR_RECEIVER` in `backend/.env`.

## API Endpoints

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Clients

- `GET /api/clients`
- `POST /api/clients`
- `GET /api/clients/:id`
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`

### Invoices

- `GET /api/invoices`
- `POST /api/invoices`
- `GET /api/invoices/:id`
- `PATCH /api/invoices/:id`
- `POST /api/invoices/:id/send`
- `POST /api/invoices/:id/cancel`
- `POST /api/invoices/:id/anchor`
- `GET /api/invoices/:id/events`
- `POST /api/invoices/:id/reminder`
- `GET /api/invoices/:id/timeline`
- `GET /api/invoices/:id/pdf`

### Payments

- `GET /api/invoices/:id/payments`
- `POST /api/invoices/:id/payments`
- `GET /api/payments/:id`
- `POST /api/payments/:id/verify-chain`

### Dashboard

- `GET /api/dashboard/summary`
- `GET /api/dashboard/overdue`
- `GET /api/dashboard/collections-trend`
- `GET /api/dashboard/client-analytics`
- `GET /api/dashboard/client-leaderboard`
- `GET /api/dashboard/cashflow-prediction`

### Events + Blockchain

- `GET /api/events/stream`
- `GET /api/blockchain/tx/:txId`

## Test Commands

Backend integration tests:

```powershell
cd .\backend
npm run test:invoices
```

Frontend checks:

```powershell
cd .\frontend
npm run lint
npm run build
```

## Troubleshooting

- `Docker is not running`: start Docker Desktop and rerun `dev-up.ps1`.
- `container name already in use`: run `docker start invoice-postgres` or remove stale container.
- `port 5000/5173 already in use`: stop conflicting process and rerun.
- DB connection errors in tests: ensure Postgres container is up and schema is applied.

## Demo User

- User ID: `11111111-1111-1111-1111-111111111111`
- This is sent via `x-user-id` from frontend by default.
