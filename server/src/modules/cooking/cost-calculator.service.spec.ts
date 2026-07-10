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

  describe('名称兜底匹配（AI 导入的 customName 行）', () => {
    // pantry 条目工厂：id 缺省递增无关紧要，测试里显式给
    const pantryItem = (p: Partial<UserIngredient>) =>
      ({
        id: 1,
        userId: 'u1',
        ingredientId: null,
        customName: null,
        unitPrice: '0.01',
        priceUnit: 'g',
        ...p,
      }) as UserIngredient;

    it('customName 行 ↔ pantry customName：归一化（空白+大小写）后全等命中 user_lib', async () => {
      userRepo.find.mockResolvedValue([
        pantryItem({ id: 1, customName: 'bread flour', unitPrice: '0.004' }),
      ]);

      const result = await service.calculate('u1', [
        item({ ingredientId: null, customName: 'Bread  Flour', unit: 'g', scaledAmount: 500 }),
      ]);

      expect(result.lines[0].source).toBe('user_lib');
      expect(result.lines[0].totalCost).toBe(2);
      expect(result.unknownCount).toBe(0);
    });

    it('宁缺勿滥：无部分匹配——行 "糖粉" 不吃 pantry "糖" 的价', async () => {
      userRepo.find.mockResolvedValue([pantryItem({ id: 1, customName: '糖', unitPrice: '5' })]);

      const result = await service.calculate('u1', [
        item({ ingredientId: null, customName: '糖粉', unit: 'g', scaledAmount: 100 }),
      ]);

      expect(result.lines[0].source).toBe('unknown');
      expect(result.lines[0].totalCost).toBe(0);
      expect(result.unknownCount).toBe(1);
    });

    it('优先级：ingredientId 命中时同名 customName 条目不干扰', async () => {
      userRepo.find.mockResolvedValue([
        pantryItem({ id: 1, customName: '面粉', unitPrice: '99' }), // 干扰项
        pantryItem({ id: 2, ingredientId: 7, unitPrice: '0.004' }), // id 精确命中
      ]);
      publicRepo.find.mockResolvedValue([{ id: 7, name: '面粉' }]);

      const result = await service.calculate('u1', [
        item({ ingredientId: 7, customName: null, unit: 'g', scaledAmount: 100 }),
      ]);

      expect(result.lines[0].source).toBe('user_lib');
      expect(result.lines[0].totalCost).toBe(0.4); // 0.004 而非 99
    });

    it('方向②：pantry 只关联公共食材（无 customName），行 customName = 公共名 → 命中', async () => {
      userRepo.find.mockResolvedValue([
        pantryItem({ id: 1, ingredientId: 4, unitPrice: '0.002' }),
      ]);
      publicRepo.find.mockResolvedValue([{ id: 4, name: '番茄' }]);

      const result = await service.calculate('u1', [
        item({ ingredientId: null, customName: '番茄', unit: 'g', scaledAmount: 300 }),
      ]);

      expect(result.lines[0].source).toBe('user_lib');
      expect(result.lines[0].totalCost).toBe(0.6);
    });

    it('方向③：行有 ingredientId 但无 id 命中，其公共名 ↔ pantry customName → 命中', async () => {
      userRepo.find.mockResolvedValue([
        pantryItem({ id: 1, customName: '番茄', unitPrice: '0.002' }),
      ]);
      publicRepo.find.mockResolvedValue([
        { id: 4, name: '番茄', referencePrice: null, referenceUnit: null },
      ]);

      const result = await service.calculate('u1', [
        item({ ingredientId: 4, customName: null, unit: 'g', scaledAmount: 300 }),
      ]);

      expect(result.lines[0].source).toBe('user_lib');
      expect(result.lines[0].totalCost).toBe(0.6);
    });

    it('歧义：两条 pantry 归一化后同名 → id 小者生效（确定性）', async () => {
      userRepo.find.mockResolvedValue([
        pantryItem({ id: 3, customName: '面粉', unitPrice: '0.004' }),
        pantryItem({ id: 9, customName: '面 粉', unitPrice: '99' }),
      ]);

      const result = await service.calculate('u1', [
        item({ ingredientId: null, customName: '面粉', unit: 'g', scaledAmount: 100 }),
      ]);

      expect(result.lines[0].totalCost).toBe(0.4);
    });

    it('级联：名称命中但单位跨类（g↔个）→ 不计价，落到 unknown', async () => {
      userRepo.find.mockResolvedValue([
        pantryItem({ id: 1, customName: '鸡蛋', unitPrice: '1', priceUnit: '个' }),
      ]);

      const result = await service.calculate('u1', [
        item({ ingredientId: null, customName: '鸡蛋', unit: 'g', scaledAmount: 50 }),
      ]);

      expect(result.lines[0].source).toBe('unknown');
      expect(result.unknownCount).toBe(1);
    });

    it('USD 守卫回归：名称命中照常计价，public 兜底仍跳过', async () => {
      await makeService('USD');
      userRepo.find.mockResolvedValue([
        pantryItem({ id: 1, customName: 'flour', unitPrice: '0.001' }),
      ]);
      publicRepo.find.mockResolvedValue([
        { id: 5, name: '盐', referencePrice: '5', referenceUnit: '斤' },
      ]);

      const result = await service.calculate('u1', [
        item({ ingredientId: null, customName: 'Flour', unit: 'g', scaledAmount: 500 }),
        item({ ingredientId: 5, customName: null, unit: 'g', scaledAmount: 10 }),
      ]);

      expect(result.currency).toBe('USD');
      expect(result.lines[0].source).toBe('user_lib');
      expect(result.lines[0].totalCost).toBe(0.5);
      expect(result.lines[1].source).toBe('unknown'); // CNY 参考价被守卫跳过
    });
  });
});
