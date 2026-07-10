import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { Recipe } from '../recipes/entities/recipe.entity';
import { ScalingService } from '../recipes/scaling.service';
import { CostCalculatorService } from './cost-calculator.service';
import { RecipeCostDto } from './dto/recipe-cost.dto';
import { RecipeCostService } from './recipe-cost.service';

const RID = '4b1a6f70-9a3e-4a6f-8c2d-1e5b7d9c0a11';

const BREAKDOWN = { currency: 'CNY', totalCost: 5, lines: [], unknownCount: 0 };

function dto(payload: object): RecipeCostDto {
  return plainToInstance(RecipeCostDto, { recipeId: RID, ...payload });
}

describe('RecipeCostService', () => {
  let service: RecipeCostService;
  let recipes: { findOne: jest.Mock };
  let scaling: { scaleWithSpec: jest.Mock };
  let costCalc: { calculate: jest.Mock };

  async function makeService(env: Record<string, string> = {}) {
    recipes = { findOne: jest.fn().mockResolvedValue(null) };
    scaling = { scaleWithSpec: jest.fn() };
    costCalc = { calculate: jest.fn().mockResolvedValue(BREAKDOWN) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecipeCostService,
        { provide: getRepositoryToken(Recipe), useValue: recipes },
        { provide: ScalingService, useValue: scaling },
        { provide: CostCalculatorService, useValue: costCalc },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: string) => env[key] ?? def) },
        },
      ],
    }).compile();

    service = moduleRef.get(RecipeCostService);
  }

  beforeEach(async () => {
    await makeService();
  });

  it('无 scale：按 (sort,id) 序把原始用量喂给 calculate（decimal string → number）', async () => {
    recipes.findOne.mockResolvedValue({
      id: RID,
      ingredients: [
        { id: 3, ingredientId: null, customName: '糖', amount: '30.00', unit: 'g', sort: 1 },
        { id: 2, ingredientId: 5, customName: null, amount: '500.00', unit: 'g', sort: 0 },
        { id: 1, ingredientId: null, customName: '盐', amount: '5.50', unit: 'g', sort: 0 },
      ],
    });

    const result = await service.getCost('u1', 'user', dto({}));

    expect(recipes.findOne).toHaveBeenCalledWith({
      where: { id: RID },
      relations: ['ingredients'],
    });
    expect(scaling.scaleWithSpec).not.toHaveBeenCalled();
    expect(costCalc.calculate).toHaveBeenCalledWith('u1', [
      { ingredientId: null, customName: '盐', scaledAmount: 5.5, unit: 'g' },
      { ingredientId: 5, customName: null, scaledAmount: 500, unit: 'g' },
      { ingredientId: null, customName: '糖', scaledAmount: 30, unit: 'g' },
    ]);
    expect(result).toBe(BREAKDOWN);
  });

  it('有 scale：委托 scaleWithSpec，不直接查 repo', async () => {
    const scaledItems = [
      { id: 2, ingredientId: 5, customName: null, unit: 'g', scaledAmount: 1000 },
    ];
    scaling.scaleWithSpec.mockResolvedValue({ recipeId: RID, ingredients: scaledItems });

    const result = await service.getCost(
      'u1',
      'user',
      dto({ scale: { profile: 'bakers_percentage', bakersLock: { mode: 'anchor', value: 1000 } } }),
    );

    expect(scaling.scaleWithSpec).toHaveBeenCalledWith(RID, {
      profile: 'bakers_percentage',
      lock: { mode: 'anchor', value: 1000 },
    });
    expect(recipes.findOne).not.toHaveBeenCalled();
    expect(costCalc.calculate).toHaveBeenCalledWith('u1', scaledItems);
    expect(result).toBe(BREAKDOWN);
  });

  it('无 scale 且配方不存在 → 404', async () => {
    await expect(service.getCost('u1', 'user', dto({}))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scaleWithSpec 的拒绝原样透传（400/404）', async () => {
    scaling.scaleWithSpec.mockRejectedValue(new NotFoundException('Recipe not found'));
    await expect(
      service.getCost('u1', 'user', dto({ scale: { profile: 'linear_legacy', multiplier: 2 } })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('COST_PRO_ONLY 门禁', () => {
    it('开：FREE → 403 带升级提示；vip → 通过', async () => {
      await makeService({ COST_PRO_ONLY: 'true' });

      await expect(service.getCost('u1', 'user', dto({}))).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('PRO'),
      });
      expect(recipes.findOne).not.toHaveBeenCalled();

      recipes.findOne.mockResolvedValue({ id: RID, ingredients: [] });
      await expect(service.getCost('u1', 'vip', dto({}))).resolves.toBe(BREAKDOWN);
    });

    it('开：FREE 拒绝用 ForbiddenException（403 而非 401——401 会触发客户端强制登出）', async () => {
      await makeService({ COST_PRO_ONLY: 'true' });
      await expect(service.getCost('u1', 'user', dto({}))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('关（默认）：FREE 正常通过', async () => {
      recipes.findOne.mockResolvedValue({ id: RID, ingredients: [] });
      await expect(service.getCost('u1', 'user', dto({}))).resolves.toBe(BREAKDOWN);
    });
  });
});
