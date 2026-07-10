import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RecipeCostDto } from './recipe-cost.dto';

const UUID = '4b1a6f70-9a3e-4a6f-8c2d-1e5b7d9c0a11';

/** 校验一个 body，返回顶层 + 嵌套的所有 error 属性名集合（同 scale.dto.spec） */
function validate(payload: unknown): string[] {
  const dto = plainToInstance(RecipeCostDto, payload);
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  const names: string[] = [];
  const walk = (es: typeof errors): void => {
    for (const e of es) {
      names.push(e.property);
      if (e.children?.length) walk(e.children);
    }
  };
  walk(errors);
  return names;
}
const ok = (p: unknown) => validate(p).length === 0;

describe('RecipeCostDto 校验', () => {
  it('合法：仅 recipeId（无 scale = 原始用量）', () => {
    expect(ok({ recipeId: UUID })).toBe(true);
  });

  it('缺 recipeId / 非 uuid → error', () => {
    expect(validate({})).toContain('recipeId');
    expect(validate({ recipeId: 'not-a-uuid' })).toContain('recipeId');
  });

  it('合法：四个 profile 的嵌套 scale 各一例', () => {
    expect(ok({ recipeId: UUID, scale: { profile: 'linear_legacy', multiplier: 2 } })).toBe(true);
    expect(
      ok({
        recipeId: UUID,
        scale: { profile: 'bakers_percentage', bakersLock: { mode: 'total', value: 1000 } },
      }),
    ).toBe(true);
    expect(
      ok({ recipeId: UUID, scale: { profile: 'ratio_based', ratioLock: { id: 22, value: 300 } } }),
    ).toBe(true);
    expect(
      ok({
        recipeId: UUID,
        scale: {
          profile: 'multi_ratio',
          multiRatio: { groups: [{ group: 'mix', total: 120 }] },
        },
      }),
    ).toBe(true);
  });

  it('嵌套判别校验生效：缺锁定对象 / 坏 profile 报到对应字段', () => {
    expect(validate({ recipeId: UUID, scale: { profile: 'bakers_percentage' } })).toContain(
      'bakersLock',
    );
    expect(validate({ recipeId: UUID, scale: { profile: 'nope' } })).toContain('profile');
  });

  it('scale 非对象 → error scale', () => {
    expect(validate({ recipeId: UUID, scale: 'x' })).toContain('scale');
    expect(validate({ recipeId: UUID, scale: 3 })).toContain('scale');
  });

  it('嵌套未知键 → forbidNonWhitelisted error', () => {
    expect(
      validate({
        recipeId: UUID,
        scale: { profile: 'linear_legacy', multiplier: 2, hack: 1 },
      }),
    ).toContain('hack');
  });

  it('顶层未知键 → forbidNonWhitelisted error', () => {
    expect(validate({ recipeId: UUID, extra: true })).toContain('extra');
  });
});

describe('RecipeCostDto.scale.toScaleSpec()（transform 后方法存活）', () => {
  it('嵌套 ScaleRequestDto 实例化后可组装引擎 spec', () => {
    const dto = plainToInstance(RecipeCostDto, {
      recipeId: UUID,
      scale: { profile: 'bakers_percentage', bakersLock: { mode: 'anchor', value: 500 } },
    });
    expect(dto.scale!.toScaleSpec()).toEqual({
      profile: 'bakers_percentage',
      lock: { mode: 'anchor', value: 500 },
    });
  });
});
