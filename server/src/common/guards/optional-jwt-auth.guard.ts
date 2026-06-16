import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 可选 JWT：带 token 就解析挂到 req.user；没带也通过。
 * 用在「登录后能看更多内容、未登录也可访问」的端点（如分类列表）。
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    // 不抛 401，即便 user 为 undefined 也放行
    return user;
  }

  canActivate(context: ExecutionContext) {
    // 总是 true；passport 会尝试解析 token，失败也不报错
    return super.canActivate(context) as boolean | Promise<boolean>;
  }
}
