import { buildPantryBody, emptyPantryForm, type PantryFormState } from './pantryForm';

function state(partial: Partial<PantryFormState>): PantryFormState {
  return { ...emptyPantryForm, unitPrice: '3.5', priceUnit: 'g', name: 'Flour', ...partial };
}

describe('buildPantryBody', () => {
  it('选中公共建议 → ingredientId，不带 customName', () => {
    const r = buildPantryBody(state({ ingredientId: 5, name: '面粉' }));
    expect(r).toEqual({
      ok: true,
      body: { ingredientId: 5, unitPrice: 3.5, priceUnit: 'g' },
    });
  });

  it('自由文本 → customName（trim 后）', () => {
    const r = buildPantryBody(state({ name: '  Bread flour  ' }));
    expect(r).toEqual({
      ok: true,
      body: { customName: 'Bread flour', unitPrice: 3.5, priceUnit: 'g' },
    });
  });

  it('名称与 ingredientId 均缺 → name error', () => {
    const r = buildPantryBody(state({ name: '   ' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeTruthy();
  });

  it('unitPrice 字符串 → number（round 到 4 位，服务端 maxDecimalPlaces 4）', () => {
    const r = buildPantryBody(state({ unitPrice: '0.00456' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.unitPrice).toBe(0.0046);
  });

  it('unitPrice 非法 / 负数 / 空 → error', () => {
    for (const bad of ['abc', '-1', '']) {
      const r = buildPantryBody(state({ unitPrice: bad }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.unitPrice).toBeTruthy();
    }
  });

  it('priceUnit 空 → error', () => {
    const r = buildPantryBody(state({ priceUnit: ' ' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.priceUnit).toBeTruthy();
  });

  it('库存空 → 完全省略 stockAmount/stockUnit', () => {
    const r = buildPantryBody(state({ stockAmount: '', stockUnit: 'g' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).not.toHaveProperty('stockAmount');
      expect(r.body).not.toHaveProperty('stockUnit');
    }
  });

  it('库存有值 → number（round 2 位）+ stockUnit（缺省用 priceUnit）', () => {
    const r = buildPantryBody(state({ stockAmount: '500.456', stockUnit: '' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.stockAmount).toBe(500.46);
      expect(r.body.stockUnit).toBe('g');
    }
  });

  it('库存负数 → error', () => {
    const r = buildPantryBody(state({ stockAmount: '-2' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.stockAmount).toBeTruthy();
  });

  it('categoryId / notes 透传（notes trim 空则省略）', () => {
    const r = buildPantryBody(state({ categoryId: 12, notes: '  organic ' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.categoryId).toBe(12);
      expect(r.body.notes).toBe('organic');
    }
  });
});
