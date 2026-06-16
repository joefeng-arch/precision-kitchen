import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShoppingListItemDto {
  @ApiProperty({ example: 'uuid-of-recipe' })
  @IsUUID('4')
  recipeId!: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  servings!: number;
}

export class GenerateShoppingListDto {
  @ApiProperty({ type: [ShoppingListItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShoppingListItemDto)
  items!: ShoppingListItemDto[];
}
