## Changes
- Remove `@reown/appkit-adapter-ethers` from `dependencies` in `package.json` to eliminate unresolved peer deps and reduce bundle size.
- No code changes required (adapter not imported anywhere).
- Optional: add `@testing-library/dom` to satisfy peer warnings (keeps CI logs clean).

## Steps
1. Edit `package.json`:
   - Delete `"@reown/appkit-adapter-ethers"` from `dependencies`.
   - Optionally add `"@testing-library/dom": "^10"` to `devDependencies`.
2. Run `yarn install` locally and `yarn build` to confirm.
3. Commit and push; Railway should build cleanly.

## Rollback
- Re-add adapter later if EVM support is needed, with peers (`ethers`, `@ethersproject/sha2`).

Confirm and I'll apply changes and push.