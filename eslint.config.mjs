import { defineConfig } from 'eslint/config';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import tsEslintPlugin from 'typescript-eslint';
import stylisticPlugin from '@stylistic/eslint-plugin';
import preferArrowPlugin from 'eslint-plugin-prefer-arrow';
import eslintJs from '@eslint/js';
import globals from 'globals';

export default defineConfig(
    eslintJs.configs.recommended,
    ...tsEslintPlugin.configs.strictTypeChecked,
    ...tsEslintPlugin.configs.stylisticTypeChecked,
    jsdocPlugin.configs['flat/recommended-typescript'],
    {
        ignores: ['jasmine.helper.js', '**/*.spec.ts']
    },
    {
        files: ['**/*.{ts,js,mjs,cjs}'],

        plugins: {
            'prefer-arrow': preferArrowPlugin,
            '@stylistic': stylisticPlugin
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            ecmaVersion: 5,
            sourceType: 'module',
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.js', '*.mjs']
                },
                tsconfigRootDir: import.meta.dirname
            }
        },

        rules: {
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/adjacent-overload-signatures': 'error',
            '@typescript-eslint/array-type': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'error',
            '@typescript-eslint/no-wrapper-object-types': 'error',
            '@typescript-eslint/no-empty-object-type': 'error',
            '@typescript-eslint/consistent-type-assertions': 'error',
            '@typescript-eslint/dot-notation': 'off',

            'jsdoc/check-tag-names': ['error', {
                definedTags: ['pkgscope:registry']
            }],

            '@stylistic/indent': ['error', 4, {
                SwitchCase: 1,

                FunctionDeclaration: {
                    parameters: 'first',
                },

                FunctionExpression: {
                    parameters: 'first',
                },
            }],

            '@stylistic/member-delimiter-style': ['error', {
                multiline: {
                    delimiter: 'semi',
                    requireLast: true,
                },

                singleline: {
                    delimiter: 'semi',
                    requireLast: false,
                },
            }],

            '@typescript-eslint/member-ordering': 'error',

            '@typescript-eslint/naming-convention': ['warn', {
                selector: 'variable',
                format: ['camelCase'],
            }],

            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-empty-interface': 'error',
            '@typescript-eslint/no-explicit-any': 'off',

            '@typescript-eslint/no-inferrable-types': ['error', {
                ignoreParameters: true,
            }],

            '@typescript-eslint/no-misused-new': 'error',
            '@typescript-eslint/no-namespace': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',

            '@typescript-eslint/no-shadow': ['error', {
                hoist: 'all',
            }],

            '@typescript-eslint/no-unused-expressions': 'error',
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/prefer-for-of': 'error',
            '@typescript-eslint/prefer-function-type': 'error',
            '@typescript-eslint/prefer-namespace-keyword': 'error',
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/semi': ['error', 'always'],

            '@typescript-eslint/triple-slash-reference': ['error', {
                path: 'always',
                types: 'prefer-import',
                lib: 'always',
            }],

            '@stylistic/type-annotation-spacing': 'error',
            '@typescript-eslint/unified-signatures': 'error',
            'arrow-body-style': 'off',
            complexity: 'off',
            'constructor-super': 'error',
            curly: 'error',
            'eol-last': 'error',
            eqeqeq: ['error', 'smart'],
            'guard-for-in': 'error',

            'id-blacklist': [
                'error',
                'any',
                'Number',
                'number',
                'String',
                'string',
                'Boolean',
                'boolean',
                'Undefined',
                'undefined',
            ],

            'id-match': 'error',
            'jsdoc/check-alignment': 'error',
            'jsdoc/check-indentation': 'error',
            'jsdoc/no-types': 'error',
            'max-classes-per-file': 'off',

            'max-len': ['off', {
                code: 140,
            }],

            'new-parens': 'error',
            'no-bitwise': 'error',
            'no-caller': 'error',
            'no-cond-assign': 'error',

            'no-console': ['error', {
                allow: [
                    'log',
                    'warn',
                    'dir',
                    'timeLog',
                    'assert',
                    'clear',
                    'count',
                    'countReset',
                    'group',
                    'groupEnd',
                    'table',
                    'info',
                    'dirxml',
                    'error',
                    'groupCollapsed',
                    'Console',
                    'profile',
                    'profileEnd',
                    'timeStamp',
                    'context',
                ],
            }],

            'no-debugger': 'error',
            'no-empty': 'off',
            'no-eval': 'error',
            'no-fallthrough': 'error',
            'no-invalid-this': 'off',
            'no-new-wrappers': 'error',
            'no-restricted-imports': ['error', 'rxjs/Rx'],
            'no-throw-literal': 'error',
            'no-trailing-spaces': 'error',
            'no-undef-init': 'error',
            'no-underscore-dangle': 'error',
            'no-unsafe-finally': 'error',
            'no-unused-labels': 'error',
            'no-var': 'error',
            'object-shorthand': 'error',
            'one-var': ['error', 'never'],
            'prefer-arrow/prefer-arrow-functions': 'error',
            'prefer-const': 'error',
            'quote-props': ['error', 'as-needed'],
            radix: 'error',

            'space-before-function-paren': ['error', {
                anonymous: 'never',
                asyncArrow: 'always',
                named: 'never',
            }],

            'spaced-comment': ['error', 'always', {
                markers: ['/'],
            }],

            'use-isnan': 'error',
            'valid-typeof': 'off',
        },
    }
);
