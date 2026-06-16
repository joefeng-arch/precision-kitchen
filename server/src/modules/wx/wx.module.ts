import { Module, Global } from '@nestjs/common';
import { WxAccessTokenService } from './wx-access-token.service';

/** 全局模块：WxAccessTokenService 可直接注入到任意模块，无需反复 import */
@Global()
@Module({
  providers: [WxAccessTokenService],
  exports: [WxAccessTokenService],
})
export class WxModule {}
