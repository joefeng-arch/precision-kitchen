import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  IsString,
  IsDefined,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { ScaleSpec, ScalingProfile } from '../../../common/utils/scaling-engine';

/** GET /:id/scale?servings= —— linear_legacy 按份数换算（保留不动） */
export class ScaleQueryDto {
  @ApiProperty({ description: '目标份数', example: 4 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  servings!: number;
}

const PROFILES = ['linear_legacy', 'bakers_percentage', 'ratio_based', 'multi_ratio'] as const;

class BakersLockDto {
  @ApiProperty({ enum: ['anchor', 'total'], description: 'anchor=锁基准量 / total=锁总重反推' })
  @IsIn(['anchor', 'total'])
  mode!: 'anchor' | 'total';

  @ApiProperty({ description: '锁定的量（基准量 F 或总重 T），必须 > 0' })
  @IsNumber()
  @IsPositive()
  value!: number;
}

class RatioLockDto {
  @ApiProperty({ description: '锁定成员的 ingredient id' })
  @IsInt()
  id!: number;

  @ApiProperty({ description: '该成员的目标量，必须 > 0' })
  @IsNumber()
  @IsPositive()
  value!: number;
}

class GroupLockDto {
  @ApiProperty({ description: '比例组标记（如 tea_base / mix）' })
  @IsString()
  group!: string;

  @ApiPropertyOptional({ description: '锁定组内某成员 id（与 lockedValue 配对；或改用 total）' })
  @ValidateIf((o) => o.total == null)
  @IsInt()
  lockedId?: number;

  @ApiPropertyOptional({ description: '锁定成员的目标量，> 0' })
  @ValidateIf((o) => o.total == null)
  @IsNumber()
  @IsPositive()
  lockedValue?: number;

  @ApiPropertyOptional({ description: '锁定整组总量，> 0（与 lockedId+lockedValue 二选一）' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  total?: number;
}

class PercentBaseDto {
  @ApiPropertyOptional({ description: 'percentage 基准 = 某比例组已解成员之和' })
  @ValidateIf((o) => o.id == null)
  @IsString()
  group?: string;

  @ApiPropertyOptional({ description: 'percentage 基准 = 单个成员 id 的用量（如奶茶茶汤=水量）' })
  @ValidateIf((o) => o.group == null)
  @IsInt()
  id?: number;
}

class MultiRatioDto {
  @ApiProperty({ type: [GroupLockDto], description: '各比例组的锁定（至少一组）' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupLockDto)
  groups!: GroupLockDto[];

  @ApiPropertyOptional({
    type: PercentBaseDto,
    description: 'percentage 原料的基准（有 percentage 料时必给）',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PercentBaseDto)
  percentBase?: PercentBaseDto;
}

/** POST /:id/scale —— 按 profile 的锁定参数缩放 */
export class ScaleRequestDto {
  @ApiProperty({ enum: PROFILES })
  @IsIn(PROFILES)
  profile!: ScalingProfile;

  @ApiPropertyOptional({ description: 'linear_legacy：缩放倍数，> 0' })
  @ValidateIf((o) => o.profile === 'linear_legacy')
  @IsNumber()
  @IsPositive()
  multiplier?: number;

  @ApiPropertyOptional({ type: BakersLockDto })
  @ValidateIf((o) => o.profile === 'bakers_percentage')
  @IsDefined()
  @ValidateNested()
  @Type(() => BakersLockDto)
  bakersLock?: BakersLockDto;

  @ApiPropertyOptional({ type: RatioLockDto })
  @ValidateIf((o) => o.profile === 'ratio_based')
  @IsDefined()
  @ValidateNested()
  @Type(() => RatioLockDto)
  ratioLock?: RatioLockDto;

  @ApiPropertyOptional({ type: MultiRatioDto })
  @ValidateIf((o) => o.profile === 'multi_ratio')
  @IsDefined()
  @ValidateNested()
  @Type(() => MultiRatioDto)
  multiRatio?: MultiRatioDto;

  /** 组装引擎 ScaleSpec（校验通过后调用；分派用字段已按 profile 校验齐备） */
  toScaleSpec(): ScaleSpec {
    switch (this.profile) {
      case 'linear_legacy':
        return { profile: 'linear_legacy', multiplier: this.multiplier as number };
      case 'bakers_percentage':
        return {
          profile: 'bakers_percentage',
          lock: { mode: this.bakersLock!.mode, value: this.bakersLock!.value },
        };
      case 'ratio_based':
        return {
          profile: 'ratio_based',
          lock: { id: this.ratioLock!.id, value: this.ratioLock!.value },
        };
      case 'multi_ratio': {
        const m = this.multiRatio!;
        const percentBase =
          m.percentBase == null
            ? undefined
            : m.percentBase.id != null
              ? { id: m.percentBase.id }
              : { group: m.percentBase.group as string };
        return {
          profile: 'multi_ratio',
          spec: {
            groups: m.groups.map((g) => ({
              group: g.group,
              lockedId: g.lockedId,
              lockedValue: g.lockedValue,
              total: g.total,
            })),
            percentBase,
          },
        };
      }
    }
  }
}
