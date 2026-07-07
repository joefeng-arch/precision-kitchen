import {
  makeRedirectUri,
  ResponseType,
  useAuthRequest,
  useAutoDiscovery,
} from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import type { OAuthSignInResult } from './types';

WebBrowser.maybeCompleteAuthSession();

// 平台各自的 OAuth Client ID（Google Cloud Console 分别注册）；未配置则按钮不可用
const CLIENT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export function useGoogleSignIn() {
  const discovery = useAutoDiscovery('https://accounts.google.com');
  // response_type=id_token 时 Google 强制要求 nonce（防重放）
  const nonce = useMemo(() => Crypto.randomUUID(), []);
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID ?? '',
      redirectUri: makeRedirectUri({ scheme: 'mobile' }),
      responseType: ResponseType.IdToken,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false, // 直取 id_token，无 code 交换，PKCE 不适用
      extraParams: { nonce },
    },
    discovery,
  );

  const signIn = async (): Promise<OAuthSignInResult | null> => {
    const result = await promptAsync();
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success') {
      throw new Error(
        (result.type === 'error' && result.error?.message) || 'Google 登录失败',
      );
    }
    const idToken = result.params.id_token;
    if (!idToken) throw new Error('Google 未返回 id_token');
    // Google 的 idToken 自带 name/picture claims，服务端直接提取，无需客户端透传 profile
    return { code: idToken };
  };

  return { ready: !!request && !!CLIENT_ID, signIn };
}
