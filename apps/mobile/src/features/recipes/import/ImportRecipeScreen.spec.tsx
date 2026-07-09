import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiClientError } from '@/lib/api/errors';
import type { ApiError, ParseTextResult } from '@/lib/api/types';

import { ImportRecipeScreen } from './ImportRecipeScreen';

// 手写替身：只 mock 路由与两个 mutation hook，组件/draftEdits 全跑真。
// 工厂在 import 阶段即执行（早于本文件顶层变量初始化），
// 所以用调用时才解引用的闭包，不能直接把 mock 对象塞进工厂返回值。
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));

const mockParse = { mutate: jest.fn(), isPending: false, error: null as unknown };
jest.mock('@/lib/api/hooks/useParseRecipeText', () => ({
  useParseRecipeText: () => mockParse,
}));

const mockCreate = { mutate: jest.fn(), isPending: false, error: null as unknown };
jest.mock('@/lib/api/hooks/useCreateRecipe', () => ({
  useCreateRecipe: () => mockCreate,
}));

function apiError(code: number, message: string): ApiClientError {
  return new ApiClientError({
    code,
    message,
    path: '/api/recipes/parse-text',
    timestamp: 'now',
  } as ApiError);
}

const BREAD_TEXT = '乡村面包：高筋面粉500g，水325g，盐10g，酵母5g。混合揉面发酵烘烤。';

const BREAD_RESULT: ParseTextResult = {
  parsed: true,
  confidence: 'high',
  warnings: [],
  originalText: BREAD_TEXT,
  recipe: {
    title: '乡村面包',
    description: '经典直接法',
    totalMinutes: 180,
    baseServings: 2,
    difficulty: 'medium',
    scalingProfile: 'bakers_percentage',
    baseAnchor: null,
    ingredients: [
      { name: '高筋面粉', amount: 500, unit: 'g', groupName: '主料', scaleType: 'linear', scalingRole: 'anchor', percentageValue: 100, ratioGroup: null, ratioValue: null },
      { name: '水', amount: 325, unit: 'g', groupName: '主料', scaleType: 'linear', scalingRole: 'percentage', percentageValue: 65, ratioGroup: null, ratioValue: null },
    ],
    steps: [{ stepNumber: 1, description: '混合揉面发酵烘烤', durationSeconds: null, warning: null }],
  },
};

const LOW_RESULT: ParseTextResult = {
  ...BREAD_RESULT,
  confidence: 'low',
  warnings: ['缩放：未能识别烘焙基准原料（anchor），已按普通线性配方处理'],
  recipe: {
    ...BREAD_RESULT.recipe,
    scalingProfile: 'linear_legacy',
    ingredients: BREAD_RESULT.recipe.ingredients.map((i) => ({
      ...i,
      scalingRole: null,
      percentageValue: null,
    })),
  },
};

async function typeAndParse(result: ParseTextResult) {
  mockParse.mutate.mockImplementation((_text, opts) => opts?.onSuccess?.(result));
  await render(<ImportRecipeScreen />);
  await fireEvent.changeText(
    screen.getByPlaceholderText('Paste your recipe here...'),
    BREAD_TEXT,
  );
  await fireEvent.press(screen.getByText('Parse recipe'));
}

describe('ImportRecipeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParse.error = null;
    mockParse.isPending = false;
    mockCreate.error = null;
    mockCreate.isPending = false;
  });

  it('粘贴页渲染；文本 <20 字不触发解析', async () => {
    await render(<ImportRecipeScreen />);
    expect(screen.getByText('Import recipe')).toBeTruthy();
    expect(screen.getByText('At least 20 characters')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByPlaceholderText('Paste your recipe here...'),
      '太短',
    );
    await fireEvent.press(screen.getByText('Parse recipe'));
    expect(mockParse.mutate).not.toHaveBeenCalled();
  });

  it('happy path：粘贴→解析→确认页（标题/profile chip/食材/步骤/Save 可见）', async () => {
    await typeAndParse(BREAD_RESULT);
    expect(mockParse.mutate).toHaveBeenCalledWith(BREAD_TEXT, expect.anything());
    await waitFor(() => {
      expect(screen.getByText('Confirm import')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('乡村面包')).toBeTruthy();
    expect(screen.getByText("Baker's %")).toBeTruthy();
    expect(screen.getByText('High confidence')).toBeTruthy();
    expect(screen.getByText('高筋面粉')).toBeTruthy();
    expect(screen.getByText('混合揉面发酵烘烤')).toBeTruthy();
    expect(screen.getByText('Save as draft')).toBeTruthy();
  });

  it('429 → 平静 callout（无报警红），普通错误样式不出现', async () => {
    mockParse.error = apiError(429, '调用过于频繁，每分钟最多 5 次，请稍后再试');
    await render(<ImportRecipeScreen />);
    expect(screen.getByTestId('rate-limit-callout')).toBeTruthy();
    expect(screen.getByText('调用过于频繁，每分钟最多 5 次，请稍后再试')).toBeTruthy();
    expect(screen.queryByTestId('parse-error')).toBeNull();
  });

  it('普通 400 → text-error 展示', async () => {
    mockParse.error = apiError(400, 'AI 服务未配置，请联系管理员设置 AI_API_KEY');
    await render(<ImportRecipeScreen />);
    expect(screen.getByTestId('parse-error')).toBeTruthy();
    expect(screen.queryByTestId('rate-limit-callout')).toBeNull();
  });

  it('low confidence → 醒目 callout + 中文 warnings 可见，无 confidence chip', async () => {
    await typeAndParse(LOW_RESULT);
    await waitFor(() => {
      expect(screen.getByTestId('low-confidence-callout')).toBeTruthy();
    });
    expect(screen.getByText('Low confidence')).toBeTruthy();
    expect(
      screen.getByText('• 缩放：未能识别烘焙基准原料（anchor），已按普通线性配方处理'),
    ).toBeTruthy();
    expect(screen.queryByText('High confidence')).toBeNull();
  });

  it('删非承重行 → 行消失、无降级提示', async () => {
    await typeAndParse(BREAD_RESULT);
    await waitFor(() => expect(screen.getByText('水')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Remove 水'));
    expect(screen.queryByText('水')).toBeNull();
    expect(screen.queryByTestId('downgrade-notice')).toBeNull();
    expect(screen.getByText("Baker's %")).toBeTruthy();
  });

  it('删 bakers anchor → 降级提示可见、profile chip 变 Servings', async () => {
    await typeAndParse(BREAD_RESULT);
    await waitFor(() => expect(screen.getByText('高筋面粉')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Remove 高筋面粉'));
    expect(screen.getByTestId('downgrade-notice')).toBeTruthy();
    expect(screen.getByText('Servings')).toBeTruthy();
    expect(screen.queryByText("Baker's %")).toBeNull();
  });

  it('保存：payload 抽查（customName/status/isPublic）→ router.replace 带新 id', async () => {
    mockCreate.mutate.mockImplementation((_body, opts) => opts?.onSuccess?.({ id: 'r-123' }));
    await typeAndParse(BREAD_RESULT);
    await waitFor(() => expect(screen.getByText('Save as draft')).toBeTruthy());

    await fireEvent.press(screen.getByText('Save as draft'));
    expect(mockCreate.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        isPublic: false,
        scalingProfile: 'bakers_percentage',
        ingredients: expect.arrayContaining([
          expect.objectContaining({ customName: '高筋面粉', scalingRole: 'anchor' }),
        ]),
      }),
      expect.anything(),
    );
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/recipe/[id]',
        params: { id: 'r-123' },
      });
    });
  });

  it('解析结果带步骤 warning → 确认页可见，保存 payload 透传', async () => {
    mockCreate.mutate.mockImplementation((_body, opts) => opts?.onSuccess?.({ id: 'r-9' }));
    await typeAndParse({
      ...BREAD_RESULT,
      recipe: {
        ...BREAD_RESULT.recipe,
        steps: [
          {
            stepNumber: 1,
            description: '混合揉面发酵烘烤',
            durationSeconds: null,
            warning: '前 25 分钟别开烤箱门',
          },
        ],
      },
    });
    await waitFor(() => {
      expect(screen.getByText('前 25 分钟别开烤箱门')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('Save as draft'));
    expect(mockCreate.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({ warning: '前 25 分钟别开烤箱门' }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('Back to text → 回粘贴页且原文保留', async () => {
    await typeAndParse(BREAD_RESULT);
    await waitFor(() => expect(screen.getByText('Back to text')).toBeTruthy());

    await fireEvent.press(screen.getByText('Back to text'));
    expect(screen.getByText('Import recipe')).toBeTruthy();
    expect(screen.getByDisplayValue(BREAD_TEXT)).toBeTruthy();
  });
});
