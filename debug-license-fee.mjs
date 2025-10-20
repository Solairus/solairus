import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const PROGRAM_ID = new PublicKey(process.env.VITE_SOLAIRUS_MAIN_PROGRAM_ID);
const RPC_URL = process.env.VITE_SOLANA_RPC_URL_MAINNET || "https://api.mainnet-beta.solana.com";

console.log('🔍 Debugging License Fee Discrepancy');
console.log('📋 Program ID:', PROGRAM_ID.toString());
console.log('🌐 RPC URL:', RPC_URL);

async function debugLicenseFee() {
  try {
    // Create connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Derive config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );
    
    console.log('📍 Config PDA:', configPda.toString());
    
    // Fetch config account
    const configAccount = await connection.getAccountInfo(configPda);
    
    if (!configAccount) {
      console.log('❌ Config account not found - contract may not be deployed');
      return;
    }
    
    console.log('✅ Config account found');
    console.log('📊 Account data length:', configAccount.data.length);
    
    // Try to decode the config data
    // The activationFeeUsdt is stored as a u64 (8 bytes) at a specific offset
    // We need to find the correct offset based on the struct layout
    
    // For debugging, let's look at the raw data
    console.log('🔍 Raw config data (first 100 bytes):');
    console.log(configAccount.data.slice(0, 100).toString('hex'));
    
    // Try to find the activation fee (should be 50000000 for 50 USDT with 6 decimals)
    // or 25000000 for 25 USDT
    const expectedFee50 = Buffer.from([0x00, 0xF2, 0x05, 0x2A, 0x01, 0x00, 0x00, 0x00]); // 50000000 in little-endian
    const expectedFee25 = Buffer.from([0x00, 0x79, 0x02, 0x95, 0x00, 0x00, 0x00, 0x00]); // 25000000 in little-endian
    
    console.log('🔍 Looking for fee patterns...');
    
    for (let i = 0; i < configAccount.data.length - 8; i++) {
      const slice = configAccount.data.slice(i, i + 8);
      const value = slice.readBigUInt64LE(0);
      
      if (value === 50000000n) {
        console.log(`✅ Found 50 USDT fee at offset ${i}: ${value}`);
      }
      if (value === 25000000n) {
        console.log(`✅ Found 25 USDT fee at offset ${i}: ${value}`);
      }
    }
    
    // Also check for other common values
    console.log('\n🔍 All u64 values in config:');
    for (let i = 0; i < configAccount.data.length - 8; i += 8) {
      const value = configAccount.data.readBigUInt64LE(i);
      if (value > 0n && value < 1000000000n) { // Reasonable range for USDT amounts
        const usdtAmount = Number(value) / 1000000;
        console.log(`Offset ${i}: ${value} (${usdtAmount} USDT)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugLicenseFee();