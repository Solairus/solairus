import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCorsInfo, PREMIUM_RPC_PROVIDERS } from '@/utils/cors-friendly-rpcs'
import Swal from 'sweetalert2'

export function CorsInfo() {
  const [showDetails, setShowDetails] = useState(false)

  const showCorsExplanation = () => {
    Swal.fire({
      icon: 'info',
      title: '🌐 CORS & RPC Endpoints',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><strong>Why do some RPCs fail in development?</strong></p>
          <p>Many RPC providers block requests from <code>localhost</code> for security (CORS policy).</p>
          
          <hr style="margin: 15px 0;">
          
          <p><strong>✅ CORS-Friendly (work from localhost):</strong></p>
          <ul>
            <li>⛓️ Chainstack RPC (reliable & fast)</li>
            <li>🔮 Alchemy Premium (with API key)</li>
            <li>🏛️ Solana Labs official RPCs</li>
            <li>🌊 Project Serum RPC</li>
            <li>🏘️ Some community RPCs</li>
          </ul>
          
          <p><strong>❌ CORS-Blocked (require production domain):</strong></p>
          <ul>
            <li>💎 Premium RPC providers (Helius, QuickNode, Alchemy)</li>
            <li>🔐 Private/paid RPC endpoints</li>
            <li>🛡️ Security-focused services</li>
          </ul>
          
          <hr style="margin: 15px 0;">
          
          <p><strong>🚀 Solutions:</strong></p>
          <ul>
            <li><strong>Development:</strong> Use Solana Labs RPCs (rate limited but work)</li>
            <li><strong>Production:</strong> Deploy to domain - all RPCs work normally</li>
            <li><strong>Premium:</strong> Get API keys and add to environment variables</li>
          </ul>
        </div>
      `,
      width: 600,
      confirmButtonText: 'Got it!'
    })
  }

  const showPremiumProviders = () => {
    const providerList = Object.entries(PREMIUM_RPC_PROVIDERS)
      .map(([key, provider]) => `
        <div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px;">
          <strong>${provider.name}</strong><br>
          <small>🌐 <a href="${provider.website}" target="_blank">${provider.website}</a></small><br>
          <small>✨ ${provider.features.join(', ')}</small>
        </div>
      `).join('')

    Swal.fire({
      icon: 'info',
      title: '💎 Premium RPC Providers',
      html: `
        <div style="text-align: left;">
          <p>For production apps, consider these premium RPC providers:</p>
          ${providerList}
          <hr style="margin: 15px 0;">
          <p><strong>💡 Benefits of Premium RPCs:</strong></p>
          <ul style="font-size: 14px;">
            <li>🚀 Higher rate limits</li>
            <li>⚡ Better performance</li>
            <li>🛠️ Enhanced APIs</li>
            <li>📊 Analytics & monitoring</li>
            <li>🎯 Dedicated support</li>
          </ul>
        </div>
      `,
      width: 600,
      confirmButtonText: 'Close'
    })
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🌐 CORS & RPC Information</span>
          <Badge variant="outline">Development</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-2">
          <p>
            <strong>🔍 Why do some RPCs fail?</strong> Many providers block localhost requests (CORS policy).
          </p>
          <p>
            <strong>✅ Working in Development:</strong> Chainstack, Alchemy (Premium) & Solana Labs official RPCs
          </p>
          <p>
            <strong>🚀 Working in Production:</strong> All RPCs work when deployed to a domain
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={showCorsExplanation}
            variant="outline"
            size="sm"
          >
            📚 Learn About CORS
          </Button>
          <Button 
            onClick={showPremiumProviders}
            variant="outline"
            size="sm"
          >
            💎 Premium RPC Providers
          </Button>
        </div>

        {showDetails && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <pre className="text-xs whitespace-pre-wrap">
              {getCorsInfo()}
            </pre>
          </div>
        )}

        <Button 
          onClick={() => setShowDetails(!showDetails)}
          variant="ghost"
          size="sm"
          className="w-full"
        >
          {showDetails ? '🔼 Hide Details' : '🔽 Show Technical Details'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default CorsInfo