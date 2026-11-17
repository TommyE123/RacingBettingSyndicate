'use client';

import type { ApiUser } from '@/types/api';
import { api, ApiError, errorMessage } from '@/lib/api';

export interface SignInParams {
  username: string;
  password: string;
}

class AuthClient {
  // The login response is the signed-in user, so callers need no second request to know it.
  async signIn(params: SignInParams): Promise<{ user?: ApiUser; error?: string }> {
    try {
      return { user: await api<ApiUser>('/api/auth/login', { method: 'POST', json: params }) };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }

  async getUser(): Promise<{ data?: ApiUser | null; error?: string }> {
    try {
      return { data: await api<ApiUser>('/api/auth/me') };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return { data: null };
      }
      return { error: errorMessage(error) };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ error?: string }> {
    try {
      await api('/api/auth/password', {
        method: 'POST',
        json: { current_password: currentPassword, new_password: newPassword },
      });
      return {};
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }

  async signOut(): Promise<{ error?: string }> {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      return {};
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }
}

export const authClient = new AuthClient();
