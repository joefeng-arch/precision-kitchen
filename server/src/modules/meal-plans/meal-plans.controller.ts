import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  JwtUserPayload,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreateMealPlanDto,
  MealPlanToShoppingListDto,
  QueryMealPlansDto,
} from './dto/meal-plan.dto';
import { MealPlansService } from './meal-plans.service';

@ApiTags('meal-plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly service: MealPlansService) {}

  @Post()
  @ApiOperation({ summary: '添加餐单项' })
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateMealPlanDto) {
    return this.service.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: '查询某周餐单' })
  list(@CurrentUser() user: JwtUserPayload, @Query() query: QueryMealPlansDto) {
    return this.service.findByDateRange(user.sub, query.startDate, query.endDate);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除餐单项' })
  remove(
    @CurrentUser() user: JwtUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user.sub, id);
  }

  @Post('to-shopping-list')
  @ApiOperation({ summary: '把某周餐单转成采购清单' })
  toShoppingList(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: MealPlanToShoppingListDto,
  ) {
    return this.service.toShoppingList(user.sub, dto.startDate, dto.endDate);
  }
}
