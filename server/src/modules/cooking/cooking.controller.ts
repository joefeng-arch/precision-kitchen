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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CookingService } from './cooking.service';
import { StockDeductionService } from './stock-deduction.service';
import { CreateCookingLogDto, ListCookingLogsDto, PreviewCostDto } from './dto/cooking.dto';

class DeductionPreviewDto {
  @IsUUID()
  recipeId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  servings!: number;
}

class UndoDeductionDto {
  @IsString()
  undoToken!: string;
}

@ApiTags('cooking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cooking')
export class CookingController {
  constructor(
    private readonly service: CookingService,
    private readonly deduction: StockDeductionService,
  ) {}

  @Post('deduction-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '预扣检查：返回菜谱用料 vs 食材库匹配 + 缺口' })
  previewDeduction(@CurrentUser() user: JwtUserPayload, @Body() dto: DeductionPreviewDto) {
    return this.deduction.preview(user.sub, dto.recipeId, dto.servings);
  }

  @Post('undo-deduction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销最近一次自动扣减（30 秒内有效）' })
  undoDeduction(@CurrentUser() user: JwtUserPayload, @Body() dto: UndoDeductionDto) {
    return this.deduction.undo(user.sub, dto.undoToken);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '预览：换算用量 + 估算成本（不落库）' })
  preview(@CurrentUser() user: JwtUserPayload, @Body() dto: PreviewCostDto) {
    return this.service.previewCost(user.sub, dto);
  }

  @Post('logs')
  @ApiOperation({ summary: '记录一次烹饪（同时落成本明细）' })
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateCookingLogDto) {
    return this.service.createLog(user.sub, dto);
  }

  @Get('logs')
  @ApiOperation({ summary: '我的烹饪历史' })
  list(@CurrentUser() user: JwtUserPayload, @Query() query: ListCookingLogsDto) {
    return this.service.list(user.sub, query);
  }

  @Get('logs/:id')
  @ApiOperation({ summary: '烹饪记录详情（含成本明细）' })
  findOne(@CurrentUser() user: JwtUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user.sub, id);
  }

  @Delete('logs/:id')
  @ApiOperation({ summary: '删除烹饪记录' })
  remove(@CurrentUser() user: JwtUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.sub, id);
  }
}
