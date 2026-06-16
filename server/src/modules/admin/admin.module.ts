import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { CookingLog } from '../cooking/entities/cooking-log.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { RecipeCategory } from '../recipes/entities/recipe-category.entity';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity';
import { RecipeStep } from '../recipes/entities/recipe-step.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { AdminUser } from './entities/admin-user.entity';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { RecipeParseService } from '../recipes/recipe-parse.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Recipe,
      RecipeIngredient,
      RecipeStep,
      RecipeCategory,
      CookingLog,
      Favorite,
      AdminUser,
      Ingredient,
      Category,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('ADMIN_JWT_SECRET') ??
          'admin-change-me-in-production',
        signOptions: {
          expiresIn: config.get<string>('ADMIN_JWT_EXPIRES_IN') ?? '12h',
          audience: 'admin',
        },
      }),
    }),
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminService, AdminJwtStrategy, RecipeParseService],
})
export class AdminModule {}
