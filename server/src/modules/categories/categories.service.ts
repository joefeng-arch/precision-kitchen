import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateCategoryDto, ListCategoriesDto, UpdateCategoryDto } from './dto/category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  /**
   * 列出分类。
   * - 未登录或不传 userId：只返回系统分类（ownerId=null）
   * - 传了 userId：系统分类 + 自己创建的
   */
  async list(query: ListCategoriesDto, viewerId?: string) {
    const { page = 1, pageSize = 50, keyword, type } = query;
    const baseWhere: Record<string, unknown> = {};
    if (type) baseWhere.type = type;
    if (keyword) baseWhere.name = ILike(`%${keyword}%`);

    const whereVariants = viewerId
      ? [
          { ...baseWhere, ownerId: IsNull() },
          { ...baseWhere, ownerId: viewerId },
        ]
      : [{ ...baseWhere, ownerId: IsNull() }];

    const [items, total] = await this.repo.findAndCount({
      where: whereVariants,
      order: { sort: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return paginate(items, total, page, pageSize);
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Category not found');
    return item;
  }

  /** admin 创建系统分类 */
  async create(dto: CreateCategoryDto) {
    const exists = await this.repo.findOne({
      where: { type: dto.type, name: dto.name, ownerId: IsNull() },
    });
    if (exists) throw new ConflictException('Category already exists');
    return this.repo.save(this.repo.create({ ...dto, ownerId: null }));
  }

  /** 普通用户创建自己的分类 */
  async createForUser(userId: string, dto: CreateCategoryDto) {
    const exists = await this.repo.findOne({
      where: { type: dto.type, name: dto.name, ownerId: userId },
    });
    if (exists) throw new ConflictException('你已经创建过同名分类');
    return this.repo.save(this.repo.create({ ...dto, ownerId: userId }));
  }

  async update(id: number, dto: UpdateCategoryDto, viewerId?: string, isAdmin = false) {
    const item = await this.findOne(id);
    if (!isAdmin && item.ownerId !== viewerId) {
      throw new ForbiddenException('Not your category');
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number, viewerId?: string, isAdmin = false) {
    const item = await this.findOne(id);
    if (!isAdmin && item.ownerId !== viewerId) {
      throw new ForbiddenException('Not your category');
    }
    await this.repo.remove(item);
    return { id };
  }
}
