import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { RecipesController } from './recipes.controller';
import { ScaleRequestDto } from './dto/scale.dto';

function makeController(scalingOverrides: Record<string, jest.Mock> = {}) {
  const scaling = {
    scale: jest.fn(),
    scaleWithSpec: jest.fn(),
    ...scalingOverrides,
  } as any;
  const controller = new RecipesController({} as any, scaling, {} as any);
  return { controller, scaling };
}

describe('RecipesController POST :id/scale', () => {
  const dto = plainToInstance(ScaleRequestDto, {
    profile: 'bakers_percentage',
    bakersLock: { mode: 'anchor', value: 1000 },
  });

  it('调 scaleWithSpec(id, dto.toScaleSpec()) 并返回结果', async () => {
    const result = { recipeId: 'r1', ingredients: [] };
    const { controller, scaling } = makeController({
      scaleWithSpec: jest.fn().mockResolvedValue(result),
    });

    const out = await controller.scaleWithProfile('r1', dto);

    expect(scaling.scaleWithSpec).toHaveBeenCalledWith('r1', {
      profile: 'bakers_percentage',
      lock: { mode: 'anchor', value: 1000 },
    });
    expect(out).toBe(result);
  });

  it('引擎普通 Error → BadRequestException（400）', async () => {
    const { controller } = makeController({
      scaleWithSpec: jest.fn().mockRejectedValue(new Error('requires an anchor')),
    });
    await expect(controller.scaleWithProfile('r1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('NotFoundException 原样透传（不被吞成 400）', async () => {
    const { controller } = makeController({
      scaleWithSpec: jest.fn().mockRejectedValue(new NotFoundException('Recipe not found')),
    });
    await expect(controller.scaleWithProfile('r1', dto)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RecipesController GET :id/scale（不回归）', () => {
  it('仍调 scaling.scale(id, servings)', () => {
    const { controller, scaling } = makeController();
    controller.scale('r1', { servings: 4 } as any);
    expect(scaling.scale).toHaveBeenCalledWith('r1', 4);
  });
});

describe('RecipesController — tier 委托（订阅配额）', () => {
  it('parseText 把 user.role 作为 tier 传给 parseService', async () => {
    const parse = { parseText: jest.fn().mockResolvedValue({ parsed: true }) } as any;
    const controller = new RecipesController({} as any, {} as any, parse);
    await controller.parseText({ sub: 'u1', role: 'vip' } as any, { text: 'x'.repeat(30) } as any);
    expect(parse.parseText).toHaveBeenCalledWith('u1', 'x'.repeat(30), { tier: 'vip' });
  });

  it('create 把 user.role 作为第三参传给 service', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'r1' }) } as any;
    const controller = new RecipesController(service, {} as any, {} as any);
    const dto = { title: 't', ingredients: [], steps: [] } as any;
    await controller.create({ sub: 'u1', role: 'user' } as any, dto);
    expect(service.create).toHaveBeenCalledWith('u1', dto, 'user');
  });
});
