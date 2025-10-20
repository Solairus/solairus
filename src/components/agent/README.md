# Agent Dashboard UI Components

This directory contains the UI components for the Enhanced AI Agent System, implementing a complete agent portfolio management interface with tier-based activation and withdrawal controls.

## Components

### 🏠 AgentDashboard
**Main dashboard component for displaying user's agent portfolio**

- Displays all activated agents in a responsive grid
- Shows withdrawal limit status and warnings
- Provides sorting and filtering options
- Handles empty states and loading states
- Integrates with agent services for real-time data

```tsx
<AgentDashboard
  userPublicKey={userPublicKey}
  connection={connection}
  onActivateAgent={() => setShowActivation(true)}
/>
```

### 🎴 AgentCard
**Individual agent display card with ROI management**

- Shows agent tier with emoji and styling (🪶 NOVA, 🔮 VEGA, ⚡ ORION, 🧠 PRIME)
- Displays investment amount, activation date, and ROI status
- Shows yield cap progress with visual progress bar
- Includes withdrawal button with timing validation
- Handles retired agents and withdrawal cooldowns

```tsx
<AgentCard
  agent={agentData}
  onWithdraw={handleAgentWithdrawal}
/>
```

### 📊 WithdrawalLimitDisplay
**Withdrawal limit status and progress display**

- Shows total deposits, withdrawals, and remaining limits
- Visual progress bar with warning level colors
- Handles privileged user status (unlimited withdrawals)
- Provides contextual warnings and guidance
- Real-time limit calculations

```tsx
<WithdrawalLimitDisplay status={withdrawalLimitStatus} />
```

### 🎯 TierSelection
**Agent tier selection interface for activation**

- Displays all four agent tiers with characteristics
- Shows daily yield ranges and yield caps
- Includes tier descriptions and target user types
- Interactive selection with visual feedback
- Tier-specific styling and metadata

```tsx
<TierSelection
  selectedTier={selectedTier}
  onTierSelect={setSelectedTier}
/>
```

### 🎮 AgentDashboardDemo
**Complete integration demo component**

- Shows how to combine all components
- Demonstrates tier selection → activation flow
- Includes proper state management
- Ready-to-use example implementation

## Agent Tiers

| Tier | Emoji | Daily Range | Yield Cap | Description |
|------|-------|-------------|-----------|-------------|
| NOVA | 🪶 | 1.00% - 1.75% | 175% | Entry-level agent, safe and steady |
| VEGA | 🔮 | 1.75% - 2.15% | 200% | Balanced risk and return |
| ORION | ⚡ | 2.15% - 3.00% | 220% | Aggressive but controlled |
| PRIME | 🧠 | 3.00% - 5.00% | 250% | Elite trading AI |

## Features

### ✅ Implemented
- **Tier-based agent display** with unique styling per tier
- **Withdrawal limit tracking** with visual progress indicators
- **ROI withdrawal management** with timing validation
- **Responsive design** optimized for mobile and desktop
- **Real-time status updates** with loading and error states
- **Comprehensive testing** with Vitest test suite

### 🚧 Integration Points
- **Agent activation** - Requires Task 8 (agent activation UI updates)
- **ROI withdrawal** - Requires Task 4 (individual agent ROI withdrawal system)
- **Wallet integration** - Needs connection and publicKey from wallet adapter

## Usage Example

```tsx
import { AgentDashboard, TierSelection } from '@/components/agent';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

function AgentPage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [showTierSelection, setShowTierSelection] = useState(false);

  if (!publicKey) {
    return <WalletConnectPrompt />;
  }

  return (
    <div className="container mx-auto p-4">
      {showTierSelection ? (
        <TierSelection
          onTierSelect={(tier) => {
            // Handle tier selection and activation
            activateAgent(tier);
            setShowTierSelection(false);
          }}
        />
      ) : (
        <AgentDashboard
          userPublicKey={publicKey}
          connection={connection}
          onActivateAgent={() => setShowTierSelection(true)}
        />
      )}
    </div>
  );
}
```

## Design System

### Color Scheme
- **NOVA**: Cyan (🪶) - `from-cyan-500/20 to-cyan-600/10`
- **VEGA**: Emerald (🔮) - `from-emerald-500/20 to-emerald-600/10`
- **ORION**: Indigo (⚡) - `from-indigo-500/20 to-indigo-600/10`
- **PRIME**: Amber (🧠) - `from-amber-500/20 to-amber-600/10`

### Glass Morphism
All components use the project's glass morphism design system:
- `glass` class for backdrop blur and transparency
- Gradient backgrounds with tier-specific colors
- Subtle borders and hover effects
- Consistent spacing and typography

## Testing

Run the test suite:
```bash
npx vitest run src/components/agent
```

Tests cover:
- Component rendering and props
- User interactions and callbacks
- Error states and edge cases
- Accessibility and responsive behavior

## Dependencies

- **@solana/web3.js** - Blockchain interaction
- **@/services/agent/** - Agent data services
- **@/lib/solairus-main** - Smart contract integration
- **@/components/ui/** - Base UI components
- **lucide-react** - Icons
- **@/lib/utils** - Utility functions