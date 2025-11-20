## Problem
- The app crashes with `Cannot read properties of undefined (reading '_bn')` at `sponsor-tree.ts:7` when constructing `new PublicKey(import.meta.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID)`. This happens if the env var is undefined at runtime.

## Minimal Fix
- Remove the unused `PROGRAM_ID` constant from `sponsor-tree.ts` (it’s not referenced anywhere). This eliminates the `new PublicKey(undefined)` crash entirely.
- Optional hardening (not strictly required now): in `getDefaultSponsor()`, guard `VITE_DEFAULT_SPONSOR_ADDRESS` and fallback to a known safe address if missing.

## Impact
- No functional change to sponsor hierarchy logic; only prevents a fatal crash during module load.
- Keeps env unchanged.

Proceeding to remove the unused constant.