import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipe } from '../recipes/entities/recipe.entity';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { RevenueCatWebhookGuard } from './revenuecat-webhook.guard';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([Recipe])],
  controllers: [BillingController],
  providers: [BillingService, RevenueCatWebhookGuard],
})
export class BillingModule {}
