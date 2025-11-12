#!/usr/bin/env node

/**
 * restartservers.js
 * Convenience script to:
 * 1. Kill anything bound to ports 4000 (backend) and 8080 (frontend)
 * 2. Relaunch both dev servers together via `npx concurrently`
 *
 * Usage:
 *   node restartservers.js
 */

import { execSync, spawn } from 'node:child_process'
import process from 'node:process'

const PORTS = [8080, 4000]

function killPort(port) {
  const killCmd = process.platform === 'win32'
    ? `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /PID %a /F`
    : `lsof -ti :${port} | xargs kill -9`

  try {
    execSync(killCmd, { stdio: 'ignore', shell: true })
    console.log(`🔪 Killed processes on port ${port}`)
  } catch (err) {
    // Ignore errors when nothing is listening
    console.log(`ℹ️  No process found on port ${port}`)
  }
}

for (const port of PORTS) {
  killPort(port)
}

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const args = ['concurrently', 'yarn dev:server', 'yarn dev']
console.log('🚀 Starting backend (4000) and frontend (8080)...')
const child = spawn(cmd, args, { stdio: 'inherit', shell: false })

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ concurrently exited with code ${code}`)
    process.exit(code ?? 1)
  }
  console.log('✅ Servers stopped')
})

