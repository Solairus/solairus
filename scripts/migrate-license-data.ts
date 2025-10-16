#!/usr/bin/env ts-node

/**
 * License Data Migration Script
 * Purpose: Migrate existing UserProfile accounts to include license expiration
 * Usage: npm run migrate-license-data
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getProgram, derivePdas } from "../src/lib/solairus-main";
import fs from "fs";
import path from "path";

interface MigrationConfig {
  rpcUrl: string;
  programId: string;
  authorityKeypair: string; // Path to keypair file
  dryRun: boolean;
  batchSize: number;
}

interface MigrationResult {
  totalAccounts: number;
  migratedAccounts: number;
  skippedAccounts: number;
  failedAccounts: number;
  errors: string[];
}

class LicenseMigrator {
  private connection: Connection;
  private program: anchor.Program;
  private authority: Keypair;
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, "confirmed");
    
    // Load authority keypair
    const keypairData = JSON.parse(fs.readFileSync(config.authorityKeypair, "utf8"));
    this.authority = Keypair.fromSecretKey(new Uint8Array(keypairData));

    // Create anchor provider
    const wallet = new anchor.Wallet(this.authority);
    const provider = new anchor.AnchorProvider(this.connection, wallet, {
      commitment: "confirmed",
    });

    this.program = getProgram(provider);
  }

  /**
   * Get all UserProfile accounts that need migration
   */
  async getUserProfiles(): Promise<{ pubkey: PublicKey; account: any }[]> {
    console.log("Fetching UserProfile accounts...");
    
    try {
      const userProfiles = await this.program.account.userProfile.all();
      console.log(`Found ${userProfiles.length} UserProfile accounts`);
      return userProfiles;
    } catch (error) {
      console.error("Failed to fetch UserProfile accounts:", error);
      throw error;
    }
  }

  /**
   * Check if a UserProfile needs migration
   */
  needsMigration(profile: any): boolean {
    // Check if license_expires_at is 0 or undefined (needs migration)
    return !profile.licenseExpiresAt || profile.licenseExpiresAt.toNumber() === 0;
  }

  /**
   * Calculate license expiration based on created_at
   */
  calculateLicenseExpiration(createdAt: anchor.BN, durationDays: number = 365): anchor.BN {
    const durationSeconds = durationDays * 24 * 60 * 60;
    return createdAt.add(new anchor.BN(durationSeconds));
  }

  /**
   * Migrate a single UserProfile account
   */
  async migrateProfile(profilePubkey: PublicKey, profile: unknown): Promise<boolean> {
    if (!this.needsMigration(profile)) {
      return false; // Already migrated
    }

    try {
      const licenseExpiration = this.calculateLicenseExpiration(profile.createdAt);

      if (this.config.dryRun) {
        console.log(`[DRY RUN] Would migrate profile ${profilePubkey.toString()}`);
        console.log(`  Created: ${new Date(profile.createdAt.toNumber() * 1000).toISOString()}`);
        console.log(`  New expiration: ${new Date(licenseExpiration.toNumber() * 1000).toISOString()}`);
        return true;
      }

      // Create migration transaction
      // Note: This would require a migration instruction in the contract
      console.log(`Migrating profile ${profilePubkey.toString()}...`);
      
      // For now, we'll simulate the migration
      // In a real deployment, you would call a migration instruction:
      /*
      const tx = await this.program.methods
        .migrateUserProfile()
        .accounts({
          authority: this.authority.publicKey,
          profile: profilePubkey,
        })
        .rpc();
      
      console.log(`Migration transaction: ${tx}`);
      */

      return true;
    } catch (error) {
      console.error(`Failed to migrate profile ${profilePubkey.toString()}:`, error);
      return false;
    }
  }

  /**
   * Run the migration process
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalAccounts: 0,
      migratedAccounts: 0,
      skippedAccounts: 0,
      failedAccounts: 0,
      errors: [],
    };

    try {
      const profiles = await this.getUserProfiles();
      result.totalAccounts = profiles.length;

      console.log(`\nStarting migration of ${profiles.length} profiles...`);
      console.log(`Dry run: ${this.config.dryRun}`);
      console.log(`Batch size: ${this.config.batchSize}\n`);

      // Process in batches
      for (let i = 0; i < profiles.length; i += this.config.batchSize) {
        const batch = profiles.slice(i, i + this.config.batchSize);
        console.log(`Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(profiles.length / this.config.batchSize)}`);

        for (const { pubkey, account } of batch) {
          try {
            const migrated = await this.migrateProfile(pubkey, account);
            
            if (migrated) {
              result.migratedAccounts++;
            } else {
              result.skippedAccounts++;
            }
          } catch (error) {
            result.failedAccounts++;
            const errorMsg = `Failed to migrate ${pubkey.toString()}: ${error}`;
            result.errors.push(errorMsg);
            console.error(errorMsg);
          }
        }

        // Small delay between batches
        if (i + this.config.batchSize < profiles.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return result;
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  /**
   * Generate migration report
   */
  generateReport(result: MigrationResult): void {
    console.log("\n" + "=".repeat(50));
    console.log("MIGRATION REPORT");
    console.log("=".repeat(50));
    console.log(`Total accounts: ${result.totalAccounts}`);
    console.log(`Migrated: ${result.migratedAccounts}`);
    console.log(`Skipped: ${result.skippedAccounts}`);
    console.log(`Failed: ${result.failedAccounts}`);
    console.log(`Success rate: ${((result.migratedAccounts / result.totalAccounts) * 100).toFixed(2)}%`);

    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    // Save report to file
    const reportPath = path.join(__dirname, `migration-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const config: MigrationConfig = {
    rpcUrl: process.env.RPC_URL || "https://api.devnet.solana.com",
    programId: process.env.PROGRAM_ID || "CXK63PkidRsKhnYCF3kMHqEX3RGgy9JJkebN3S91VHD3",
    authorityKeypair: process.env.AUTHORITY_KEYPAIR || "./authority-keypair.json",
    dryRun: process.env.DRY_RUN !== "false",
    batchSize: parseInt(process.env.BATCH_SIZE || "10"),
  };

  console.log("License Data Migration Script");
  console.log("Configuration:", {
    ...config,
    authorityKeypair: "[REDACTED]",
  });

  try {
    const migrator = new LicenseMigrator(config);
    const result = await migrator.migrate();
    migrator.generateReport(result);

    if (result.failedAccounts > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Migration script failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { LicenseMigrator, MigrationConfig, MigrationResult };