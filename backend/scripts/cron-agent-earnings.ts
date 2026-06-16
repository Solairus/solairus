import { runDailyAgentEarnings } from '../services/agent_results'

async function main() {
  try {
    const res = await runDailyAgentEarnings()
    console.log(`[cron] agents processed=${res.processed} credited=${res.credited} skipped=${res.skipped}`)
    process.exit(0)
  } catch (e) {
    console.error('[cron] failed:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
}

main()

