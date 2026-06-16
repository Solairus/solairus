import { PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { UserProfile } from '@/types/backend';

/**
 * User Transfer Parameters
 */
export interface UserTransferParams {
    fromUser: PublicKey;
    toUser: PublicKey;
    amount: number; // Amount in micro USDT (6 decimals)
}

/**
 * User Transfer Result
 */
export interface UserTransferResult {
    txSignature: string; // May be a backend transaction ID or empty if backend handles it
    fromUser: PublicKey;
    toUser: PublicKey;
    amount: number;
}

/**
 * UserService - Handles user-to-user operations via Backend API
 */
export class UserService {
    private baseUrl: string;

    constructor(baseUrl: string = '/api') {
        this.baseUrl = baseUrl;
    }

    /**
     * Transfer credit balance between users
     */
    async transferCredit(params: UserTransferParams): Promise<UserTransferResult> {
        const { fromUser, toUser, amount } = params;

        // Validate parameters
        if (amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }

        if (fromUser.equals(toUser)) {
            throw new Error('Cannot transfer to yourself');
        }

        try {
            // Call backend API to perform transfer
            // POST /api/transfers
            const response = await axios.post(`${this.baseUrl}/transfers`, {
                fromUser: fromUser.toString(),
                toUser: toUser.toString(),
                amount: amount
            });

            return {
                txSignature: response.data.signature || 'backend-transfer',
                fromUser,
                toUser,
                amount,
            };
        } catch (error: unknown) {
            console.error('Error in transfer credit:', error);
            throw this.formatApiError(error);
        }
    }

    /**
     * Get user credit balance
     */
    async getUserCreditBalance(userPubkey: PublicKey): Promise<number> {
        try {
            // GET /api/users/:pubkey/profile
            const response = await axios.get<UserProfile>(`${this.baseUrl}/users/${userPubkey.toString()}/profile`);
            return response.data.creditBalance || 0;
        } catch (error) {
            console.error('Error fetching user credit balance:', error);
            // Return 0 on error to prevent UI crash, but log it
            return 0;
        }
    }

    /**
     * Format API errors into user-friendly messages
     */
    private formatApiError(error: unknown): Error {
        if (axios.isAxiosError(error)) {
            const message = (error.response?.data as { message: string })?.message || error.message;

            if (message.includes('Insufficient funds')) {
                return new Error('Insufficient balance for this transfer');
            }
            if (message.includes('Self transfer')) {
                return new Error('Cannot transfer to yourself');
            }

            return new Error(message);
        }

        return new Error('Transfer failed. Please try again.');
    }
}