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
import process from 'node:process';
import { Buffer } from 'node:buffer';

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

const PAYMENT_MADE_DISCRIMINATOR = Buffer.from([227, 251, 123, 16, 133, 220, 83, 242]);
const MEMO_OFFSET = 32 + 32 + 32 + 8 + 1 + 32; // 137

function extractMemoFromLog(log) {
  if (!log.includes('Program data:')) return null;
  const base64 = log.split('Program data: ')[1]?.trim();
  if (!base64) return null;
  const buf = Buffer.from(base64, 'base64');
  if (buf.length < MEMO_OFFSET + 4) return null;
  const discriminator = buf.subarray(0, 8);
  if (!discriminator.equals(PAYMENT_MADE_DISCRIMINATOR)) return null;
  const memoLen = buf.readUInt32LE(MEMO_OFFSET);
  const start = MEMO_OFFSET + 4;
  if (buf.length < start + memoLen) return null;
  return buf.subarray(start, start + memoLen).toString('utf8');
}

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
    for (const log of parsed.meta.logMessages) {
      const memo = extractMemoFromLog(log);
      if (memo && memo === targetOrderId) {
        console.log('\n✅ Found matching transaction!');
        console.log(`Signature: ${sig.signature}`);
        console.log(`Slot: ${parsed.slot}`);
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

