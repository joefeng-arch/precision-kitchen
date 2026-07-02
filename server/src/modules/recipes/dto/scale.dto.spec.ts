import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ScaleRequestDto } from './scale.dto';

/** 校验一个 body，返回顶层 + 嵌套的所有 error 属性名集合 */
function validate(payload: unknown): string[] {
  const dto = plainToInstance(ScaleRequestDto, payload);
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

describe('ScaleRequestDto 校验（挡非法输入）', () => {
  it('缺 profile / 非法 profile → error', () => {
    expect(validate({})).toContain('profile');
    expect(validate({ profile: 'nope' })).toContain('profile');
  });

  describe('linear_legacy', () => {
    it('合法：multiplier>0', () => {
      expect(ok({ profile: 'linear_legacy', multiplier: 2 })).toBe(true);
    });
    it('缺 multiplier / <=0 → error', () => {
      expect(validate({ profile: 'linear_legacy' })).toContain('multiplier');
      expect(validate({ profile: 'linear_legacy', multiplier: 0 })).toContain('multiplier');
    });
  });

  describe('bakers_percentage', () => {
    it('合法', () => {
      expect(
        ok({ profile: 'bakers_percentage', bakersLock: { mode: 'anchor', value: 1000 } }),
      ).toBe(true);
    });
    it('缺 bakersLock → error', () => {
      expect(validate({ profile: 'bakers_percentage' })).toContain('bakersLock');
    });
    it('value<=0 → error', () => {
      expect(
        validate({ profile: 'bakers_percentage', bakersLock: { mode: 'anchor', value: 0 } }),
      ).toContain('value');
    });
    it('mode 非法 → error', () => {
      expect(
        validate({ profile: 'bakers_percentage', bakersLock: { mode: 'x', value: 1 } }),
      ).toContain('mode');
    });
  });

  describe('ratio_based', () => {
    it('合法', () => {
      expect(ok({ profile: 'ratio_based', ratioLock: { id: 22, value: 300 } })).toBe(true);
    });
    it('缺 ratioLock → error', () => {
      expect(validate({ profile: 'ratio_based' })).toContain('ratioLock');
    });
    it('value<=0 → error', () => {
      expect(validate({ profile: 'ratio_based', ratioLock: { id: 22, value: -1 } })).toContain(
        'value',
      );
    });
  });

  describe('multi_ratio', () => {
    it('合法：锁单项 + percentBase', () => {
      expect(
        ok({
          profile: 'multi_ratio',
          multiRatio: {
            groups: [{ group: 'tea_base', lockedId: 31, lockedValue: 5 }],
            percentBase: { id: 32 },
          },
        }),
      ).toBe(true);
    });
    it('合法：锁组总量，无 percentBase', () => {
      expect(
        ok({ profile: 'multi_ratio', multiRatio: { groups: [{ group: 'mix', total: 120 }] } }),
      ).toBe(true);
    });
    it('groups 空数组 → error', () => {
      expect(validate({ profile: 'multi_ratio', multiRatio: { groups: [] } })).toContain('groups');
    });
    it('group 既无 total 又无 lockedId+lockedValue → error', () => {
      const names = validate({ profile: 'multi_ratio', multiRatio: { groups: [{ group: 'x' }] } });
      expect(names).toEqual(expect.arrayContaining(['lockedId', 'lockedValue']));
    });
    it('缺 multiRatio → error', () => {
      expect(validate({ profile: 'multi_ratio' })).toContain('multiRatio');
    });
  });
});

describe('ScaleRequestDto.toScaleSpec()', () => {
  const spec = (p: unknown) => plainToInstance(ScaleRequestDto, p).toScaleSpec();

  it('linear_legacy → { multiplier }', () => {
    expect(spec({ profile: 'linear_legacy', multiplier: 2 })).toEqual({
      profile: 'linear_legacy',
      multiplier: 2,
    });
  });
  it('bakers → { lock }', () => {
    expect(
      spec({ profile: 'bakers_percentage', bakersLock: { mode: 'total', value: 1680 } }),
    ).toEqual({
      profile: 'bakers_percentage',
      lock: { mode: 'total', value: 1680 },
    });
  });
  it('ratio → { lock }', () => {
    expect(spec({ profile: 'ratio_based', ratioLock: { id: 22, value: 300 } })).toEqual({
      profile: 'ratio_based',
      lock: { id: 22, value: 300 },
    });
  });
  it('multi_ratio → { spec: groups + percentBase(id) }', () => {
    expect(
      spec({
        profile: 'multi_ratio',
        multiRatio: {
          groups: [{ group: 'tea_base', lockedId: 31, lockedValue: 5 }],
          percentBase: { id: 32 },
        },
      }),
    ).toEqual({
      profile: 'multi_ratio',
      spec: {
        groups: [{ group: 'tea_base', lockedId: 31, lockedValue: 5, total: undefined }],
        percentBase: { id: 32 },
      },
    });
  });
});
