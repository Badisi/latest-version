import latestVersion, { LatestVersionPackage } from './index';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import rewire from 'rewire';

interface Data {
    only: LatestVersionPackage;
    exactRange: LatestVersionPackage;
    minorRange: LatestVersionPackage;
    patchRange: LatestVersionPackage;
    collection: LatestVersionPackage[];
    json: LatestVersionPackage[];
}

const spyOnRequire = (id: string): jasmine.Spy => {
    const spy = jasmine.createSpy(id);
    const Mod = require('module');
    const ori = Mod.prototype.require;
    Mod.prototype.require = function () {
        return (arguments[0].indexOf(id) !== -1) ? spy() : ori.apply(this, arguments);
    };
    return spy;
};

const getData = async (): Promise<Data> => {
    return {
        only: await latestVersion('npm'),
        exactRange: await latestVersion('npm@5.0.2'),
        minorRange: await latestVersion('npm@^5.0.2'),
        patchRange: await latestVersion('npm@~5.0.2'),
        collection: await latestVersion(['npm', 'npm@1.3.2', '@scope/name@^5.0.2']),
        json: await latestVersion({
            dependencies: { 'npm': 'latest' },
            devDependencies: { 'npm': '1.3.2' },
            peerDependencies: { '@scope/name': '^5.0.2' }
        })
    } as Data;
};

describe('@badisi/latest-version', () => {
    let pkg: Data;
    let pkgInstalled: Data;
    let pkgNotInstalled: Data;

    beforeAll(async () => {
        pkg = await getData();
        spyOnRequire('npm/package.json').and.returnValue({ version: '5.0.2' });
        pkgInstalled = await getData();
        spyOnRequire('npm/package.json').and.returnValue({ version: undefined });
        pkgNotInstalled = await getData();
    });

    describe('Test "name"', () => {
        it('with package string', () => {
            expect(pkg.only.name).toBe('npm');
        });
        it('with package range', () => {
            expect(pkg.exactRange.name).toBe('npm');
            expect(pkg.minorRange.name).toBe('npm');
            expect(pkg.patchRange.name).toBe('npm');
        });
        it('with collection', () => {
            expect(pkg.collection[0].name).toBe('npm');
            expect(pkg.collection[1].name).toBe('npm');
            expect(pkg.collection[2].name).toBe('@scope/name');
        });
        it('with package json', () => {
            expect(pkg.json[0].name).toBe('npm');
            expect(pkg.json[1].name).toBe('npm');
            expect(pkg.json[2].name).toBe('@scope/name');
        });
    });

    describe('Test "range"', () => {
        it('with package string', () => {
            expect(pkg.only.range).toBe('latest');
        });
        it('with package range', () => {
            expect(pkg.exactRange.range).toBe('5.0.2');
            expect(pkg.minorRange.range).toBe('^5.0.2');
            expect(pkg.patchRange.range).toBe('~5.0.2');
        });
        it('with collection', () => {
            expect(pkg.collection[0].range).toBe('latest');
            expect(pkg.collection[1].range).toBe('1.3.2');
            expect(pkg.collection[2].range).toBe('^5.0.2');
        });
        it('with package json', () => {
            expect(pkg.json[0].range).toBe('latest');
            expect(pkg.json[1].range).toBe('1.3.2');
            expect(pkg.json[2].range).toBe('^5.0.2');
        });
    });

    describe('Test "installed"', () => {
        describe('..if package not installed', () => {
            it('with package string', () => {
                expect(pkgNotInstalled.only.installed).toBeUndefined();
            });
            it('with package range', () => {
                expect(pkgNotInstalled.exactRange.installed).toBeUndefined();
                expect(pkgNotInstalled.minorRange.installed).toBeUndefined();
                expect(pkgNotInstalled.patchRange.installed).toBeUndefined();
            });
            it('with collection', () => {
                expect(pkgNotInstalled.collection[0].installed).toBeUndefined();
                expect(pkgNotInstalled.collection[1].installed).toBeUndefined();
                expect(pkgNotInstalled.collection[2].installed).toBeUndefined();
            });
            it('with package json', () => {
                expect(pkgNotInstalled.json[0].installed).toBeUndefined();
                expect(pkgNotInstalled.json[1].installed).toBeUndefined();
                expect(pkgNotInstalled.json[2].installed).toBeUndefined();
            });
        });
        describe('..if package installed', () => {
            it('with package string', () => {
                expect(pkgInstalled.only.installed).toBe('5.0.2');
            });
            it('with package range', () => {
                expect(pkgInstalled.exactRange.installed).toBe('5.0.2');
                expect(pkgInstalled.minorRange.installed).toBe('5.0.2');
                expect(pkgInstalled.patchRange.installed).toBe('5.0.2');
            });
            it('with collection', () => {
                expect(pkgInstalled.collection[0].installed).toBe('5.0.2');
                expect(pkgInstalled.collection[1].installed).toBe('5.0.2');
                expect(pkgInstalled.collection[2].installed).toBeUndefined();
            });
            it('with package json', () => {
                expect(pkgInstalled.json[0].installed).toBe('5.0.2');
                expect(pkgInstalled.json[1].installed).toBe('5.0.2');
                expect(pkgInstalled.json[2].installed).toBeUndefined();
            });
        });
    });

    describe('Test "updateAvailable"', () => {
        describe('..if package not installed', () => {
            it('with package string', () => {
                expect(pkgNotInstalled.only.updateAvailable).toBe(false);
            });
            it('with package range', () => {
                expect(pkgNotInstalled.exactRange.updateAvailable).toBe(false);
                expect(pkgNotInstalled.minorRange.updateAvailable).toBe(false);
                expect(pkgNotInstalled.patchRange.updateAvailable).toBe(false);
            });
            it('with collection', () => {
                expect(pkgNotInstalled.collection[0].updateAvailable).toBe(false);
                expect(pkgNotInstalled.collection[1].updateAvailable).toBe(false);
                expect(pkgNotInstalled.collection[2].updateAvailable).toBe(false);
            });
            it('with package json', () => {
                expect(pkgNotInstalled.json[0].updateAvailable).toBe(false);
                expect(pkgNotInstalled.json[1].updateAvailable).toBe(false);
                expect(pkgNotInstalled.json[2].updateAvailable).toBe(false);
            });
        });
        describe('..if package installed', () => {
            it('with package string', () => {
                expect(pkgInstalled.only.updateAvailable).toBe(true);
            });
            it('with package range', () => {
                expect(pkgInstalled.exactRange.updateAvailable).toBe(false);
                expect(pkgInstalled.minorRange.updateAvailable).toBe(true);
                expect(pkgInstalled.patchRange.updateAvailable).toBe(true);
            });
            it('with collection', () => {
                expect(pkgInstalled.collection[0].updateAvailable).toBe(true);
                expect(pkgInstalled.collection[1].updateAvailable).toBe(false);
                expect(pkgInstalled.collection[2].updateAvailable).toBe(false);
            });
            it('with package json', () => {
                expect(pkgInstalled.json[0].updateAvailable).toBe(true);
                expect(pkgInstalled.json[1].updateAvailable).toBe(false);
                expect(pkgInstalled.json[2].updateAvailable).toBe(false);
            });
        });
    });

    describe('Test "latest"', () => {
        it('with package string', () => {
            expect(pkg.only.latest).toBeDefined();
        });
        it('with package range', () => {
            expect(pkg.exactRange.latest).toBe(pkg.only.latest);
            expect(pkg.minorRange.latest).toBe(pkg.only.latest);
            expect(pkg.patchRange.latest).toBe(pkg.only.latest);
        });
        it('with collection', () => {
            expect(pkg.collection[0].latest).toBe(pkg.only.latest);
            expect(pkg.collection[1].latest).toBe(pkg.only.latest);
            expect(pkg.collection[2].latest).toBeUndefined();
        });
        it('with package json', () => {
            expect(pkg.json[0].latest).toBe(pkg.only.latest);
            expect(pkg.json[1].latest).toBe(pkg.only.latest);
            expect(pkg.json[2].latest).toBeUndefined();
        });
    });

    describe('Test "latestRange"', () => {
        it('with package string', () => {
            expect(pkg.only.latestRange).toBe(pkg.only.latest);
        });
        it('with package range', () => {
            expect(pkg.exactRange.latestRange).toBe('5.0.2');
            expect(pkg.minorRange.latestRange).toBe('5.10.0');
            expect(pkg.patchRange.latestRange).toBe('5.0.4');
        });
        it('with collection', () => {
            expect(pkg.collection[0].latestRange).toBe(pkg.json[0].latest);
            expect(pkg.collection[1].latestRange).toBe('1.3.2');
            expect(pkg.collection[2].latestRange).toBeUndefined();
        });
        it('with package json', () => {
            expect(pkg.json[0].latestRange).toBe(pkg.json[0].latest);
            expect(pkg.json[1].latestRange).toBe('1.3.2');
            expect(pkg.json[2].latestRange).toBeUndefined();
        });
    });

    describe('Test "error"', () => {
        describe('..if package not installed', () => {
            it('with package string', () => {
                expect(pkgInstalled.only.error).toBeUndefined();
            });
            it('with package range', () => {
                expect(pkgInstalled.exactRange.error).toBeUndefined();
                expect(pkgInstalled.minorRange.error).toBeUndefined();
                expect(pkgInstalled.patchRange.error).toBeUndefined();
            });
            it('with collection', () => {
                expect(pkgInstalled.collection[0].error).toBeUndefined();
                expect(pkgInstalled.collection[1].error).toBeUndefined();
                expect(pkgInstalled.collection[2].error).toBeDefined();
            });
            it('with package json', () => {
                expect(pkgInstalled.json[0].error).toBeUndefined();
                expect(pkgInstalled.json[1].error).toBeUndefined();
                expect(pkgInstalled.json[2].error).toBeDefined();
            });
        });
        describe('..if package installed', () => {
            it('with package string', () => {
                expect(pkgInstalled.only.error).toBeUndefined();
            });
            it('with package range', () => {
                expect(pkgInstalled.exactRange.error).toBeUndefined();
                expect(pkgInstalled.minorRange.error).toBeUndefined();
                expect(pkgInstalled.patchRange.error).toBeUndefined();
            });
            it('with collection', () => {
                expect(pkgInstalled.collection[0].error).toBeUndefined();
                expect(pkgInstalled.collection[1].error).toBeUndefined();
                expect(pkgInstalled.collection[2].error).toBeDefined();
            });
            it('with package json', () => {
                expect(pkgInstalled.json[0].error).toBeUndefined();
                expect(pkgInstalled.json[1].error).toBeUndefined();
                expect(pkgInstalled.json[2].error).toBeDefined();
            });
        });
    });

    describe('Test cache', () => {
        let cacheDir = rewire('./index').__get__('getCacheDir')();
        describe('..if useCache=false', () => {
            let pkg: LatestVersionPackage;
            beforeEach(async () => {
                rmSync(cacheDir, { recursive: true, force: true });
                pkg = await latestVersion('npm');
            });
            it('no cache should be created', async () => {
                expect(existsSync(join(cacheDir, 'npm.json'))).toBe(false);
                expect(pkg).toBeDefined();
            });
        });
        describe('..if useCache=true', () => {
            let pkg: LatestVersionPackage;
            beforeEach(async () => {
                rmSync(cacheDir, { recursive: true, force: true });
                pkg = await latestVersion('npm', { useCache: true });
            });
            it('first call -> data should be undefined and returned immediately', () => {
                expect(pkg).toBeDefined();
                expect(pkg.name).toBe('npm');
                expect(pkg.latest).toBeUndefined();
                expect(pkg.latestRange).toBeUndefined();
            });
            it('first call -> a cache file should be created', () => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        expect(existsSync(join(cacheDir, 'npm.json'))).toBe(true);
                        resolve(null);
                    }, 500);
                });
            });
            it('second call -> data should be defined and returned immediately', async () => {
                return new Promise((resolve) => {
                    setTimeout(async () => {
                        pkg = await latestVersion('npm', { useCache: true });
                        expect(pkg).toBeDefined();
                        expect(pkg.name).toBe('npm');
                        expect(pkg.latest).toBeDefined();
                        expect(pkg.latestRange).toBeDefined();
                        resolve(null);
                    }, 500);
                });
            });
        });
        describe('..if cacheMaxAge=0', () => {
            let pkg: LatestVersionPackage;
            beforeEach(async () => {
                rmSync(cacheDir, { recursive: true, force: true });
                pkg = await latestVersion('npm', { useCache: true });
            });
            it('second call with cacheMaxAge=0 -> data should be undefined and returned immediately', async () => {
                return new Promise((resolve) => {
                    setTimeout(async () => {
                        pkg = await latestVersion('npm', { useCache: true, cacheMaxAge: 0 });
                        expect(pkg).toBeDefined();
                        expect(pkg.name).toBe('npm');
                        expect(pkg.latest).toBeUndefined();
                        expect(pkg.latestRange).toBeUndefined();
                        resolve(null);
                    }, 500);
                });
            });
            it('second call with cacheMaxAge=0 -> lastUpdateDate should be updated', async () => {
                return new Promise((resolve) => {
                    setTimeout(async () => {
                        const { lastUpdateDate: before } = JSON.parse(readFileSync(join(cacheDir, 'npm.json')).toString());
                        pkg = await latestVersion('npm', { useCache: true, cacheMaxAge: 0 });
                        setTimeout(() => {
                            const { lastUpdateDate: after } = JSON.parse(readFileSync(join(cacheDir, 'npm.json')).toString());
                            expect(before).toBeLessThan(after);
                            resolve(null);
                        }, 500);
                    }, 500);
                });
            });
        });
    });
});
