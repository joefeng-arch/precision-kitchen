import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AdminUser } from '../../modules/admin/entities/admin-user.entity';
import { User } from '../../modules/users/entities/user.entity';

const SALT_ROUNDS = 10;

/**
 * Seed the super-admin account and the "老舅官方" virtual user.
 *
 * Super-admin: username=laojiu_admin
 * Password is read from env ADMIN_SEED_PASSWORD (see .env.example).
 * If the account already exists the seed is skipped entirely.
 *
 * Official user: nickname=老舅官方, no openid (cannot login to mini-app)
 */
export async function seedAdmin(ds: DataSource): Promise<void> {
  // ── 1. Super-admin account ─────────────────────────────────
  const adminRepo = ds.getRepository(AdminUser);
  const existing = await adminRepo.findOne({ where: { username: 'laojiu_admin' } });
  if (!existing) {
    const rawPassword = process.env.ADMIN_SEED_PASSWORD;
    if (!rawPassword || rawPassword === 'change-me-strong-password') {
      throw new Error(
        '[seed:admin] ADMIN_SEED_PASSWORD 未设置或仍为占位值。\n' +
          '请在 .env 中设置一个强密码后再运行 pnpm seed。',
      );
    }
    const hash = await bcrypt.hash(rawPassword, SALT_ROUNDS);
    await adminRepo.save(
      adminRepo.create({
        username: 'laojiu_admin',
        passwordHash: hash,
        nickname: '老舅',
        email: 'joefeng1998@gmail.com',
        role: 'super_admin',
      }),
    );
    console.log('[seed:admin] super-admin "laojiu_admin" created');
  } else {
    console.log('[seed:admin] super-admin already exists, skipped');
  }

  // ── 2. "老舅官方" virtual user (for official recipes) ──────
  const userRepo = ds.getRepository(User);
  // Look for the virtual user by the legacy seed openid OR by null openid + nickname
  let officialUser = await userRepo.findOne({ where: { openid: '__seed_system__' } });
  if (officialUser) {
    // Migrate: clear the openid so this user can never login via mini-app
    officialUser.openid = null;
    officialUser.nickname = '老舅官方';
    officialUser.role = 'user'; // no longer uses admin role
    await userRepo.save(officialUser);
    console.log('[seed:admin] migrated __seed_system__ → official user (cleared openid)');
  } else {
    // Check if already created with null openid
    const byNickname = await userRepo
      .createQueryBuilder('u')
      .where('u.openid IS NULL')
      .andWhere('u.nickname = :name', { name: '老舅官方' })
      .getOne();
    if (!byNickname) {
      await userRepo.save(
        userRepo.create({
          openid: null,
          nickname: '老舅官方',
          avatar: null, // TODO: set to official logo URL later
          role: 'user',
        }),
      );
      console.log('[seed:admin] "老舅官方" virtual user created');
    } else {
      console.log('[seed:admin] "老舅官方" virtual user already exists, skipped');
    }
  }
}
