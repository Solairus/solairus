import { useState, useCallback } from 'react';
import { Connection } from '@solana/web3.js';
import { getCurrentRpcConnection, switchRpcEndpoint, shouldSwitchRpc } from '@/utils/rpc-connection-manager';

export function useRpcConnection() {
  const [connection, setConnection] = useState<Connection>(() => getCurrentRpcConnection());
  const [hasError, setHasError] = useState(false);

  const handleRpcError = useCallback((error: unknown) => {
    if (shouldSwitchRpc(error)) {
      console.log('🔄 RPC error detected, switching endpoint...');
      try {
        const newConnection = switchRpcEndpoint();
        setConnection(newConnection);
        setHasError(false);
        return newConnection;
      } catch (switchError) {
        console.error('❌ Failed to switch RPC:', switchError);
        setHasError(true);
        throw error;
      }
    } else {
      setHasError(true);
      throw error;
    }
  }, []);

  const resetConnection = useCallback(() => {
    try {
      const newConnection = getCurrentRpcConnection();
      setConnection(newConnection);
      setHasError(false);
    } catch (error) {
      console.error('❌ Failed to reset connection:', error);
      setHasError(true);
    }
  }, []);

  return {
    connection,
    hasError,
    handleRpcError,
    resetConnection
  };
}