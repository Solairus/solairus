import { ApiClient, API_CONFIG } from '@/config/service-endpoints'

/**
 * OrdersService — client for the contract-free HD-wallet payment API.
 * Pay-per-order (license/agent) and deposit/top-up both flow through /orders.
 * The user pays USDT to the returned address; the backend detects, sweeps, and fulfills.
 */

export type OrderType = 'license' | 'agent' | 'deposit'
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'expired'

export interface PaymentOrder {
  order_ref: string
  type: OrderType
  address: string
  expected_micro: number | null
  status: OrderStatus
  tx_signature: string | null
  transaction_id: number | null
  expires_at: string
  mint: string | null
  cluster: string
}

export interface InitOrderResult {
  order?: PaymentOrder
  info?: 'active_order_exists'
}

export class OrdersService {
  /**
   * Create (or surface an existing) payment order.
   * Collision: backend returns HTTP 200 { info:'active_order_exists', order } — NOT an error.
   */
  static async init(params: { type: OrderType; amountMicro?: number; tierId?: number }): Promise<InitOrderResult> {
    const url = `${API_CONFIG.getBaseUrl()}/orders/init`
    const res = await ApiClient.post(url, params)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ? JSON.stringify(data.error) : `Order init failed (${res.status})`)
    return data as InitOrderResult
  }

  /** Poll a single order's status. */
  static async get(orderRef: string): Promise<PaymentOrder> {
    const url = `${API_CONFIG.getBaseUrl()}/orders/${encodeURIComponent(orderRef)}`
    const res = await ApiClient.get(url)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? `Order fetch failed (${res.status})`)
    return data.order as PaymentOrder
  }

  /** Force one on-chain detection pass (same logic as the background monitor). */
  static async verify(orderRef: string): Promise<PaymentOrder> {
    const url = `${API_CONFIG.getBaseUrl()}/orders/${encodeURIComponent(orderRef)}/verify`
    const res = await ApiClient.post(url, {})
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? `Order verify failed (${res.status})`)
    return data.order as PaymentOrder
  }

  /** Cancel a still-pending order. */
  static async cancel(orderRef: string): Promise<boolean> {
    const url = `${API_CONFIG.getBaseUrl()}/orders/${encodeURIComponent(orderRef)}/cancel`
    const res = await ApiClient.post(url, {})
    return res.ok
  }

  /** Build a Solana Pay URI for QR display. */
  static solanaPayUri(order: PaymentOrder): string {
    const params = new URLSearchParams()
    if (order.mint) params.set('spl-token', order.mint)
    if (order.expected_micro && order.expected_micro > 0) {
      params.set('amount', (order.expected_micro / 1_000_000).toString())
    }
    const qs = params.toString()
    return `solana:${order.address}${qs ? `?${qs}` : ''}`
  }
}
