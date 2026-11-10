import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import cssModules from 'eslint-plugin-css-modules-next'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'css-modules': cssModules,
    },
    rules: {
      // 未使用変数を禁止（_から始まる引数・変数は除外）
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // 型安全の維持: anyの安易な使用を警告
      '@typescript-eslint/no-explicit-any': 'warn',

      // 型importの明示（バンドラ最適化と循環依存防止）
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],

      // CSS Modulesの整合性チェック（存在しないクラス参照はエラー）
      'css-modules/no-undefined-class': 'error',
      'css-modules/no-unused-class': 'off',

      // localStorageの直接呼び出しを禁止し、utils/storage.ts 経由を強制（storage.ts 自体は除外ルール適用）
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'localStorage を直接使用せず、src/utils/storage.ts のラッパー関数を使用してください。',
        },
      ],

      // デバッグコードの混入防止
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',

      // Vite HMR 用のコンポーネント分離ルール
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // utils/storage.ts は localStorage を直接管理する責務を持つため制限を除外
    files: ['src/utils/storage.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
])


