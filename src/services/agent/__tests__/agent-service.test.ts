import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Connection, PublicKey } from '@solana/web3.js';
import { getUserAgents, getUserAgentStatistics } from '../agent-service';
import { fetchUserAgentActivations } from '../agent-backend';

vi.mock('../agent-backend', () => ({
  fetchUserAgentActivations: vi.fn(),
}));

const mockFetchAgents = fetchUserAgentActivations as unknown as vi.Mock;
const mockConnection = {} as Connection;
const mockUserPublicKey = new PublicKey('11111111111111111111111111111112');

describe('Agent Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserAgents', () => {
    it('should return empty result when no agents found', async () => {
      mockFetchAgents.mockResolvedValue([]);

      const result = await getUserAgents(mockConnection, mockUserPublicKey);

      expect(result).toEqual({
        agents: [],
        totalCount: 0,
        hasMore: false,
      });
    });

    it('should surface backend errors', async () => {
      mockFetchAgents.mockRejectedValue(new Error('Backend error'));

      await expect(getUserAgents(mockConnection, mockUserPublicKey)).rejects.toThrow('Backend error');
    });
  });

  describe('getUserAgentStatistics', () => {
    it('should return default statistics when no agents found', async () => {
      mockFetchAgents.mockResolvedValue([]);

      const result = await getUserAgentStatistics(mockConnection, mockUserPublicKey);

      expect(result).toEqual({
        totalAgents: 0,
        activeAgents: 0,
        retiredAgents: 0,
        totalInvested: 0,
        totalWithdrawn: 0,
        averageYieldProgress: 0,
        agentsByTier: {
          NOVA: 0,
          VEGA: 0,
          ORION: 0,
          PRIME: 0,
        },
      });
    });
  });
});