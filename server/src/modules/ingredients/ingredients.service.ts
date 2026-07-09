import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination.dto';
import { Category } from '../categories/entities/category.entity';
import { CreateIngredientDto, ListIngredientsDto, UpdateIngredientDto } from './dto/ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly repo: Repository<Ingredient>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  async list(query: ListIngredientsDto) {
    const { page = 1, pageSize = 20, keyword, categoryId } = query;
    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (keyword) where.name = ILike(`%${keyword}%`);

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { sort: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // enrich with categoryName so frontend autocomplete can show it
    const catIds = Array.from(
      new Set(items.map((i) => i.categoryId).filter((v): v is number => typeof v === 'number')),
    );
    const cats =
      catIds.length > 0 ? await this.categories.find({ where: { id: In(catIds) } as any }) : [];
    const catById = new Map(cats.map((c) => [c.id, c]));
    const enriched = items.map((i) => ({
      ...i,
      categoryName: i.categoryId != null ? (catById.get(i.categoryId)?.name ?? null) : null,
    }));
    return paginate(enriched, total, page, pageSize);
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Ingredient not found');
    return item;
  }

  async create(dto: CreateIngredientDto) {
    const exists = await this.repo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Ingredient already exists');
    const entity = this.repo.create({
      ...dto,
      referencePrice: dto.referencePrice?.toFixed(2) ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: number, dto: UpdateIngredientDto) {
    const item = await this.findOne(id);
    const patch: Partial<Ingredient> = { ...dto } as Partial<Ingredient>;
    if (dto.referencePrice !== undefined) {
      patch.referencePrice = dto.referencePrice.toFixed(2);
    }
    Object.assign(item, patch);
    return this.repo.save(item);
  }

  async remove(id: number) {
    const item = await this.findOne(id);
    await this.repo.remove(item);
    return { id };
  }
}
