// Seed script: insert sample transactions for UI testing
// Purpose: Provide demo data for listing and detail views without relying on real signatures
// Inputs: DATABASE_URL in backend/.env
// Outputs: Inserts rows into transactions table with varied types and statuses
const path = require('path')
require('dotenv').config()
// Also load root project .env to pick up ADMIN_PUBKEY and marketer keys
try {
  const rootEnvPath = path.resolve(__dirname, '..', '..', '.env')
  require('dotenv').config({ path: rootEnvPath })
  console.log('[seed] loaded root .env at', rootEnvPath)
} catch (_) {}
const { Client } = require('pg')
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js')
const ADMINS_ONLY = process.argv.includes('--admins-only')
const ADMINS_ARG = (process.argv.find((a) => a.startsWith('--admins=')) || '').split('=')[1] || ''

async function seed() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString })
  await client.connect()

  const nowTag = Date.now()
  const txs = [
    {
      type: 'license_activation',
      status: 'pending',
      signature: null,
      initiator_wallet: 'DEMO_INITIATOR_A11111111111111111111111111111111',
      recipient_wallet: 'DEMO_RECIPIENT_A1111111111111111111111111111111',
      program_id: null,
      amount: 1000000, // 1.000000 USDT
      mint_address: 'DEMO_USDT_DEVNET_MINT_11111111111111111111111',
      decimals: 6,
      metadata: { note: 'seed', tag: `demo-${nowTag}` },
    },
    {
      type: 'agent_activation',
      status: 'confirmed',
      signature: `SEED_SIG_${nowTag}_1`,
      initiator_wallet: 'DEMO_INITIATOR_B22222222222222222222222222222222',
      recipient_wallet: 'DEMO_RECIPIENT_B2222222222222222222222222222222',
      program_id: null,
      amount: 2500000, // 2.500000 USDT
      mint_address: 'DEMO_USDT_DEVNET_MINT_11111111111111111111111',
      decimals: 6,
      metadata: { note: 'seed', tag: `demo-${nowTag}` },
    },
    {
      type: 'user_withdrawal',
      status: 'pending',
      signature: `SEED_SIG_${nowTag}_2`,
      initiator_wallet: 'DEMO_INITIATOR_C33333333333333333333333333333333',
      recipient_wallet: null,
      program_id: null,
      amount: 500000, // 0.500000 USDT
      mint_address: 'DEMO_USDT_DEVNET_MINT_11111111111111111111111',
      decimals: 6,
      metadata: { note: 'seed', tag: `demo-${nowTag}` },
    },
    {
      type: 'role_withdrawal',
      status: 'failed',
      signature: `SEED_SIG_${nowTag}_3`,
      initiator_wallet: 'DEMO_INITIATOR_D44444444444444444444444444444444',
      recipient_wallet: null,
      program_id: null,
      amount: 750000, // 0.750000 USDT
      mint_address: 'DEMO_USDT_DEVNET_MINT_11111111111111111111111',
      decimals: 6,
      metadata: { note: 'seed', reason: 'demo failure', tag: `demo-${nowTag}` },
    },
  ]

  const sql = `
    INSERT INTO transactions (type, status, signature, initiator_wallet, recipient_wallet, program_id, amount, mint_address, decimals, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (signature) DO NOTHING
    RETURNING id
  `

  for (const t of txs) {
    const params = [
      t.type,
      t.status,
      t.signature,
      t.initiator_wallet,
      t.recipient_wallet,
      t.program_id,
      t.amount,
      t.mint_address,
      t.decimals,
      JSON.stringify(t.metadata),
    ]
    const res = await client.query(sql, params)
    const id = res.rows[0]?.id
    console.log(`[seed] ${t.type} (${t.status}) inserted${id ? ` as id ${id}` : ' (skipped due to conflict)'}`)
  }

  // Seed users
  const users = [
    { address: 'DEMO_INITIATOR_A11111111111111111111111111111111', status: 'active', expiration: new Date(Date.now() + 30*24*60*60*1000), refBy: null },
    { address: 'DEMO_INITIATOR_B22222222222222222222222222222222', status: 'active', expiration: new Date(Date.now() + 45*24*60*60*1000), refBy: 'DEMO_INITIATOR_A11111111111111111111111111111111' },
    { address: 'DEMO_INITIATOR_C33333333333333333333333333333333', status: 'none', expiration: null, refBy: null },
    { address: 'DEMO_INITIATOR_D44444444444444444444444444444444', status: 'revoked', expiration: null, refBy: null },
  ]

  // Map referral addresses to ids after insertion
  const insertedUserIds = new Map()
  for (const u of users) {
    const resp = await client.query(
      `INSERT INTO users (user_address, license_status, license_expiration) VALUES ($1, $2, $3)
       ON CONFLICT (user_address) DO UPDATE SET license_status = EXCLUDED.license_status, license_expiration = EXCLUDED.license_expiration
       RETURNING id`, [u.address, u.status, u.expiration]
    )
    const uid = resp.rows[0]?.id
    if (uid) insertedUserIds.set(u.address, uid)
    console.log(`[seed] user ${u.address} upserted${uid ? ` as id ${uid}` : ''}`)
  }

  // Update ref_by relations
  for (const u of users) {
    if (!u.refBy) continue
    const uid = insertedUserIds.get(u.address)
    const refId = insertedUserIds.get(u.refBy)
    if (uid && refId) {
      await client.query('UPDATE users SET ref_by = $1 WHERE id = $2', [refId, uid])
      console.log(`[seed] user ${u.address} set ref_by to id ${refId}`)
    }
  }

  // Seed one agent for user B
  const userBId = insertedUserIds.get('DEMO_INITIATOR_B22222222222222222222222222222222')
  if (userBId) {
    const exists = await client.query('SELECT id FROM agents WHERE user_id = $1 AND agent_label = $2 LIMIT 1', [userBId, 'Agent B1'])
    if (!exists.rows.length) {
      await client.query(
        `INSERT INTO agents (user_id, agent_label, status, activation_signature, metadata)
         VALUES ($1, $2, 'active', $3, $4)`,
        [userBId, 'Agent B1', `SEED_SIG_${nowTag}_1`, JSON.stringify({ note: 'seed' })]
      )
      console.log(`[seed] agent Agent B1 created for user id ${userBId}`)
    } else {
      console.log('[seed] agent Agent B1 already exists')
    }
  }

  // Helpers: upsert balance and add history events
  async function upsertBalance(client, userId) {
    const res = await client.query(
      `INSERT INTO balances (user_id, metadata)
       VALUES ($1, '{}'::jsonb)
       ON CONFLICT (user_id)
       DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING id`,
      [userId]
    )
    return res.rows[0]?.id
  }

  async function addHistory(client, balanceId, change, bucket, eventType, metadata) {
    await client.query(
      `INSERT INTO balance_history (balance_id, change, bucket, event_type, source_tx_id, metadata)
       VALUES ($1, $2, $3, $4, NULL, $5)`,
      [balanceId, change, bucket, eventType, JSON.stringify(metadata)]
    )
  }

  // Seed balances and history for User A
  try {
    const userAWallet = 'DEMO_INITIATOR_A11111111111111111111111111111111'
    const userAId = insertedUserIds.get(userAWallet) || null
    const balAId = await upsertBalance(client, userAId)
    if (balAId) {
      await addHistory(client, balAId, 2000000, 'main', 'deposit', { note: 'seed deposit A' })
      await addHistory(client, balAId, 100000, 'reward', 'reward', { note: 'seed reward A' })
      await addHistory(client, balAId, 50000, 'bonus', 'adjustment', { note: 'seed bonus A' })
      await addHistory(client, balAId, 500000, 'credit', 'adjustment', { note: 'seed credit A' })
      await addHistory(client, balAId, -300000, 'main', 'withdrawal', { note: 'seed withdrawal A' })
      const balAVal = await client.query('SELECT main_balance, bonus_balance, reward_balance, credit_balance FROM balances WHERE id = $1', [balAId])
      const a = balAVal.rows[0] || {}
      console.log(`[seed] balances A main=${a.main_balance} bonus=${a.bonus_balance} reward=${a.reward_balance} credit=${a.credit_balance}`)
    }
  } catch (e) {
    console.warn('[seed] balances/history A skipped due to constraint:', e?.message || e)
  }

  // Seed balances and history for User B
  try {
    const userBWallet = 'DEMO_INITIATOR_B22222222222222222222222222222222'
    const userBIdSafe = userBId || insertedUserIds.get(userBWallet) || null
    const balBId = await upsertBalance(client, userBIdSafe)
    if (balBId) {
      await addHistory(client, balBId, 500000, 'main', 'deposit', { note: 'seed deposit B' })
      await addHistory(client, balBId, 50000, 'reward', 'reward', { note: 'seed reward B' })
      const balBVal = await client.query('SELECT main_balance, bonus_balance, reward_balance, credit_balance FROM balances WHERE id = $1', [balBId])
      const b = balBVal.rows[0] || {}
      console.log(`[seed] balances B main=${b.main_balance} bonus=${b.bonus_balance} reward=${b.reward_balance} credit=${b.credit_balance}`)
    }
  } catch (e) {
    console.warn('[seed] balances/history B skipped due to constraint:', e?.message || e)
  }

  // Seed settings (typed key-value) with upsert to avoid duplicates
  const settings = [
    { key: 'site.title', type: 'string', value: 'Solairus', description: 'Public site title' },
    { key: 'site.description', type: 'string', value: 'Solana DeFi yield dApp', description: 'Public site description' },
    { key: 'site.metadata', type: 'object', value: { theme: 'dark', layout: 'mobile-app-shell' }, description: 'Misc public metadata for UI' },
    { key: 'license.fee_usdt', type: 'number', value: Math.round(Number(process.env.LICENSE_FEE_USDT ?? 25) * 1_000_000), description: 'License activation cost in micro-USDT (6 decimals)' },
    { key: 'license.term_days', type: 'number', value: Number(process.env.LICENSE_TERM_DAYS ?? 365), description: 'License expiration term in days' },
    { key: 'ui.enable_agent_dashboard', type: 'boolean', value: true, description: 'Feature flag: agent dashboard' },
    { key: 'ui.enable_tier_selection', type: 'boolean', value: true, description: 'Feature flag: tier selection' },
    { key: 'ui.enable_withdrawal_limits', type: 'boolean', value: true, description: 'Feature flag: withdrawal limits' },
  ]

  for (const s of settings) {
    await client.query(
      `INSERT INTO settings (key, value, type, description)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type, description = COALESCE(EXCLUDED.description, settings.description)`,
      [s.key, JSON.stringify(s.value), s.type, s.description || null]
    )
    console.log(`[seed] setting ${s.key} upserted`)
  }

  await client.end()
  console.log('[seed] done')
}

;(async () => {
  try {
    if (ADMINS_ONLY) {
      console.log('[seed] admins-only mode: skipping demo transactions/users/settings')
      await seedAdmins()
    } else {
      await seed()
      await seedAdmins()
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()

/**
 * Additional seeding: insert dev backend authority and admins from env into users table
 * This helper runs at module load time after seed() execution
 */
async function seedAdmins() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return
  const client = new Client({ connectionString })
  await client.connect()

  try {
    const adminList = (
      (process.env.ADMIN_PUBKEYS || '') + (ADMINS_ARG ? (process.env.ADMIN_PUBKEYS ? ',' : '') + ADMINS_ARG : '')
    )
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    // Include singular ADMIN_PUBKEY and marketer keys from root .env for convenience
    const extras = [
      process.env.ADMIN_PUBKEY,
      process.env.MARKETER_1_PUBKEY,
      process.env.MARKETER_2_PUBKEY,
    ].filter((s) => typeof s === 'string' && s.trim().length > 0)

    // Derive dev backend authority from program details (Upgradeable Loader ProgramData)
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet')
    const programIdStr = process.env.SOLAIRUS_PAY_PROGRAM_ID || '6hvnwbkJqbFAWBKbrj22giH33hVUTLuLcPAvtCkkpSZ4'
    const programId = new PublicKey(programIdStr)
    const connection = new Connection(rpcUrl, 'confirmed')
    let devAuthority = null
    try {
      const programInfo = await connection.getAccountInfo(programId)
      if (programInfo && programInfo.data && programInfo.data.length >= 36) {
        // Program account layout: [4-byte tag][32-byte ProgramData address]
        const programDataAddress = new PublicKey(programInfo.data.slice(4, 36))
        const programDataInfo = await connection.getAccountInfo(programDataAddress)
        if (programDataInfo && programDataInfo.data && programDataInfo.data.length >= 45) {
          // ProgramData layout: [4-byte tag][8-byte slot][1-byte option][32-byte upgrade authority if present]
          const hasAuthority = programDataInfo.data[12] === 1
          if (hasAuthority) {
            const authBytes = programDataInfo.data.slice(13, 45)
            devAuthority = new PublicKey(authBytes).toBase58()
          }
        }
      }
    } catch (e) {
      console.warn('[seed-admins] failed to derive program upgrade authority:', e?.message || e)
    }

    const addresses = new Set([...(adminList || []), ...extras])
    if (devAuthority) addresses.add(devAuthority)

    if (!addresses.size) {
      console.warn('[seed-admins] no admin/dev addresses discovered. Provide ADMIN_PUBKEYS env or use --admins=<comma-separated>')
    } else {
      for (const addr of addresses) {
        await client.query(
          `INSERT INTO users (user_address, license_status, license_expiration)
           VALUES ($1, 'active', NULL)
           ON CONFLICT (user_address) DO UPDATE SET license_status = 'active', license_expiration = NULL`,
          [addr]
        )
        console.log(`[seed-admins] upserted admin/dev user ${addr} with non-expiry active license`)
      }
    }
  } catch (e) {
    console.warn('[seed-admins] skipped:', e?.message || e)
  } finally {
    await client.end()
  }
}

// (seedAdmins is awaited in the main IIFE above)