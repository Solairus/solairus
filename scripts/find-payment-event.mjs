#!/usr/bin/env node

/**
 * Search recent transactions for a PaymentMade event carrying the provided orderId.
 *
 * Usage:
 *   node scripts/find-payment-event.mjs <payerPubkey> <orderId>
 *
 * Optionally, pass a custom RPC endpoint as third argument. Otherwise the script
 * uses SOLANA_RPC_URL_MAINNET (falling back to VITE_SOLANA_RPC_URL_MAINNET etc).
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

if (process.argv.length < 4) {
  console.error('Usage: node scripts/find-payment-event.mjs <payerPubkey> <orderId> [rpcUrl]');
  process.exit(1);
}

const payerAddress = new PublicKey(process.argv[2]);
const targetOrderId = process.argv[3];
const explicitRpc = process.argv[4];

const RPC_ENV_KEYS = [
  'SOLANA_RPC_URL_MAINNET',
  'SOLANA_RPC_URL_MAINNET_2',
  'SOLANA_RPC_URL_MAINNET_3',
  'SOLANA_RPC_URL_MAINNET_4',
  'SOLANA_RPC_URL_MAINNET_5',
  'VITE_SOLANA_RPC_URL_MAINNET',
  'VITE_SOLANA_RPC_URL_MAINNET_2',
  'VITE_SOLANA_RPC_URL_MAINNET_3',
  'VITE_SOLANA_RPC_URL_MAINNET_4',
  'VITE_SOLANA_RPC_URL_MAINNET_5',
];

function resolveRpcUrl() {
  if (explicitRpc) return explicitRpc;
  for (const key of RPC_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      return value.endsWith('/') ? value : `${value}/`;
    }
  }
  throw new Error('No RPC endpoint provided. Set SOLANA_RPC_URL_MAINNET or pass URL as third argument.');
}

const rpcUrl = resolveRpcUrl();
const connection = new Connection(rpcUrl, 'confirmed');
const idlPath = path.resolve(new URL('.', import.meta.url).pathname, '../server/idl/solairus_pay.json');
const solairusPayIdl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const programId =
  process.env.SOLAIRUS_PAY_PROGRAM_ID ??
  (solairusPayIdl.address || process.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID);
if (!programId) {
  console.error('Missing SOLAIRUS_PAY_PROGRAM_ID or IDL address. Unable to parse events.');
  process.exit(1);
}
const coder = new BorshCoder(solairusPayIdl);
const parser = new EventParser(new PublicKey(programId), coder);

async function run() {
  console.log(`Searching payments for payer ${payerAddress.toBase58()} on ${rpcUrl}`);
  const signatures = await connection.getSignaturesForAddress(payerAddress, { limit: 100 });
  console.log(`Fetched ${signatures.length} recent signatures`);

  for (const sig of signatures) {
    const parsed = await connection.getParsedTransaction(sig.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!parsed || !parsed.meta?.logMessages) continue;
    for (const event of parser.parseLogs(parsed.meta.logMessages)) {
      if (event.name !== 'PaymentMade') continue;
      const memoField = event.data?.memo;
      const memo =
        typeof memoField === 'string'
          ? memoField
          : memoField instanceof Uint8Array
          ? Buffer.from(memoField).toString('utf8')
          : String(memoField ?? '');
      if (memo === targetOrderId) {
        const normalizeKey = (value) => {
          try {
            if (!value) return undefined;
            if (value instanceof Uint8Array) return new PublicKey(value).toBase58();
            if (value instanceof PublicKey) return value.toBase58();
            if (typeof value === 'string') return new PublicKey(value).toBase58();
            if (value && typeof value === 'object' && 'toString' in value) {
              return new PublicKey(value.toString()).toBase58();
            }
          } catch {
            return value?.toString?.();
          }
          return value;
        };

        console.log('\n✅ Found matching transaction!');
        console.log(`Signature: ${sig.signature}`);
        console.log(`Slot: ${parsed.slot}`);
        console.log(`Payer: ${normalizeKey(event.data?.payer)}`);
        console.log(`Recipient: ${normalizeKey(event.data?.recipient)}`);
        console.log(`Reference: ${normalizeKey(event.data?.reference)}`);
        console.log(`Mint: ${normalizeKey(event.data?.mint)}`);
        console.log(`Amount (raw): ${event.data?.amount?.toString?.() ?? event.data?.amount}`);
        console.log(`Decimals: ${event.data?.decimals}`);
        return;
      }
    }
  }

  console.log('\nNo PaymentMade event found with that orderId in the recent signatures.');
  process.exit(1);
}

run().catch((err) => {
  console.error('Failed to search payments:', err);
  process.exit(1);
});

