import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UserIngredient } from '../ingredients/entities/user-ingredient.entity';
import { ScaledIngredientItem } from '../recipes/scaling.service';
import { CostCalculatorService } from './cost-calculator.service';

function item(partial: Partial<ScaledIngredientItem>): ScaledIngredientItem {
  return {
    id: 1,
    ingredientId: null,
    customName: null,
    groupName: null,
    unit: 'g',
    originalAmount: 100,
    scaledAmount: 100,
    scaleType: 'linear',
    scaleFactor: 1,
    notes: null,
    sort: 0,
    ...partial,
  };
}

describe('CostCalculatorService', () => {
  let service: CostCalculatorService;
  let userRepo: { find: jest.Mock };
  let publicRepo: { find: jest.Mock };

  async function makeService(currency?: string) {
    userRepo = { find: jest.fn().mockResolvedValue([]) };
    publicRepo = { find: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CostCalculatorService,
        { provide: getRepositoryToken(UserIngredient), useValue: userRepo },
        { provide: getRepositoryToken(Ingredient), useValue: publicRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) =>
              key === 'COST_CURRENCY' ? (currency ?? def) : def,
            ),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CostCalculatorService);
  }

  beforeEach(async () => {
    await makeService();
  });

  it('prefers user_lib over public_lib', async () => {
    userRepo.find.mockResolvedValue([
      { userId: 'u1', ingredientId: 1, unitPrice: '10', priceUnit: '斤' },
    ]);
    publicRepo.find.mockResolvedValue([
      { id: 1, name: '猪肉', referencePrice: '20', referenceUnit: '斤' },
    ]);

    const result = await service.calculate('u1', [
      item({ ingredientId: 1, unit: '斤', scaledAmount: 1 }),
    ]);

    expect(result.lines[0].source).toBe('user_lib');
    expect(result.lines[0].totalCost).toBe(10);
    expect(result.totalCost).toBe(10);
    expect(result.unknownCount).toBe(0);
  });

  it('falls back to public_lib when no user price', async () => {
    publicRepo.find.mockResolvedValue([
      { id: 2, name: '盐', referencePrice: '5', referenceUnit: '斤' },
    ]);

    const result = await service.calculate('u1', [
      item({ ingredientId: 2, unit: '斤', scaledAmount: 2 }),
    ]);

    expect(result.lines[0].source).toBe('public_lib');
    expect(result.lines[0].totalCost).toBe(10);
  });

  it('converts units when amount unit differs from price unit', async () => {
    publicRepo.find.mockResolvedValue([
      { id: 3, name: '糖', referencePrice: '10', referenceUnit: '斤' }, // 10元/500g
    ]);

    // 250g = 0.5 斤 → 5元
    const result = await service.calculate('u1', [
      item({ ingredientId: 3, unit: 'g', scaledAmount: 250 }),
    ]);

    expect(result.lines[0].source).toBe('public_lib');
    expect(result.lines[0].totalCost).toBe(5);
  });

  it('marks as unknown when no price found', async () => {
    const result = await service.calculate('u1', [
      item({ ingredientId: 99, unit: 'g', scaledAmount: 50 }),
    ]);

    expect(result.lines[0].source).toBe('unknown');
    expect(result.lines[0].totalCost).toBe(0);
    expect(result.unknownCount).toBe(1);
    expect(result.totalCost).toBe(0);
  });

  it('marks as unknown when unit conversion fails', async () => {
    publicRepo.find.mockResolvedValue([
      { id: 4, name: '鸡蛋', referencePrice: '1', referenceUnit: '个' },
    ]);

    // 50g 无法换算到「个」
    const result = await service.calculate('u1', [
      item({ ingredientId: 4, unit: 'g', scaledAmount: 50 }),
    ]);

    expect(result.lines[0].source).toBe('unknown');
    expect(result.unknownCount).toBe(1);
  });

  it('uses customName when no ingredientId', async () => {
    const result = await service.calculate('u1', [
      item({ ingredientId: null, customName: '秘制酱', scaledAmount: 30 }),
    ]);

    expect(result.lines[0].name).toBe('秘制酱');
    expect(result.lines[0].source).toBe('unknown');
  });

  it('aggregates multiple lines into total', async () => {
    userRepo.find.mockResolvedValue([
      { userId: 'u1', ingredientId: 1, unitPrice: '10', priceUnit: '斤' },
    ]);
    publicRepo.find.mockResolvedValue([
      { id: 2, name: '盐', referencePrice: '5', referenceUnit: '斤' },
    ]);

    const result = await service.calculate('u1', [
      item({ ingredientId: 1, unit: '斤', scaledAmount: 2 }), // 20
      item({ ingredientId: 2, unit: '斤', scaledAmount: 1 }), // 5
      item({ ingredientId: null, customName: '神秘配方' }), // unknown
    ]);

    expect(result.totalCost).toBe(25);
    expect(result.unknownCount).toBe(1);
    expect(result.lines).toHaveLength(3);
  });

  describe('COST_CURRENCY（海外货币守卫）', () => {
    it('defaults to CNY with public_lib fallback intact', async () => {
      publicRepo.find.mockResolvedValue([
        { id: 2, name: '盐', referencePrice: '5', referenceUnit: '斤' },
      ]);

      const result = await service.calculate('u1', [
        item({ ingredientId: 2, unit: '斤', scaledAmount: 1 }),
      ]);

      expect(result.currency).toBe('CNY');
      expect(result.lines[0].source).toBe('public_lib');
    });

    it('labels breakdown with configured currency and prices user_lib normally', async () => {
      await makeService('USD');
      userRepo.find.mockResolvedValue([
        { userId: 'u1', ingredientId: 1, unitPrice: '0.005', priceUnit: 'g' },
      ]);

      const result = await service.calculate('u1', [
        item({ ingredientId: 1, unit: 'g', scaledAmount: 100 }),
      ]);

      expect(result.currency).toBe('USD');
      expect(result.lines[0].source).toBe('user_lib');
      expect(result.lines[0].totalCost).toBe(0.5);
    });

    it('skips CNY-denominated public_lib fallback when currency is not CNY', async () => {
      await makeService('USD');
      publicRepo.find.mockResolvedValue([
        { id: 2, name: '盐', referencePrice: '5', referenceUnit: '斤' },
      ]);

      const result = await service.calculate('u1', [
        item({ ingredientId: 2, unit: '斤', scaledAmount: 1 }),
      ]);

      expect(result.lines[0].source).toBe('unknown');
      expect(result.lines[0].totalCost).toBe(0);
      expect(result.unknownCount).toBe(1);
    });

    it('prices imperial-unit amounts against metric user prices', async () => {
      await makeService('USD');
      userRepo.find.mockResolvedValue([
        { userId: 'u1', ingredientId: 1, unitPrice: '0.005', priceUnit: 'g' },
      ]);

      // 1 lb = 453.592 g → 453.592 × 0.005 ≈ 2.27
      const result = await service.calculate('u1', [
        item({ ingredientId: 1, unit: 'lb', scaledAmount: 1 }),
      ]);

      expect(result.lines[0].source).toBe('user_lib');
      expect(result.lines[0].totalCost).toBeCloseTo(2.27, 2);
    });
  });
});
