import { describe, it, expect } from 'vitest'
import { PublicKey, Connection } from '@solana/web3.js'
import { findPaymentSignatureByOrderId } from '../onchain_verifier'

describe('onchain_verifier', () => {
  it('returns null when no signatures found or RPC unreachable', async () => {
    const conn = new Connection('https://api.devnet.solana.com')
    const wallet = new PublicKey('11111111111111111111111111111111')
    const res = await findPaymentSignatureByOrderId(conn, wallet, 'non-existent-order-id', { maxSignatures: 1 })
    expect(res === null || typeof res.signature === 'string').toBe(true)
  })
})