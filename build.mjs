/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-argument, no-underscore-dangle */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve as pathResolve } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { buildSync } from 'esbuild';
import cpy from 'cpy';

import colors from '@colors/colors/safe.js';
const { blue, green } = colors;

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
    await cpy('bin', pathResolve(CONFIG.distPath, 'bin'), { flat: false });
    await cpy('package.json', CONFIG.distPath, { flat: true });
    await cpy('README.md', CONFIG.distPath, { flat: true });
    await cpy('LICENSE', CONFIG.distPath, { flat: true });
};

const execCmd = (cmd, opts) => new Promise((resolve, reject) => {
    exec(cmd, opts, (err, stdout, stderr) => {
        if (err) {
            console.error(stdout, stderr);
            return reject(err);
        }
        return resolve(stdout);
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
        console.log(blue('Building Library\n'));

        // Build index entry point
        console.log('-'.repeat(78));
        console.log(`Building entry point '${pkgJson.name}/index'`);
        console.log('-'.repeat(78));
        console.log(`${green('✓')} Bundling to CJS`);
        build(pathResolve(__dirname, 'src', 'index.ts'), 'node', 'cjs');
        console.log(`${green('✓')} Built ${pkgJson.name}/index`, '\n');

        // Build cli entry point
        console.log('-'.repeat(78));
        console.log(`Building entry point '${pkgJson.name}/cli'`);
        console.log('-'.repeat(78));
        console.log(`${green('✓')} Bundling to CJS`);
        build(pathResolve(__dirname, 'src', 'cli.ts'), 'node', 'cjs');
        console.log(`${green('✓')} Built ${pkgJson.name}/cli`, '\n');

        // Build library
        console.log('-'.repeat(78));
        console.log(`Building '${pkgJson.name}'`);
        console.log('-'.repeat(78));

        //  -- types
        console.log(`${green('✓')} Generating types`);
        await execCmd(`tsc --project ${CONFIG.tsconfigPath}`);

        //  -- assets
        console.log(`${green('✓')} Copying assets`);
        await copyAssets();

        //  -- package.json
        console.log(`${green('✓')} Writing package metadata`);
        const distPkgJsonPath = pathResolve(CONFIG.distPath, 'package.json');
        const distPkgJson = JSON.parse(readFileSync(distPkgJsonPath, { encoding: 'utf8' }));
        delete distPkgJson.scripts;
        delete distPkgJson.devDependencies;
        writeFileSync(distPkgJsonPath, JSON.stringify(distPkgJson, null, 4), { encoding: 'utf8' });

        //  -- end
        console.log(`${green('✓')} Built ${pkgJson.name}\n`);

        // Success
        console.log(green('-'.repeat(78)));
        console.log(green('Built Library'));
        console.log(green(`- from: ${__dirname}`));
        console.log(green(`- to:   ${CONFIG.distPath}`));
        console.log(green('-'.repeat(78)));

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
