import { login } from '@/lib/api/auth';
import { setAuthTokenGetter } from '@/lib/api/client';

import { useAuthStore } from './authStore';
import { setSecureItem } from './secureStorage';

// 手写替身：隔离网络与原生存储，只验证 store 自身的编排逻辑
jest.mock('@/lib/api/auth', () => ({
  login: jest.fn(),
  mockLogin: jest.fn(),
  whoami: jest.fn(),
}));
jest.mock('./secureStorage', () => ({
  getSecureItem: jest.fn().mockResolvedValue(null),
  setSecureItem: jest.fn().mockResolvedValue(undefined),
  deleteSecureItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/api/client', () => ({
  setAuthTokenGetter: jest.fn(),
  setUnauthorizedHandler: jest.fn(),
}));

const LOGIN_RESULT = {
  token: 'jwt-token-123',
  user: { id: 'u1', nickname: 'Joe Feng', avatar: null, role: 'user' as const },
};

describe('authStore.loginWithOAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ status: 'unauthenticated', user: null, token: null });
  });

  it('apple 登录：调用通用 login、持久化 token/user、状态置 authenticated', async () => {
    (login as jest.Mock).mockResolvedValue(LOGIN_RESULT);

    await useAuthStore
      .getState()
      .loginWithOAuth('apple', 'identity-token', { nickname: 'Joe Feng' });

    expect(login).toHaveBeenCalledWith({
      provider: 'apple',
      code: 'identity-token',
      nickname: 'Joe Feng',
    });
    expect(setSecureItem).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
    expect(setSecureItem).toHaveBeenCalledWith(
      'auth_user',
      JSON.stringify(LOGIN_RESULT.user),
    );
    expect(setAuthTokenGetter).toHaveBeenCalled();

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user).toEqual(LOGIN_RESULT.user);
    expect(state.token).toBe('jwt-token-123');
  });

  it('google 登录：不带 profile 时 body 只有 provider+code', async () => {
    (login as jest.Mock).mockResolvedValue(LOGIN_RESULT);

    await useAuthStore.getState().loginWithOAuth('google', 'google-id-token');

    expect(login).toHaveBeenCalledWith({
      provider: 'google',
      code: 'google-id-token',
    });
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('登录失败：错误向上抛（由 LoginScreen 捕获展示），状态保持 unauthenticated、不写存储', async () => {
    (login as jest.Mock).mockRejectedValue(new Error('401 Unauthorized'));

    await expect(
      useAuthStore.getState().loginWithOAuth('google', 'bad-token'),
    ).rejects.toThrow('401 Unauthorized');

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(setSecureItem).not.toHaveBeenCalled();
    expect(setAuthTokenGetter).not.toHaveBeenCalled();
  });
});
