# Auth API Update: Wallet Authentication Response

## Endpoint
- `POST /api/auth/wallet`

## Summary
- The response now includes `credit_balance_micro` alongside the existing `bonus_balance_micro`.

## Request Body
```
{
  "walletAddress": "<base58>",
  "sponsorPubkey": "<base58>" // optional
}
```

## Response
```
{
  "jwt": "<token>",
  "user": {
    "user_address": "<base58>",
    "license_status": "active|none|expired|revoked",
    "license_expiration": "<ISO8601>|null",
    "ref_by": "<user_id>|null",
    "bonus_balance_micro": "<string>",
    "credit_balance_micro": "<string>"
  }
}
```

## Notes
- Both balances are returned as strings to preserve precision (micro-USDT, 6 decimals).
- On failure to read balances, the fields default to "0" without affecting authentication.