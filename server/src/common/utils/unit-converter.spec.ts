import { convert, getCategory, toBase } from './unit-converter';

describe('getCategory', () => {
  it('classifies weight units', () => {
    expect(getCategory('g')).toBe('weight');
    expect(getCategory('斤')).toBe('weight');
    expect(getCategory('kg')).toBe('weight');
  });

  it('classifies volume units', () => {
    expect(getCategory('ml')).toBe('volume');
    expect(getCategory('汤匙')).toBe('volume');
  });

  it('classifies count units', () => {
    expect(getCategory('个')).toBe('count');
    expect(getCategory('瓣')).toBe('count');
  });

  it('returns unknown for unrecognized units', () => {
    expect(getCategory('xyz')).toBe('unknown');
  });
});

describe('toBase', () => {
  it('converts weights to grams', () => {
    expect(toBase(1, 'kg')).toEqual({ value: 1000, baseUnit: 'g' });
    expect(toBase(1, '斤')).toEqual({ value: 500, baseUnit: 'g' });
    expect(toBase(2, '两')).toEqual({ value: 100, baseUnit: 'g' });
  });

  it('converts volumes to ml', () => {
    expect(toBase(1, '升')).toEqual({ value: 1000, baseUnit: 'ml' });
    expect(toBase(1, '汤匙')).toEqual({ value: 15, baseUnit: 'ml' });
  });

  it('returns null for count/unknown', () => {
    expect(toBase(1, '个')).toBeNull();
    expect(toBase(1, 'xyz')).toBeNull();
  });
});

describe('convert', () => {
  it('converts within weight category', () => {
    expect(convert(500, 'g', '斤')).toBe(1);
    expect(convert(2, '斤', 'g')).toBe(1000);
    expect(convert(1, 'kg', '两')).toBe(20);
  });

  it('converts within volume category', () => {
    expect(convert(1000, 'ml', '升')).toBe(1);
    expect(convert(1, '杯', 'ml')).toBe(240);
  });

  it('returns null across categories', () => {
    expect(convert(100, 'g', 'ml')).toBeNull();
    expect(convert(1, '个', 'g')).toBeNull();
  });

  it('returns null on unknown units', () => {
    expect(convert(1, 'g', 'xyz')).toBeNull();
  });
});

describe('English units (overseas)', () => {
  it('classifies English weight and volume units', () => {
    expect(getCategory('oz')).toBe('weight');
    expect(getCategory('lb')).toBe('weight');
    expect(getCategory('cup')).toBe('volume');
    expect(getCategory('tbsp')).toBe('volume');
    expect(getCategory('tsp')).toBe('volume');
  });

  it('converts oz and lb to grams', () => {
    expect(convert(1, 'oz', 'g')).toBeCloseTo(28.3495, 4);
    expect(convert(1, 'lb', 'g')).toBeCloseTo(453.592, 3);
    expect(convert(1, 'lb', 'oz')).toBeCloseTo(16, 6);
  });

  it('converts cup/tbsp/tsp within volume', () => {
    expect(convert(1, 'cup', 'ml')).toBe(240);
    expect(convert(1, 'cup', '杯')).toBe(1); // 与既有中文杯一致
    expect(convert(1, 'tbsp', 'ml')).toBe(15);
    expect(convert(1, 'tsp', 'tbsp')).toBeCloseTo(1 / 3, 6);
    expect(convert(1, 'fl oz', 'ml')).toBeCloseTo(29.5735, 4);
  });

  it('accepts word forms, plurals, case and whitespace', () => {
    expect(convert(2, 'Pounds', 'g')).toBeCloseTo(907.184, 3);
    expect(convert(1, ' TBSP ', 'ml')).toBe(15);
    expect(convert(3, 'teaspoons', 'ml')).toBe(15);
    expect(convert(1, 'ounce', 'g')).toBeCloseTo(28.3495, 4);
    expect(convert(2, 'cups', 'ml')).toBe(480);
  });

  it('still rejects cross-category conversion', () => {
    expect(convert(1, 'oz', 'ml')).toBeNull();
    expect(convert(1, 'cup', 'g')).toBeNull();
  });

  it('regression: Chinese units unchanged', () => {
    expect(convert(1, '斤', 'g')).toBe(500);
    expect(convert(1, '杯', 'ml')).toBe(240);
  });
});
