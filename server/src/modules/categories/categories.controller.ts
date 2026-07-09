import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../admin/guards/admin-jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, ListCategoriesDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '分类列表（系统 + 当前用户自建）' })
  list(@Query() query: ListCategoriesDto, @Req() req: { user?: JwtUserPayload }) {
    return this.service.list(query, req.user?.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: '分类详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建系统分类（管理员）' })
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Post('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户创建自己的分类' })
  createMine(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateCategoryDto) {
    return this.service.createForUser(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新分类（仅分类作者）' })
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    // Regular users can only update their own categories; admin manages via /admin endpoints
    return this.service.update(id, dto, user.sub, false);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除分类（仅分类作者）' })
  remove(@CurrentUser() user: JwtUserPayload, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, user.sub, false);
  }
}
