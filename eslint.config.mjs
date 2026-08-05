import hug from '@hug/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(
    hug.configs.stylistic.recommended,
    hug.configs.createModerate({
        angular: false,
        rxjs: false,
        rxjsAngular: false,
        cypress: false,
        noLoops: {
            rules: {
                'no-loops/no-loops': 'off',
            },
        },
    }),
);
