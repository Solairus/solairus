import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const RPC_URL = process.env.VITE_SOLANA_RPC_URL_MAINNET || "https://api.mainnet-beta.solana.com";
const USDT_MINT = new PublicKey(process.env.VITE_USDT_MINT);

console.log('🔧 Creating USDT Token Account');
console.log('🌐 RPC URL:', RPC_URL);
console.log('💰 USDT Mint:', USDT_MINT.toString());

async function createUsdtAccount() {
  try {
    // You'll need to provide your wallet's private key or use a wallet adapter
    console.log('⚠️ This script requires wallet connection.');
    console.log('💡 Alternative: Use Phantom wallet to send a small USDT transaction to yourself');
    console.log('   This will automatically create your USDT token account.');
    
    // Instructions for manual creation
    console.log('\n📋 Manual Steps:');
    console.log('1. Open Phantom wallet');
    console.log('2. Go to "Send" → Select USDT');
    console.log('3. Send 0.01 USDT to your own address');
    console.log('4. This creates your USDT token account');
    console.log('5. Then you can use credit activation');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createUsdtAccount();