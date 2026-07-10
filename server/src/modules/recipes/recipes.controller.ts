import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateRecipeDto, ListRecipesDto, ParseTextDto, UpdateRecipeDto } from './dto/recipe.dto';
import { ScaleQueryDto, ScaleRequestDto } from './dto/scale.dto';
import { RecipeParseService } from './recipe-parse.service';
import { RecipesService } from './recipes.service';
import { ScalingService } from './scaling.service';

@ApiTags('recipes')
@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly service: RecipesService,
    private readonly scaling: ScalingService,
    private readonly parseService: RecipeParseService,
  ) {}

  @Get()
  @ApiOperation({ summary: '菜谱列表（分页 + 多筛选）' })
  list(@Query() query: ListRecipesDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '菜谱详情（含用料、步骤）' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/scale')
  @ApiOperation({ summary: '动态换算用量（按目标份数，linear_legacy 兼容）' })
  scale(@Param('id', ParseUUIDPipe) id: string, @Query() query: ScaleQueryDto) {
    return this.scaling.scale(id, query.servings);
  }

  @Post(':id/scale')
  @ApiOperation({ summary: '按缩放模型换算（bakers % / 比例 / 多比例，锁定参数）' })
  async scaleWithProfile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ScaleRequestDto) {
    try {
      return await this.scaling.scaleWithSpec(id, dto.toScaleSpec());
    } catch (e) {
      // 引擎守卫（缺 anchor / 除零 NaN / 缺 percentBase 等）→ 400；NotFound 等透传
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e instanceof Error ? e.message : 'scaling failed');
    }
  }

  @Get(':id/versions')
  @ApiOperation({ summary: '菜谱历史版本列表' })
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listVersions(id);
  }

  @Post('parse-text')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '智能导入：AI 解析菜谱文本' })
  parseText(@CurrentUser() user: JwtUserPayload, @Body() dto: ParseTextDto) {
    // user.role 是有效角色（JwtStrategy 已折算 vip 过期）→ 月度配额按层级
    return this.parseService.parseText(user.sub, dto.text, { tier: user.role });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建菜谱' })
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateRecipeDto) {
    return this.service.create(user.sub, dto, user.role);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新菜谱（每次更新生成新版本快照）' })
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
  ) {
    // Regular users can only update their own; admin manages via /admin endpoints
    return this.service.update(user.sub, id, dto, false);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除菜谱（仅作者）' })
  remove(@CurrentUser() user: JwtUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.sub, id, false);
  }

  @Post('batch-delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量删除菜谱（只能删自己的）' })
  batchDelete(@CurrentUser() user: JwtUserPayload, @Body() body: { ids: string[] }) {
    return this.service.batchRemove(user.sub, body?.ids ?? [], false);
  }
}
