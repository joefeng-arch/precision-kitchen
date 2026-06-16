import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { Recipe } from '../recipes/entities/recipe.entity';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favs: Repository<Favorite>,
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
  ) {}

  async toggle(userId: string, recipeId: string) {
    const exists = await this.favs.findOne({ where: { userId, recipeId } });
    if (exists) {
      await this.favs.remove(exists);
      return { recipeId, favorited: false };
    }
    const recipe = await this.recipes.findOne({ where: { id: recipeId } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    await this.favs.save(this.favs.create({ userId, recipeId }));
    return { recipeId, favorited: true };
  }

  async remove(userId: string, recipeId: string) {
    const exists = await this.favs.findOne({ where: { userId, recipeId } });
    if (!exists) throw new NotFoundException('Favorite not found');
    await this.favs.remove(exists);
    return { recipeId, favorited: false };
  }

  async list(userId: string, query: PaginationDto) {
    const { page = 1, pageSize = 20 } = query;
    const [favs, total] = await this.favs.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const recipeIds = favs.map((f) => f.recipeId);
    const recipes = recipeIds.length
      ? await this.recipes.find({ where: { id: In(recipeIds) } })
      : [];
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const items = favs.map((f) => ({
      id: f.id,
      recipeId: f.recipeId,
      favoritedAt: f.createdAt,
      recipe: byId.get(f.recipeId) ?? null,
    }));
    return paginate(items, total, page, pageSize);
  }

  async checkBatch(userId: string, recipeIds: string[]): Promise<Record<string, boolean>> {
    if (!recipeIds.length) return {};
    const hits = await this.favs.find({ where: { userId, recipeId: In(recipeIds) } });
    const set = new Set(hits.map((h) => h.recipeId));
    return Object.fromEntries(recipeIds.map((id) => [id, set.has(id)]));
  }
}
