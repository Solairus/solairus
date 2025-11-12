#!/usr/bin/env node

/**
 * Check recent transactions in database and verify on-chain status
 *
 * Usage:
 *   node scripts/check-transactions.mjs [limit]
 */

import { query } from '../server/db.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import fs from 'node:fs';
import path from 'node:path';

const limit = parseInt(process.argv[2]) || 3;

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
  for (const key of RPC_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      return value.endsWith('/') ? value : `${value}/`;
    }
  }
  throw new Error('No RPC endpoint provided. Set SOLANA_RPC_URL_MAINNET or similar.');
}

const rpcUrl = resolveRpcUrl();
const connection = new Connection(rpcUrl, 'confirmed');

const idlPath = path.resolve(new URL('.', import.meta.url).pathname, '../server/idl/solairus_pay.json');
const solairusPayIdl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const programId = process.env.SOLAIRUS_PAY_PROGRAM_ID ?? solairusPayIdl.address;
const coder = new BorshCoder(solairusPayIdl);
const parser = new EventParser(new PublicKey(programId), coder);

async function checkTransactions() {
  try {
    console.log(`Checking last ${limit} transactions from database...`);
    console.log(`Using RPC: ${rpcUrl}`);
    console.log(`Program ID: ${programId}`);
    console.log('');

    const result = await query(`
      SELECT id, type, status, signature, order_id, amount, created_at, metadata
      FROM transactions
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    for (const [index, row] of result.rows.entries()) {
      console.log(`${index + 1}. Transaction ID: ${row.id}`);
      console.log(`   Type: ${row.type}, Status: ${row.status}`);
      console.log(`   Order ID: ${row.order_id || 'null'}`);
      console.log(`   Amount: ${row.amount}`);
      console.log(`   Created: ${row.created_at}`);

      if (row.signature) {
        console.log(`   Signature: ${row.signature.substring(0, 20)}...`);

        // Check on-chain status
        try {
          const status = await connection.getSignatureStatuses([row.signature], { searchTransactionHistory: true });
          const txStatus = status.value[0];

          if (txStatus) {
            if (txStatus.err) {
              console.log(`   ❌ On-chain: FAILED (${JSON.stringify(txStatus.err)})`);
            } else {
              const confirmations = txStatus.confirmationStatus === 'finalized' ? 32 : (txStatus.confirmations || 0);
              console.log(`   ✅ On-chain: ${txStatus.confirmationStatus} (${confirmations} confirmations)`);

              // Check for PaymentMade event
              if (row.type === 'license_activation' || row.type === 'agent_activation') {
                const parsed = await connection.getParsedTransaction(row.signature, {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0,
                });

                if (parsed && parsed.meta?.logMessages) {
                  let foundEvent = false;
                  for (const event of parser.parseLogs(parsed.meta.logMessages)) {
                    if (event.name === 'PaymentMade') {
                      const memoField = event.data?.memo;
                      const memo = typeof memoField === 'string' ? memoField :
                                 memoField instanceof Uint8Array ? Buffer.from(memoField).toString('utf8') :
                                 String(memoField ?? '');

                      console.log(`   💰 PaymentMade Event:`);
                      console.log(`      Memo: ${memo}`);
                      console.log(`      Amount: ${event.data?.amount?.toString()}`);
                      console.log(`      Order ID Match: ${memo === row.order_id ? '✅' : '❌'}`);
                      console.log(`      Amount Match: ${event.data?.amount?.toString() === row.amount.toString() ? '✅' : '❌'}`);
                      foundEvent = true;
                      break;
                    }
                  }
                  if (!foundEvent) {
                    console.log(`   ⚠️  No PaymentMade event found`);
                  }
                }
              }
            }
          } else {
            console.log(`   ❓ On-chain: Not found`);
          }
        } catch (err) {
          console.log(`   ❌ On-chain check failed: ${err.message}`);
        }
      } else {
        console.log(`   Signature: null`);
      }

      // Show metadata
      if (row.metadata && typeof row.metadata === 'object') {
        const meta = row.metadata;
        console.log(`   Phase: ${meta.phase || 'unknown'}`);
        console.log(`   Verified: ${meta.verified || 'unknown'}`);
        if (meta.failureReason) {
          console.log(`   Failure: ${meta.failureReason}`);
        }
      }

      console.log('');
    }

  } catch (err) {
    console.error('Error checking transactions:', err);
    process.exit(1);
  }
}

checkTransactions();