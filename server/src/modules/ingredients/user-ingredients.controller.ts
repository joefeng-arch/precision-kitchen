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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreateUserIngredientDto,
  ListUserIngredientsDto,
  UpdateUserIngredientDto,
} from './dto/user-ingredient.dto';
import { UserIngredientsService } from './user-ingredients.service';

@ApiTags('me-ingredients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/ingredients')
export class UserIngredientsController {
  constructor(private readonly service: UserIngredientsService) {}

  @Get()
  @ApiOperation({ summary: '我的食材库列表' })
  list(@CurrentUser() user: JwtUserPayload, @Query() query: ListUserIngredientsDto) {
    return this.service.list(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '我的食材详情' })
  findOne(@CurrentUser() user: JwtUserPayload, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOneEnriched(user.sub, id);
  }

  @Post()
  @ApiOperation({ summary: '添加到我的食材库' })
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateUserIngredientDto) {
    return this.service.create(user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新我的食材' })
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserIngredientDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '从我的食材库移除' })
  remove(@CurrentUser() user: JwtUserPayload, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.sub, id);
  }
}
