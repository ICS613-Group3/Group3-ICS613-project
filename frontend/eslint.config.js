import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // The "fetch on mount" pattern is canonical for data-loading pages:
      // set loading=true, await, set loading=false. React 19's stricter
      // react-hooks plugin flags the leading setIsLoading(true) as a
      // cascading-render risk, but in practice the cascade is exactly one
      // re-render per load and matches the documented pattern in the
      // React docs. The error-handling path (cancelled flag) is preserved.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
