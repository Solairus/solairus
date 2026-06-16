import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LicenseGuard from '../LicenseGuard';

// Mock the hooks and utilities
vi.mock('@/hooks/wallet/use-wallet-connection', () => ({
  useWalletConnection: vi.fn(),
}));

vi.mock('@/contexts/license-context', () => ({
  useLicense: vi.fn(),
}));

vi.mock('@/contexts/wallet-context', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/utils/admin-roles', () => ({
  detectUserRole: vi.fn(),
  hasAdminAccess: vi.fn(),
}));

import { useWalletConnection } from '@/hooks/wallet/use-wallet-connection';
import { useLicense } from '@/contexts/license-context';
import { useWallet } from '@/contexts/wallet-context';
import { detectUserRole, hasAdminAccess } from '@/utils/admin-roles';
import { PublicKey } from '@solana/web3.js';

const mockUseWalletConnection = useWalletConnection as any;
const mockUseLicense = useLicense as any;
const mockUseWallet = useWallet as any;
const mockDetectUserRole = detectUserRole as any;
const mockHasAdminAccess = hasAdminAccess as any;

// Test component
const TestChild = () => <div>Protected Content</div>;

// Wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('LicenseGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set default environment variable
    vi.stubEnv('VITE_ENABLE_LICENSE_GUARD', 'true');
    
    // Default mock implementations
    mockUseWalletConnection.mockReturnValue({
      isConnected: true,
    });
    
    mockUseLicense.mockReturnValue({
      licenseInfo: { isValid: false, status: 'inactive' },
      isLoading: false,
      error: null,
      refreshLicenseStatus: vi.fn(),
    });
    
    mockUseWallet.mockReturnValue({
      publicKey: null,
    });
    
    mockDetectUserRole.mockReturnValue(null);
    mockHasAdminAccess.mockReturnValue(false);
  });

  it('should bypass license check for admin accounts', () => {
    const adminPublicKey = new PublicKey('GE3apux6AGjxhGbBZuxidXF6YvUHF4374ZaDv1NbJBfi');
    
    mockUseWallet.mockReturnValue({
      publicKey: adminPublicKey,
    });
    
    mockDetectUserRole.mockReturnValue('admin');
    mockHasAdminAccess.mockReturnValue(true);

    render(
      <TestWrapper>
        <LicenseGuard>
          <TestChild />
        </LicenseGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should bypass license check for dev accounts', () => {
    const devPublicKey = new PublicKey('4YXNGAsEgmcPAoBL6974oqAZwZqKNQkx9GSzs67jkdez');
    
    mockUseWallet.mockReturnValue({
      publicKey: devPublicKey,
    });
    
    mockDetectUserRole.mockReturnValue('dev');
    mockHasAdminAccess.mockReturnValue(true);

    render(
      <TestWrapper>
        <LicenseGuard>
          <TestChild />
        </LicenseGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should bypass license check for marketer accounts', () => {
    const marketerPublicKey = new PublicKey('2C2CSXnnJUknvdMsyss3gUq3tT8MR4cC7LJT461nceZr');
    
    mockUseWallet.mockReturnValue({
      publicKey: marketerPublicKey,
    });
    
    mockDetectUserRole.mockReturnValue('marketer1');
    mockHasAdminAccess.mockReturnValue(true);

    render(
      <TestWrapper>
        <LicenseGuard>
          <TestChild />
        </LicenseGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should require license for regular users', () => {
    const regularPublicKey = new PublicKey('11111111111111111111111111111111');
    
    mockUseWallet.mockReturnValue({
      publicKey: regularPublicKey,
    });
    
    mockDetectUserRole.mockReturnValue(null);
    mockHasAdminAccess.mockReturnValue(false);

    render(
      <TestWrapper>
        <LicenseGuard>
          <TestChild />
        </LicenseGuard>
      </TestWrapper>
    );

    expect(screen.getByText('License Required')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should allow access when license guard is disabled', () => {
    vi.stubEnv('VITE_ENABLE_LICENSE_GUARD', 'false');
    
    const regularPublicKey = new PublicKey('11111111111111111111111111111111');
    
    mockUseWallet.mockReturnValue({
      publicKey: regularPublicKey,
    });
    
    mockDetectUserRole.mockReturnValue(null);
    mockHasAdminAccess.mockReturnValue(false);

    render(
      <TestWrapper>
        <LicenseGuard>
          <TestChild />
        </LicenseGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should allow access for users with valid licenses', () => {
    const regularPublicKey = new PublicKey('11111111111111111111111111111111');
    
    mockUseWallet.mockReturnValue({
      publicKey: regularPublicKey,
    });
    
    mockUseLicense.mockReturnValue({
      licenseInfo: { isValid: true, status: 'active' },
      isLoading: false,
      error: null,
      refreshLicenseStatus: vi.fn(),
    });
    
    mockDetectUserRole.mockReturnValue(null);
    mockHasAdminAccess.mockReturnValue(false);

    render(
      <TestWrapper>
        <LicenseGuard>
          <TestChild />
        </LicenseGuard>
      </TestWrapper>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});