/**
 * Shared backend types for transactions
 */
export type TransactionType =
  | 'license_activation'
  | 'agent_activation'
  | 'user_withdrawal'
  | 'role_withdrawal'

export type TransactionStatus = 'pending' | 'confirmed' | 'failed'

export interface Transaction {
  id: number
  type: TransactionType
  status: TransactionStatus
  signature?: string
  initiator_wallet: string
  recipient_wallet?: string
  program_id?: string
  amount: number
  mint_address: string
  decimals: number
  order_id?: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}