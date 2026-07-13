import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination.dto';
import { Category } from '../categories/entities/category.entity';
import {
  CreateUserIngredientDto,
  ListUserIngredientsDto,
  UpdateUserIngredientDto,
} from './dto/user-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import { UserIngredient } from './entities/user-ingredient.entity';

@Injectable()
export class UserIngredientsService {
  constructor(
    @InjectRepository(UserIngredient)
    private readonly repo: Repository<UserIngredient>,
    @InjectRepository(Ingredient)
    private readonly publicIngs: Repository<Ingredient>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  async list(userId: string, query: ListUserIngredientsDto) {
    const { page = 1, pageSize = 20, categoryId } = query;
    const where: Record<string, unknown> = { userId };
    if (categoryId != null) where.categoryId = categoryId;
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const enriched = await this.enrich(items);
    return paginate(enriched, total, page, pageSize);
  }

  /**
   * Enrich UserIngredient rows with:
   *   - publicName  (from ingredients table)
   *   - categoryName (from categories table, using item.categoryId directly)
   */
  private async enrich(items: UserIngredient[]) {
    // 1) public ingredient names
    const publicIds = items
      .map((i) => i.ingredientId)
      .filter((v): v is number => typeof v === 'number');
    const pubs =
      publicIds.length > 0
        ? await this.publicIngs.find({ where: { id: In(Array.from(new Set(publicIds))) } })
        : [];
    const pubById = new Map(pubs.map((p) => [p.id, p]));

    // 2) category names (from items' own categoryId)
    const catIds = Array.from(
      new Set(items.map((i) => i.categoryId).filter((v): v is number => typeof v === 'number')),
    );
    const cats =
      catIds.length > 0 ? await this.categories.find({ where: { id: In(catIds) } as any }) : [];
    const catById = new Map(cats.map((c) => [c.id, c]));

    return items.map((i) => {
      const pub = i.ingredientId != null ? pubById.get(i.ingredientId) : undefined;
      const cat = i.categoryId != null ? catById.get(i.categoryId) : undefined;
      return {
        ...i,
        publicName: pub?.name ?? null,
        categoryId: i.categoryId ?? null,
        categoryName: cat?.name ?? null,
      };
    });
  }

  async findOne(userId: string, id: number) {
    const item = await this.repo.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException('UserIngredient not found');
    return item;
  }

  async findOneEnriched(userId: string, id: number) {
    const item = await this.findOne(userId, id);
    const [enriched] = await this.enrich([item]);
    return enriched;
  }

  async create(userId: string, dto: CreateUserIngredientDto) {
    if (!dto.ingredientId && !dto.customName) {
      throw new BadRequestException('Either ingredientId or customName is required');
    }

    // 自动推断 categoryId：
    //   - 如果前端传了 categoryId → 直接用
    //   - 否则如果关联公共食材 → 从公共食材的 categoryId 继承
    let categoryId: number | null = dto.categoryId ?? null;
    if (categoryId == null && dto.ingredientId) {
      const pub = await this.publicIngs.findOne({ where: { id: dto.ingredientId } });
      if (pub?.categoryId) categoryId = pub.categoryId;
    }

    const entity = this.repo.create({
      userId,
      ingredientId: dto.ingredientId ?? null,
      customName: dto.customName ?? null,
      unitPrice: dto.unitPrice.toFixed(4),
      priceUnit: dto.priceUnit,
      stockAmount: dto.stockAmount?.toFixed(2) ?? null,
      stockUnit: dto.stockUnit ?? null,
      notes: dto.notes ?? null,
      expiryDate: dto.expiryDate ?? null,
      storageType: dto.storageType ?? null,
      categoryId,
    });
    const saved = await this.repo.save(entity);
    const [enriched] = await this.enrich([saved]);
    return enriched;
  }

  async update(userId: string, id: number, dto: UpdateUserIngredientDto) {
    const item = await this.findOne(userId, id);
    if (dto.ingredientId !== undefined) item.ingredientId = dto.ingredientId ?? null;
    if (dto.customName !== undefined) item.customName = dto.customName ?? null;
    if (dto.unitPrice !== undefined) item.unitPrice = dto.unitPrice.toFixed(4);
    if (dto.priceUnit !== undefined) item.priceUnit = dto.priceUnit;
    if (dto.stockAmount !== undefined) item.stockAmount = dto.stockAmount?.toFixed(2) ?? null;
    if (dto.stockUnit !== undefined) item.stockUnit = dto.stockUnit ?? null;
    if (dto.notes !== undefined) item.notes = dto.notes ?? null;
    if (dto.expiryDate !== undefined) item.expiryDate = dto.expiryDate ?? null;
    if (dto.storageType !== undefined) item.storageType = dto.storageType ?? null;
    if (dto.categoryId !== undefined) item.categoryId = dto.categoryId ?? null;
    const saved = await this.repo.save(item);
    const [enriched] = await this.enrich([saved]);
    return enriched;
  }

  async remove(userId: string, id: number) {
    const item = await this.findOne(userId, id);
    await this.repo.remove(item);
    return { id };
  }
}
