import latestVersion, { LatestVersionPackage } from './index';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import rewire from 'rewire';

interface Data {
    empty: LatestVersionPackage;
    string: LatestVersionPackage;
    exactRange: LatestVersionPackage;
    minorRange: LatestVersionPackage;
    patchRange: LatestVersionPackage;
    collection: LatestVersionPackage[];
    collectionWOfOne: LatestVersionPackage[];
    collectionEmpty: LatestVersionPackage[];
    json: LatestVersionPackage[];
}

const spyOnRequire = (id: string): jasmine.Spy => {
    const spy = jasmine.createSpy(id);
    const Mod = require('module');
    const ori = Mod.prototype.require;
    Mod.prototype.require = function () {
        const convertedId = join(id); // use path.join to convert path separator (posix vs windows)
        return (arguments[0].indexOf(convertedId) !== -1) ? spy() : ori.apply(this, arguments);
    };
    return spy;
};

const getData = async (): Promise<Data> => {
    return {
        empty: await latestVersion(''),
        string: await latestVersion('npm'),
        exactRange: await latestVersion('npm@5.0.2'),
        minorRange: await latestVersion('npm@^5.0.2'),
        patchRange: await latestVersion('npm@~5.0.2'),
        collection: await latestVersion(['npm', 'npm@1.3.2', '@scope/name@^5.0.2']),
        collectionWOfOne: await latestVersion(['npm']),
        collectionEmpty: await latestVersion([]),
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

    describe('Test return objects', () => {
        it('with empty', () => {
            expect(pkg.empty).toBeUndefined();
        });
        it('with package string', () => {
            expect(Array.isArray(pkg.string)).toBe(false);
        });
        it('with package range', () => {
            expect(Array.isArray(pkg.exactRange)).toBe(false);
            expect(Array.isArray(pkg.minorRange)).toBe(false);
            expect(Array.isArray(pkg.patchRange)).toBe(false);
        });
        it('with collection', () => {
            expect(Array.isArray(pkg.collection)).toBe(true);
            expect(pkg.collection.length).toBe(3);
        });
        it('with collection of one', () => {
            expect(Array.isArray(pkg.collectionWOfOne)).toBe(true);
            expect(pkg.collectionWOfOne.length).toBe(1);
        });
        it('with collection empty', () => {
            expect(Array.isArray(pkg.collectionEmpty)).toBe(true);
            expect(pkg.collectionEmpty.length).toBe(0);
        });
        it('with package json', () => {
            expect(Array.isArray(pkg.json)).toBe(true);
            expect(pkg.json.length).toBe(3);
        });
    });

    describe('Test "name"', () => {
        it('with package string', () => {
            expect(pkg.string.name).toBe('npm');
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
            expect(pkg.string.range).toBe('latest');
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
                expect(pkgNotInstalled.string.installed).toBeUndefined();
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
                expect(pkgInstalled.string.installed).toBe('5.0.2');
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
                expect(pkgNotInstalled.string.updateAvailable).toBe(false);
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
                expect(pkgInstalled.string.updateAvailable).toBe(true);
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
            expect(pkg.string.latest).toBeDefined();
        });
        it('with package range', () => {
            expect(pkg.exactRange.latest).toBe(pkg.string.latest);
            expect(pkg.minorRange.latest).toBe(pkg.string.latest);
            expect(pkg.patchRange.latest).toBe(pkg.string.latest);
        });
        it('with collection', () => {
            expect(pkg.collection[0].latest).toBe(pkg.string.latest);
            expect(pkg.collection[1].latest).toBe(pkg.string.latest);
            expect(pkg.collection[2].latest).toBeUndefined();
        });
        it('with package json', () => {
            expect(pkg.json[0].latest).toBe(pkg.string.latest);
            expect(pkg.json[1].latest).toBe(pkg.string.latest);
            expect(pkg.json[2].latest).toBeUndefined();
        });
    });

    describe('Test "latestRange"', () => {
        it('with package string', () => {
            expect(pkg.string.latestRange).toBe(pkg.string.latest);
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
                expect(pkgInstalled.string.error).toBeUndefined();
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
                expect(pkgInstalled.string.error).toBeUndefined();
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
            beforeEach((done) => {
                rmSync(cacheDir, { recursive: true, force: true });
                latestVersion('npm')
                    .then((value: LatestVersionPackage) => {
                        pkg = value;
                        setTimeout(() => done(), 1000); // give time for the cache to be persisted
                    });
            });
            it('no cache should be created', () => {
                expect(existsSync(join(cacheDir, 'npm.json'))).toBe(false);
                expect(pkg).toBeDefined();
            });
        });
        describe('..if useCache=true', () => {
            let pkg: LatestVersionPackage;
            beforeEach((done) => {
                rmSync(cacheDir, { recursive: true, force: true });
                latestVersion('npm', { useCache: true })
                    .then((value: LatestVersionPackage) => {
                        pkg = value;
                        setTimeout(() => done(), 1000); // give time for the cache to be persisted
                    });
            });
            it('first call -> data should be undefined and returned immediately', async () => {
                expect(pkg).toBeDefined();
                expect(pkg.name).toBe('npm');
                expect(pkg.latest).toBeUndefined();
                expect(pkg.latestRange).toBeUndefined();
            });
            it('first call -> a cache file should be created', async () => {
                expect(existsSync(join(cacheDir, 'npm.json'))).toBe(true);
            });
            it('second call -> data should be defined and returned immediately', (done) => {
                latestVersion('npm', { useCache: true })
                    .then((value: LatestVersionPackage) => {
                        pkg = value;
                        setTimeout(() => {
                            expect(pkg).toBeDefined();
                            expect(pkg.name).toBe('npm');
                            expect(pkg.latest).toBeDefined();
                            expect(pkg.latestRange).toBeDefined();
                            done();
                        }, 1000); // give time for the cache to be persisted
                    });
            });
        });
        describe('..if cacheMaxAge=0', () => {
            let pkg: LatestVersionPackage;
            beforeEach((done) => {
                rmSync(cacheDir, { recursive: true, force: true });
                latestVersion('npm', { useCache: true })
                    .then((value: LatestVersionPackage) => {
                        pkg = value;
                        setTimeout(() => done(), 1000); // give time for the cache to be persisted
                    });
            });
            it('second call with cacheMaxAge=0 -> data should be undefined and returned immediately', (done) => {
                latestVersion('npm', { useCache: true, cacheMaxAge: 0 })
                    .then((value: LatestVersionPackage) => {
                        pkg = value;
                        setTimeout(() => {
                            expect(pkg).toBeDefined();
                            expect(pkg.name).toBe('npm');
                            expect(pkg.latest).toBeUndefined();
                            expect(pkg.latestRange).toBeUndefined();
                            done();
                        }, 1000); // give time for the cache to be persisted
                    });
            });
            it('second call with cacheMaxAge=0 -> lastUpdateDate should be updated', (done) => {
                const { lastUpdateDate: before } = JSON.parse(readFileSync(join(cacheDir, 'npm.json')).toString());
                latestVersion('npm', { useCache: true, cacheMaxAge: 0 })
                    .then((value: LatestVersionPackage) => {
                        pkg = value;
                        setTimeout(() => {
                            const { lastUpdateDate: after } = JSON.parse(readFileSync(join(cacheDir, 'npm.json')).toString());
                            expect(before).toBeLessThan(after);
                            done();
                        }, 1000); // give time for the cache to be persisted
                    });
            });
        });
    });
});
