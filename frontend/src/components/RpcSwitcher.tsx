import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { testRpcEndpoints, switchRpcEndpoint, getRpcStats } from '@/utils/rpc-switcher'
import { useWallet } from '@/contexts/wallet-context'
import Swal from 'sweetalert2'

type ClusterName = 'mainnet-beta' | 'devnet' | 'testnet'

interface RpcEndpoint {
  url: string
  name: string
  isWorking?: boolean
  lastChecked?: number
  responseTime?: number
}

export function RpcSwitcher() {
  const { provider } = useWallet()
  const [endpoints, setEndpoints] = useState<RpcEndpoint[]>([])
  const [testing, setTesting] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [currentCluster, setCurrentCluster] = useState<ClusterName>('mainnet-beta')

  useEffect(() => {
    // Determine current cluster from environment
    const override = (() => {
      try {
        return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase()
      } catch {
        return ""
      }
    })()
    const clusterStr = (override || (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet")).toLowerCase()
    const cluster = clusterStr === "mainnet" || clusterStr === "mainnet-beta"
      ? "mainnet-beta"
      : clusterStr === "testnet"
        ? "testnet"
        : "devnet"

    setCurrentCluster(cluster)
    // Removed automatic endpoint stats loading to prevent RPC calls
    console.log(`🌐 RPC Switcher initialized for ${cluster} - stats loading disabled to preserve rate limits`)
  }, [])

  const loadEndpointStats = (cluster: ClusterName) => {
    const stats = getRpcStats(cluster)
    setEndpoints(stats)
  }

  const handleTestEndpoints = async () => {
    Swal.fire({
      icon: 'info',
      title: '🚫 Health Checks Disabled',
      text: 'RPC health checks are disabled to preserve rate limits. Endpoints are only tested when actually used for real operations.',
      timer: 4000,
      showConfirmButton: false
    })
    console.error('🚫 RPC health checks are disabled to prevent rate limit exhaustion!')
  }

  const handleSwitchRpc = async () => {
    setSwitching(true)
    try {
      await switchRpcEndpoint(currentCluster)
      // Refresh the page to use the new connection
      window.location.reload()
    } catch (error) {
      console.error('Failed to switch RPC:', error)
      Swal.fire({
        icon: 'error',
        title: 'Switch Failed',
        text: 'Failed to switch to a healthy RPC endpoint',
        timer: 3000,
        showConfirmButton: false
      })
    } finally {
      setSwitching(false)
    }
  }

  const getStatusBadge = (endpoint: RpcEndpoint) => {
    if (endpoint.lastChecked === undefined) {
      return <Badge variant="secondary">Untested</Badge>
    }

    if (endpoint.isWorking) {
      const responseTime = endpoint.responseTime || 0
      const variant = responseTime < 1000 ? 'default' : responseTime < 3000 ? 'secondary' : 'destructive'
      return <Badge variant={variant}>✅ {responseTime}ms</Badge>
    }

    return <Badge variant="destructive">❌ Failed</Badge>
  }

  const getCurrentRpcUrl = () => {
    if (!provider) return 'Not connected'
    return provider.rpcEndpoint || 'Unknown'
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🔄 RPC Connection Manager</span>
          <Badge variant="outline">{currentCluster}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Connection */}
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-sm font-medium">Current RPC:</div>
          <div className="text-xs text-muted-foreground font-mono break-all">
            {getCurrentRpcUrl()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleTestEndpoints}
            disabled={testing}
            variant="outline"
            size="sm"
          >
            {testing ? '🔄 Testing...' : '🧪 Test All Endpoints'}
          </Button>
          <Button
            onClick={handleSwitchRpc}
            disabled={switching}
            size="sm"
          >
            {switching ? '🔄 Switching...' : '🔀 Switch to Best RPC'}
          </Button>
        </div>

        {/* Endpoint List */}
        {endpoints.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Available Endpoints:</div>
            <div className="space-y-1">
              {endpoints.map((endpoint, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{endpoint.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {endpoint.url}
                    </div>
                  </div>
                  <div className="ml-2">
                    {getStatusBadge(endpoint)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground">
          <p>💡 <strong>Tip:</strong> The smart RPC switcher automatically finds the fastest, most reliable endpoint.</p>
          <p>🔧 <strong>Manual Switch:</strong> Use "Switch to Best RPC" if you're experiencing connection issues.</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default RpcSwitcher