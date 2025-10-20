import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getProgram, derivePdas, type Config } from '@/lib/solairus-main';

export interface SetConfigArgs {
  activationFeeUsdt: anchor.BN;
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
 * Configuration service for managing system settings
 */
export class ConfigService {
  private program: anchor.Program;
  
  constructor(provider: anchor.AnchorProvider) {
    this.program = getProgram(provider);
  }
  
  /**
   * Get current system configuration
   */
  async getConfig(): Promise<Config> {
    const { config } = derivePdas();
    return await this.program.account['config'].fetch(config) as Config;
  }
  
  /**
   * Update system configuration (dev only)
   */
  async setConfig(
    authority: PublicKey,
    args: SetConfigArgs
  ): Promise<string> {
    const { config, vault } = derivePdas();
    
    // Get current config to determine dev profile and USDT mint
    const currentConfig = await this.getConfig();
    const { profile: devProfile } = derivePdas(currentConfig.dev);
    
    if (!devProfile) {
      throw new Error('Could not derive dev profile PDA');
    }
    
    // Get program data account for upgrade authority verification
    const programDataAddress = PublicKey.findProgramAddressSync(
      [this.program.programId.toBuffer()],
      new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
    )[0];
    
    return await this.program.methods
      .setConfig(args)
      .accounts({
        config,
        vault,
        devProfile,
        authority,
        usdtMint: currentConfig.usdtMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        {
          pubkey: programDataAddress,
          isSigner: false,
          isWritable: false,
        }
      ])
      .rpc();
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
export function createConfigService(provider: anchor.AnchorProvider): ConfigService {
  return new ConfigService(provider);
}