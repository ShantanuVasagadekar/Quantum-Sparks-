## Production Deployment (Neon + Render + Vercel)

### 1) Neon (Postgres)
- Create a Neon project and copy the connection string.
- Set backend env `DATABASE_URL` to Neon pooled URL.
- Run schema + migrations in order:
  - `database/schema.sql`
  - `database/migrations/*.sql`
  - `backend/database/migrations/fix_schema.sql`

### 2) Backend on Render
- Use `render.yaml` from repo root.
- Root directory: `invoice management blockchain/backend`
- Build: `npm install`
- Start: `npm run start`
- Required env vars:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `CORS_ORIGIN` (your Vercel URL)
  - optional Algorand vars (`ALGO_NODE_URL`, `ALGO_INDEXER_URL`, etc)

### 3) Frontend on Vercel
- Import frontend project folder: `invoice management blockchain/frontend`
- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Required env vars:
  - `VITE_API_URL=https://<your-render-backend>/api`
  - optional Algorand vars (`VITE_ALGO_NODE_URL`, `VITE_ALGO_BUSINESS_WALLET`, etc)

### 4) CORS & Health
- Ensure backend `CORS_ORIGIN` exactly matches deployed frontend URL.
- Backend health endpoint: `/health`

### 5) Auto-seeding behavior
- On backend startup, if `clients` count is below `10`, demo seeding runs once.
- After seeded data is present, restart does not trigger additional seeding.
