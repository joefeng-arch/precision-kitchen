import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface JwtUserPayload {
  sub: string;
  openid?: string;
  role: 'user' | 'vip';
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtUserPayload | undefined;
    return data && user ? user[data] : user;
  },
);
