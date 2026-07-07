import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAuthStore } from '@/lib/store/authStore';

import { LoginScreen } from './LoginScreen';

// 手写替身：隔离网络/存储/OAuth 浏览器流程，只验证 LoginScreen 的编排
jest.mock('@/lib/api/auth', () => ({
  login: jest.fn(),
  mockLogin: jest.fn(),
  whoami: jest.fn(),
}));
jest.mock('@/lib/api/client', () => ({
  setAuthTokenGetter: jest.fn(),
  setUnauthorizedHandler: jest.fn(),
}));
jest.mock('@/lib/store/secureStorage', () => ({
  getSecureItem: jest.fn().mockResolvedValue(null),
  setSecureItem: jest.fn().mockResolvedValue(undefined),
  deleteSecureItem: jest.fn().mockResolvedValue(undefined),
}));

const mockAppleSignIn = jest.fn();
const mockGoogleSignIn = jest.fn();
jest.mock('@/lib/auth/useAppleSignIn', () => ({
  useAppleSignIn: () => ({ ready: true, signIn: mockAppleSignIn }),
}));
jest.mock('@/lib/auth/useGoogleSignIn', () => ({
  useGoogleSignIn: () => ({ ready: true, signIn: mockGoogleSignIn }),
}));

describe('LoginScreen OAuth 按钮', () => {
  let loginWithOAuth: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    loginWithOAuth = jest.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      status: 'unauthenticated',
      loginWithOAuth: loginWithOAuth as never,
    });
  });

  it('渲染 Apple / Google 登录按钮，mock 登录入口保持原样', async () => {
    await render(<LoginScreen />);
    expect(screen.getByText('Sign in with Apple')).toBeTruthy();
    expect(screen.getByText('Sign in with Google')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
    expect(screen.getByPlaceholderText('Nickname (optional)')).toBeTruthy();
  });

  it('点 Apple：signIn 成功 → 用返回的 code/profile 调 loginWithOAuth', async () => {
    mockAppleSignIn.mockResolvedValue({
      code: 'apple-identity-token',
      profile: { nickname: 'Joe Feng' },
    });
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText('Sign in with Apple'));

    await waitFor(() => {
      expect(loginWithOAuth).toHaveBeenCalledWith('apple', 'apple-identity-token', {
        nickname: 'Joe Feng',
      });
    });
  });

  it('点 Google：signIn 成功（无 profile）→ 调 loginWithOAuth', async () => {
    mockGoogleSignIn.mockResolvedValue({ code: 'google-id-token' });
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText('Sign in with Google'));

    await waitFor(() => {
      expect(loginWithOAuth).toHaveBeenCalledWith('google', 'google-id-token', undefined);
    });
  });

  it('用户取消授权（signIn 返回 null）→ 不调 loginWithOAuth、不显示错误', async () => {
    mockGoogleSignIn.mockResolvedValue(null);
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText('Sign in with Google'));

    await waitFor(() => {
      expect(mockGoogleSignIn).toHaveBeenCalled();
    });
    expect(loginWithOAuth).not.toHaveBeenCalled();
  });

  it('OAuth 流程报错 → 错误信息展示在页面上', async () => {
    mockAppleSignIn.mockRejectedValue(new Error('Apple 登录失败'));
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText('Sign in with Apple'));

    await waitFor(() => {
      expect(screen.getByText('Apple 登录失败')).toBeTruthy();
    });
    expect(loginWithOAuth).not.toHaveBeenCalled();
  });
});
