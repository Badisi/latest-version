import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import rewire from 'rewire';

import latestVersion, { Package, PackageJson, LatestVersionPackage } from './index';

const spyOnRequire = (id: string): jasmine.Spy => {
    /* eslint-disable */
    const spy = jasmine.createSpy(id);
    const Mod = require('module');
    const ori = Mod.prototype.require;
    Mod.prototype.require = function () {
        const convertedId = join(id); // use path.join to convert path separator (posix vs windows)
        return (arguments[0].indexOf(convertedId) !== -1) ? spy() : ori.apply(this, arguments);
    };
    return spy;
    /* eslint-enable */
};

interface TestCase {
    name: string;
    fakeInstalled?: string;
    data: Package | Package[] | PackageJson;
    expect: LatestVersionPackage | LatestVersionPackage[];
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const TO_BE_DEFINED = 'TO_BE_DEFINED';

// eslint-disable-next-line @typescript-eslint/naming-convention
const TESTS: TestCase[] = [{
    name: 'Empty package',
    data: '',
    expect: {
        name: '',
        installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: undefined,
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }
}, {
    name: 'Package with name only',
    data: 'typescript',
    expect: {
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: undefined, wantedTagOrRange: undefined,
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }
}, {
    name: 'Package with exact range',
    data: 'typescript@3.6.2',
    expect: {
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: '3.6.2', wantedTagOrRange: '3.6.2',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }
}, {
    name: 'Package with minor range',
    data: 'typescript@^3.6.2',
    expect: {
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: '3.9.10', wantedTagOrRange: '^3.6.2',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }
}, {
    name: 'Package with patch range',
    data: 'typescript@~3.6.2',
    expect: {
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: '3.6.5', wantedTagOrRange: '~3.6.2',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }
}, {
    name: 'Package with existing tag',
    data: 'typescript@beta',
    expect: {
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: TO_BE_DEFINED, wantedTagOrRange: 'beta',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }
}, {
    name: 'Package with non existing tag',
    data: 'typescript@unknown',
    expect: {
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: undefined, wantedTagOrRange: 'unknown',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }
}, {
    name: 'Package with updates available',
    fakeInstalled: '3.6.2',
    data: ['typescript', 'typescript@3.6.2', 'typescript@^3.6.2', 'typescript@~3.6.2'],
    expect: [{
        name: 'typescript',
        installed: '3.6.2', latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: undefined, wantedTagOrRange: undefined,
        updatesAvailable: { latest: true, next: true, wanted: false },
        error: undefined
    }, {
        name: 'typescript',
        installed: '3.6.2', latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: '3.6.2', wantedTagOrRange: '3.6.2',
        updatesAvailable: { latest: true, next: true, wanted: false },
        error: undefined
    }, {
        name: 'typescript',
        installed: '3.6.2', latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: '3.9.10', wantedTagOrRange: '^3.6.2',
        updatesAvailable: { latest: true, next: true, wanted: true },
        error: undefined
    }, {
        name: 'typescript',
        installed: '3.6.2', latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: '3.6.5', wantedTagOrRange: '~3.6.2',
        updatesAvailable: { latest: true, next: true, wanted: true },
        error: undefined
    }]
}, {
    name: 'Empty collection',
    data: [],
    expect: []
}, {
    name: 'Collection of one package',
    data: ['npm'],
    expect: [{
        name: 'npm',
        installed: undefined, latest: TO_BE_DEFINED, next: undefined, wanted: undefined, wantedTagOrRange: undefined,
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }]
}, {
    name: 'Collection of many packages',
    data: ['typescript', 'typescript@1.6.2', '@scope/name@^5.0.2'],
    expect: [{
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: undefined, wantedTagOrRange: undefined,
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }, {
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: '1.6.2', wantedTagOrRange: '1.6.2',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }, {
        name: '@scope/name',
        installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: '^5.0.2',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: TO_BE_DEFINED as unknown as Error
    }]
}, {
    name: 'Package.json',
    data: {
        dependencies: { typescript: 'latest' },
        devDependencies: { typescript: '1.6.2' },
        peerDependencies: { '@scope/name': '^5.0.2' }
    },
    expect: [{
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: TO_BE_DEFINED, wantedTagOrRange: 'latest',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }, {
        name: 'typescript',
        installed: undefined, latest: TO_BE_DEFINED, next: TO_BE_DEFINED, wanted: '1.6.2', wantedTagOrRange: '1.6.2',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: undefined
    }, {
        name: '@scope/name',
        installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: '^5.0.2',
        updatesAvailable: { latest: false, next: false, wanted: false },
        error: TO_BE_DEFINED as unknown as Error
    }]
}];


const isPackageJson = (obj: any): obj is PackageJson => {
    return ((obj as PackageJson).dependencies !== undefined) ||
        ((obj as PackageJson).devDependencies !== undefined) ||
        ((obj as PackageJson).peerDependencies !== undefined);
};

const testValue = (actual: any, expected: any, output: string) => {
    if (expected === TO_BE_DEFINED) {
        expect(actual).toBeDefined(output);
    } else if (expected === undefined) {
        expect(actual).toBeUndefined(output);
    } else {
        expect(actual).toBe(expected, output);
    }
};

const testPkg = (actual: LatestVersionPackage, expected: LatestVersionPackage, testInstalled = false) => {
    testValue(actual.name, expected.name, '(pkg.name)');
    if (testInstalled) {
        testValue(actual.installed, expected.installed, '(pkg.installed)');
    }
    testValue(actual.latest, expected.latest, '(pkg.latest)');
    testValue(actual.next, expected.next, '(pkg.next)');
    testValue(actual.wanted, expected.wanted, '(pkg.wanted)');
    testValue(actual.wantedTagOrRange, expected.wantedTagOrRange, '(pkg.wantedTagOrRange)');
    testValue(actual.updatesAvailable?.latest, expected.updatesAvailable?.latest, '(pkg.updatesAvailable.latest)');
    testValue(actual.updatesAvailable?.next, expected.updatesAvailable?.next, '(pkg.updatesAvailable.next)');
    testValue(actual.updatesAvailable?.wanted, expected.updatesAvailable?.wanted, '(pkg.updatesAvailable.wanted)');
    testValue(actual.error, expected.error, '(pkg.error)');
};

describe('@badisi/latest-version', () => {
    describe('Test cache', () => {
        const cacheDir = rewire('./index')['__get__']('getCacheDir')();
        describe('useCache=false', () => {
            beforeAll((done) => {
                rmSync(cacheDir, { recursive: true, force: true });
                spyOnRequire('npm/package.json').and.returnValue({ version: undefined });
                void latestVersion(['npm', '@badisi/latest-version'], { useCache: false })
                    .then(() => {
                        setTimeout(() => done(), 1000); // give time for the cache to be persisted
                    });
            });
            it('no cache should be created', () => {
                expect(existsSync(join(cacheDir, 'npm.json'))).toBe(false, 'package');
                expect(existsSync(join(cacheDir, '@badisi/latest-version.json'))).toBe(false, 'scoped package');
            });
        });
        describe('useCache=true', () => {
            let pkgsCached: LatestVersionPackage[];
            beforeEach((done) => {
                rmSync(cacheDir, { recursive: true, force: true });
                spyOnRequire('npm/package.json').and.returnValue({ version: undefined });
                void latestVersion(['npm@^5.0.2', '@badisi/latest-version', '@scope/name'], { useCache: true })
                    .then((value: LatestVersionPackage[]) => {
                        pkgsCached = value;
                        setTimeout(() => done(), 1000); // give time for the cache to be persisted
                    });
            });
            it('first call -> data should be undefined and returned immediately', () => {
                testPkg(pkgsCached[0], {
                    name: 'npm',
                    installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: '^5.0.2',
                    updatesAvailable: { latest: false, next: false, wanted: false },
                    error: undefined
                });
                testPkg(pkgsCached[1], {
                    name: '@badisi/latest-version',
                    installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: undefined,
                    updatesAvailable: { latest: false, next: false, wanted: false },
                    error: undefined
                });
                testPkg(pkgsCached[2], {
                    name: '@scope/name',
                    installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: undefined,
                    updatesAvailable: { latest: false, next: false, wanted: false },
                    error: TO_BE_DEFINED as unknown as Error
                });
            });
            it('first call -> a cache file should be created', () => {
                expect(existsSync(join(cacheDir, 'npm.json'))).toBe(true, 'package');
                expect(existsSync(join(cacheDir, '@badisi/latest-version.json'))).toBe(true, 'scoped package');
                expect(existsSync(join(cacheDir, '@scope/name.json'))).toBe(false, 'non existing package');
            });
            it('second call -> data should be defined and returned immediately', (done) => {
                void latestVersion(['npm@^5.0.2', '@badisi/latest-version', '@scope/name'], { useCache: true })
                    .then((value: LatestVersionPackage[]) => {
                        setTimeout(() => {
                            testPkg(value[0], {
                                name: 'npm',
                                installed: undefined, latest: TO_BE_DEFINED, next: undefined, wanted: '5.10.0', wantedTagOrRange: '^5.0.2',
                                updatesAvailable: { latest: false, next: false, wanted: false },
                                error: undefined
                            });
                            testPkg(value[1], {
                                name: '@badisi/latest-version',
                                installed: undefined, latest: TO_BE_DEFINED, next: undefined, wanted: undefined, wantedTagOrRange: undefined,
                                updatesAvailable: { latest: false, next: false, wanted: false },
                                error: undefined
                            });
                            testPkg(value[2], {
                                name: '@scope/name',
                                installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: undefined,
                                updatesAvailable: { latest: false, next: false, wanted: false },
                                error: TO_BE_DEFINED as unknown as Error
                            });
                            done();
                        }, 1000); // give time for the cache to be persisted
                    });
            });
        });
        describe('cacheMaxAge=0', () => {
            beforeEach((done) => {
                rmSync(cacheDir, { recursive: true, force: true });
                spyOnRequire('npm/package.json').and.returnValue({ version: undefined });
                void latestVersion(['npm@^5.0.2', '@badisi/latest-version'], { useCache: true })
                    .then(() => {
                        setTimeout(() => done(), 1000); // give time for the cache to be persisted
                    });
            });
            it('second call with cacheMaxAge=0 -> data should be undefined and returned immediately', (done) => {
                void latestVersion(['npm@^5.0.2', '@badisi/latest-version'], { useCache: true, cacheMaxAge: 0 })
                    .then((value: LatestVersionPackage[]) => {
                        setTimeout(() => {
                            testPkg(value[0], {
                                name: 'npm',
                                installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: '^5.0.2',
                                updatesAvailable: { latest: false, next: false, wanted: false },
                                error: undefined
                            });
                            testPkg(value[1], {
                                name: '@badisi/latest-version',
                                installed: undefined, latest: undefined, next: undefined, wanted: undefined, wantedTagOrRange: undefined,
                                updatesAvailable: { latest: false, next: false, wanted: false },
                                error: undefined
                            });
                            done();
                        }, 1000); // give time for the cache to be persisted
                    });
            });
            it('second call with cacheMaxAge=0 -> lastUpdateDate should be updated', (done) => {
                const { lastUpdateDate: before } = JSON.parse(readFileSync(join(cacheDir, '@badisi/latest-version.json')).toString());
                void latestVersion('@badisi/latest-version', { useCache: true, cacheMaxAge: 0 })
                    .then(() => {
                        setTimeout(() => {
                            const { lastUpdateDate: after } = JSON.parse(readFileSync(join(cacheDir, '@badisi/latest-version.json')).toString());
                            expect(before).toBeLessThan(after);
                            done();
                        }, 1000); // give time for the cache to be persisted
                    });
            });
        });
    });

    TESTS.forEach((test: TestCase) => {
        describe(test.name, () => {
            let result: LatestVersionPackage | LatestVersionPackage[];

            beforeAll(async () => {
                if (test.fakeInstalled) {
                    spyOnRequire(`typescript/package.json`).and.returnValue({ version: test.fakeInstalled });
                } else {
                    spyOnRequire(`typescript/package.json`).and.returnValue({ version: undefined });
                }

                if (typeof test.data === 'string') {
                    result = await latestVersion(test.data);
                } else if (Array.isArray(test.data)) {
                    const pkgs = test.data;
                    result = await latestVersion(pkgs);
                } else if (isPackageJson(test.data)) {
                    const pkgs = test.data;
                    result = await latestVersion(pkgs);
                }
            });

            if (typeof test.data === 'string') {
                it('returned type', () => {
                    expect(Array.isArray(result)).toBe(false);
                });
                it(`'${test.data}'`, () => {
                    testPkg(result as LatestVersionPackage, test.expect as LatestVersionPackage, !!test.fakeInstalled);
                });
            } else if (Array.isArray(test.data)) {
                it('returned type', () => {
                    expect(Array.isArray(result)).toBe(true);
                });
                it('returned length', () => {
                    expect((result as LatestVersionPackage[]).length).toBe((test.expect as LatestVersionPackage[]).length);
                });
                for (let i = 0; i < test.data.length; i++) {
                    it(`'${test.data[i]}'`, () => {
                        testPkg((result as LatestVersionPackage[])[i], (test.expect as LatestVersionPackage[])[i], !!test.fakeInstalled);
                    });
                }
            } else if (isPackageJson(test.data)) {
                const testData: Package[] = [];
                [test.data.dependencies, test.data.devDependencies, test.data.peerDependencies].forEach((deps) => {
                    testData.push(...Object.keys(deps).map((key: string) => `${key}@${deps[key]}`));
                });
                it('returned type', () => {
                    expect(Array.isArray(result)).toBe(true);
                });
                it('returned length', () => {
                    expect((result as LatestVersionPackage[]).length).toBe(testData.length);
                });
                for (let i = 0; i < testData.length; i++) {
                    it(`'${testData[i]}'`, () => {
                        testPkg((result as LatestVersionPackage[])[i], (test.expect as LatestVersionPackage[])[i], !!test.fakeInstalled);
                    });
                }
            }
        });
    });
});
