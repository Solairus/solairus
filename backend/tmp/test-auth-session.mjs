/*
 * Test script: auth wallet and validate session endpoint
 * Purpose: E2E check for GET /api/auth/session using JWT from /api/auth/wallet
 */
const base = 'http://localhost:4001'
const addr = 'DEMO_INITIATOR_A11111111111111111111111111111111'

async function main() {
  const authResp = await fetch(base + '/api/auth/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: addr }),
  })
  const authJson = await authResp.json()
  console.log('[auth] status', authResp.status, 'jwt', authJson.jwt ? 'issued' : 'missing', 'user.id', authJson.user?.id)
  const jwt = authJson.jwt
  if (!jwt) throw new Error('JWT not returned')

  const sessResp = await fetch(base + '/api/auth/session', {
    headers: { Authorization: 'Bearer ' + jwt },
  })
  const sessJson = await sessResp.json()
  console.log('[session] status', sessResp.status, 'user.id', sessJson.user?.id, 'addr', sessJson.user?.user_address)
  if (sessResp.status !== 200) throw new Error('Session check failed: ' + JSON.stringify(sessJson))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})