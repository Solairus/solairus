# Railway Deployment Guide

This project can be deployed to Railway as two services: frontend (Vite) and backend (Express).

## Overview
- Frontend: builds with `vite` and serves via `vite preview` binding to `$PORT`.
- Backend: Express server binds to `$PORT`, exposes `/api` routes, and sets CORS based on `CORS_ORIGIN`.

## Services

### 1) Frontend Service
- Root directory: repository root
- Start command: `yarn install && yarn build && yarn start:preview`
- Environment variables:
  - `VITE_SOLANA_CLUSTER=devnet` (or your target)
  - `VITE_API_BASE_URL=https://<backend-service>.up.railway.app/api`
  - WalletConnect, RPCs, and other VITE_ variables as needed
  - Leave `VITE_WITHDRAWAL_WINDOW_SECONDS` unset (defaults to 24h)

### 2) Backend Service
- Root directory: `backend`
- Start command: `yarn install && yarn build && yarn start`
- Environment variables:
  - `DATABASE_URL=<Railway Postgres URL>`
  - `JWT_SECRET=<random strong secret>`
  - `SOLANA_RPC_URL=https://api.devnet.solana.com`
  - `CORS_ORIGIN=https://<frontend-service>.up.railway.app`

## Notes
- Frontend production calls default to `'/api'`. When running on different origins on Railway, set `VITE_API_BASE_URL` to the backend URL.
- Backend CORS must allow the frontend domain (`CORS_ORIGIN`).
- `.env.local` is ignored by git; production timing defaults to 24h when `VITE_WITHDRAWAL_WINDOW_SECONDS` is not set.

## Verification
1. Deploy both services.
2. Open frontend URL, connect wallet, and navigate to dApp.
3. Confirm API calls hit `https://<backend-service>.up.railway.app/api/*` and succeed.
4. Check `/health` on backend returns `{ ok: true }`.