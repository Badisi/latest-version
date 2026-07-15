import hug from '@hug/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(
    hug.configs.stylistic.recommended,
    hug.configs.createModerate({
        noLoops: {
            rules: {
                'no-loops/no-loops': 'off',
            },
        },
    }),
);
