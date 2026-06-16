import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentActivationModal } from '../AgentActivationModal';
import { Connection, PublicKey } from '@solana/web3.js';

vi.mock('@/contexts/wallet-context', () => ({
  useWallet: () => ({ anchorProvider: {} })
}));

const dummyConn = new Connection('http://localhost');
const dummyPubkey = new PublicKey('DummyPubkey11111111111111111111111111111');

describe('AgentActivationModal credit balance display', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('shows formatted available credits when fetch succeeds', async () => {
vi.mock('@/services/auth/auth-service', () => ({
  AuthService: { async getSession() { return { credit_balance_micro: '2290000' }; } }
}));

    render(
      <AgentActivationModal
        isOpen={true}
        onClose={() => {}}
        userPublicKey={dummyPubkey}
        connection={dummyConn}
      />
    );

    const contBtn = await screen.findByRole('button', { name: /Continue/i });
    await userEvent.click(contBtn);

    expect(await screen.findByText(/Available Credits/i)).toBeInTheDocument();
    expect(await screen.findByText('$2.29')).toBeInTheDocument();
  });

  it('shows zero balance correctly', async () => {
vi.mock('@/services/auth/auth-service', () => ({
  AuthService: { async getSession() { return { credit_balance_micro: '0' }; } }
}));

    render(
      <AgentActivationModal
        isOpen={true}
        onClose={() => {}}
        userPublicKey={dummyPubkey}
        connection={dummyConn}
      />
    );

    const contBtn = await screen.findByRole('button', { name: /Continue/i });
    await userEvent.click(contBtn);

    expect(await screen.findByText('$0.00')).toBeInTheDocument();
  });

  it('shows error state when balance retrieval fails', async () => {
vi.mock('@/services/auth/auth-service', () => ({
  AuthService: { async getSession() { throw new Error('fetch failed'); } }
}));

    render(
      <AgentActivationModal
        isOpen={true}
        onClose={() => {}}
        userPublicKey={dummyPubkey}
        connection={dummyConn}
      />
    );

    const contBtn = await screen.findByRole('button', { name: /Continue/i });
    await userEvent.click(contBtn);

    expect(await screen.findByText(/Error/i)).toBeInTheDocument();
  });

  it('balance refresh updates UI', async () => {
const getSession = vi.fn()
  .mockResolvedValueOnce({ credit_balance_micro: '1000000' })
  .mockResolvedValueOnce({ credit_balance_micro: '3500000' });

vi.mock('@/services/auth/auth-service', () => ({
  AuthService: { async getSession() { return getSession(); } }
}));

    render(
      <AgentActivationModal
        isOpen={true}
        onClose={() => {}}
        userPublicKey={dummyPubkey}
        connection={dummyConn}
      />
    );

    const contBtn = await screen.findByRole('button', { name: /Continue/i });
    await userEvent.click(contBtn);

    expect(await screen.findByText('$1.00')).toBeInTheDocument();

    const refreshBtn = await screen.findByRole('button', { name: /Refresh credit balance/i });
    await userEvent.click(refreshBtn);

    expect(await screen.findByText('$3.50')).toBeInTheDocument();
  });
});