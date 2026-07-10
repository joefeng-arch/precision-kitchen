import type { CreateUserIngredientRequest } from '@/lib/api/types';

export interface PantryFormState {
  /** 选中公共建议后锁定的 id；自由文本时为 null */
  ingredientId: number | null;
  /** 展示名：选中建议时是建议名，否则是自由输入（→ customName） */
  name: string;
  unitPrice: string;
  priceUnit: string;
  stockAmount: string;
  stockUnit: string;
  categoryId: number | null;
  notes: string;
}

export const emptyPantryForm: PantryFormState = {
  ingredientId: null,
  name: '',
  unitPrice: '',
  priceUnit: 'g',
  stockAmount: '',
  stockUnit: '',
  categoryId: null,
  notes: '',
};

export type PantryFormErrors = Partial<
  Record<'name' | 'unitPrice' | 'priceUnit' | 'stockAmount', string>
>;

export type BuildResult =
  | { ok: true; body: CreateUserIngredientRequest }
  | { ok: false; errors: PantryFormErrors };

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** 表单 state（全 string 输入）→ 契约 §10 请求体（number）。镜像服务端校验，提前挡 400。 */
export function buildPantryBody(state: PantryFormState): BuildResult {
  const errors: PantryFormErrors = {};

  const name = state.name.trim();
  if (state.ingredientId == null && !name) {
    errors.name = 'Pick a suggestion or type an ingredient name';
  }

  const unitPrice = Number(state.unitPrice);
  if (state.unitPrice.trim() === '' || !Number.isFinite(unitPrice) || unitPrice < 0) {
    errors.unitPrice = 'Enter a price of 0 or more';
  }

  const priceUnit = state.priceUnit.trim();
  if (!priceUnit) {
    errors.priceUnit = 'Unit is required';
  }

  let stockAmount: number | undefined;
  if (state.stockAmount.trim() !== '') {
    const parsed = Number(state.stockAmount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.stockAmount = 'Stock must be 0 or more';
    } else {
      stockAmount = round(parsed, 2);
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const body: CreateUserIngredientRequest = {
    unitPrice: round(unitPrice, 4), // 服务端 maxDecimalPlaces: 4
    priceUnit,
  };
  if (state.ingredientId != null) body.ingredientId = state.ingredientId;
  else body.customName = name;
  if (stockAmount !== undefined) {
    body.stockAmount = stockAmount;
    body.stockUnit = state.stockUnit.trim() || priceUnit;
  }
  if (state.categoryId != null) body.categoryId = state.categoryId;
  const notes = state.notes.trim();
  if (notes) body.notes = notes;

  return { ok: true, body };
}
