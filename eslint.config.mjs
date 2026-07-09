import hug from '@hug/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(
    hug.configs.createModerate({
        noLoops: {
            rules: {
                'no-loops/no-loops': 'off',
            },
        },
    }),
);
