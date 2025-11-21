import { ApiClient, API_CONFIG } from '@/config/service-endpoints';
import { getSponsorAddress } from '@/lib/address-crypto';

export interface BackendUser {
  id: number;
  user_address: string;
  license_status: 'none' | 'active' | 'expired' | 'revoked';
  license_expiration: string | null;
  ref_by: number | null;
  created_at: string;
  updated_at: string;
  // Bonus balance from backend DB (micro-USDT, string to preserve precision)
  bonus_balance_micro?: string;
  // Credit balance from backend DB (micro-USDT, string)
  credit_balance_micro?: string;
}

export interface AuthResponse {
  token: string;
  user: BackendUser;
}

const TOKEN_STORAGE_KEY = 'solairus.jwt';

/**
 * AuthService handles JWT-based wallet authentication against backend
 */
export class AuthService {
  /** Authenticate a wallet address and store JWT */
  static async authenticateWallet(walletAddress: string): Promise<AuthResponse> {
    const url = `${API_CONFIG.getBaseUrl()}/auth/wallet`;
    // Include stored sponsor pubkey for signup-only handling on backend
    // Purpose: pass referral sponsor during first-time user creation; ignored on signin
    const sponsorPubkey = (() => {
      try {
        return getSponsorAddress();
      } catch {
        return '';
      }
    })();

    const resp = await ApiClient.post(url, {
      walletAddress,
      sponsorPubkey,
    });
    const data = await resp.json() as { jwt: string; user: BackendUser };
    const token = data.jwt;
    AuthService.setToken(token);
    try {
      localStorage.setItem('solairus.user', JSON.stringify(data.user));
    } catch {
      // ignore storage errors
    }
    return { token, user: data.user };
  }

  /** Validate current session and return user */
  static async getSession(): Promise<BackendUser | null> {
    try {
      const url = `${API_CONFIG.getBaseUrl()}/auth/session`;
      const resp = await ApiClient.get(url);
      const data = await resp.json() as { jwtValid: boolean; user?: BackendUser };
      return data.user ?? null;
    } catch (err) {
      return null;
    }
  }

  /** Retrieve JWT token from storage */
  static getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /** Get cached user payload from last authentication */
  static getCachedUser(): BackendUser | null {
    try {
      const raw = localStorage.getItem('solairus.user');
      return raw ? (JSON.parse(raw) as BackendUser) : null;
    } catch {
      return null;
    }
  }

  /** Persist JWT token */
  static setToken(token: string | null) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }

  /** Clear session */
  static logout() {
    AuthService.setToken(null);
  }
}