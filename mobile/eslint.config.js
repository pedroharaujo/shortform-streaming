// @ts-check
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: ['.expo/**', 'coverage/**', 'dist/**', 'node_modules/**'],
  },
  {
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']:not([property.name=/^EXPO_PUBLIC_/])",
          message:
            'Read only EXPO_PUBLIC_* variables in mobile source; other process.env values must not reach the bundle.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];
