import type { RecipeIngredient } from '@/lib/api/types';

// Groups preserve first-seen order (ingredients already arrive sorted by
// sort,id from the backend), sorted by `sort` within each group.
export function groupIngredients(
  ingredients: RecipeIngredient[],
): Array<[string | null, RecipeIngredient[]]> {
  const groups = new Map<string | null, RecipeIngredient[]>();
  for (const ing of ingredients) {
    const key = ing.groupName ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ing);
  }
  for (const list of groups.values()) list.sort((a, b) => a.sort - b.sort);
  return Array.from(groups.entries());
}
