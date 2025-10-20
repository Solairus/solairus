import { useState, useCallback } from 'react'
import { Connection } from '@solana/web3.js'
import { getHealthyRpcConnection, switchRpcEndpoint, testRpcEndpoints } from '@/utils/rpc-switcher'
import Swal from 'sweetalert2'

type ClusterName = 'mainnet-beta' | 'devnet' | 'testnet'

export function useRpcSwitcher(cluster: ClusterName = 'mainnet-beta') {
  const [isLoading, setIsLoading] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const getConnection = useCallback(async (): Promise<Connection | null> => {
    setIsLoading(true)
    setLastError(null)
    
    try {
      const connection = await getHealthyRpcConnection(cluster)
      return connection
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setLastError(errorMessage)
      console.error('Failed to get RPC connection:', error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  const switchRpc = useCallback(async (): Promise<Connection | null> => {
    setIsLoading(true)
    setLastError(null)
    
    try {
      const connection = await switchRpcEndpoint(cluster)
      
      // Show success notification
      // Swal.fire({
      //   icon: 'success',
      //   title: '🔄 RPC Switched',
      //   text: `Successfully switched to a new RPC endpoint for ${cluster}`,
      //   toast: true,
      //   position: 'top-end',
      //   showConfirmButton: false,
      //   timer: 3000,
      //   timerProgressBar: true
      // })
      
      return connection
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setLastError(errorMessage)
      
      // Show error notification
      // Swal.fire({
      //   icon: 'error',
      //   title: '❌ RPC Switch Failed',
      //   text: errorMessage,
      //   toast: true,
      //   position: 'top-end',
      //   showConfirmButton: false,
      //   timer: 5000,
      //   timerProgressBar: true
      // })
      
      console.error('Failed to switch RPC:', error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [cluster])

  const testEndpoints = useCallback(async () => {
    console.error('🚫 RPC health checks are disabled to prevent rate limit exhaustion!')
    
    Swal.fire({
      icon: 'info',
      title: '🚫 Health Checks Disabled',
      text: 'RPC health checks are disabled to preserve rate limits. Endpoints are tested only when actually used.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true
    })
    
    return []
  }, [cluster])

  const handleConnectionError = useCallback(async (error: Error): Promise<Connection | null> => {
    console.warn('Connection error detected, attempting RPC switch:', error)
    
    // Show notification about connection issue
    // Swal.fire({
    //   icon: 'warning',
    //   title: '⚠️ Connection Issue',
    //   text: 'Attempting to switch to a better RPC endpoint...',
    //   toast: true,
    //   position: 'top-end',
    //   showConfirmButton: false,
    //   timer: 3000,
    //   timerProgressBar: true
    // })
    
    // Try to switch to a better RPC
    return switchRpc()
  }, [switchRpc])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  return {
    isLoading,
    lastError,
    getConnection,
    switchRpc,
    testEndpoints,
    handleConnectionError,
    clearError
  }
}

export default useRpcSwitcher