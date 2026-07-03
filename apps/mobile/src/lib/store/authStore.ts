import { create } from 'zustand';

import { mockLogin, whoami } from '@/lib/api/auth';
import { setAuthTokenGetter, setUnauthorizedHandler } from '@/lib/api/client';
import type { LoginResult } from '@/lib/api/types';

import { deleteSecureItem, getSecureItem, setSecureItem } from './secureStorage';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: LoginResult['user'] | null;
  token: string | null;
  bootstrap: () => Promise<void>;
  loginWithMock: (nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  token: null,

  bootstrap: async () => {
    const token = await getSecureItem(TOKEN_KEY);
    if (!token) {
      set({ status: 'unauthenticated', user: null, token: null });
      return;
    }
    setAuthTokenGetter(() => token);
    try {
      await whoami();
      const userRaw = await getSecureItem(USER_KEY);
      const user = userRaw ? (JSON.parse(userRaw) as LoginResult['user']) : null;
      set({ status: 'authenticated', user, token });
    } catch {
      await deleteSecureItem(TOKEN_KEY);
      await deleteSecureItem(USER_KEY);
      setAuthTokenGetter(() => null);
      set({ status: 'unauthenticated', user: null, token: null });
    }
  },

  loginWithMock: async (nickname?: string) => {
    const result = await mockLogin(nickname ? { nickname } : {});
    await setSecureItem(TOKEN_KEY, result.token);
    await setSecureItem(USER_KEY, JSON.stringify(result.user));
    setAuthTokenGetter(() => result.token);
    set({ status: 'authenticated', user: result.user, token: result.token });
  },

  logout: async () => {
    await deleteSecureItem(TOKEN_KEY);
    await deleteSecureItem(USER_KEY);
    setAuthTokenGetter(() => null);
    set({ status: 'unauthenticated', user: null, token: null });
  },
}));

// Registered once — any 401 from any request logs the user out (no refresh flow exists).
setUnauthorizedHandler(() => {
  useAuthStore.getState().logout();
});
