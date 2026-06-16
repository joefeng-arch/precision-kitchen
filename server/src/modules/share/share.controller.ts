import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShareService } from './share.service';
import { GenerateQrcodeDto } from './dto/generate-qrcode.dto';

@ApiTags('share')
@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post('qrcode')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '生成菜谱分享小程序码' })
  async generateQrcode(@Body() dto: GenerateQrcodeDto) {
    return this.shareService.generateQrcode(dto.recipeId);
  }

  @Get('resolve')
  @ApiOperation({ summary: '解析分享码 → recipeId（扫码后调用）' })
  @ApiQuery({ name: 'scene', required: true, description: '小程序码 scene 参数' })
  async resolveScene(@Query('scene') scene: string) {
    return this.shareService.resolveScene(scene);
  }
}
