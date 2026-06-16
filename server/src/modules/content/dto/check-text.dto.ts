import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CheckTextDto {
  @ApiProperty({ description: '要检查的文本内容' })
  @IsString()
  @MinLength(1)
  @MaxLength(2500)
  content!: string;
}

export class CheckTextWithSkipDto extends CheckTextDto {
  @ApiPropertyOptional({ description: '管理员专用：跳过内容安全检查（默认 false）' })
  @IsOptional()
  @IsBoolean()
  skipCheck?: boolean;
}
