// ESLint 9 flat config —— 行为对齐迁移自 .eslintrc.js（NestJS 脚手架式配置）。
// 注意：旧配置从未启用 eslint:recommended 核心规则集，这里同样不引入，
// 避免迁移本身给业务代码带来新报错。
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: import.meta.dirname, // Node >= 20.11
        sourceType: 'module',
      },
      globals: { ...globals.node, ...globals.jest }, // 旧 env: { node, jest }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // v8 插件的 legacy preset rules map，等同旧 extends plugin:@typescript-eslint/recommended
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // 下划线前缀 = 故意未用（代码里已有 _opts/_content 等既定用法），旧配置漏配
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 旧配置里的 @typescript-eslint/interface-name-prefix 在 typescript-eslint v3
      // 就已移除（脚手架遗物），flat config 引用不存在的规则会报错——不迁移。
    },
  },
  // 置底：eslint-plugin-prettier 的 flat preset（含 config-prettier 冲突规则关闭 + prettier/prettier）
  prettierRecommended,
];
