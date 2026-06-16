import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { LicenseInfo, UserProfile } from "@/types/backend";
import { LicenseStatusValidator, LicenseValidationResult, CacheValidationResult } from "./license-status-validator";

/**
 * License Debug Utilities - Simplified for Backend API
 */

export interface OnChainInspection {
  // Kept interface but streamlined
  profileExists: boolean;
  decodedData: UserProfile | null;
  decodingErrors: string[];
}

export interface Issue {
  severity: string;
  message: string;
}

export interface DebugReport {
  timestamp: string;
  userPubkey: string;
  backendInspection: OnChainInspection; // Renamed from onChainInspection
  currentStatus: LicenseInfo;
  validationResult: LicenseValidationResult;
  issues: Issue[];
}

export class LicenseDebugUtils {
  private validator: LicenseStatusValidator;

  constructor(validator: LicenseStatusValidator) {
    this.validator = validator;
  }

  /**
   * Inspect backend data for a user profile
   */
  async inspectBackendData(userPubkey: PublicKey): Promise<OnChainInspection> {
    const decodingErrors: string[] = [];
    try {
      const result = await this.validator.validateOnBackend(userPubkey);
      return {
        profileExists: result.hasProfile,
        decodedData: result.profileData,
        decodingErrors: result.errors
      };
    } catch (error) {
      return {
        profileExists: false,
        decodedData: null,
        decodingErrors: [String(error)]
      };
    }
  }

  /**
   * Generate comprehensive debug report
   */
  async generateDebugReport(userPubkey: PublicKey): Promise<DebugReport> {
    const timestamp = new Date().toISOString();

    const backendInspection = await this.inspectBackendData(userPubkey);
    const validationResult = await this.validator.validateOnBackend(userPubkey);

    return {
      timestamp,
      userPubkey: userPubkey.toString(),
      backendInspection,
      currentStatus: validationResult.licenseInfo,
      validationResult,
      issues: validationResult.errors.map(e => ({ severity: 'error', message: e }))
    };
  }

  async exportDebugData(userPubkey: PublicKey): Promise<string> {
    const report = await this.generateDebugReport(userPubkey);
    return JSON.stringify(report, null, 2);
  }
}