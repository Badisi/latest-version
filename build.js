const { existsSync, mkdirSync, rmSync, copySync } = require('fs-extra');
const { resolve: pathResolve } = require('path');
const { exec } = require('child_process');

const DIST_PATH = './dist';
const LIB_ASSETS = [
    'README.md',
    'LICENSE',
    'package.json'
];

function execCmd(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.error(stdout, stderr);
                return reject(err);
            }
            return resolve();
        });
    });
}

function clean(path) {
    if (existsSync(path)) {
        rmSync(path, { recursive: true });
    }
    mkdirSync(path, { recursive: true });
}

(async function main() {
    try {
        console.log('> Cleaning..');
        clean(DIST_PATH);

        console.log('> Transpiling..');
        await execCmd('tsc');

        console.log('> Copying assets..');
        LIB_ASSETS.forEach(file => copySync(file, pathResolve(DIST_PATH, file), { recursive: true }));

        console.log('> Done!');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
