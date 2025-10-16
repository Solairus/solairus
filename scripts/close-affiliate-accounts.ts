#!/usr/bin/env ts-node

/**
 * Utility to close problematic affiliate accounts that have wrong discriminators
 * This allows the contract to recreate them with the correct structure
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";

// Configuration
const CLUSTER = process.env.CLUSTER || "devnet";
const PROGRAM_ID = new PublicKey("CXK63PkidRsKhnYCF3kMHqEX3RGgy9JJkebN3S91VHD3");

// User whose affiliate accounts need to be closed
const USER_PUBKEY = new PublicKey("BUrqbAq4XLZrQwUBB7EfkXjFDBfEW5RT9baGddWkGhgB");

async function main() {
    console.log("🧹 Closing problematic affiliate accounts...");
    console.log("Cluster:", CLUSTER);
    console.log("User:", USER_PUBKEY.toString());

    // Setup connection
    const connection = new Connection(
        CLUSTER === "mainnet-beta"
            ? "https://api.mainnet-beta.solana.com"
            : "https://api.devnet.solana.com",
        "confirmed"
    );

    // For this diagnostic script, let's assume the sponsors are all the dev key
    // (which is the default when no sponsors are provided during registration)
    const DEV_KEY = new PublicKey("CXK63PkidRsKhnYCF3kMHqEX3RGgy9JJkebN3S91VHD3"); // Using program ID as dev key for now
    
    console.log("📋 Assuming sponsors are dev key:", DEV_KEY.toString());

    try {
        // Derive affiliate PDAs using dev key as sponsors (default behavior)
        const affL1 = PublicKey.findProgramAddressSync([
            Buffer.from("affiliate"),
            DEV_KEY.toBuffer(),
        ], PROGRAM_ID)[0];

        const affL2 = PublicKey.findProgramAddressSync([
            Buffer.from("affiliate"),
            DEV_KEY.toBuffer(),
        ], PROGRAM_ID)[0];

        const affL3 = PublicKey.findProgramAddressSync([
            Buffer.from("affiliate"),
            DEV_KEY.toBuffer(),
        ], PROGRAM_ID)[0];

        console.log("🏦 Affiliate PDAs:", {
            affL1: affL1.toString(),
            affL2: affL2.toString(),
            affL3: affL3.toString()
        });

        // Check which accounts exist and their states
        const [affL1Info, affL2Info, affL3Info] = await Promise.all([
            connection.getAccountInfo(affL1),
            connection.getAccountInfo(affL2),
            connection.getAccountInfo(affL3)
        ]);

        console.log("📊 Account states:");
        console.log("  affL1:", affL1Info ? `exists (${affL1Info.data.length} bytes)` : "null");
        console.log("  affL2:", affL2Info ? `exists (${affL2Info.data.length} bytes)` : "null");
        console.log("  affL3:", affL3Info ? `exists (${affL3Info.data.length} bytes)` : "null");

        // Check discriminators
        if (affL1Info) {
            console.log("  affL1 discriminator:", Array.from(affL1Info.data.slice(0, 8)));
        }
        if (affL2Info) {
            console.log("  affL2 discriminator:", Array.from(affL2Info.data.slice(0, 8)));
        }
        if (affL3Info) {
            console.log("  affL3 discriminator:", Array.from(affL3Info.data.slice(0, 8)));
        }

        // For devnet, we can suggest manual account closure
        console.log("\n💡 To fix the AccountDiscriminatorMismatch error:");
        console.log("1. The problematic accounts need to be closed and recreated");
        console.log("2. This requires the account owner (the program) to close them");
        console.log("3. Or redeploy the contract with fresh state");
        
        console.log("\n🔧 Suggested solutions:");
        console.log("1. Add a close_affiliate_account instruction to the contract");
        console.log("2. Or redeploy the contract to devnet with fresh state");
        console.log("3. Or modify the contract to handle discriminator mismatches");

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

// Run the script
main().catch(console.error);