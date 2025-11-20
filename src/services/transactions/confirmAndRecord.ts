import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js'
import { API_CONFIG, ApiClient } from '@/config/service-endpoints'

type TxLike = Transaction | VersionedTransaction

export async function confirmAndRecord(params: {
  connection: Connection
  signedTx: TxLike
  orderId?: string
  maxAttempts?: number
  delayMs?: number
}): Promise<{ signature: string }> {
  const { connection, signedTx, orderId } = params
  const maxAttempts = params.maxAttempts ?? 24
  const delayMs = params.delayMs ?? 5000

  const raw = 'serialize' in signedTx ? signedTx.serialize() : (signedTx as VersionedTransaction).serialize()
  const signature = await connection.sendRawTransaction(raw, { skipPreflight: false })

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const status = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })
    const s = status.value[0]
    if (s) {
      if (s.err) throw new Error(`Transaction failed: ${JSON.stringify(s.err)}`)
      if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') {
        if (orderId) {
          try {
            await ApiClient.post(`${API_CONFIG.getBaseUrl()}/transactions/record/signature`, { orderId, signature })
          } catch {}
          let finalized = false
          for (let i = 0; i < 24 && !finalized; i++) {
            await new Promise(r => setTimeout(r, 2000))
            try {
              const sResp = await ApiClient.get(`${API_CONFIG.getBaseUrl()}/transactions/${orderId}`)
              const sJson = await sResp.json()
              finalized = Boolean(sJson?.finalized)
            } catch {}
          }
        }
        return { signature }
      }
    }
    if (attempt < maxAttempts) await new Promise(r => setTimeout(r, delayMs))
  }
  throw new Error('Transaction confirmation timeout')
}