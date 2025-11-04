import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getProgram, derivePdas } from '@/lib/solairus-removed';

/**
 * User Transfer Parameters
 */
export interface UserTransferParams {
    fromUser: PublicKey;
    toUser: PublicKey;
    amount: number; // Amount in micro USDT (6 decimals)
    provider: anchor.AnchorProvider;
}

/**
 * User Transfer Result
 */
export interface UserTransferResult {
    txSignature: string;
    fromUser: PublicKey;
    toUser: PublicKey;
    amount: number;
}

/**
 * UserService - Handles user-to-user operations
 */
export class UserService {
    private program: anchor.Program;

    constructor(provider: anchor.AnchorProvider) {
        this.program = getProgram(provider);
    }

    /**
     * Transfer credit balance between users
     */
    async transferCredit(params: UserTransferParams): Promise<UserTransferResult> {
        const { fromUser, toUser, amount, provider } = params;

        // Validate parameters
        if (amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }

        if (fromUser.equals(toUser)) {
            throw new Error('Cannot transfer to yourself');
        }

        // Derive PDAs
        const { config } = derivePdas();
        const { profile: fromProfile } = derivePdas(fromUser);
        const { profile: toProfile } = derivePdas(toUser);

        if (!fromProfile || !toProfile) {
            throw new Error('Could not derive profile PDAs');
        }

        try {
            // Convert amount to BN (contract expects u64)
            const amountBN = new anchor.BN(Math.floor(amount));

            const txSignature = await this.program.methods
                .transferCredit(amountBN)
                .accounts({
                    config,
                    fromProfile,
                    toProfile,
                    fromUser,
                    toUser,
                })
                .rpc();

            return {
                txSignature,
                fromUser,
                toUser,
                amount,
            };
        } catch (error) {
            console.error('Error in transfer credit:', error);
            throw this.formatContractError(error);
        }
    }

    /**
     * Get user credit balance
     */
    async getUserCreditBalance(userPubkey: PublicKey): Promise<number> {
        const { profile } = derivePdas(userPubkey);

        if (!profile) {
            throw new Error('Could not derive user profile PDA');
        }

        try {
            const userProfile = await this.program.account['userProfile'].fetch(profile);
            return userProfile.creditBalance?.toNumber() || 0;
        } catch (error) {
            console.error('Error fetching user credit balance:', error);
            return 0;
        }
    }

    /**
     * Format contract errors into user-friendly messages
     */
    private formatContractError(error: unknown): Error {
        if (error instanceof Error) {
            const message = error.message;

            // Handle specific contract errors
            if (message.includes('InsufficientFunds')) {
                return new Error('Insufficient balance for this transfer');
            }

            if (message.includes('SelfTransferNotAllowed')) {
                return new Error('Cannot transfer to yourself');
            }

            if (message.includes('InvalidAmount')) {
                return new Error('Invalid transfer amount');
            }

            if (message.includes('Unauthorized')) {
                return new Error('You are not authorized to perform this transfer');
            }

            // Return original error message if no specific handling
            return new Error(message);
        }

        return new Error('Transfer failed. Please try again.');
    }
}