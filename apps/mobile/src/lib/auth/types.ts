/** OAuth 登录钩子的统一返回：code 为 ID token，profile 仅 Apple 首次授权可能有 */
export interface OAuthSignInResult {
  code: string;
  profile?: { nickname?: string; avatar?: string };
}
