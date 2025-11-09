#!/usr/bin/env node

/**
 * Quick diagnostic for GetBlock Solana RPC endpoints.
 *
 * Reads the same environment variables the frontend/backends use
 * (VITE_SOLANA_RPC_URL_MAINNET[_2..5] and SOLANA_RPC_URL_MAINNET[_2..5])
 * and sends a simple `getHealth` request to each.
 *
 * Usage:
 *   node scripts/test-getblock.mjs
 *
 * If you want to test a specific endpoint, pass it as an argument:
 *   node scripts/test-getblock.mjs https://go.getblock.us/<token>/
 */

const ENDPOINT_ENV_KEYS = [
  'VITE_SOLANA_RPC_URL_MAINNET',
  'VITE_SOLANA_RPC_URL_MAINNET_2',
  'VITE_SOLANA_RPC_URL_MAINNET_3',
  'VITE_SOLANA_RPC_URL_MAINNET_4',
  'VITE_SOLANA_RPC_URL_MAINNET_5',
  'SOLANA_RPC_URL_MAINNET',
  'SOLANA_RPC_URL_MAINNET_2',
  'SOLANA_RPC_URL_MAINNET_3',
  'SOLANA_RPC_URL_MAINNET_4',
  'SOLANA_RPC_URL_MAINNET_5',
];

const explicitArgs = process.argv.slice(2);

function sanitizeUrl(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

async function buildEndpointList() {
  if (explicitArgs.length) {
    return explicitArgs.map(sanitizeUrl).filter(Boolean);
  }

  const { existsSync, readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const envPath = resolve(process.cwd(), '.env');
  const envVars = { ...process.env };

  if (existsSync(envPath)) {
    try {
      const contents = readFileSync(envPath, 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        if (!key || !rest.length) continue;
        const value = rest.join('=').trim();
        envVars[key.trim()] = value.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      }
    } catch (err) {
      console.warn(`⚠️ Failed to read .env: ${err instanceof Error ? err.message : err}`);
    }
  }

  const urls = new Set();
  for (const key of ENDPOINT_ENV_KEYS) {
    const value = envVars[key];
    const normalized = sanitizeUrl(value);
    if (normalized) urls.add(normalized);
  }
  return Array.from(urls);
}

async function testEndpoint(url) {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getHealth',
    params: [],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, status: response.status, statusText: response.statusText, body: text };
    }

    const json = await response.json();
    return { ok: true, body: json };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const endpoints = await buildEndpointList();
  if (!endpoints.length) {
    console.error('No endpoints found in environment or CLI arguments.');
    process.exit(1);
  }

  console.log(`Testing ${endpoints.length} endpoint(s)...`);

  for (const endpoint of endpoints) {
    process.stdout.write(`\n→ ${endpoint} ... `);
    const result = await testEndpoint(endpoint);
    if (result.ok) {
      console.log('OK');
      console.log(JSON.stringify(result.body, null, 2));
    } else if (result.status) {
      console.log(`HTTP ${result.status} ${result.statusText ?? ''}`.trim());
      console.log(result.body);
    } else {
      console.log(`Error: ${result.error}`);
    }
  }
}

main().catch((err) => {
  console.error('Unexpected failure:', err);
  process.exit(1);
});

