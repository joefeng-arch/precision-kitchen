import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GenerateShoppingListDto } from './dto/generate-shopping-list.dto';
import { ShoppingListService } from './shopping-list.service';

@ApiTags('shopping-list')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shopping-list')
export class ShoppingListController {
  constructor(private readonly service: ShoppingListService) {}

  @Post('generate')
  @ApiOperation({ summary: '根据菜谱列表生成采购清单' })
  generate(@CurrentUser() user: JwtUserPayload, @Body() dto: GenerateShoppingListDto) {
    return this.service.generate(user.sub, dto.items);
  }
}
