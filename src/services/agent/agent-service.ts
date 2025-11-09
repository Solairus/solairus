import { Connection, PublicKey } from "@solana/web3.js";
import { fetchUserAgentActivations, type BackendAgentActivation } from "./agent-backend";
import { calculateNextWithdrawalTime } from "./contract-timing-service";

type TierName = "NOVA" | "VEGA" | "ORION" | "PRIME" | string;

export interface AgentData {
  activationId: number;
  tier: TierName;
  tierConfig: {
    name: string;
    emoji: string;
    description: string;
    dailyRange: string;
    yieldCapPct: number;
  };
  activationAmount: number;
  activatedAt: Date;
  lastRoiWithdrawal: Date | null;
  totalRoiWithdrawn: number;
  yieldCapReached: boolean;
  yieldCapProgress: number;
  canWithdraw: boolean;
  nextWithdrawalAt: Date | null;
  withdrawalStatus: {
    canWithdraw: boolean;
    reason?: string;
    nextWithdrawalAt?: Date | null;
  };
  pda: PublicKey | null;
  accountData: Record<string, unknown> | null;
}

export interface GetUserAgentsOptions {
  limit?: number;
  offset?: number;
  sortBy?: "activatedAt" | "tier" | "activationAmount";
  sortOrder?: "asc" | "desc";
}

export interface GetUserAgentsResult {
  agents: AgentData[];
  totalCount: number;
  hasMore: boolean;
}

const UI_TIER_CONFIGS: Record<string, AgentData["tierConfig"]> = {
  NOVA: {
    name: "NOVA",
    emoji: "🪶",
    description: "Entry tier with stable daily yields",
    dailyRange: "1.25% - 1.75%",
    yieldCapPct: 200,
  },
  VEGA: {
    name: "VEGA",
    emoji: "🔮",
    description: "Balanced risk and return",
    dailyRange: "1.75% - 2.15%",
    yieldCapPct: 200,
  },
  ORION: {
    name: "ORION",
    emoji: "⚡",
    description: "Higher yields with moderate risk",
    dailyRange: "2.15% - 2.75%",
    yieldCapPct: 200,
  },
  PRIME: {
    name: "PRIME",
    emoji: "🧠",
    description: "Elite tier with top yields",
    dailyRange: "2.75% - 3.25%",
    yieldCapPct: 200,
  },
};

function resolveTierConfig(tierName: string | null | undefined): AgentData["tierConfig"] {
  if (!tierName) return UI_TIER_CONFIGS.NOVA;
  return UI_TIER_CONFIGS[tierName.toUpperCase()] ?? { ...UI_TIER_CONFIGS.NOVA, name: tierName.toUpperCase() };
}

function resolveConnection(connection: Connection | { connection?: Connection } | null | undefined): Connection | null {
  if (!connection) return null;
  if (connection instanceof Connection) return connection;
  if ("connection" in connection && connection.connection instanceof Connection) {
    return connection.connection;
  }
  return null;
}

async function mapBackendAgentToAgentData(
  row: BackendAgentActivation,
  connection: Connection | null
): Promise<AgentData> {
  const rawTierName = row.metadata?.tier_name;
  const tierName = typeof rawTierName === "string" ? rawTierName : undefined;
  const tierConfig = resolveTierConfig(tierName);
  const activationAmount = typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0);
  const totalRoiWithdrawn = typeof row.total_earned === "number" ? row.total_earned : Number(row.total_earned ?? 0);
  const capBp = row.reward_cap_bp ?? 20000;
  const capPct = capBp / 100;

  const rawProgress = activationAmount > 0 ? (totalRoiWithdrawn / activationAmount) * 100 : 0;
  const yieldCapProgress = Math.min(row.yield_cap_progress_pct ?? rawProgress, capPct);
  const yieldCapReached = row.yield_cap_reached ?? yieldCapProgress >= capPct;

  const activatedAtIso = row.activated_at ?? row.created_at;
  const activatedAt = activatedAtIso ? new Date(activatedAtIso) : new Date();

  const nextWithdrawalAt =
    connection && activationAmount > 0
      ? await calculateNextWithdrawalTime(connection, activatedAt, undefined)
      : null;

  const canWithdraw = !yieldCapReached && !nextWithdrawalAt && activationAmount > 0;

  return {
    activationId: row.id,
    tier: tierConfig.name,
    tierConfig: {
      ...tierConfig,
      yieldCapPct: capPct || tierConfig.yieldCapPct,
    },
    activationAmount,
    activatedAt,
    lastRoiWithdrawal: null,
    totalRoiWithdrawn,
    yieldCapReached,
    yieldCapProgress,
    canWithdraw,
    nextWithdrawalAt: nextWithdrawalAt ?? null,
    withdrawalStatus: {
      canWithdraw,
      nextWithdrawalAt: nextWithdrawalAt ?? null,
      reason: canWithdraw ? undefined : yieldCapReached ? "Yield cap reached" : undefined,
    },
    pda: null,
    accountData: {
      id: row.id,
      tier: tierConfig.name,
      metadata: row.metadata,
    },
  };
}

export async function getUserAgents(
  connection: Connection | { connection?: Connection },
  userPublicKey: PublicKey,
  options: GetUserAgentsOptions = {}
): Promise<GetUserAgentsResult> {
  const { limit = 1000, offset = 0, sortBy = "activatedAt", sortOrder = "desc" } = options;

  const backendRows = await fetchUserAgentActivations(userPublicKey.toBase58());
  const resolvedConnection = resolveConnection(connection);

  const mappedAgents = await Promise.all(
    backendRows.map((row) => mapBackendAgentToAgentData(row, resolvedConnection))
  );

  mappedAgents.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
      case "activatedAt":
          comparison = a.activatedAt.getTime() - b.activatedAt.getTime();
          break;
      case "tier":
        comparison = String(a.tier).localeCompare(String(b.tier));
          break;
      case "activationAmount":
          comparison = a.activationAmount - b.activationAmount;
          break;
        default:
          comparison = a.activatedAt.getTime() - b.activatedAt.getTime();
      }
    return sortOrder === "desc" ? -comparison : comparison;
    });

  const totalCount = mappedAgents.length;
  const sliced = mappedAgents.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return {
    agents: sliced,
      totalCount,
    hasMore,
  };
}

export async function getUserAgent(
  connection: Connection | { connection?: Connection },
  userPublicKey: PublicKey,
  activationId: number
): Promise<AgentData | null> {
  const result = await getUserAgents(connection, userPublicKey, { limit: 1000, offset: 0 });
  return result.agents.find((agent) => agent.activationId === activationId) ?? null;
}

export interface AgentStatistics {
  totalAgents: number;
  activeAgents: number;
  retiredAgents: number;
  totalInvested: number;
  totalWithdrawn: number;
  averageYieldProgress: number;
  agentsByTier: Record<TierName, number>;
}

export async function getUserAgentStatistics(
  connection: Connection | { connection?: Connection },
  userPublicKey: PublicKey
): Promise<AgentStatistics> {
  const { agents } = await getUserAgents(connection, userPublicKey);
    const totalAgents = agents.length;
  const activeAgents = agents.filter((agent) => !agent.yieldCapReached).length;
  const retiredAgents = totalAgents - activeAgents;
    
    const totalInvested = agents.reduce((sum, agent) => sum + agent.activationAmount, 0);
    const totalWithdrawn = agents.reduce((sum, agent) => sum + agent.totalRoiWithdrawn, 0);
  const averageYieldProgress = totalAgents > 0 ? agents.reduce((sum, agent) => sum + agent.yieldCapProgress, 0) / totalAgents : 0;

  const baseTiers: Record<TierName, number> = {
    NOVA: 0,
    VEGA: 0,
    ORION: 0,
    PRIME: 0,
  };
  const agentsByTier = agents.reduce<Record<TierName, number>>((acc, agent) => {
    acc[agent.tier] = (acc[agent.tier] ?? 0) + 1;
    return acc;
  }, { ...baseTiers });
    
    return {
      totalAgents,
      activeAgents,
      retiredAgents,
      totalInvested,
      totalWithdrawn,
      averageYieldProgress,
    agentsByTier,
    };
}