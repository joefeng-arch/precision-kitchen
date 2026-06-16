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
