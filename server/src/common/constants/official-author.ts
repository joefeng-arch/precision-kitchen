/**
 * 官方配方虚拟作者的昵称（users 表，openid IS NULL）。
 * 海外上架走查改为品牌名（此前为 '老舅官方'——用户可见于每张配方卡的作者行）。
 * seedAdmin 会把旧昵称的存量行就地改名；所有查找方共用本常量，防止再漂移。
 */
export const OFFICIAL_AUTHOR_NICKNAME = 'Precision Kitchen';

/** 旧昵称（改名迁移用）；新库不会再创建 */
export const LEGACY_OFFICIAL_AUTHOR_NICKNAME = '老舅官方';
