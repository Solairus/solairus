import React from 'react';
import { AgentTier } from '@/lib/solairus-removed';
import { EXTENDED_AGENT_TIER_CONFIGS, ExtendedTierConfig } from '@/config/agent-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Target, 
  Zap, 
  Crown,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TierSelectionProps {
  selectedTier?: AgentTier;
  onTierSelect: (tier: AgentTier) => void;
  disabled?: boolean;
  className?: string;
}

interface TierCardProps {
  tier: AgentTier;
  config: ExtendedTierConfig;
  selected: boolean;
  onSelect: (tier: AgentTier) => void;
  disabled?: boolean;
}

const TierCard: React.FC<TierCardProps> = ({ 
  tier, 
  config, 
  selected, 
  onSelect, 
  disabled 
}) => {
  // Get tier-specific styling from configuration
  const styling = config.styling;
  
  // Get tier-specific icon
  const getIconComponent = (tierValue: AgentTier) => {
    switch (tierValue) {
      case AgentTier.NOVA: return Target;
      case AgentTier.VEGA: return TrendingUp;
      case AgentTier.ORION: return Zap;
      case AgentTier.PRIME: return Crown;
      default: return Target;
    }
  };

  const IconComponent = getIconComponent(tier);

  return (
    <div
      className={cn(
        "glass rounded-xl p-4 cursor-pointer transition-all duration-300",
        "bg-gradient-to-br", styling.gradient,
        "border-2",
        selected 
          ? cn(styling.border, "shadow-lg", styling.glow, "scale-[1.02]")
          : "border-border/30 hover:border-border/50 hover:scale-[1.01]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={() => !disabled && onSelect(tier)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            styling.bg
          )}>
            <span className="text-2xl">{config.emoji}</span>
          </div>
          <div>
            <h3 className={cn("font-bold text-lg", styling.accent)}>
              {config.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>
          </div>
        </div>
        
        {selected && (
          <CheckCircle className="h-6 w-6 text-primary" />
        )}
      </div>

      {/* Yield Information */}
      <div className="space-y-3 mb-4">
        {/* Daily Yield Range */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Daily Yield</span>
          <span className={cn("font-semibold text-sm", styling.accent)}>
            {config.dailyRange}
          </span>
        </div>

        {/* Yield Cap */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Cap</span>
          <span className="font-semibold text-sm">
            {config.yieldCapPct}%
          </span>
        </div>

        {/* Target User */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Target User</span>
          <Badge variant="outline" className="text-xs">
            {config.targetUser}
          </Badge>
        </div>

        {/* Risk Level */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Risk Level</span>
          <span className={cn("text-xs font-medium", config.riskColor)}>
            {config.riskLevel}
          </span>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <IconComponent className={cn("h-4 w-4", styling.accent)} />
          <span className="text-xs text-muted-foreground">
            {tier === AgentTier.NOVA && "Stable daily returns with minimal risk"}
            {tier === AgentTier.VEGA && "Balanced approach with steady growth"}
            {tier === AgentTier.ORION && "Higher yields with controlled volatility"}
            {tier === AgentTier.PRIME && "Maximum returns for experienced traders"}
          </span>
        </div>
      </div>

      {/* Selection Indicator */}
      <div className={cn(
        "flex items-center justify-center py-2 rounded-lg transition-all duration-200",
        selected 
          ? cn(styling.bg, "border", styling.border)
          : "border border-border/30 hover:border-border/50"
      )}>
        {selected ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Selected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm">Click to select</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        )}
      </div>
    </div>
  );
};

export const TierSelection: React.FC<TierSelectionProps> = ({ 
  selectedTier, 
  onTierSelect, 
  disabled,
  className 
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold gradient-text">
          Choose Your Agent Tier
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Select an AI trading agent tier based on your risk tolerance and yield expectations. 
          Each tier offers different daily yield ranges and total yield caps.
        </p>
      </div>

      {/* Tier Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(EXTENDED_AGENT_TIER_CONFIGS).map(([tierKey, config]) => {
          const tier = parseInt(tierKey) as AgentTier;
          return (
            <TierCard
              key={tier}
              tier={tier}
              config={config}
              selected={selectedTier === tier}
              onSelect={onTierSelect}
              disabled={disabled}
            />
          );
        })}
      </div>

      {/* Selected Tier Summary */}
      {selectedTier !== undefined && (
        <div className="glass rounded-xl p-4 border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{EXTENDED_AGENT_TIER_CONFIGS[selectedTier].emoji}</span>
            <div>
              <h3 className="font-semibold text-primary">
                {EXTENDED_AGENT_TIER_CONFIGS[selectedTier].name} Agent Selected
              </h3>
              <p className="text-sm text-muted-foreground">
                {EXTENDED_AGENT_TIER_CONFIGS[selectedTier].description}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Daily Yield Range:</span>
              <p className="font-semibold text-primary">
                {EXTENDED_AGENT_TIER_CONFIGS[selectedTier].dailyRange}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Maximum Total Yield:</span>
              <p className="font-semibold text-primary">
                {EXTENDED_AGENT_TIER_CONFIGS[selectedTier].yieldCapPct}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          💡 Higher tiers offer greater yield potential but come with increased risk. 
          Choose the tier that matches your investment strategy.
        </p>
      </div>
    </div>
  );
};