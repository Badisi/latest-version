/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-argument, no-underscore-dangle */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve as pathResolve } from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { styleText } from 'node:util';
import { cp } from 'node:fs/promises';
import { buildSync } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(readFileSync(pathResolve(__dirname, 'package.json')));

const CONFIG = {
    distPath: pathResolve(__dirname, 'dist'),
    tsconfigPath: pathResolve(__dirname, 'tsconfig.json'),
    buildOptions: {
        externals: Object.keys({ ...pkgJson.dependencies, ...pkgJson.peerDependencies })
    }
};

const copyAssets = async () => {
    await cp('bin', pathResolve(CONFIG.distPath, 'bin'), { recursive: true });
    await cp('package.json', pathResolve(CONFIG.distPath, 'package.json'));
    await cp('README.md', pathResolve(CONFIG.distPath, 'README.md'));
    await cp('LICENSE', pathResolve(CONFIG.distPath, 'LICENSE'));
};

const execCmd = (cmd, opts) => new Promise((resolve, reject) => {
    exec(cmd, opts, (err, stdout, stderr) => {
        if (err) {
            console.error(stdout, stderr);
            reject(err);
            return;
        }
        resolve(stdout);
    });
});

const build = (entryPoint, platform, format, bundleExternals = false, minify = false) => {
    const options = {
        platform,
        format: (platform === 'browser') ? 'iife' : format,
        absWorkingDir: __dirname,
        outdir: CONFIG.distPath,
        entryPoints: [entryPoint],
        tsconfig: CONFIG.tsconfigPath,
        bundle: true,
        sourcemap: false,
        minify,
        globalName: (bundleExternals) ? CONFIG.buildOptions.browser : undefined,
        // When compiling "cli.ts" do not embed "./index" = "index.js"
        external: (bundleExternals) ? undefined : [...CONFIG.buildOptions.externals, './index']
    };
    mkdirSync(CONFIG.distPath, { recursive: true });
    buildSync(options);
};

void (async () => {
    try {
        console.log(styleText('blue', 'Building Library\n'));

        // Build index entry point
        console.log('-'.repeat(78));
        console.log(`Building entry point '${pkgJson.name}/index'`);
        console.log('-'.repeat(78));
        console.log(`${styleText('green', '✓')} Bundling to CJS`);
        build(pathResolve(__dirname, 'src', 'index.ts'), 'node', 'cjs');
        console.log(`${styleText('green', '✓')} Built ${pkgJson.name}/index`, '\n');

        // Build cli entry point
        console.log('-'.repeat(78));
        console.log(`Building entry point '${pkgJson.name}/cli'`);
        console.log('-'.repeat(78));
        console.log(`${styleText('green', '✓')} Bundling to CJS`);
        build(pathResolve(__dirname, 'src', 'cli.ts'), 'node', 'cjs');
        console.log(`${styleText('green', '✓')} Built ${pkgJson.name}/cli`, '\n');

        // Build library
        console.log('-'.repeat(78));
        console.log(`Building '${pkgJson.name}'`);
        console.log('-'.repeat(78));

        //  -- types
        console.log(`${styleText('green', '✓')} Generating types`);
        await execCmd(`tsc --project ${CONFIG.tsconfigPath}`);

        //  -- assets
        console.log(`${styleText('green', '✓')} Copying assets`);
        await copyAssets();

        //  -- package.json
        console.log(`${styleText('green', '✓')} Writing package metadata`);
        const distPkgJsonPath = pathResolve(CONFIG.distPath, 'package.json');
        const distPkgJson = JSON.parse(readFileSync(distPkgJsonPath, { encoding: 'utf8' }));
        delete distPkgJson.scripts;
        delete distPkgJson.devDependencies;
        writeFileSync(distPkgJsonPath, JSON.stringify(distPkgJson, null, 4), { encoding: 'utf8' });

        //  -- end
        console.log(`${styleText('green', '✓')} Built ${pkgJson.name}\n`);

        // Success
        console.log(styleText('green', '-'.repeat(78)));
        console.log(styleText('green', 'Built Library'));
        console.log(styleText('green', `- from: ${__dirname}`));
        console.log(styleText('green', `- to:   ${CONFIG.distPath}`));
        console.log(styleText('green', '-'.repeat(78)));

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
