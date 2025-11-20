## Issue
Frontend calls `POST /api/admin/buckets/:bucketType/withdraw/init`, but backend exposes `POST /api/buckets/:bucketType/withdraw/init`. This mismatch returns 404.

## Fix
- Refactor the existing bucket withdrawal init route logic into a helper function within `server/routes/admin.ts`.
- Add an alias route `POST /api/admin/buckets/:bucketType/withdraw/init` that calls the same helper to avoid code duplication.

## Safety
- No logic changes; only an alias path and small refactor. Role gating and unit/micro conversions remain intact.

Proceeding to implement the alias route and refactor.