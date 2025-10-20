/**
 * Tests for WithdrawalLimitDisplay Component
 * 
 * This test suite validates the withdrawal limit display component that shows
 * users their current withdrawal status, limits, and usage progress.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WithdrawalLimitDisplay } from '../WithdrawalLimitDisplay';
import { WithdrawalLimitDisplay as WithdrawalLimitStatus } from '@/services/agent/withdrawal-limit-service';

describe('WithdrawalLimitDisplay', () => {
  let mockStatus: WithdrawalLimitStatus;

  beforeEach(() => {
    mockStatus = {
      totalDeposits: '1,000.00',
      totalWithdrawn: '50,000.00',
      maxWithdrawable: '200,000.00',
      remainingWithdrawable: '150,000.00',
      usagePercentage: 25,
      limitReached: false,
      isPrivileged: false,
      warningLevel: 'none',
      statusMessage: 'Withdrawal limit healthy'
    };
  });

  describe('Basic Display', () => {
    it('should render withdrawal limit information correctly', () => {
      render(<WithdrawalLimitDisplay status={mockStatus} />);

      expect(screen.getByText('Withdrawal Limits')).toBeInTheDocument();
      expect(screen.getByText('Withdrawal limit healthy')).toBeInTheDocument();
      expect(screen.getByText('25% Used')).toBeInTheDocument();
    });

    it('should display total deposits and withdrawals', () => {
      render(<WithdrawalLimitDisplay status={mockStatus} />);

      expect(screen.getByText('Total Deposits')).toBeInTheDocument();
      expect(screen.getByText('$1.0K')).toBeInTheDocument(); // Numbers get formatted
      expect(screen.getByText('Total Withdrawn')).toBeInTheDocument();
      expect(screen.getByText('$50.0K')).toBeInTheDocument(); // Numbers get formatted
    });

    it('should show max limit and remaining amounts', () => {
      render(<WithdrawalLimitDisplay status={mockStatus} />);

      expect(screen.getByText('Max Limit')).toBeInTheDocument();
      expect(screen.getByText('200,000.00')).toBeInTheDocument();
      expect(screen.getByText('Remaining')).toBeInTheDocument();
      expect(screen.getByText('150,000.00')).toBeInTheDocument();
    });

    it('should display usage progress bar', () => {
      render(<WithdrawalLimitDisplay status={mockStatus} />);

      expect(screen.getByText('Usage Progress')).toBeInTheDocument();
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });
  });

  describe('Privileged Users', () => {
    it('should display unlimited status for privileged users', () => {
      const privilegedStatus = {
        ...mockStatus,
        isPrivileged: true,
        statusMessage: 'Unlimited withdrawal access'
      };

      render(<WithdrawalLimitDisplay status={privilegedStatus} />);

      expect(screen.getByText('Unlimited')).toBeInTheDocument();
      expect(screen.getByText('Unlimited withdrawal access')).toBeInTheDocument();
    });

    it('should show crown icon for privileged users', () => {
      const privilegedStatus = {
        ...mockStatus,
        isPrivileged: true
      };

      render(<WithdrawalLimitDisplay status={privilegedStatus} />);

      // Crown icon should be present (using data-testid or checking for specific class)
      const crownIcon = document.querySelector('.lucide-crown');
      expect(crownIcon).toBeInTheDocument();
    });

    it('should not show progress bar for privileged users', () => {
      const privilegedStatus = {
        ...mockStatus,
        isPrivileged: true
      };

      render(<WithdrawalLimitDisplay status={privilegedStatus} />);

      expect(screen.queryByText('Usage Progress')).not.toBeInTheDocument();
    });

    it('should show privileged account message', () => {
      const privilegedStatus = {
        ...mockStatus,
        isPrivileged: true
      };

      render(<WithdrawalLimitDisplay status={privilegedStatus} />);

      expect(screen.getByText(/Privileged Account/)).toBeInTheDocument();
      expect(screen.getByText(/unlimited withdrawal access/)).toBeInTheDocument();
    });
  });

  describe('Warning Levels', () => {
    it('should display critical warning styling', () => {
      const criticalStatus = {
        ...mockStatus,
        warningLevel: 'critical' as const,
        usagePercentage: 95,
        statusMessage: 'Critical: Near withdrawal limit'
      };

      render(<WithdrawalLimitDisplay status={criticalStatus} />);

      expect(screen.getByText('Critical: Near withdrawal limit')).toBeInTheDocument();
      expect(screen.getByText('95% Used')).toBeInTheDocument();
    });

    it('should display high warning styling', () => {
      const highWarningStatus = {
        ...mockStatus,
        warningLevel: 'high' as const,
        usagePercentage: 80,
        statusMessage: 'High usage detected'
      };

      render(<WithdrawalLimitDisplay status={highWarningStatus} />);

      expect(screen.getByText('High usage detected')).toBeInTheDocument();
      expect(screen.getByText('80% Used')).toBeInTheDocument();
    });

    it('should display medium warning styling', () => {
      const mediumWarningStatus = {
        ...mockStatus,
        warningLevel: 'medium' as const,
        usagePercentage: 60,
        statusMessage: 'Moderate usage level'
      };

      render(<WithdrawalLimitDisplay status={mediumWarningStatus} />);

      expect(screen.getByText('Moderate usage level')).toBeInTheDocument();
      expect(screen.getByText('60% Used')).toBeInTheDocument();
    });

    it('should display low warning styling', () => {
      const lowWarningStatus = {
        ...mockStatus,
        warningLevel: 'low' as const,
        usagePercentage: 30,
        statusMessage: 'Low usage level'
      };

      render(<WithdrawalLimitDisplay status={lowWarningStatus} />);

      expect(screen.getByText('Low usage level')).toBeInTheDocument();
      expect(screen.getByText('30% Used')).toBeInTheDocument();
    });
  });

  describe('Limit Reached State', () => {
    it('should display limit reached status', () => {
      const limitReachedStatus = {
        ...mockStatus,
        limitReached: true,
        usagePercentage: 100,
        remainingWithdrawable: '0.00',
        statusMessage: 'Withdrawal limit reached'
      };

      render(<WithdrawalLimitDisplay status={limitReachedStatus} />);

      expect(screen.getByText('Withdrawal limit reached')).toBeInTheDocument();
      expect(screen.getByText('100% Used')).toBeInTheDocument();
      expect(screen.getByText('0.00')).toBeInTheDocument();
    });

    it('should show appropriate message when limit is reached', () => {
      const limitReachedStatus = {
        ...mockStatus,
        limitReached: true,
        usagePercentage: 100
      };

      render(<WithdrawalLimitDisplay status={limitReachedStatus} />);

      expect(screen.getByText(/reached the maximum withdrawal limit/)).toBeInTheDocument();
      expect(screen.getByText(/Deposit more to increase your limit/)).toBeInTheDocument();
    });
  });

  describe('Large Number Formatting', () => {
    it('should format large numbers correctly', () => {
      const largeNumberStatus = {
        ...mockStatus,
        totalDeposits: '1,500,000.00',
        totalWithdrawn: '50,000,000.00',
        maxWithdrawable: '300,000,000.00',
        remainingWithdrawable: '250,000,000.00'
      };

      render(<WithdrawalLimitDisplay status={largeNumberStatus} />);

      // Should show formatted numbers with $ prefix
      expect(screen.getByText('$1.5M')).toBeInTheDocument();
      expect(screen.getByText('$50.0M')).toBeInTheDocument();
      expect(screen.getByText('300,000,000.00')).toBeInTheDocument(); // Max limit doesn't get formatted
      expect(screen.getByText('250,000,000.00')).toBeInTheDocument(); // Remaining doesn't get formatted
    });

    it('should format thousands correctly', () => {
      const thousandsStatus = {
        ...mockStatus,
        totalDeposits: '15,000.00',
        totalWithdrawn: '50,000.00',
        maxWithdrawable: '3,000,000.00',
        remainingWithdrawable: '2,950,000.00'
      };

      render(<WithdrawalLimitDisplay status={thousandsStatus} />);

      expect(screen.getByText('$15.0K')).toBeInTheDocument();
      expect(screen.getByText('$50.0K')).toBeInTheDocument();
      expect(screen.getByText('3,000,000.00')).toBeInTheDocument(); // Max limit doesn't get formatted
      expect(screen.getByText('2,950,000.00')).toBeInTheDocument(); // Remaining doesn't get formatted
    });
  });

  describe('Informational Messages', () => {
    it('should show appropriate info for healthy status', () => {
      render(<WithdrawalLimitDisplay status={mockStatus} />);

      expect(screen.getByText(/Withdrawal limit is 200x/)).toBeInTheDocument();
      expect(screen.getByText(/Current usage: 25.0%/)).toBeInTheDocument();
    });

    it('should show warning when approaching limit', () => {
      const approachingLimitStatus = {
        ...mockStatus,
        usagePercentage: 80,
        warningLevel: 'high' as const
      };

      render(<WithdrawalLimitDisplay status={approachingLimitStatus} />);

      expect(screen.getByText(/approaching your withdrawal limit/)).toBeInTheDocument();
      expect(screen.getByText(/Consider your remaining capacity/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and structure', () => {
      render(<WithdrawalLimitDisplay status={mockStatus} />);

      // Check for proper heading structure
      expect(screen.getByText('Withdrawal Limits')).toBeInTheDocument();
      
      // Check for descriptive text
      expect(screen.getByText(/Withdrawal limit is 200x/)).toBeInTheDocument();
    });

    it('should use semantic HTML elements', () => {
      const { container } = render(<WithdrawalLimitDisplay status={mockStatus} />);

      // Should use proper semantic elements
      const progressElement = container.querySelector('[role="progressbar"]');
      expect(progressElement).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <WithdrawalLimitDisplay 
          status={mockStatus} 
          className="custom-class" 
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should apply warning level specific styling', () => {
      const criticalStatus = {
        ...mockStatus,
        warningLevel: 'critical' as const
      };

      const { container } = render(<WithdrawalLimitDisplay status={criticalStatus} />);

      // Should have critical warning styling
      expect(container.querySelector('.border-destructive\\/30')).toBeInTheDocument();
    });
  });
});