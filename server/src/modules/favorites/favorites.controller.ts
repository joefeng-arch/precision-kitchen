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
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

class CheckBatchDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  recipeIds!: string[];
}

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: '我的收藏列表' })
  list(@CurrentUser() user: JwtUserPayload, @Query() query: PaginationDto) {
    return this.service.list(user.sub, query);
  }

  @Post(':recipeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '切换收藏状态' })
  toggle(@CurrentUser() user: JwtUserPayload, @Param('recipeId', ParseUUIDPipe) recipeId: string) {
    return this.service.toggle(user.sub, recipeId);
  }

  @Delete(':recipeId')
  @ApiOperation({ summary: '取消收藏' })
  remove(@CurrentUser() user: JwtUserPayload, @Param('recipeId', ParseUUIDPipe) recipeId: string) {
    return this.service.remove(user.sub, recipeId);
  }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量查询收藏状态' })
  checkBatch(@CurrentUser() user: JwtUserPayload, @Body() dto: CheckBatchDto) {
    return this.service.checkBatch(user.sub, dto.recipeIds);
  }
}
