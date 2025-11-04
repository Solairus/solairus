import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { 
  PROGRAM_ID, 
  UserAgentActivation, 
  AgentTier,
  getAgentTierConfig,
  canWithdrawRoi,
  calculateYieldCapProgress
} from "@/lib/solairus-removed";
import { handleRpcError, getHealthyRpcConnection } from "@/utils/rpc-switcher";
import { getAgentServiceConfig } from "@/config/agent-config";
import { getContractSecondsPerDay } from "./contract-timing-service";

// Agent data formatted for frontend consumption
export interface AgentData {
  activationId: number;
  tier: AgentTier;
  tierConfig: {
    name: string;
    emoji: string;
    description: string;
    dailyRange: string;
    yieldCapPct: number;
  };
  activationAmount: number; // In USDT (converted from smallest unit)
  activatedAt: Date;
  lastRoiWithdrawal: Date | null;
  totalRoiWithdrawn: number; // In USDT (converted from smallest unit)
  yieldCapReached: boolean;
  yieldCapProgress: number; // Percentage (0-100)
  canWithdraw: boolean;
  nextWithdrawalAt: Date | null;
  withdrawalStatus: {
    canWithdraw: boolean;
    reason?: string;
    nextWithdrawalAt?: Date;
  };
  // Raw PDA and account data for transactions
  pda: PublicKey;
  accountData: UserAgentActivation;
}

export interface GetUserAgentsOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'activatedAt' | 'tier' | 'activationAmount';
  sortOrder?: 'asc' | 'desc';
}

export interface GetUserAgentsResult {
  agents: AgentData[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Query all UserAgentActivation PDAs for a specific user
 * Uses memcmp filter on user field for efficient querying
 */
export async function getUserAgents(
  connection: Connection,
  userPublicKey: PublicKey,
  options: GetUserAgentsOptions = {}
): Promise<GetUserAgentsResult> {
  try {
    console.log('🔍 Querying agents for user:', userPublicKey.toString());
    
    const serviceConfig = getAgentServiceConfig();
    const {
      limit = serviceConfig.defaultPageSize,
      offset = 0,
      sortBy = 'activatedAt',
      sortOrder = 'desc'
    } = options;

    // Query all UserAgentActivation PDAs for the user using memcmp filter
    // If this RPC fails, the error will bubble up and the UI can handle it
    const agentAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          // Filter by account size (8 bytes discriminator + UserAgentActivation::SIZE)
          dataSize: 8 + 76 // 8 + UserAgentActivation::SIZE from contract
        },
        {
          // memcmp filter on user field (first field after discriminator)
          memcmp: {
            offset: 8, // Skip 8-byte discriminator
            bytes: userPublicKey.toBase58()
          }
        }
      ]
    });

    console.log(`✅ Found ${agentAccounts.length} agent accounts for user`);

    // Get contract timing once for all agents (performance optimization)
    const secondsPerDay = await getContractSecondsPerDay(connection);
    console.log(`🕒 Using contract timing: ${secondsPerDay} seconds per day`);

    // Parse and format agent data
    const agents: AgentData[] = [];
    
    for (const accountInfo of agentAccounts) {
      try {
        // Deserialize the account data
        const accountData = parseUserAgentActivation(accountInfo.account.data);
        
        // Get tier configuration
        const tierConfig = getAgentTierConfig(accountData.tier as AgentTier);
        
        // Calculate yield cap progress
        const yieldCapProgress = calculateYieldCapProgress(
          accountData.tier,
          accountData.amountUsdt,
          accountData.totalRoiWithdrawn
        );

        // Check withdrawal status with contract timing
        const withdrawalStatus = canWithdrawRoi(accountData, Math.floor(Date.now() / 1000), secondsPerDay);

        // Format agent data for frontend
        const agentData: AgentData = {
          activationId: accountData.activationId.toNumber(),
          tier: accountData.tier as AgentTier,
          tierConfig: {
            name: tierConfig.name,
            emoji: tierConfig.emoji,
            description: tierConfig.description,
            dailyRange: tierConfig.dailyRange,
            yieldCapPct: tierConfig.yieldCapPct
          },
          activationAmount: accountData.amountUsdt.toNumber() / 1_000_000, // Convert from smallest unit to USDT
          activatedAt: new Date(accountData.startedAt.toNumber() * 1000),
          lastRoiWithdrawal: accountData.lastRoiWithdrawAt.eq(new anchor.BN(0)) 
            ? null 
            : new Date(accountData.lastRoiWithdrawAt.toNumber() * 1000),
          totalRoiWithdrawn: accountData.totalRoiWithdrawn.toNumber() / 1_000_000, // Convert from smallest unit to USDT
          yieldCapReached: accountData.yieldCapReached,
          yieldCapProgress,
          canWithdraw: withdrawalStatus.canWithdraw,
          nextWithdrawalAt: withdrawalStatus.nextWithdrawalAt || null,
          withdrawalStatus,
          pda: accountInfo.pubkey,
          accountData
        };

        agents.push(agentData);
      } catch (error) {
        console.warn('⚠️ Failed to parse agent account:', accountInfo.pubkey.toString(), error);
        // Continue processing other accounts
      }
    }

    // Sort agents based on options
    agents.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'activatedAt':
          comparison = a.activatedAt.getTime() - b.activatedAt.getTime();
          break;
        case 'tier':
          comparison = a.tier - b.tier;
          break;
        case 'activationAmount':
          comparison = a.activationAmount - b.activationAmount;
          break;
        default:
          comparison = a.activatedAt.getTime() - b.activatedAt.getTime();
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const totalCount = agents.length;
    const paginatedAgents = agents.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    console.log(`✅ Returning ${paginatedAgents.length} agents (${offset}-${offset + limit} of ${totalCount})`);

    return {
      agents: paginatedAgents,
      totalCount,
      hasMore
    };

  } catch (error) {
    console.error('❌ Error querying user agents:', error);
    throw new Error(`Failed to query user agents: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse UserAgentActivation account data from raw bytes
 */
function parseUserAgentActivation(data: Buffer): UserAgentActivation {
  try {
    // Skip 8-byte discriminator
    let offset = 8;
    
    // Parse fields according to UserAgentActivation struct layout
    const user = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    const activationId = new anchor.BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    
    const tier = data.readUInt8(offset);
    offset += 1;
    
    const usingUsdt = data.readUInt8(offset) !== 0;
    offset += 1;
    
    const amountUsdt = new anchor.BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    
    const startedAt = new anchor.BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    
    const lastRoiWithdrawAt = new anchor.BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    
    const totalRoiWithdrawn = new anchor.BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    
    const yieldCapReached = data.readUInt8(offset) !== 0;
    offset += 1;
    
    const bump = data.readUInt8(offset);
    
    return {
      user,
      activationId,
      tier,
      usingUsdt,
      amountUsdt,
      startedAt,
      lastRoiWithdrawAt,
      totalRoiWithdrawn,
      yieldCapReached,
      bump
    };
  } catch (error) {
    throw new Error(`Failed to parse UserAgentActivation data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a single agent by activation ID
 */
export async function getUserAgent(
  connection: Connection,
  userPublicKey: PublicKey,
  activationId: number
): Promise<AgentData | null> {
  try {
    const result = await getUserAgents(connection, userPublicKey);
    return result.agents.find(agent => agent.activationId === activationId) || null;
  } catch (error) {
    console.error('❌ Error getting user agent:', error);
    return null;
  }
}

/**
 * Get agent statistics for a user
 */
export interface AgentStatistics {
  totalAgents: number;
  activeAgents: number;
  retiredAgents: number;
  totalInvested: number; // In USDT
  totalWithdrawn: number; // In USDT
  averageYieldProgress: number; // Percentage
  agentsByTier: Record<AgentTier, number>;
}

export async function getUserAgentStatistics(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<AgentStatistics> {
  try {
    const result = await getUserAgents(connection, userPublicKey);
    const agents = result.agents;
    
    const totalAgents = agents.length;
    const activeAgents = agents.filter(agent => !agent.yieldCapReached).length;
    const retiredAgents = agents.filter(agent => agent.yieldCapReached).length;
    
    const totalInvested = agents.reduce((sum, agent) => sum + agent.activationAmount, 0);
    const totalWithdrawn = agents.reduce((sum, agent) => sum + agent.totalRoiWithdrawn, 0);
    
    const averageYieldProgress = totalAgents > 0 
      ? agents.reduce((sum, agent) => sum + agent.yieldCapProgress, 0) / totalAgents 
      : 0;
    
    const agentsByTier: Record<AgentTier, number> = {
      [AgentTier.NOVA]: 0,
      [AgentTier.VEGA]: 0,
      [AgentTier.ORION]: 0,
      [AgentTier.PRIME]: 0
    };
    
    agents.forEach(agent => {
      agentsByTier[agent.tier]++;
    });
    
    return {
      totalAgents,
      activeAgents,
      retiredAgents,
      totalInvested,
      totalWithdrawn,
      averageYieldProgress,
      agentsByTier
    };
  } catch (error) {
    console.error('❌ Error getting agent statistics:', error);
    throw error;
  }
}