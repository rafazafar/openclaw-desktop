import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['**/dist/**', '**/build/**', '**/out/**', '**/node_modules/**']
  }
];
