import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Connection, PublicKey } from '@solana/web3.js';
import { getUserAgents, getUserAgentStatistics } from '../agent-service';
import { AgentTier } from '@/lib/solairus-main';

// Mock the connection
const mockConnection = {
    getProgramAccounts: vi.fn()
} as unknown as Connection;

// Type the mock function properly
const mockGetProgramAccounts = mockConnection.getProgramAccounts as ReturnType<typeof vi.fn>;

const mockUserPublicKey = new PublicKey('11111111111111111111111111111112');

describe('Agent Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getUserAgents', () => {
        it('should return empty result when no agents found', async () => {
            // Mock empty response
            mockGetProgramAccounts.mockResolvedValue([]);

            const result = await getUserAgents(mockConnection, mockUserPublicKey);

            expect(result).toEqual({
                agents: [],
                totalCount: 0,
                hasMore: false
            });
        });

        it('should handle connection errors gracefully', async () => {
            // Mock connection error
            mockGetProgramAccounts.mockRejectedValue(new Error('Connection failed'));

            await expect(getUserAgents(mockConnection, mockUserPublicKey)).rejects.toThrow('Failed to query user agents');
        });
    });

    describe('getUserAgentStatistics', () => {
        it('should return default statistics when no agents found', async () => {
            // Mock empty response
            mockGetProgramAccounts.mockResolvedValue([]);

            const result = await getUserAgentStatistics(mockConnection, mockUserPublicKey);

            expect(result).toEqual({
                totalAgents: 0,
                activeAgents: 0,
                retiredAgents: 0,
                totalInvested: 0,
                totalWithdrawn: 0,
                averageYieldProgress: 0,
                agentsByTier: {
                    [AgentTier.NOVA]: 0,
                    [AgentTier.VEGA]: 0,
                    [AgentTier.ORION]: 0,
                    [AgentTier.PRIME]: 0
                }
            });
        });
    });
});