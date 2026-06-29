import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AuthGuard } from '@nestjs/passport';
import { ContentCheckService } from './content.service';
import { CheckTextDto } from './dto/check-text.dto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

@ApiTags('content')
@ApiBearerAuth()
@UseGuards(AuthGuard(['jwt', 'admin-jwt']))  // 用户 token 和管理员 token 都放行
@Controller('content')
export class ContentController {
  constructor(private readonly svc: ContentCheckService) {}

  @Post('check-text')
  @ApiOperation({ summary: '文本内容安全检查' })
  async checkText(@Body() dto: CheckTextDto) {
    const result = await this.svc.checkText(dto.content);
    return result;
  }

  @Post('check-image')
  @ApiOperation({ summary: '图片内容安全检查' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, _file, cb) => {
          cb(null, `tmp-check-${randomUUID()}${extname(_file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowed.includes(file.mimetype)) {
          cb(new BadRequestException(`不支持的图片类型：${file.mimetype}`), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async checkImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('未收到文件');
    const filePath = join(process.cwd(), UPLOAD_DIR, file.filename);
    try {
      const result = await this.svc.checkImage(filePath);
      return result;
    } finally {
      // 检查完立即删除临时文件（这个接口仅做检查，不保留文件）
      try { unlinkSync(filePath); } catch { /* ignore */ }
    }
  }
}
