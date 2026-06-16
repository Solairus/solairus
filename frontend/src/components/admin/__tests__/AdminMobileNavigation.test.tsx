import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminMobileNavigation } from '../AdminMobileNavigation';

// Mock the AdminProvider
vi.mock('../AdminProvider', () => ({
  useAdmin: vi.fn(),
}));

import { useAdmin } from '../AdminProvider';
const mockUseAdmin = useAdmin as any;

describe('AdminMobileNavigation', () => {
  const mockOnTabChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render overview tab for all users', () => {
    mockUseAdmin.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: false,
        accessibleBuckets: [],
      },
    });

    render(
      <AdminMobileNavigation 
        activeTab="overview" 
        onTabChange={mockOnTabChange} 
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('should render bucket management for users with bucket access', () => {
    mockUseAdmin.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: false,
        accessibleBuckets: ['admin', 'trader'],
      },
    });

    render(
      <AdminMobileNavigation 
        activeTab="overview" 
        onTabChange={mockOnTabChange} 
      />
    );

    expect(screen.getByText('Buckets')).toBeInTheDocument();
  });

  it('should render user management tabs for users with user management access', () => {
    mockUseAdmin.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: true,
        accessibleBuckets: [],
      },
    });

    render(
      <AdminMobileNavigation 
        activeTab="overview" 
        onTabChange={mockOnTabChange} 
      />
    );

    expect(screen.getByText('Licenses')).toBeInTheDocument();
    expect(screen.getByText('Credits')).toBeInTheDocument();
  });

  it('should render config tab for dev users', () => {
    mockUseAdmin.mockReturnValue({
      role: 'dev',
      context: {
        canAccessConfig: true,
        canManageUsers: true,
        accessibleBuckets: ['admin', 'dev'],
      },
    });

    render(
      <AdminMobileNavigation 
        activeTab="overview" 
        onTabChange={mockOnTabChange} 
      />
    );

    expect(screen.getByText('Config')).toBeInTheDocument();
  });

  it('should call onTabChange when tab is clicked', () => {
    mockUseAdmin.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: true,
        accessibleBuckets: ['admin'],
      },
    });

    render(
      <AdminMobileNavigation 
        activeTab="overview" 
        onTabChange={mockOnTabChange} 
      />
    );

    fireEvent.click(screen.getByText('Buckets'));
    expect(mockOnTabChange).toHaveBeenCalledWith('buckets');
  });

  it('should highlight active tab', () => {
    mockUseAdmin.mockReturnValue({
      role: 'admin',
      context: {
        canAccessConfig: false,
        canManageUsers: false,
        accessibleBuckets: ['admin'],
      },
    });

    render(
      <AdminMobileNavigation 
        activeTab="buckets" 
        onTabChange={mockOnTabChange} 
      />
    );

    const bucketsButton = screen.getByText('Buckets').closest('button');
    expect(bucketsButton).toHaveClass('text-blue-400');
  });
});