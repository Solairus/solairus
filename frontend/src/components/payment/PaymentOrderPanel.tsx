import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OrdersService, type OrderType, type PaymentOrder } from '@/services/payment/orders-service'

/**
 * PaymentOrderPanel — shared per-order payment UI.
 * Used identically for license activation, deposit/top-up, and agent deployment.
 * Flow: create order → show unique address + QR + amount + countdown → poll until
 *       completed (fires onCompleted) or expired (offer a new order).
 */
export interface PaymentOrderPanelProps {
  type: OrderType
  amountMicro?: number
  tierId?: number
  /** Fired once when the order is detected/settled on-chain. */
  onCompleted?: (order: PaymentOrder) => void
  onCancel?: () => void
  pollIntervalMs?: number
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PaymentOrderPanel({ type, amountMicro, tierId, onCompleted, onCancel, pollIntervalMs = 5000 }: PaymentOrderPanelProps) {
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [copied, setCopied] = useState(false)
  const [verifying, setVerifying] = useState(false)
  // Collision (skill pattern): backend may return an existing active order. Offer Continue vs Cancel & New.
  const [resumedExisting, setResumedExisting] = useState(false)

  // Keep latest onCompleted without re-triggering the poll effect.
  const onCompletedRef = useRef(onCompleted)
  onCompletedRef.current = onCompleted
  const completedFiredRef = useRef(false)

  const createOrder = useCallback(async () => {
    setLoading(true)
    setError(null)
    completedFiredRef.current = false
    try {
      const r = await OrdersService.init({ type, amountMicro, tierId })
      if (!r.order) { setError('Could not create payment order'); return }
      setResumedExisting(r.info === 'active_order_exists')
      setOrder(r.order)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }, [type, amountMicro, tierId])

  // Cancel & New (skill collision pattern): drop the resumed order and mint a fresh one.
  const cancelAndNew = useCallback(async () => {
    if (order) { try { await OrdersService.cancel(order.order_ref) } catch { /* ignore */ } }
    setResumedExisting(false)
    await createOrder()
  }, [order, createOrder])

  useEffect(() => { void createOrder() }, [createOrder])

  // Countdown to expiry.
  useEffect(() => {
    if (!order) return
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [order])

  // Poll while pending — keyed only by ref + status to avoid interval churn.
  const orderRef = order?.order_ref
  const status = order?.status
  useEffect(() => {
    if (!orderRef || status !== 'pending') return
    const id = setInterval(async () => {
      try {
        const updated = await OrdersService.get(orderRef)
        setOrder(updated)
        if (updated.status === 'completed' && !completedFiredRef.current) {
          completedFiredRef.current = true
          onCompletedRef.current?.(updated)
        }
      } catch { /* transient RPC/network — keep polling */ }
    }, pollIntervalMs)
    return () => clearInterval(id)
  }, [orderRef, status, pollIntervalMs])

  const handleVerifyNow = async () => {
    if (!order) return
    setVerifying(true)
    try {
      const updated = await OrdersService.verify(order.order_ref)
      setOrder(updated)
      if (updated.status === 'completed' && !completedFiredRef.current) {
        completedFiredRef.current = true
        onCompletedRef.current?.(updated)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleCopy = async () => {
    if (!order) return
    try {
      await navigator.clipboard.writeText(order.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  if (loading) {
    return (
      <Card className="bg-white/80 border-gray-200">
        <CardContent className="p-6 flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-600">Generating your payment address…</p>
        </CardContent>
      </Card>
    )
  }

  if (error && !order) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-center space-y-3">
          <p className="text-sm font-semibold text-red-700">Could not start payment</p>
          <p className="text-xs text-red-600 break-words">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={() => void createOrder()} className="bg-blue-600 hover:bg-blue-700 text-white">Try again</Button>
            {onCancel && <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!order) return null

  if (order.status === 'completed') {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-6 text-center space-y-2">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">✅</div>
          <h3 className="text-lg font-bold text-green-800">Payment received</h3>
          <p className="text-sm text-green-700">Your {order.type} order has been confirmed.</p>
        </CardContent>
      </Card>
    )
  }

  if (order.status === 'expired' || order.status === 'cancelled') {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 text-center space-y-3">
          <p className="text-sm font-semibold text-orange-700">This payment window {order.status === 'expired' ? 'expired' : 'was cancelled'}</p>
          <p className="text-xs text-orange-600">Start a new order to get a fresh address.</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={() => void createOrder()} className="bg-blue-600 hover:bg-blue-700 text-white">New order</Button>
            {onCancel && <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>
    )
  }

  // pending / processing
  const usdt = order.expected_micro && order.expected_micro > 0 ? (order.expected_micro / 1_000_000) : null
  const uri = OrdersService.solanaPayUri(order)

  return (
    <Card className="bg-white/80 border-gray-200">
      <CardContent className="p-4 space-y-3">
        <div className="text-center space-y-1">
          <h3 className="text-base font-semibold text-gray-800">
            {usdt !== null ? `Send exactly ${usdt} USDT` : 'Send USDT to deposit'}
          </h3>
          <p className="text-xs text-gray-500">
            {order.cluster === 'mainnet-beta' ? 'Solana (USDT SPL)' : `Solana ${order.cluster} (USDT SPL)`}
          </p>
        </div>

        <div className="flex justify-center">
          <div className="bg-white p-2 rounded-lg border border-gray-200">
            <QRCodeSVG value={uri} size={168} includeMargin />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <p className="text-[11px] text-gray-500 mb-1">Payment address (unique to this order)</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-gray-800 break-all flex-1">{order.address}</code>
            <Button size="sm" variant="outline" className="text-xs px-2 py-1 h-7" onClick={handleCopy}>{copied ? 'Copied' : 'Copy'}</Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{order.status === 'processing' ? 'Confirming payment…' : 'Awaiting payment'}</span>
          <span className={`font-mono ${remaining < 60 ? 'text-red-600' : 'text-gray-700'}`}>{formatCountdown(remaining)}</span>
        </div>

        {order.status === 'pending' && (
          <div className="bg-blue-50 border border-blue-100 rounded p-2">
            <p className="text-[11px] text-blue-700">
              {resumedExisting
                ? 'You have a pending order from a previous session — use the address below to send USDT.'
                : 'Detection is automatic — this updates as soon as your payment lands. You can also check now.'}
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-600 text-center">{error}</p>}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleVerifyNow} disabled={verifying} className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
            {verifying ? 'Checking…' : 'Check now'}
          </Button>
          {resumedExisting && (
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => void cancelAndNew()}>
              Cancel &amp; new
            </Button>
          )}
          {onCancel && <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>}
        </div>
      </CardContent>
    </Card>
  )
}

export default PaymentOrderPanel
