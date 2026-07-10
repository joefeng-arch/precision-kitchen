import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Button, Screen, Typography } from '@/components/ui';
import { ApiClientError } from '@/lib/api/errors';
import { useCreateRecipe } from '@/lib/api/hooks/useCreateRecipe';
import { useParseRecipeText } from '@/lib/api/hooks/useParseRecipeText';
import type { ParsedRecipe, ParseTextResult } from '@/lib/api/types';

import { ConfirmView } from './ConfirmView';
import { deleteIngredient, toCreateRecipeRequest } from './draftEdits';

/**
 * AI 导入流：粘贴文本 → 解析 → 确认（改标题/删食材）→ 存草稿 → 跳详情。
 * 单路由双 phase：确认态不跨路由传参；Back to text 保留原文（重进确认需再解析，
 * 消耗一次 5次/分钟 限流额度——接受的取舍）。
 */
export function ImportRecipeScreen() {
  const [phase, setPhase] = useState<'paste' | 'confirm'>('paste');
  const [text, setText] = useState('');
  /** 解析结果原件（confidence/warnings 的不可变来源） */
  const [parseResult, setParseResult] = useState<ParseTextResult | null>(null);
  /** 可变工作副本（标题编辑、删食材作用于此） */
  const [draft, setDraft] = useState<ParsedRecipe | null>(null);
  /** 删除承重原料触发的客户端降级，sticky 展示 */
  const [downgraded, setDowngraded] = useState(false);

  const parse = useParseRecipeText();
  const create = useCreateRecipe();

  const handleParse = () => {
    parse.mutate(text, {
      onSuccess: (res) => {
        setParseResult(res);
        setDraft(res.recipe);
        setDowngraded(false);
        setPhase('confirm');
      },
    });
  };

  const handleDelete = (index: number) => {
    if (!draft) return;
    const result = deleteIngredient(draft, index);
    setDraft(result.recipe);
    if (result.downgraded) setDowngraded(true);
  };

  const handleSave = () => {
    if (!draft) return;
    create.mutate(toCreateRecipeRequest(draft), {
      onSuccess: (saved) => {
        // replace：返回时不落在已消费的确认页
        router.replace({ pathname: '/recipe/[id]', params: { id: saved.id } });
      },
    });
  };

  if (phase === 'confirm' && draft && parseResult) {
    return (
      <ConfirmView
        draft={draft}
        confidence={parseResult.confidence}
        warnings={parseResult.warnings}
        downgraded={downgraded}
        saving={create.isPending}
        saveError={create.error}
        onChangeTitle={(title) => setDraft({ ...draft, title })}
        onDeleteIngredient={handleDelete}
        onBack={() => setPhase('paste')}
        onSave={handleSave}
      />
    );
  }

  const trimmedLen = text.trim().length;
  const parseError = parse.error;
  const isRateLimited = parseError instanceof ApiClientError && parseError.code === 429;
  // 403 = 月度配额用尽（区别于 429 分钟限流）→ 引导升级 PRO
  const isQuotaExhausted = parseError instanceof ApiClientError && parseError.code === 403;

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 16 }}
      >
        <Typography variant="headlineMd">Import recipe</Typography>
        <Typography variant="bodyMd" className="text-on-surface-variant">
          Paste a recipe — title, ingredients, and steps.
        </Typography>

        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={5000}
          placeholder="Paste your recipe here..."
          placeholderTextColor="#877365"
          className="h-64 w-full rounded-lg bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface"
          // textAlignVertical 不走 className：NativeWind 对该属性映射不可靠（Android 需置顶）
          style={{ textAlignVertical: 'top' }}
        />
        <Typography variant="bodyMd" className="text-on-surface-variant">
          {trimmedLen < 20 ? 'At least 20 characters' : `${text.length} / 5000`}
        </Typography>

        {parseError != null && isRateLimited && (
          // 限流不是用户的错：平静展示，不用报警红
          <View testID="rate-limit-callout" className="rounded-lg bg-surface-container px-4 py-3">
            <Typography variant="bodyMd" className="text-on-surface-variant">
              {(parseError as ApiClientError).message}
            </Typography>
          </View>
        )}
        {parseError != null && isQuotaExhausted && (
          // 月度配额用尽：平静展示 + 升级入口（403 与 429 是不同语义）
          <View testID="quota-callout" className="gap-3 rounded-lg bg-surface-container px-4 py-3">
            <Typography variant="bodyMd" className="text-on-surface-variant">
              {(parseError as ApiClientError).message}
            </Typography>
            <Button
              variant="cta"
              label="Upgrade to PRO"
              onPress={() => router.push('/paywall')}
            />
          </View>
        )}
        {parseError != null && !isRateLimited && !isQuotaExhausted && (
          <Typography testID="parse-error" variant="bodyMd" className="text-error">
            {parseError instanceof ApiClientError ? parseError.message : String(parseError)}
          </Typography>
        )}

        <Button
          variant="primary"
          label={parse.isPending ? 'Parsing...' : 'Parse recipe'}
          disabled={trimmedLen < 20 || parse.isPending}
          onPress={handleParse}
        />
      </ScrollView>
    </Screen>
  );
}
