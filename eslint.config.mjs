// @ts-check
import base from '@hug/eslint-config/base';
import eslint from '@hug/eslint-config/eslint';
import jsdoc from '@hug/eslint-config/jsdoc';
import { json, jsonc } from '@hug/eslint-config/jsonc';
import noLoops from '@hug/eslint-config/no-loops';
import noSecrets from '@hug/eslint-config/no-secrets';
import preferArrow from '@hug/eslint-config/prefer-arrow';
import simpleImportSort from '@hug/eslint-config/simple-import-sort';
import stylistic from '@hug/eslint-config/stylistic';
import typescript from '@hug/eslint-config/typescript';
import unusedImports from '@hug/eslint-config/unused-imports';
import { defineConfig } from 'eslint/config';

export default defineConfig(
    base,
    stylistic.recommended,
    eslint.recommended,
    typescript.recommended,
    jsdoc.ts.recommended,
    json.recommended,
    jsonc.recommended,
    noLoops.createRecommended({
        rules: {
            'no-loops/no-loops': 'off',
        },
    }),
    preferArrow.recommended,
    simpleImportSort.recommended,
    unusedImports.recommended,
    noSecrets.recommended,
);
