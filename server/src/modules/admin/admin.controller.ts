import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { AdminService } from './admin.service';
import { RecipeParseService } from '../recipes/recipe-parse.service';
import { ParseTextDto } from '../recipes/dto/recipe.dto';
import {
  AdminCreateCategoryDto,
  AdminCreateIngredientDto,
  AdminCreateOfficialRecipeDto,
  AdminListCategoriesDto,
  AdminListIngredientsDto,
  AdminListRecipesDto,
  AdminListUsersDto,
  AdminUpdateCategoryDto,
  AdminUpdateIngredientDto,
  AdminUpdateRecipeDto,
  BatchIdsDto,
  ReorderCategoriesDto,
  SetCategoryEnabledDto,
  SetFeaturedDto,
  SetRecipeStatusDto,
  SetUserRoleDto,
  SetUserStatusDto,
  SetVipDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly parseService: RecipeParseService,
  ) {}

  /* ─────────────────── AI Parse ─────────────────── */

  @Post('recipes/parse-text')
  @ApiOperation({ summary: 'AI 解析菜谱文本（管理员版，不限频率）' })
  adminParseText(@Body() dto: ParseTextDto) {
    // 管理员调用，跳过每用户限频
    return this.parseService.parseText('admin', dto.text, { skipRateLimit: true });
  }

  /* ─────────────────── Stats ─────────────────── */

  @Get('stats')
  @ApiOperation({ summary: '总览统计' })
  stats() {
    return this.service.stats();
  }

  /* ─────────────────── Recipes ─────────────────── */

  @Get('recipes')
  @ApiOperation({ summary: '菜谱列表（含作者/分类/浏览量/收藏量，支持高级筛选）' })
  listRecipes(@Query() query: AdminListRecipesDto) {
    return this.service.listRecipes(query);
  }

  @Get('recipes/:id')
  @ApiOperation({ summary: '菜谱详情（含食材、步骤、作者、分类）' })
  getRecipeDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getRecipeDetail(id);
  }

  @Post('recipes/official')
  @ApiOperation({ summary: '以"老舅官方"身份创建菜谱' })
  createOfficialRecipe(@Body() dto: AdminCreateOfficialRecipeDto) {
    return this.service.createOfficialRecipe(dto);
  }

  @Patch('recipes/:id')
  @ApiOperation({ summary: '更新菜谱（含食材/步骤全量替换）' })
  updateRecipe(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateRecipeDto) {
    return this.service.updateRecipe(id, dto);
  }

  @Patch('recipes/:id/status')
  @ApiOperation({ summary: '改菜谱状态（审核/下架）' })
  setRecipeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRecipeStatusDto) {
    return this.service.setRecipeStatus(id, dto.status);
  }

  @Put('recipes/:id/feature')
  @ApiOperation({ summary: '设置/取消官方推荐' })
  setFeatured(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetFeaturedDto) {
    return this.service.setFeatured(id, dto.isFeatured ?? true);
  }

  @Post('recipes/batch-archive')
  @ApiOperation({ summary: '批量归档菜谱' })
  batchArchive(@Body() dto: BatchIdsDto) {
    return this.service.batchArchive(dto.ids);
  }

  @Post('recipes/batch-delete')
  @ApiOperation({ summary: '批量删除菜谱（硬删除）' })
  batchDelete(@Body() dto: BatchIdsDto) {
    return this.service.batchDelete(dto.ids);
  }

  @Delete('recipes/:id')
  @ApiOperation({ summary: '删除单个菜谱' })
  deleteRecipe(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteRecipe(id);
  }

  /* ─────────────────── Users ─────────────────── */

  @Get('users')
  @ApiOperation({ summary: '用户列表（含菜谱数/做菜数/最后登录/VIP状态）' })
  listUsers(@Query() query: AdminListUsersDto) {
    return this.service.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: '用户详情（含近期菜谱与做菜记录）' })
  getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getUserDetail(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '设置用户角色（user / vip）' })
  setUserRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserRoleDto) {
    return this.service.setUserRole(id, dto.role);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: '封禁/解封用户' })
  setUserStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserStatusDto) {
    return this.service.setUserStatus(id, dto.status);
  }

  @Post('users/:id/vip')
  @ApiOperation({ summary: '设置/移除 VIP（传 null 移除）' })
  setVip(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetVipDto) {
    const expiresAt = dto.vipExpiresAt ? new Date(dto.vipExpiresAt) : null;
    return this.service.setVip(id, expiresAt);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '删除用户' })
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteUser(id);
  }

  /* ─────────────────── Ingredients ─────────────────── */

  @Get('ingredients')
  @ApiOperation({ summary: '食材列表（含分类名、别名、热量）' })
  listIngredients(@Query() query: AdminListIngredientsDto) {
    return this.service.listIngredients(query);
  }

  @Get('ingredients/:id')
  @ApiOperation({ summary: '食材详情' })
  getIngredient(@Param('id', ParseIntPipe) id: number) {
    return this.service.getIngredient(id);
  }

  @Post('ingredients')
  @ApiOperation({ summary: '创建食材' })
  createIngredient(@Body() dto: AdminCreateIngredientDto) {
    return this.service.createIngredient(dto);
  }

  @Patch('ingredients/:id')
  @ApiOperation({ summary: '更新食材' })
  updateIngredient(@Param('id', ParseIntPipe) id: number, @Body() dto: AdminUpdateIngredientDto) {
    return this.service.updateIngredient(id, dto);
  }

  @Delete('ingredients/:id')
  @ApiOperation({ summary: '删除食材' })
  deleteIngredient(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteIngredient(id);
  }

  @Post('ingredients/import-csv')
  @ApiOperation({ summary: '批量导入食材（CSV 文件）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importIngredientsCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传 CSV 文件');

    const content = file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new BadRequestException('CSV 至少需要表头 + 1 行数据');

    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const rows = lines
      .slice(1)
      .map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        const row: Record<string, any> = {};
        headers.forEach((h, i) => {
          row[h] = cols[i] ?? '';
        });
        return {
          name: row['name'] || row['名称'] || '',
          categoryId:
            row['categoryid'] || row['分类id']
              ? parseInt(row['categoryid'] || row['分类id'], 10)
              : undefined,
          defaultUnit: row['defaultunit'] || row['默认单位'] || 'g',
          referencePrice: row['referenceprice'] || row['参考单价'] || undefined,
          referenceUnit: row['referenceunit'] || row['参考单位'] || undefined,
          aliases: (row['aliases'] || row['别名'] || '').split('|').filter(Boolean),
          calories: row['calories'] || row['热量'] || undefined,
        };
      })
      .filter((r) => r.name);

    return this.service.batchImportIngredients(rows);
  }

  /* ─────────────────── Categories ─────────────────── */

  @Get('categories')
  @ApiOperation({ summary: '系统分类列表' })
  listCategories(@Query() query: AdminListCategoriesDto) {
    return this.service.listCategories(query);
  }

  @Post('categories')
  @ApiOperation({ summary: '创建系统分类' })
  createCategory(@Body() dto: AdminCreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: '更新分类（名称/图标/排序/启用状态）' })
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: AdminUpdateCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Put('categories/:id/enabled')
  @ApiOperation({ summary: '启用/禁用分类' })
  setCategoryEnabled(@Param('id', ParseIntPipe) id: number, @Body() dto: SetCategoryEnabledDto) {
    return this.service.setCategoryEnabled(id, dto.enabled);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '删除系统分类' })
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteCategory(id);
  }

  @Post('categories/reorder')
  @ApiOperation({ summary: '批量调整分类排序' })
  reorderCategories(@Body() dto: ReorderCategoriesDto) {
    return this.service.reorderCategories(dto);
  }
}
