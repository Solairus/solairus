## Scope
- Implement agent activation using `credit_balance` only (no on-chain).
- Create a transaction record with `order_id` similar to USDT flow.
- Do not trigger bucket distributions or affiliate commissions for credit activations.
- Enforce `credit_balance >= amountMicro` and never allow negative balances.

## Key Decisions
- Transaction `signature` column remains `NULL` to avoid downstream USDT-only distribution triggers in `applyPostConfirmation`. Instead, store a UI label in `metadata.signature_label = 'credit_balance'`.
- Transaction `status = 'confirmed'` after successful backend debit and agent creation (since no on-chain verification is required).

## Backend Changes
1. Add `POST /agents/activate` route (Express):
   - Body: `{ amountMicro: number, tierId?: number, tierName?: string, paymentMethod: 'credit' }`.
   - Use `res.locals.auth.sub` to resolve `user_id`.
   - Transactional steps:
     - Resolve tier by amount range if `tierId` not provided.
     - Resolve/create `balances.id` via `getOrCreateBalanceId`.
     - Pre-check `credit_balance` (`SELECT ... FOR UPDATE`); if `< amountMicro` return `400`.
     - Insert `transactions` row: `{ type: 'agent_activation', status: 'confirmed', signature: NULL, amount, mint_address: 'USDT_DEVNET' or fixed value, decimals: 6, order_id: UUID, metadata: { paymentMethod: 'credit', signature_label: 'credit_balance' } }`.
     - Debit `credit_balance` via `applyBalanceBucketChange(client, balanceId, 'credit_balance', 'debit', BigInt(amountMicro), txId, { source: 'agent_activation_credit' })`.
     - Insert `agents` row: `status='active'`, `amount=amountMicro`, `tier_id`, `metadata` includes `transaction_id` and `tier_name`.
     - Commit and return `{ activated: true, agent, transaction }`.
   - No calls to `distributeAffiliateBonuses` or bucket distribution services.

2. OrderId Flow:
   - Generate and persist `order_id` (UUID) on the transaction record.
   - Ensure `GET /api/transactions/:orderId` returns consistent status for UI polling (already implemented in `server/routes/transactions.ts`).

## Frontend Changes
3. Update `src/services/agent/agent-activation-service.ts`:
   - For `paymentMethod === 'credit'`, call backend `AGENT_ENDPOINTS.activateAgent` with decimal → micro conversion.
   - Return `AgentActivationResult` without `txSignature` (and include `activationId` from agent row).
   - Remove USDT ATA checks for credit path.

4. Update `AgentActivationModal` messaging for credit:
   - Processing text should reflect backend-only activation (no blockchain wording).
   - Success message remains tier-specific; omit tx signature display for credit.

## Tests
5. Backend tests:
   - Happy path: sufficient `credit_balance` → transaction confirmed, agent created.
   - Insufficient balance: respond `400` with no changes.

6. Frontend tests:
   - Service calls backend for credit path and handles success/error.
   - Modal shows non-blockchain processing copy for credit and displays results from backend.

## Safety & Constraints
- Maintain non-negative `credit_balance` invariant; abort on insufficient funds.
- Keep distribution logic untouched and protected by `signature != NULL` guard (we set `NULL`).
- Avoid modifying existing USDT activation and verification flows.

If approved, I will implement the backend route, adjust the frontend service/UI, and add tests accordingly, ensuring the transaction record has `order_id` and `metadata.signature_label = 'credit_balance'` for display. 