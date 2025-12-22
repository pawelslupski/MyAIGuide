import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default [
  {
    ignores: ['node_modules', 'dist', 'supabase/functions']
  },
  // JS
  js.configs.recommended,
  // TypeScript 5
  ...tseslint.configs.recommended,
  // Vue 3.5 + <script setup>
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue}'],
    plugins: {
      prettier
    },
    rules: {
      // Prettier = jedyne źródło formatowania
      'prettier/prettier': 'error',
      // Vue / shadcn-vue
      'vue/multi-word-component-names': 'off',
      // TS + Supabase + AI DTOs
      '@typescript-eslint/no-explicit-any': 'off',
      // Pozwala ignorować nieużywane argumenty
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Vite / Vue 3
      'vue/no-v-html': 'off'
    }
  },
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser'
      }
    }
  },
  eslintConfigPrettier // tu: wyłącza wszystkie style kolidujące z Prettierem
]
