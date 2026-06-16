import React, { useState, useEffect } from 'react'
import { testRpcEndpoints, getRpcStats, reinitializeRpcSwitcher, rpcSwitcher } from '../utils/rpc-switcher'

interface RpcEndpoint {
  url: string
  name: string
  isWorking?: boolean
  lastChecked?: number
  responseTime?: number
}

export const RpcDebug: React.FC = () => {
  const [endpoints, setEndpoints] = useState<RpcEndpoint[]>([])
  const [testing, setTesting] = useState(false)
  const [cluster] = useState<'mainnet-beta' | 'devnet' | 'testnet'>('mainnet-beta')

  const loadEndpoints = () => {
    const stats = getRpcStats(cluster)
    setEndpoints(stats)
  }

  const testEndpoints = async () => {
    setTesting(true)
    try {
      console.log('🧪 Testing RPC endpoints (this will make network requests)')
      const results = await testRpcEndpoints(cluster)
      setEndpoints(results)
    } catch (error) {
      console.error('Error testing endpoints:', error)
    } finally {
      setTesting(false)
    }
  }

  const handleReinitialize = () => {
    reinitializeRpcSwitcher()
    loadEndpoints()
  }

  useEffect(() => {
    loadEndpoints()
  }, [cluster, loadEndpoints])

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      padding: '16px', 
      maxWidth: '400px',
      fontSize: '12px',
      zIndex: 1000,
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>🔧 RPC Debug ({cluster})</h3>
      
      <div style={{ marginBottom: '12px' }}>
        <button 
          onClick={testEndpoints} 
          disabled={testing}
          style={{ 
            marginRight: '8px', 
            padding: '4px 8px', 
            fontSize: '11px',
            background: testing ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: testing ? 'not-allowed' : 'pointer'
          }}
        >
          {testing ? 'Testing...' : 'Test All'}
        </button>
        
        <button 
          onClick={handleReinitialize}
          style={{ 
            padding: '4px 8px', 
            fontSize: '11px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reinitialize
        </button>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {endpoints.length === 0 ? (
          <p style={{ margin: 0, color: '#666' }}>No endpoints configured</p>
        ) : (
          endpoints.map((endpoint, index) => (
            <div 
              key={index} 
              style={{ 
                marginBottom: '8px', 
                padding: '8px', 
                background: '#f8f9fa', 
                borderRadius: '4px',
                border: `1px solid ${
                  endpoint.isWorking === true ? '#28a745' : 
                  endpoint.isWorking === false ? '#dc3545' : '#6c757d'
                }`
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {endpoint.isWorking === true ? '✅' : 
                 endpoint.isWorking === false ? '❌' : '⏳'} {endpoint.name}
              </div>
              <div style={{ color: '#666', fontSize: '10px', wordBreak: 'break-all' }}>
                {endpoint.url}
              </div>
              {endpoint.responseTime && (
                <div style={{ color: '#28a745', fontSize: '10px' }}>
                  Response: {endpoint.responseTime}ms
                </div>
              )}
              {endpoint.lastChecked && (
                <div style={{ color: '#666', fontSize: '10px' }}>
                  Checked: {new Date(endpoint.lastChecked).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '12px', fontSize: '10px', color: '#666' }}>
        Environment: {import.meta.env.VITE_SOLANA_RPC_URL_MAINNET || 'Not set'}
      </div>
    </div>
  )
}