import React from 'react'
import RpcSwitcher from '@/components/RpcSwitcher'
import { useWallet } from '@/contexts/wallet-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function RpcTest() {
  const { provider, isConnected, account } = useWallet()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">🔄 RPC Connection Tester</h1>
        <p className="text-muted-foreground mt-2">
          Test and manage your Solana RPC connections
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span>Wallet:</span>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </Badge>
          </div>
          
          {account && (
            <div className="flex items-center gap-2">
              <span>Address:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {account.slice(0, 8)}...{account.slice(-8)}
              </code>
            </div>
          )}
          
          {provider && (
            <div className="flex items-center gap-2">
              <span>RPC Endpoint:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded break-all">
                {provider.rpcEndpoint}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RPC Switcher Component */}
      <RpcSwitcher />

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>🧪 Test All Endpoints:</strong> Check the health and response time of all configured RPC endpoints.
          </p>
          <p>
            <strong>🔀 Switch to Best RPC:</strong> Automatically switch to the fastest, most reliable endpoint.
          </p>
          <p>
            <strong>⚡ Smart Switching:</strong> The system automatically uses the best RPC when connecting wallets.
          </p>
          <p>
            <strong>🔧 Configuration:</strong> RPC endpoints are configured in your <code>.env</code> file using comma-separated URLs.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}