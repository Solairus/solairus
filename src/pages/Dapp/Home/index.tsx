import { useState, useEffect, useCallback } from "react";
import VaultBalanceCard from "@/components/VaultBalanceCard";
import WalletActionsCard from "@/components/WalletActionsCard";
import NewsTickerCard from "@/components/NewsTickerCard";
import AffiliateLinkCard from "@/components/AffiliateLinkCard";
import AffiliateEarningsCard from "@/components/AffiliateEarningsCard";
import AgentsOutcomesCard from "@/components/AgentsOutcomesCard";
import { useWalletConnection } from "@/hooks/wallet/use-wallet-connection";
import { useWallet } from "@/contexts/wallet-context";
import { getProgram, derivePdas, UserProfile, Config } from "@/lib/solairus-main";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

export default function DappHome() {
  const { account } = useWalletConnection();
  const { anchorProvider } = useWallet();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  const loadUserData = useCallback(async () => {
    if (!account || !anchorProvider) return;

    try {
      const program = getProgram(anchorProvider);
      const userPubkey = new PublicKey(account);
      const { config: configPda, profile } = derivePdas(userPubkey);

      // Load config
      try {
        const configData = await program.account["config"].fetch(configPda) as Config;
        setConfig(configData);
      } catch (configError) {
        console.warn("Config not available:", configError);
      }

      // Load user profile
      try {
        const profileData = await program.account["userProfile"].fetch(profile) as UserProfile;
        setUserProfile(profileData);
      } catch (profileError) {
        console.warn("User profile not found:", profileError);
        setUserProfile(null);
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
    }
  }, [account, anchorProvider]);

  useEffect(() => {
    if (account && anchorProvider) {
      loadUserData();
    }
  }, [account, anchorProvider, loadUserData]);

  const usdtMint = config?.usdtMint || new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet USDT

  return (
    <div className="space-y-4">
      <VaultBalanceCard />
      <WalletActionsCard />
      <NewsTickerCard />
      <AffiliateLinkCard />
      {/* Show affiliate earnings card if user has earnings */}
      {userProfile && userProfile.totalAffiliateEarnings.gt(new anchor.BN(0)) && (
        <AffiliateEarningsCard
          userProfile={userProfile}
          usdtMint={usdtMint}
          onEarningsUpdate={loadUserData}
        />
      )}
      <AgentsOutcomesCard />
    </div>
  );
}