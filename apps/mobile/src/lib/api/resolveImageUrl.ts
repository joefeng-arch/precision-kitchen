const API_ORIGIN = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/api\/?$/, '');

/**
 * coverImage/imageUrl fields come back as null, a full external URL, or a
 * relative /uploads/xxx.png path served from the API's origin (not under /api).
 */
export function resolveImageUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
