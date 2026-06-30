module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:@wordpress/eslint-plugin/recommended',
        'plugin:react/jsx-runtime',
    ],
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 12,
        sourceType: 'module',
    },
    rules: {
        // WordPress specific rules
        'no-console': 'warn',
        'no-debugger': 'error',

        // TypeScript specific rules
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',

        // Base no-unused-vars overlaps the TypeScript-aware rule above; kept at
        // the same warn level rather than the recommended error level.
        'no-unused-vars': 'warn',

        // Empty blocks (commonly intentional empty catch) are not errors.
        'no-empty': 'warn',

        // React specific rules
        'react/react-in-jsx-scope': 'off', // Not needed with React 17+
        'react/prop-types': 'off', // Using TypeScript for prop validation
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',

        // JSDoc is not required on admin JS/JSX (TypeScript carries type info);
        // the WordPress preset's strict JSDoc rules are disabled here.
        'jsdoc/require-param': 'off',
        'jsdoc/require-param-description': 'off',
        'jsdoc/require-returns': 'off',
        'jsdoc/require-returns-description': 'off',
        'jsdoc/check-tag-names': 'off',
        'jsdoc/check-line-alignment': 'off',
        'jsdoc/check-types': 'off',
        'jsdoc/no-undefined-types': 'off',

        // WordPress micro-optimization rule, not a correctness concern.
        '@wordpress/no-unused-vars-before-return': 'off',

        // no-shadow produces large numbers of false positives with TypeScript
        // and reused callback parameter names; disabled in favour of real
        // correctness rules below.
        'no-shadow': 'off',

        // Intentional stylistic patterns in this codebase; not treated as
        // errors. camelcase is off because REST payload keys are snake_case.
        'camelcase': 'off',
        'no-bitwise': 'off',
        'no-nested-ternary': 'off',

        // Often a false positive on optional-chaining call expressions; kept
        // visible as a warning rather than a blocking error.
        'no-unused-expressions': 'warn',

        // Real correctness rules kept at error level. The null exception
        // permits the deliberate `== null` (null-or-undefined) idiom.
        'no-undef': 'error',
        'eqeqeq': ['error', 'always', { null: 'ignore' }],

        // Settings labels are translated at runtime via __(), which the static
        // .pot extractor cannot see; surfaced as warnings pending a literal
        // string-registration pass rather than blocking the build.
        '@wordpress/i18n-no-variables': 'warn',
        '@wordpress/i18n-translator-comments': 'warn',

        // Formatting is owned entirely by Prettier (prettier/prettier via the
        // WordPress preset); ESLint stylistic rules are intentionally not set
        // here so the two never conflict.
    },
    settings: {
        react: {
            version: 'detect',
        },
    },
    globals: {
        wp: 'readonly',
        jQuery: 'readonly',
        ajaxurl: 'readonly',
        fotogridsAjax: 'readonly',
        fotogridsAdminHeader: 'readonly',
        // The non-bundled admin/plain scripts use the React global that
        // WordPress enqueues, rather than importing it.
        React: 'readonly',
    },
    ignorePatterns: [
        'dist/',
        'node_modules/',
        // Vendored third-party libraries are not linted as project source.
        'src/assets/**/vendor/**',
        '**/*.min.js',
    ],
};
