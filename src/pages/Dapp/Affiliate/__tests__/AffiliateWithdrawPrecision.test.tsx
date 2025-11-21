import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AffiliatePage from '../index';

vi.mock('@/hooks/wallet/use-wallet-connection', () => ({
  useWalletConnection: () => ({ account: 'DummyPubkey11111111111111111111111111111' })
}));

vi.mock('@/contexts/wallet-context', () => ({
  useWallet: () => ({ anchorProvider: { connection: {} }, signTransaction: vi.fn() })
}));

const makeSummary = (availableMicro: number) => ({
  total_earnings_affiliate_micro: availableMicro,
  available_to_withdraw_micro: availableMicro,
  bonus_balance_micro: 0,
  total_withdrawn_micro: 0,
});

describe('Affiliate withdraw precision', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fills Max with 6 decimals and step=0.000001 (no fee)', async () => {
    vi.stubEnv('VITE_WITHDRAWAL_FEE_BPS', '0');
    vi.mock('@/services/affiliate/affiliate-backend', () => ({
      AffiliateBackendService: {
        getSummary: async () => makeSummary(7_999_700),
        getReferrals: async () => [],
      },
    }));

    render(
      <BrowserRouter>
        <AffiliatePage />
      </BrowserRouter>
    );

    const withdrawBtn = await screen.findByRole('button', { name: /Withdraw/i });
    await userEvent.click(withdrawBtn);

    const input = await screen.findByPlaceholderText('Amount in USDT');
    expect(input).toHaveAttribute('step', '0.000001');

    const maxBtn = await screen.findByRole('button', { name: /Max/i });
    await userEvent.click(maxBtn);

    // Expect exact 6-decimal string
    expect((input as HTMLInputElement).value).toBe('7.999700');
  });

  it('applies fee bps exactly in micro without rounding', async () => {
    vi.stubEnv('VITE_WITHDRAWAL_FEE_BPS', '25');
    vi.mock('@/services/affiliate/affiliate-backend', () => ({
      AffiliateBackendService: {
        getSummary: async () => makeSummary(7_999_700),
        getReferrals: async () => [],
      },
    }));

    render(
      <BrowserRouter>
        <AffiliatePage />
      </BrowserRouter>
    );

    const withdrawBtn = await screen.findByRole('button', { name: /Withdraw/i });
    await userEvent.click(withdrawBtn);

    const input = await screen.findByPlaceholderText('Amount in USDT');
    const maxBtn = await screen.findByRole('button', { name: /Max/i });
    await userEvent.click(maxBtn);

    expect((input as HTMLInputElement).value).toBe('7.979701');
  });

  it('supports very small amounts without truncation', async () => {
    vi.stubEnv('VITE_WITHDRAWAL_FEE_BPS', '0');
    vi.mock('@/services/affiliate/affiliate-backend', () => ({
      AffiliateBackendService: {
        getSummary: async () => makeSummary(1),
        getReferrals: async () => [],
      },
    }));

    render(
      <BrowserRouter>
        <AffiliatePage />
      </BrowserRouter>
    );

    const withdrawBtn = await screen.findByRole('button', { name: /Withdraw/i });
    await userEvent.click(withdrawBtn);

    const input = await screen.findByPlaceholderText('Amount in USDT');
    const maxBtn = await screen.findByRole('button', { name: /Max/i });
    await userEvent.click(maxBtn);

    expect((input as HTMLInputElement).value).toBe('0.000001');
  });
});