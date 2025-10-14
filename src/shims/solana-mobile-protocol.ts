// Minimal web-safe shim for Solana Mobile Wallet Adapter protocol.
// This avoids bundling mobile-only packages during web development.

export async function transact(..._args: unknown[]) {
  throw new Error("Solana Mobile transact is not available in web builds.")
}

export async function startRemoteScenario(..._args: unknown[]) {
  throw new Error("Solana Mobile startRemoteScenario is not available in web builds.")
}

// Some consumers may check for default export
export default {
  transact,
  startRemoteScenario,
}