import { describe, it, expect, beforeEach } from 'vitest'
import * as anchor from '@coral-xyz/anchor'
import { ensureSolairusProgramsInitialized } from '@/utils/solairus-program-validation'
import { SolairusPayService, createProvider } from '@/services/wallet/solairus-pay'

function makeMockProvider(): anchor.AnchorProvider {
  const connection = new anchor.web3.Connection('https://api.devnet.solana.com')
  const wallet = {
    publicKey: anchor.web3.Keypair.generate().publicKey,
    signTransaction: async (tx: anchor.web3.Transaction) => tx,
    signAllTransactions: async (txs: anchor.web3.Transaction[]) => txs,
  } as unknown as anchor.Wallet
  return createProvider(connection, wallet)
}

describe('Solairus program ID lazy validation', () => {
  const originalEnv = { ...import.meta.env }

  beforeEach(() => {
    Object.keys(import.meta.env).forEach((k) => delete (import.meta.env as any)[k])
    Object.assign(import.meta.env, originalEnv)
  })

  it('does not require main program ID globally', () => {
    ;(import.meta.env as any).VITE_SOLAIRUS_MAIN_PROGRAM_ID = ''
    const fn = () => ensureSolairusProgramsInitialized()
    expect(fn).not.toThrow()
  })

  it('requires pay program ID only when constructing the service', () => {
    ;(import.meta.env as any).VITE_SOLAIRUS_PAY_PROGRAM_ID = ''
    const provider = makeMockProvider()
    const fn = () => new SolairusPayService(provider)
    expect(fn).toThrow()
  })

  it('succeeds when pay program ID is set', () => {
    ;(import.meta.env as any).VITE_SOLAIRUS_PAY_PROGRAM_ID = 'CMvEEAXnNKZs7brTjVp4dqtPzkdRqSjnFNG9zpBjUP3g'
    const provider = makeMockProvider()
    const service = new SolairusPayService(provider)
    expect(service.programId).toBeDefined()
  })
})