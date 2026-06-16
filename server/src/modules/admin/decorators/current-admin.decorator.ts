import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AdminJwtPayload } from '../admin-auth.service';

/**
 * Extract the validated admin JWT payload from the request.
 * Only works on routes protected by AdminJwtAuthGuard.
 */
export const CurrentAdmin = createParamDecorator(
  (data: keyof AdminJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const admin = request.user as AdminJwtPayload | undefined;
    return data && admin ? admin[data] : admin;
  },
);
