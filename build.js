const { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } = require('fs');
const { resolve: pathResolve } = require('path');
const { green, magenta } = require('colors/safe');
const { exec } = require('child_process');
const cpy = require('cpy');

const DIST_PATH = pathResolve(__dirname, 'dist');
const LIB_ASSETS = [
    pathResolve(__dirname, 'README.md'),
    pathResolve(__dirname, 'LICENSE'),
    pathResolve(__dirname, 'package.json')
];

const log = str => console.log(magenta(str));

const execCmd = (cmd, opts) => new Promise((resolve, reject) => {
    exec(cmd, opts, (err, stdout, stderr) => {
        if (err) {
            console.error(stdout, stderr);
            return reject(err);
        }
        return resolve(stdout);
    });
});

const cleanDir = path => new Promise(resolve => {
    const exists = existsSync(path);
    if (exists) {
        rmSync(path, { recursive: true, cwd: __dirname });
    }
    // Gives time to rmSync to unlock the file on Windows
    setTimeout(() => {
        mkdirSync(path, { recursive: true, cwd: __dirname });
        resolve();
    }, exists ? 1000 : 0);
});

const copyAssets = () => cpy(
    LIB_ASSETS,
    DIST_PATH,
    {
        expandDirectories: true
    }
);

const customizePackageJson = async () => {
    const pkgJsonPath = pathResolve(DIST_PATH, 'package.json');
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, { encoding: 'utf8' }));
    delete pkgJson.scripts;
    delete pkgJson.devDependencies;
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), { encoding: 'utf8' });

    const pkgJsonCjsPath = pathResolve(DIST_PATH, 'cjs', 'package.json');
    writeFileSync(pkgJsonCjsPath, JSON.stringify({ type: 'commonjs' }, null, 4), { encoding: 'utf8' });

    const pkgJsonEsmPath = pathResolve(DIST_PATH, 'esm', 'package.json');
    writeFileSync(pkgJsonEsmPath, JSON.stringify({ type: 'module' }, null, 4), { encoding: 'utf8' });
};

const build = async () => {
    log('> Cleaning..');
    await cleanDir(DIST_PATH);

    log('> Building library..');
    await execCmd('tsc --project tsconfig-cjs.json', { cwd: __dirname });
    await execCmd('tsc --project tsconfig-esm.json', { cwd: __dirname });

    log('> Copying assets..');
    await copyAssets();

    log('> Customizing package.json..');
    await customizePackageJson();

    log(`> ${green('Done!')}\n`);
};

(async () => {
    try {
        await build();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
