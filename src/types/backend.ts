import { PublicKey } from '@solana/web3.js';

export interface UserProfile {
    user: PublicKey; // Wallet address
    creditBalance: number; // In micro USDT (or whatever the backend returns)
    totalAffiliateEarnings: number;
    totalAffiliateWithdrawn: number;
    // Add other fields as needed based on actual backend response
}

export interface LicenseInfo {
    active: boolean;
    tier: AgentTier;
    expiryDate: Date | null;
}

export enum AgentTier {
    None = 'None',
    Basic = 'Basic',
    Pro = 'Pro',
    Enterprise = 'Enterprise'
}

export interface Config {
    // Mimics the critical parts of the old on-chain config
    backendAuthority: PublicKey;
    activationFeeUsdt: number;
    roiDailyBps: number;
    licenseDurationDays: number;
    // ... add roles/percentages if backend exposes them
}

export interface EarningsHistoryPayout {
    type: 'withdrawal' | 'payout';
    amount: number;
    timestamp: Date;
    signature: string;
}
