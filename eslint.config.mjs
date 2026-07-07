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
    hug.configs.stylistic.createRecommended({
        rules: {
            // TODO: remove after new upgrade of @hug/eslint-config
            '@stylistic/max-statements-per-line': [
                'error', {
                    max: 2,
                },
            ],
        },
    }),
);
