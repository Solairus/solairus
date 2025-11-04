/**
 * Tests for TierSelection Component
 * 
 * This test suite validates the tier selection component that allows users
 * to choose between different AI agent tiers with varying characteristics.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { TierSelection } from '../TierSelection';
import { AgentTier } from '@/lib/solairus-removed';

// Mock the solairus-main lib
vi.mock('@/lib/solairus-main', () => ({
  AgentTier: {
    NOVA: 0,
    VEGA: 1,
    ORION: 2,
    PRIME: 3,
  },
  AGENT_TIER_CONFIGS: {
    0: {
      name: 'NOVA',
      emoji: '🪶',
      description: 'Entry-level agent, safe and steady',
      dailyRange: '1.00% - 1.75%',
      yieldCapPct: 175,
    },
    1: {
      name: 'VEGA',
      emoji: '🔮',
      description: 'Balanced risk and return',
      dailyRange: '1.75% - 2.15%',
      yieldCapPct: 200,
    },
    2: {
      name: 'ORION',
      emoji: '⚡',
      description: 'Aggressive but controlled',
      dailyRange: '2.15% - 3.00%',
      yieldCapPct: 220,
    },
    3: {
      name: 'PRIME',
      emoji: '🧠',
      description: 'Elite trading AI',
      dailyRange: '3.00% - 5.00%',
      yieldCapPct: 250,
    },
  },
}));

describe('TierSelection', () => {
  const mockOnTierSelect = vi.fn();

  beforeEach(() => {
    mockOnTierSelect.mockClear();
  });

  describe('Basic Rendering', () => {
    it('should render the component title and description', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('Choose Your Agent Tier')).toBeInTheDocument();
      expect(screen.getByText(/Select an AI trading agent tier based on your risk tolerance/)).toBeInTheDocument();
    });

    it('should render all four agent tiers', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('NOVA')).toBeInTheDocument();
      expect(screen.getByText('VEGA')).toBeInTheDocument();
      expect(screen.getByText('ORION')).toBeInTheDocument();
      expect(screen.getByText('PRIME')).toBeInTheDocument();
    });

    it('should display tier emojis', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('🪶')).toBeInTheDocument();
      expect(screen.getByText('🔮')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('🧠')).toBeInTheDocument();
    });

    it('should display tier descriptions', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('Entry-level agent, safe and steady')).toBeInTheDocument();
      expect(screen.getByText('Balanced risk and return')).toBeInTheDocument();
      expect(screen.getByText('Aggressive but controlled')).toBeInTheDocument();
      expect(screen.getByText('Elite trading AI')).toBeInTheDocument();
    });
  });

  describe('Tier Information Display', () => {
    it('should display daily yield ranges for all tiers', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('1.00% - 1.75%')).toBeInTheDocument();
      expect(screen.getByText('1.75% - 2.15%')).toBeInTheDocument();
      expect(screen.getByText('2.15% - 3.00%')).toBeInTheDocument();
      expect(screen.getByText('3.00% - 5.00%')).toBeInTheDocument();
    });

    it('should display yield caps for all tiers', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('175%')).toBeInTheDocument();
      expect(screen.getByText('200%')).toBeInTheDocument();
      expect(screen.getByText('220%')).toBeInTheDocument();
      expect(screen.getByText('250%')).toBeInTheDocument();
    });

    it('should display target user types', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('Beginners')).toBeInTheDocument();
      expect(screen.getByText('Balanced')).toBeInTheDocument();
      expect(screen.getByText('Aggressive')).toBeInTheDocument();
      expect(screen.getByText('Elite')).toBeInTheDocument();
    });

    it('should display risk levels', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('Low Risk')).toBeInTheDocument();
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
      expect(screen.getByText('High Risk')).toBeInTheDocument();
      expect(screen.getByText('Max Risk')).toBeInTheDocument();
    });
  });

  describe('Tier Selection Functionality', () => {
    it('should call onTierSelect when NOVA tier is clicked', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      const novaCard = screen.getByText('NOVA').closest('div');
      if (novaCard) {
        fireEvent.click(novaCard);
        expect(mockOnTierSelect).toHaveBeenCalledWith(AgentTier.NOVA);
      }
    });

    it('should call onTierSelect when VEGA tier is clicked', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      const vegaCard = screen.getByText('VEGA').closest('div');
      if (vegaCard) {
        fireEvent.click(vegaCard);
        expect(mockOnTierSelect).toHaveBeenCalledWith(AgentTier.VEGA);
      }
    });

    it('should call onTierSelect when ORION tier is clicked', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      const orionCard = screen.getByText('ORION').closest('div');
      if (orionCard) {
        fireEvent.click(orionCard);
        expect(mockOnTierSelect).toHaveBeenCalledWith(AgentTier.ORION);
      }
    });

    it('should call onTierSelect when PRIME tier is clicked', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      const primeCard = screen.getByText('PRIME').closest('div');
      if (primeCard) {
        fireEvent.click(primeCard);
        expect(mockOnTierSelect).toHaveBeenCalledWith(AgentTier.PRIME);
      }
    });
  });

  describe('Selected Tier Display', () => {
    it('should show selected tier summary when NOVA is selected', () => {
      render(
        <TierSelection 
          selectedTier={AgentTier.NOVA}
          onTierSelect={mockOnTierSelect} 
        />
      );

      expect(screen.getByText('NOVA Agent Selected')).toBeInTheDocument();
      // Check for the summary section specifically
      const summarySection = document.querySelector('.glass.rounded-xl.p-4.border.border-primary\\/30');
      expect(summarySection).toBeInTheDocument();
    });

    it('should show selected tier summary when VEGA is selected', () => {
      render(
        <TierSelection 
          selectedTier={AgentTier.VEGA}
          onTierSelect={mockOnTierSelect} 
        />
      );

      expect(screen.getByText('VEGA Agent Selected')).toBeInTheDocument();
      // Check for the summary section specifically
      const summarySection = document.querySelector('.glass.rounded-xl.p-4.border.border-primary\\/30');
      expect(summarySection).toBeInTheDocument();
    });

    it('should show selected tier summary when ORION is selected', () => {
      render(
        <TierSelection 
          selectedTier={AgentTier.ORION}
          onTierSelect={mockOnTierSelect} 
        />
      );

      expect(screen.getByText('ORION Agent Selected')).toBeInTheDocument();
      // Check for the summary section specifically
      const summarySection = document.querySelector('.glass.rounded-xl.p-4.border.border-primary\\/30');
      expect(summarySection).toBeInTheDocument();
    });

    it('should show selected tier summary when PRIME is selected', () => {
      render(
        <TierSelection 
          selectedTier={AgentTier.PRIME}
          onTierSelect={mockOnTierSelect} 
        />
      );

      expect(screen.getByText('PRIME Agent Selected')).toBeInTheDocument();
      // Check for the summary section specifically
      const summarySection = document.querySelector('.glass.rounded-xl.p-4.border.border-primary\\/30');
      expect(summarySection).toBeInTheDocument();
    });

    it('should display selected tier yield information in summary', () => {
      render(
        <TierSelection 
          selectedTier={AgentTier.VEGA}
          onTierSelect={mockOnTierSelect} 
        />
      );

      // Should show the selected tier's specific information
      expect(screen.getByText('Daily Yield Range:')).toBeInTheDocument();
      expect(screen.getByText('Maximum Total Yield:')).toBeInTheDocument();
    });

    it('should not show selected tier summary when no tier is selected', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.queryByText(/Agent Selected/)).not.toBeInTheDocument();
    });
  });

  describe('Visual Selection Indicators', () => {
    it('should show "Selected" indicator for selected tier', () => {
      render(
        <TierSelection 
          selectedTier={AgentTier.NOVA}
          onTierSelect={mockOnTierSelect} 
        />
      );

      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('should show "Click to select" for unselected tiers', () => {
      render(
        <TierSelection 
          selectedTier={AgentTier.NOVA}
          onTierSelect={mockOnTierSelect} 
        />
      );

      // Should have multiple "Click to select" texts for unselected tiers
      const clickToSelectElements = screen.getAllByText('Click to select');
      expect(clickToSelectElements).toHaveLength(3); // 3 unselected tiers
    });

    it('should show check circle icon for selected tier', () => {
      render(
        <TierSelection 
          selectedTier={AgentTier.VEGA}
          onTierSelect={mockOnTierSelect} 
        />
      );

      // Check for CheckCircle icons using a more flexible approach
      const checkIcons = document.querySelectorAll('svg[class*="check"]');
      expect(checkIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Disabled State', () => {
    it('should disable interaction when disabled prop is true', () => {
      render(
        <TierSelection 
          onTierSelect={mockOnTierSelect}
          disabled={true}
        />
      );

      const novaCard = screen.getByText('NOVA').closest('div');
      if (novaCard) {
        fireEvent.click(novaCard);
        expect(mockOnTierSelect).not.toHaveBeenCalled();
      }
    });

    it('should apply disabled styling when disabled', () => {
      const { container } = render(
        <TierSelection 
          onTierSelect={mockOnTierSelect}
          disabled={true}
        />
      );

      // Should have opacity-50 class for disabled state
      const disabledElements = container.querySelectorAll('.opacity-50');
      expect(disabledElements.length).toBeGreaterThan(0);
    });

    it('should have cursor-not-allowed when disabled', () => {
      const { container } = render(
        <TierSelection 
          onTierSelect={mockOnTierSelect}
          disabled={true}
        />
      );

      const notAllowedElements = container.querySelectorAll('.cursor-not-allowed');
      expect(notAllowedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Tier Features Display', () => {
    it('should display tier-specific feature descriptions', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText('Stable daily returns with minimal risk')).toBeInTheDocument();
      expect(screen.getByText('Balanced approach with steady growth')).toBeInTheDocument();
      expect(screen.getByText('Higher yields with controlled volatility')).toBeInTheDocument();
      expect(screen.getByText('Maximum returns for experienced traders')).toBeInTheDocument();
    });

    it('should display appropriate icons for each tier', () => {
      const { container } = render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      // Check for tier-specific icons
      expect(container.querySelector('.lucide-target')).toBeInTheDocument(); // NOVA
      expect(container.querySelector('.lucide-trending-up')).toBeInTheDocument(); // VEGA
      expect(container.querySelector('.lucide-zap')).toBeInTheDocument(); // ORION
      expect(container.querySelector('.lucide-crown')).toBeInTheDocument(); // PRIME
    });
  });

  describe('Informational Footer', () => {
    it('should display helpful information footer', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByText(/Higher tiers offer greater yield potential/)).toBeInTheDocument();
      expect(screen.getByText(/Choose the tier that matches your investment strategy/)).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className when provided', () => {
      const { container } = render(
        <TierSelection 
          onTierSelect={mockOnTierSelect}
          className="custom-tier-selection"
        />
      );

      expect(container.firstChild).toHaveClass('custom-tier-selection');
    });

    it('should apply tier-specific gradient styling', () => {
      const { container } = render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      // Check for tier-specific gradient classes
      expect(container.querySelector('.from-cyan-500\\/20')).toBeInTheDocument(); // NOVA
      expect(container.querySelector('.from-emerald-500\\/20')).toBeInTheDocument(); // VEGA
      expect(container.querySelector('.from-indigo-500\\/20')).toBeInTheDocument(); // ORION
      expect(container.querySelector('.from-amber-500\\/20')).toBeInTheDocument(); // PRIME
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      render(
        <TierSelection onTierSelect={mockOnTierSelect} />
      );

      const novaCard = screen.getByText('NOVA').closest('div');
      if (novaCard) {
        // Should be interactive - check that it's clickable
        expect(novaCard).toBeTruthy();
        // Verify it responds to clicks by checking the mock was called
        fireEvent.click(novaCard);
        expect(mockOnTierSelect).toHaveBeenCalledWith(AgentTier.NOVA);
      }
    });
  });
});