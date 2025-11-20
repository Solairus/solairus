require('dotenv/config')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined })
const query = (sql, params) => pool.query(sql, params)

function normalizeMicro(amount, decimals) {
  const d = typeof decimals === 'number' ? decimals : 6
  if (typeof amount === 'number') return Math.round(amount * Math.pow(10, d)).toString()
  if (typeof amount === 'string') {
    if (amount.includes('.')) return Math.round(Number(amount) * Math.pow(10, d)).toString()
    if (/^\d+$/.test(amount)) return amount
    return '0'
  }
  return '0'
}

async function main() {
  const sql = "SELECT id, order_id, type, amount, decimals, metadata FROM transactions WHERE status = 'pending' AND type IN ('user_withdrawal','role_withdrawal') ORDER BY created_at ASC"
  const res = await query(sql)
  for (const r of res.rows) {
    const md = r.metadata && typeof r.metadata === 'object' ? r.metadata : {}
    const bucket = r.type === 'role_withdrawal' ? (md.bucket_type || null) : 'user_bonus'
    const micro = normalizeMicro(r.amount, r.decimals)
    console.log(`id=${r.id} orderId=${r.order_id} type=${r.type} bucket=${bucket} amount=${r.amount} decimals=${r.decimals || 6} amountMicro=${micro}`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })