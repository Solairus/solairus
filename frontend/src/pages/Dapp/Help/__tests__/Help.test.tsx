import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import HelpPage from '../index';

// Mock the BackButton component
vi.mock('@/components/ui/BackButton', () => ({
  default: () => <button>Back</button>
}));

// Mock the pricing config
vi.mock('@/config/pricing', () => ({
  PRICING_CONFIG: {
    licenseFeeUsd: 50,
    agentMinimumUsd: 25,
    withdrawalFeePercent: 0
  },
  getRecommendedStartingBalance: () => 75
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('HelpPage', () => {
  it('should render the help page with main sections', () => {
    renderWithRouter(<HelpPage />);

    // Check main title
    expect(screen.getByText('Help Center')).toBeInTheDocument();
    expect(screen.getByText('Everything you need to know about Solairus')).toBeInTheDocument();

    // Check official links section
    expect(screen.getByText('Official Links & Community')).toBeInTheDocument();
    expect(screen.getByText('Visit Our Official Linktree')).toBeInTheDocument();

    // Check quick start guide
    expect(screen.getByText('Quick Start Guide')).toBeInTheDocument();
    expect(screen.getByText('Connect your Solana wallet')).toBeInTheDocument();

    // Check tabs
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('should show FAQ categories', () => {
    renderWithRouter(<HelpPage />);

    expect(screen.getByText('All Topics')).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('AI Agents')).toBeInTheDocument();
    expect(screen.getByText('Affiliate System')).toBeInTheDocument();
    expect(screen.getByText('Wallet & Security')).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
  });

  it('should expand FAQ items when clicked', () => {
    renderWithRouter(<HelpPage />);

    const faqQuestion = screen.getByText('What is Solairus?');
    fireEvent.click(faqQuestion);

    expect(screen.getByText(/Solairus is a decentralized AI trading platform/)).toBeInTheDocument();
  });

  it('should filter FAQs by category', () => {
    renderWithRouter(<HelpPage />);

    const agentsButton = screen.getByText('AI Agents');
    fireEvent.click(agentsButton);

    expect(screen.getByText('What are AI Trading Agents?')).toBeInTheDocument();
  });

  it('should have features tab button', () => {
    renderWithRouter(<HelpPage />);

    const featuresTab = screen.getByText('Features');
    expect(featuresTab).toBeInTheDocument();
    expect(featuresTab).toHaveAttribute('role', 'tab');
  });

  it('should display license fee in quick start guide', () => {
    renderWithRouter(<HelpPage />);

    expect(screen.getByText(/Activate license \(\$50 USDT\)/)).toBeInTheDocument();
  });

  it('should have linktree button that opens external link', () => {
    // Mock window.open
    const mockOpen = vi.fn();
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true
    });

    renderWithRouter(<HelpPage />);

    const linktreeButton = screen.getByText('Visit Our Official Linktree');
    fireEvent.click(linktreeButton);

    expect(mockOpen).toHaveBeenCalledWith('https://linktr.ee/Solairua.ai', '_blank');
  });
});