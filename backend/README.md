# GeniusGrid Backend (Auth)

## Setup
1. `cp .env.example .env` and fill DB + SMTP.
2. Run migrations (psql):
   ```sh
   psql "$PGDATABASE" -h "$PGHOST" -U "$PGUSER" -f migrations/00_auth_core.sql
   ```
3. Install deps: `npm i`
4. Start: `npm run dev`

## Routes
- `POST /api/public/signup`
- `GET  /api/public/verify-email?token=...&email=...`
- `GET  /api/auth/csrf`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
