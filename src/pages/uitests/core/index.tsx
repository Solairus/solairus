import React, { useEffect, useMemo, useState } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { useWallet } from "@/contexts/wallet-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PROGRAM_ID, getProgram, derivePdas, accounts as accountNs, getErrorMessage, depositUsdt as depositIx, terminate as terminateIx, safeFetchAccount } from "@/lib/solairus-core";

// Minimal shape for the Config account used by this UI
interface ConfigAccount {
  dev: PublicKey;
  admin: PublicKey;
  marketer1: PublicKey;
  marketer2: PublicKey;
  usdtMint: PublicKey;
}

export default function CoreUITest() {
  const { isConnected, publicKey, provider, anchorProvider, chainId, getChainInfo, switchNetwork } = useWallet();
  const [log, setLog] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [deposits, setDeposits] = useState<Array<{ amount: string; sig: string; ts: number }>>([]);
  const [cfgObj, setCfgObj] = useState<ConfigAccount | null>(null);
  // Dev-only initialize UI removed per product requirement.

  const program = useMemo<anchor.Program | null>(() => {
    try {
      if (anchorProvider) return getProgram(anchorProvider);
      if (provider) {
        const stubWallet = {
          publicKey: publicKey ?? anchor.web3.Keypair.generate().publicKey,
          signTransaction: async (tx: anchor.web3.Transaction | anchor.web3.VersionedTransaction) => tx,
          signAllTransactions: async (txs: (anchor.web3.Transaction | anchor.web3.VersionedTransaction)[]) => txs,
          payer: anchor.web3.Keypair.generate(),
        } as unknown as anchor.Wallet;
        const roProvider = new anchor.AnchorProvider(provider, stubWallet, { commitment: "processed" });
        return getProgram(roProvider);
      }
      return null;
    } catch (e) {
      console.error("Program init failed", e);
      return null;
    }
  }, [anchorProvider, provider, publicKey]);

  const { config, vault, userDeposit, userHistory, license } = derivePdas(publicKey);
  const pa = program ? accountNs(program) : undefined;

  // Auto-read config on load when program becomes available
  useEffect(() => {
    if (program && pa) {
      refreshConfig(false).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  // Local storage helpers for session deposit list
  const STORAGE_KEY = "core_ui_deposits";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setDeposits(arr);
      }
    } catch {
      // ignore
    }
  }, []);
  const addDepositEntry = (amountStr: string, sig: string) => {
    const entry = { amount: amountStr, sig, ts: Date.now() };
    const next = [entry, ...deposits].slice(0, 50);
    setDeposits(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const refreshConfig = async (notify = true) => {
    try {
      if (!program || !pa) throw new Error("Program not available");
      setCfgObj(null);
      const cfg = await safeFetchAccount<ConfigAccount>(program, pa.config, config);
      setCfgObj(cfg as ConfigAccount);
      setLog(JSON.stringify(cfg, null, 2));
    } catch (err) {
      const msg = getErrorMessage(err);
      if (notify) toast.error(msg);
    }
  };

  const refreshDeposit = async () => {
    try {
      if (!program || !pa || !userDeposit) throw new Error("Program not available");
      const dep = await safeFetchAccount(program, pa.userDeposit!, userDeposit);
      setLog(JSON.stringify(dep, null, 2));
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const refreshLicense = async () => {
    try {
      if (!program || !pa || !license) throw new Error("Program not available");
      const lic = await safeFetchAccount(program, pa.userLicense, license);
      setLog(JSON.stringify(lic, null, 2));
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  // InitializeConfig removed from UI.

  const deposit = async () => {
    try {
      // Connection guard: only gate on missing publicKey
      if (!publicKey) throw new Error("Connect wallet");
      if (!program || !pa) throw new Error("Program not available. Please refresh the page.");
      // Require a signing-capable provider to avoid wallet action errors
      if (!anchorProvider) {
        throw new Error("Wallet connected but not ready for signing. Please reconnect with a signing-capable Solana wallet (e.g., Phantom or Solflare). ");
      }
      const hasSigner = typeof (anchorProvider.wallet as unknown as { signTransaction?: unknown }).signTransaction === 'function';
      if (!hasSigner) {
        throw new Error("Wallet connected but cannot sign transactions. Please switch to a signing-capable Solana wallet.");
      }

      // Debug: Check if config exists
      console.log("Checking config at:", config.toBase58());
      const cfg = await safeFetchAccount<ConfigAccount>(program, pa.config, config);
      console.log("Config loaded:", cfg);
      
      const mint: PublicKey = (cfg as ConfigAccount).usdtMint;
      console.log("Using mint:", mint.toBase58());
      
      const userAta = getAssociatedTokenAddressSync(mint, publicKey);
      const vaultAta = getAssociatedTokenAddressSync(mint, vault, true);
      
      console.log("User ATA:", userAta.toBase58());
      console.log("Vault ATA:", vaultAta.toBase58());
      console.log("UserDeposit PDA:", userDeposit?.toBase58());
      console.log("UserHistory PDA:", userHistory?.toBase58());
      
      const amountBN = new anchor.BN(amount.trim());
      console.log("Amount:", amountBN.toString());
      
      const sig = await depositIx(program, publicKey, { config, vault, userDeposit: userDeposit!, userHistory: userHistory! }, { mint, userAta, vaultAta }, amountBN);
      toast.success("Deposit sent");
      addDepositEntry(amount.trim(), sig);
      await refreshDeposit();
    } catch (err) { 
      console.error("Deposit error:", err);
      toast.error(getErrorMessage(err)); 
    }
  };

  const activateLicense = async () => {
    try {
      if (!program || !pa || !publicKey) throw new Error("Connect wallet");
      const cfg = await safeFetchAccount<ConfigAccount>(program, pa.config, config);
      const mint: PublicKey = (cfg as ConfigAccount).usdtMint;
      const userAta = getAssociatedTokenAddressSync(mint, publicKey);
      const vaultAta = getAssociatedTokenAddressSync(mint, vault, true);
      const sig = await program.methods
        .activateLicense(null, null, null)
        .accounts({
          user: publicKey,
          config,
          vault,
          mint,
          userAta,
          vaultAta,
          license: license!,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      toast.success("License activated");
      setLog((prev) => `${prev}\nActivated tx: ${sig}`.trim());
      await refreshLicense();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const terminateProgram = async () => {
    try {
      if (!program || !publicKey) throw new Error("Connect wallet");
      await terminateIx(program, publicKey, config, vault);
      toast.success("Config and Vault closed to dev. Ready to redeploy.");
      await refreshConfig();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const isDev = cfgObj && publicKey ? new PublicKey(cfgObj.dev).equals(publicKey) : false;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Solairus Core – UI Tests</h1>
      <div className="mb-4 text-sm">
        <div><strong>Connected Wallet:</strong> {publicKey ? publicKey.toBase58() : "(not connected)"}</div>
        <div><strong>Connection Status:</strong> {isConnected ? "Connected" : "Not connected"}</div>
        {(() => {
          const chain = getChainInfo(chainId);
          const override = (() => { try { return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase() } catch { return "" } })();
          const clusterStr = (override || (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet")).toLowerCase();
          const isMainnet = clusterStr === "mainnet" || clusterStr === "mainnet-beta";
          const nextLabel = isMainnet ? "Switch to Devnet" : "Switch to Mainnet";
          return (
            <div className="mt-2 flex items-center gap-2">
              <div><strong>Network:</strong> {chain.name}</div>
              <Button variant="outline" size="sm" onClick={() => switchNetwork(0)}>{nextLabel}</Button>
            </div>
          );
        })()}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">PDAs</h2>
          <div className="text-xs break-words">
            <div><strong>Program:</strong> {PROGRAM_ID.toBase58()}</div>
            <div><strong>Config PDA:</strong> {config.toBase58()}</div>
            <div><strong>Vault PDA:</strong> {vault.toBase58()}</div>
            <div><strong>UserDeposit PDA:</strong> {userDeposit?.toBase58() ?? "(connect wallet)"}</div>
            <div><strong>License PDA:</strong> {license?.toBase58() ?? "(connect wallet)"}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={refreshConfig}>Read Config</Button>
            <Button variant="outline" onClick={refreshDeposit}>Read Deposit</Button>
            <Button variant="outline" onClick={refreshLicense}>Read License</Button>
          </div>
        </Card>

        {/* Config summary */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Config</h2>
          {cfgObj ? (
            <div className="text-xs break-words space-y-1">
              <div><strong>Admin:</strong> {cfgObj.admin.toBase58()}</div>
              <div><strong>Marketer1:</strong> {cfgObj.marketer1.toBase58()}</div>
              <div><strong>Marketer2:</strong> {cfgObj.marketer2.toBase58()}</div>
              <div><strong>USDT Mint:</strong> {cfgObj.usdtMint.toBase58()}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <span>Config not loaded. If uninitialized, use Dev card to initialize, then click "Read Config".</span>
            </div>
          )}
        </Card>

        {/* Dev initialize UI removed */}

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Deposit USDT</h2>
          <p className="text-sm text-muted-foreground">Transfers USDT from your ATA to the vault; displays your aggregated on-chain deposited amount.</p>
          <Label htmlFor="amount">Amount (u64)</Label>
          <Input id="amount" placeholder="e.g. 1000000" value={amount} onChange={e => setAmount(e.target.value)} />
          <div className="mt-3"><Button onClick={deposit}>Deposit</Button></div>
          <p className="text-xs text-muted-foreground mt-2">Note: Per-deposit list is not stored on-chain; showing aggregate total only.</p>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Activate License</h2>
          <p className="text-sm text-muted-foreground">Transfers USDT from your ATA to the vault and extends your license.</p>
          <div className="mt-3"><Button onClick={activateLicense}>Activate</Button></div>
        </Card>

        {isDev && (
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Terminate & Redeploy (Dev)</h2>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Close `config` and `vault` PDAs to reclaim rent. This calls the on-chain terminate instruction (dev-only).
              </p>
              <p>
                Recommended flow:
                1) Withdraw any earnings and vault funds using the available instructions,
                2) Deploy updated program if needed,
                3) Reinitialize config after redeploy.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={terminateProgram}>Terminate Now</Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card className="p-4 mt-4">
        <h2 className="text-lg font-semibold mb-2">Deposits (Session)</h2>
        <p className="text-xs text-muted-foreground">Local list of deposits you sent from this UI (most recent first).</p>
        {deposits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deposits yet.</p>
        ) : (
          <div className="text-xs overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="py-1 pr-2">Time</th>
                  <th className="py-1 pr-2">Amount (u64)</th>
                  <th className="py-1 pr-2">Tx Sig</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1 pr-2">{new Date(d.ts).toLocaleString()}</td>
                    <td className="py-1 pr-2">{d.amount}</td>
                    <td className="py-1 pr-2 break-words">{d.sig}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 mt-4">
        <h2 className="text-lg font-semibold mb-2">Output</h2>
        <pre className="text-xs whitespace-pre-wrap break-words">{log || "(no output yet)"}</pre>
      </Card>
    </div>
  );
}