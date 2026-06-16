import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that validates admin JWT tokens.
 * Uses the 'admin-jwt' Passport strategy (separate from mini-app 'jwt').
 */
@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {}
