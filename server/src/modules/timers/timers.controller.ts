import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateTimerDto } from './dto/timer.dto';
import { TimersService } from './timers.service';

@ApiTags('timers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timers')
export class TimersController {
  constructor(private readonly service: TimersService) {}

  @Post()
  @ApiOperation({ summary: '启动一个计时器' })
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateTimerDto) {
    return this.service.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: '我的活跃计时器列表（含实时剩余秒数）' })
  list(@CurrentUser() user: JwtUserPayload) {
    return this.service.list(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: '计时器详情' })
  findOne(@CurrentUser() user: JwtUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user.sub, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '暂停' })
  pause(@CurrentUser() user: JwtUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.pause(user.sub, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '恢复' })
  resume(@CurrentUser() user: JwtUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.resume(user.sub, id);
  }

  @Post(':id/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重置（重新开始计时）' })
  reset(@CurrentUser() user: JwtUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reset(user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除计时器' })
  remove(@CurrentUser() user: JwtUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.sub, id);
  }
}
