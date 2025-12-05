import { PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { Config, AgentTier } from '@/types/backend';
// Define local types for complex args if they are not in backend types yet
// or if we want to submit them to the backend

export interface SetConfigArgs {
  activationFeeUsdt: number;
  roiDailyBps: number;
  licenseDurationDays: number;
  // Role addresses
  admin: PublicKey;
  marketer1: PublicKey;
  marketer2: PublicKey;
  trader: PublicKey;
  systemreserve: PublicKey;
  // License percentages
  licenseAdminPct: number;
  licenseDevPct: number;
  licenseMarketer1Pct: number;
  licenseMarketer2Pct: number;
  licenseReservePct: number;
  licenseAffL1Pct: number;
  licenseAffL2Pct: number;
  licenseAffL3Pct: number;
  // Agent percentages
  agentAdminPct: number;
  agentDevPct: number;
  agentMarketer1Pct: number;
  agentMarketer2Pct: number;
  agentTraderPct: number;
  agentReservePct: number;
  agentAffL1Pct: number;
  agentAffL2Pct: number;
  agentAffL3Pct: number;
}

/**
 * Configuration service for managing system settings via Backend API
 */
export class ConfigService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get current system configuration
   */
  async getConfig(): Promise<Config> {
    try {
      const response = await axios.get<Config>(`${this.baseUrl}/config`);
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      // Return default/empty config structure if failed to prevent crash
      return {} as Config;
    }
  }

  /**
   * Update system configuration (admin only)
   */
  async setConfig(
    authority: PublicKey,
    args: SetConfigArgs
  ): Promise<string> {
    try {
      // Transform data to simple JSON for backend
      const payload = {
        authority: authority.toString(),
        ...args,
        // Convert PublicKeys to strings
        admin: args.admin.toString(),
        marketer1: args.marketer1.toString(),
        marketer2: args.marketer2.toString(),
        trader: args.trader.toString(),
        systemreserve: args.systemreserve.toString(),
      };

      const response = await axios.post(`${this.baseUrl}/admin/config`, payload);
      return response.data.signature || 'backend-update-ok';
    } catch (error: unknown) {
      console.error('Error setting config:', error);
      throw new Error('Failed to update configuration via API');
    }
  }

  /**
   * Validate percentage configurations
   */
  validatePercentages(
    licensePercentages: Record<string, number>,
    agentPercentages: Record<string, number>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check license percentages sum to 100
    const licenseSum = Object.values(licensePercentages).reduce((sum, val) => sum + val, 0);
    if (licenseSum !== 100) {
      errors.push(`License percentages must sum to 100% (currently ${licenseSum}%)`);
    }

    // Check agent percentages sum to 100
    const agentSum = Object.values(agentPercentages).reduce((sum, val) => sum + val, 0);
    if (agentSum !== 100) {
      errors.push(`Agent percentages must sum to 100% (currently ${agentSum}%)`);
    }

    // Check individual percentages are within valid range
    const allPercentages = { ...licensePercentages, ...agentPercentages };
    Object.entries(allPercentages).forEach(([key, value]) => {
      if (value < 0 || value > 100) {
        errors.push(`${key} percentage must be between 0 and 100 (currently ${value}%)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate public key addresses
   */
  validateAddresses(addresses: Record<string, string>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    Object.entries(addresses).forEach(([role, address]) => {
      if (address && address !== PublicKey.default.toString()) {
        try {
          // Check valid base58
          new PublicKey(address);
        } catch (error) {
          errors.push(`Invalid ${role} address format`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Create configuration service instance
 */
export function createConfigService(): ConfigService {
  return new ConfigService();
}