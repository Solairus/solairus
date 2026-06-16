import React, { useMemo, useState } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@/contexts/wallet-context";
import * as anchor from "@coral-xyz/anchor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Role,
  PROGRAM_ID,
  getProgram,
  derivePdas,
  accounts as accountNs,
  getErrorMessage,
  initializeConfig as initializeConfigIx,
  updateLicenseConfig as updateLicenseConfigIx,
} from "@/lib/license-activation";

// PDAs from shared lib

export default function LicenseActivationUITest() {
  const { isConnected, publicKey, provider, anchorProvider, chainId, getChainInfo, switchNetwork } = useWallet();
  const [usdtMintStr, setUsdtMintStr] = useState<string>("");
  const [log, setLog] = useState<string>("");
  const [role, setRole] = useState<string>("Admin");
  const [reserveAmount, setReserveAmount] = useState<string>("");
  type ConfigAccount = {
    dev: PublicKey;
    admin: PublicKey;
    marketer1: PublicKey;
    marketer2: PublicKey;
    usdtPriceCents: anchor.BN;
    durationDays: number;
    usdtMint: PublicKey;
    balances: {
      admin: anchor.BN;
      dev: anchor.BN;
      marketer1: anchor.BN;
      marketer2: anchor.BN;
      reserve: anchor.BN;
    };
    bumpConfig: number;
    bumpVault: number;
  };
  const [cfgObj, setCfgObj] = useState<ConfigAccount | null>(null);
  const [adminInputs, setAdminInputs] = useState({
    admin: "",
    marketer1: "",
    marketer2: "",
    usdtPriceCents: "",
    durationDays: "",
    usdtMint: "",
  });
  const [updateInputs, setUpdateInputs] = useState({
    usdtPriceCents: "",
    durationDays: "",
  });

  const program = useMemo<anchor.Program | null>(() => {
    try {
      // Prioritize the anchor provider from global context
      if (anchorProvider) {
        return getProgram(anchorProvider);
      }
      
      // Fallback: create read-only provider when no wallet connected
      if (provider) {
        const stubWallet = {
          publicKey: publicKey ?? anchor.web3.Keypair.generate().publicKey,
          signTransaction: async (tx: anchor.web3.Transaction | anchor.web3.VersionedTransaction) => tx,
          signAllTransactions: async (
            txs: (anchor.web3.Transaction | anchor.web3.VersionedTransaction)[]
          ) => txs,
          payer: anchor.web3.Keypair.generate(),
        } as unknown as anchor.Wallet;
        const roProvider = new anchor.AnchorProvider(provider, stubWallet, { commitment: "processed" });
        return getProgram(roProvider);
      }
      
      return null;
    } catch (error) {
      console.error("Failed to create program:", error);
      return null;
    }
  }, [anchorProvider, provider, publicKey]);

  const { config, vault, license } = derivePdas(publicKey);

  const accounts = program ? accountNs(program) : undefined;

  const refreshConfig = async () => {
    try {
      if (!program || !accounts) throw new Error("Program not available");
      const cfg = (await accounts.config.fetch(config)) as unknown as ConfigAccount;
      setLog(JSON.stringify(cfg, null, 2));
      setCfgObj(cfg);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const refreshLicense = async () => {
    try {
      if (!program || !accounts || !license) throw new Error("Program not available");
      const lic = await accounts.userLicense.fetch(license);
      setLog(JSON.stringify(lic, null, 2));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const updateUsdtMint = async () => {
    try {
      if (!program || !publicKey) throw new Error("Signer unavailable for updates");
      const mintPk = new PublicKey(usdtMintStr.trim());
      await updateLicenseConfigIx(program, publicKey, config, { usdtMint: mintPk });
      toast.success("USDT mint updated");
      await refreshConfig();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const activate = async () => {
    try {
      if (!program || !accounts || !publicKey) throw new Error("Signer unavailable for activation");
      const cfg = (await accounts.config.fetch(config)) as unknown as ConfigAccount;
      const mint = cfg.usdtMint;
      const userAta = getAssociatedTokenAddressSync(mint, publicKey);
      const vaultAta = getAssociatedTokenAddressSync(mint, vault, true);
      await program.methods
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
      await refreshLicense();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const withdraw = async () => {
    try {
      if (!program || !publicKey || !accounts) throw new Error("Signer unavailable for withdrawal");
      const cfg = (await accounts.config.fetch(config)) as unknown as ConfigAccount;
      const mint = cfg.usdtMint;
      const authorityAta = getAssociatedTokenAddressSync(mint, publicKey);
      const vaultAta = getAssociatedTokenAddressSync(mint, vault, true);
      const roleVariant = role as Role; // Anchor maps enum by variant name
      const amountOpt = roleVariant === "Reserve" && reserveAmount ? new anchor.BN(reserveAmount) : null;
      await program.methods
        .withdrawEarnings(roleVariant, amountOpt)
        .accounts({
          authority: publicKey,
          config,
          vault,
          mint,
          authorityAta,
          vaultAta,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      toast.success("Withdrawal sent");
      await refreshConfig();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const isAdmin = cfgObj && publicKey ? new PublicKey(cfgObj.admin).equals(publicKey) : false;
  const isDev = cfgObj && publicKey ? new PublicKey(cfgObj.dev).equals(publicKey) : false;

  const submitInitializeConfig = async () => {
    try {
      if (!program || !publicKey) throw new Error("Connect wallet");
      if (!isDev) throw new Error("Only dev can initialize config");
      const admin = new PublicKey(adminInputs.admin.trim());
      const marketer1 = new PublicKey(adminInputs.marketer1.trim());
      const marketer2 = new PublicKey(adminInputs.marketer2.trim());
      const usdtMint = new PublicKey(adminInputs.usdtMint.trim());
      const usdtPriceCents = new anchor.BN(adminInputs.usdtPriceCents.trim());
      const durationDays = parseInt(adminInputs.durationDays.trim(), 10);
      await initializeConfigIx(program, publicKey, config, vault, {
        admin,
        marketer1,
        marketer2,
        usdtPriceCents,
        durationDays,
        usdtMint,
      });
      toast.success("Config initialized");
      await refreshConfig();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const submitUpdateFeeDuration = async () => {
    try {
      if (!program || !publicKey) throw new Error("Connect wallet");
      if (!isAdmin && !isDev) throw new Error("Only admin/dev can update config");
      const price = updateInputs.usdtPriceCents ? new anchor.BN(updateInputs.usdtPriceCents.trim()) : null;
      const duration = updateInputs.durationDays ? parseInt(updateInputs.durationDays.trim(), 10) : null;
      await updateLicenseConfigIx(program, publicKey, config, {
        usdtPriceCents: price,
        durationDays: duration,
      });
      toast.success("Config updated");
      await refreshConfig();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">License Activation – UI Tests</h1>
      <div className="mb-4 text-sm">
        <div><strong>Connected Wallet:</strong> {publicKey ? publicKey.toBase58() : "(not connected)"}</div>
        <div><strong>Connection Status:</strong> {isConnected ? "Connected" : "Not connected"}</div>
        {(() => {
          const chain = getChainInfo(chainId)
          const override = (() => {
            try { return (localStorage.getItem("solana_cluster_override") ?? "").toLowerCase() } catch { return "" }
          })()
          const clusterStr = (override || (import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet")).toLowerCase()
          const isMainnet = clusterStr === "mainnet" || clusterStr === "mainnet-beta"
          const nextLabel = isMainnet ? "Switch to Devnet" : "Switch to Mainnet"
          return (
            <div className="mt-2 flex items-center gap-2">
              <div><strong>Network:</strong> {chain.name}</div>
              <Button variant="outline" size="sm" onClick={() => switchNetwork(0)}>{nextLabel}</Button>
            </div>
          )
        })()}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Adapter connection is auto-synced from AppKit; no duplicate connect UI */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">PDAs</h2>
          <div className="text-xs break-words">
            <div><strong>Program:</strong> {PROGRAM_ID.toBase58()}</div>
            <div><strong>Config PDA:</strong> {config.toBase58()}</div>
            <div><strong>Vault PDA:</strong> {vault.toBase58()}</div>
            <div><strong>License PDA:</strong> {license?.toBase58() ?? "(connect wallet)"}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={refreshConfig}>Read Config</Button>
            <Button variant="outline" onClick={refreshLicense}>Read License</Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Set USDT Mint</h2>
          <Label htmlFor="mint">USDT Mint</Label>
          <Input id="mint" placeholder="Mint address" value={usdtMintStr} onChange={e => setUsdtMintStr(e.target.value)} />
          <div className="mt-3">
            <Button onClick={updateUsdtMint}>Update Mint</Button>
          </div>
        </Card>

        {(isDev || isAdmin) && (
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Update Fee/Duration</h2>
            <Label htmlFor="fee">USDT Price (cents, u64)</Label>
            <Input id="fee" placeholder="e.g. 500" value={updateInputs.usdtPriceCents} onChange={e => setUpdateInputs({ ...updateInputs, usdtPriceCents: e.target.value })} />
            <Label htmlFor="duration" className="mt-2">Duration (days, u16)</Label>
            <Input id="duration" placeholder="e.g. 30" value={updateInputs.durationDays} onChange={e => setUpdateInputs({ ...updateInputs, durationDays: e.target.value })} />
            <div className="mt-3">
              <Button onClick={submitUpdateFeeDuration}>Update Config</Button>
            </div>
            {!cfgObj && <p className="text-xs text-muted-foreground mt-2">Tip: Click "Read Config" to determine your role.</p>}
          </Card>
        )}

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Activate License</h2>
          <p className="text-sm text-muted-foreground">Transfers USDT from your ATA to the vault and extends license.</p>
          <div className="mt-3">
            <Button onClick={activate}>Activate</Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Withdraw Earnings</h2>
          <Label>Role</Label>
          <select className="mt-1 border rounded p-2 text-sm" value={role} onChange={e => setRole(e.target.value)}>
            <option>Admin</option>
            <option>Dev</option>
            <option>Marketer1</option>
            <option>Marketer2</option>
            <option>Reserve</option>
          </select>
          {role === "Reserve" && (
            <div className="mt-2">
              <Label htmlFor="amount">Amount (u64)</Label>
              <Input id="amount" placeholder="e.g. 1000000" value={reserveAmount} onChange={e => setReserveAmount(e.target.value)} />
            </div>
          )}
          <div className="mt-3">
            <Button onClick={withdraw}>Withdraw</Button>
          </div>
        </Card>
      </div>

      {isDev && (
        <Card className="p-4 mt-4">
          <h2 className="text-lg font-semibold mb-2">Initialize Config (Dev Only)</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label>Admin</Label>
              <Input placeholder="Admin pubkey" value={adminInputs.admin} onChange={e => setAdminInputs({ ...adminInputs, admin: e.target.value })} />
            </div>
            <div>
              <Label>Marketer1</Label>
              <Input placeholder="Marketer1 pubkey" value={adminInputs.marketer1} onChange={e => setAdminInputs({ ...adminInputs, marketer1: e.target.value })} />
            </div>
            <div>
              <Label>Marketer2</Label>
              <Input placeholder="Marketer2 pubkey" value={adminInputs.marketer2} onChange={e => setAdminInputs({ ...adminInputs, marketer2: e.target.value })} />
            </div>
            <div>
              <Label>USDT Mint</Label>
              <Input placeholder="USDT mint pubkey" value={adminInputs.usdtMint} onChange={e => setAdminInputs({ ...adminInputs, usdtMint: e.target.value })} />
            </div>
            <div>
              <Label>USDT Price (cents, u64)</Label>
              <Input placeholder="e.g. 500" value={adminInputs.usdtPriceCents} onChange={e => setAdminInputs({ ...adminInputs, usdtPriceCents: e.target.value })} />
            </div>
            <div>
              <Label>Duration (days, u16)</Label>
              <Input placeholder="e.g. 30" value={adminInputs.durationDays} onChange={e => setAdminInputs({ ...adminInputs, durationDays: e.target.value })} />
            </div>
          </div>
          <div className="mt-3">
            <Button onClick={submitInitializeConfig}>Initialize</Button>
          </div>
          {!cfgObj && <p className="text-xs text-muted-foreground mt-2">Tip: Click "Read Config" to determine your role.</p>}
        </Card>
      )}

      <Card className="p-4 mt-4">
        <h2 className="text-lg font-semibold mb-2">Output</h2>
        <pre className="text-xs whitespace-pre-wrap break-words">{log || "(no output yet)"}</pre>
      </Card>
    </div>
  );
}