# Devnet USDT Transfer — Gotchas

## Mint is self-locked — cannot mint

The devnet USDT mint `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr` has its **mint authority set to itself** (the mint address). No keypair can mint new tokens. Attempting `mintTo()` gives:

```
custom program error: 0x4 → "owner does not match"
```

**Always transfer, never mint.**

## Deployer holds the USDT, not the treasury

| Key | Pubkey | USDT balance |
|-----|--------|-------------|
| **Deployer** (`~/.config/solana/deployer.json`) | `HZc1teoKrQs458TbJHYhsw1hxGSZL8C83axqSKST17oG` | ~9,925 USDT |
| Treasury (`SOLAIRUS_AUTHORITY_SECRET_BASE58`) | `AmepZKG9yawM9yThcHEF9zG8roucoHhHSVcnoaSezqN` | ~25 USDT (sweep target, not a faucet) |

**Always send from the deployer keypair.**

## Exact command

From `backend/` directory:

```sh
cd backend
set -a && source .env && set +a && npx tsx -e "
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import * as fs from 'fs';

const USDT_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
const recipient = new PublicKey(process.argv[1]);
const amountWhole = parseFloat(process.argv[2] || '50');
const amountMicro = Math.round(amountWhole * 1_000_000);

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const deployer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync('/Users/nouvic/.config/solana/deployer.json', 'utf-8'))));
const senderAta = await getOrCreateAssociatedTokenAccount(conn, deployer, USDT_MINT, deployer.publicKey, false);
const recipientAta = await getOrCreateAssociatedTokenAccount(conn, deployer, USDT_MINT, recipient);
const sig = await transfer(conn, deployer, senderAta.address, recipientAta.address, deployer.publicKey, amountMicro);
console.log('TX:', \`https://explorer.solana.com/tx/\${sig}?cluster=devnet\`);
" <recipient-address> <amount-whole>
```

## Recipient needs SOL for rent

The ATA creation costs ~0.002 SOL (covered by the sender). But the recipient needs minimal SOL to exist on-chain — if sending to a brand-new address, airdrop first:

```sh
solana airdrop 1 <recipient-address> --url devnet
```

Or fund with SOL from the deployer in the same transaction.
