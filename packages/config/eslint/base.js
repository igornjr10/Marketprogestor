/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['eslint:recommended'],
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist/', 'node_modules/', '.next/', 'coverage/'],
}
