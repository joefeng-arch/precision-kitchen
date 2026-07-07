import { makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';

import type { OAuthSignInResult } from './types';

WebBrowser.maybeCompleteAuthSession();

// Apple 的 OIDC 端点固定，不走 discovery 网络请求
const APPLE_DISCOVERY = {
  authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
  tokenEndpoint: 'https://appleid.apple.com/auth/token',
};

// Apple Developer 后台配置的 Services ID；未配置则按钮不可用
const CLIENT_ID = process.env.EXPO_PUBLIC_APPLE_CLIENT_ID;

/** Apple 仅首次授权在回调里附带 user JSON（含姓名，之后永不再给）——解析并透传 */
function parseAppleUser(raw?: string): { nickname?: string } | undefined {
  if (!raw) return undefined;
  try {
    const user = JSON.parse(raw) as { name?: { firstName?: string; lastName?: string } };
    const name = [user.name?.firstName, user.name?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return name ? { nickname: name } : undefined;
  } catch {
    return undefined;
  }
}

export function useAppleSignIn() {
  const nonce = useMemo(() => Crypto.randomUUID(), []);
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID ?? '',
      redirectUri: makeRedirectUri({ scheme: 'mobile' }),
      responseType: ResponseType.IdToken,
      // 注意：请求 name/email scope 会被 Apple 强制 response_mode=form_post，
      // 自定义 scheme 收不到 POST 回调——纯客户端流程只能不带 scope，
      // 仅凭 identityToken.sub 登录（服务端只需要 sub；昵称走 upsert 默认值）。
      // 要拿姓名需后端 form_post 回调或原生 expo-apple-authentication，见 data-contract §7。
      scopes: [],
      usePKCE: false, // 直取 id_token，无 code 交换，PKCE 不适用
      extraParams: { nonce },
    },
    APPLE_DISCOVERY,
  );

  const signIn = async (): Promise<OAuthSignInResult | null> => {
    const result = await promptAsync();
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success') {
      throw new Error(
        (result.type === 'error' && result.error?.message) || 'Apple 登录失败',
      );
    }
    const idToken = result.params.id_token;
    if (!idToken) throw new Error('Apple 未返回 id_token');
    const profile = parseAppleUser(result.params.user);
    return profile ? { code: idToken, profile } : { code: idToken };
  };

  return { ready: !!request && !!CLIENT_ID, signIn };
}
