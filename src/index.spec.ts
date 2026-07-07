/* eslint-disable @typescript-eslint/naming-convention */
import { npm, yarn } from 'global-dirs';
import type * as fs from 'node:fs';
import { existsSync, type PathOrFileDescriptor, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCacheDir } from './cache';
import { latestVersion, type LatestVersionPackage, type Package, type PackageJson } from './index';

const specDirname = dirname(fileURLToPath(import.meta.url));

const mockedFiles = new Map<string, string>();
vi.mock('node:fs', async importOriginal => {
    const actual = await importOriginal<typeof fs>();
    return {
        ...actual,
        readFileSync: vi.fn().mockImplementation((
            path: PathOrFileDescriptor,
            options?: { encoding?: BufferEncoding | null; flag?: string } | null,
        ) => {
            for (const [mockedPath, mockContent] of mockedFiles.entries()) {
                if (String(path).includes(join(mockedPath))) {
                    return mockContent;
                }
            }
            return actual.readFileSync(path, options);
        }),
    };
});

const spyOnReadFileSync = (path: string, mockData: Record<string, unknown>): void => {
    mockedFiles.set(path, JSON.stringify(mockData));
};

interface TestCase {
    name: string;
    fakeLocal?: string;
    fakeGlobalNpm?: string;
    fakeGlobalYarn?: string;
    data: Package | Package[] | PackageJson;
    expect: LatestVersionPackage | LatestVersionPackage[];
}


const TO_BE_DEFINED = 'TO_BE_DEFINED';


const TESTS: TestCase[] = [{
    name: 'Empty package',
    data: '',
    expect: {
        name: '',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: undefined,
        next: undefined,
        wanted: undefined,
        wantedTagOrRange: 'latest',
        updatesAvailable: false,
        error: undefined,
    },
}, {
    name: 'Package with name only',
    data: 'typescript',
    expect: {
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: TO_BE_DEFINED,
        wantedTagOrRange: 'latest',
        updatesAvailable: false,
        error: undefined,
    },
}, {
    name: 'Package with exact range',
    data: 'typescript@3.6.2',
    expect: {
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.6.2',
        wantedTagOrRange: '3.6.2',
        updatesAvailable: false,
        error: undefined,
    },
}, {
    name: 'Package with minor range',
    data: 'typescript@^3.6.2',
    expect: {
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.9.10',
        wantedTagOrRange: '^3.6.2',
        updatesAvailable: false,
        error: undefined,
    },
}, {
    name: 'Package with patch range',
    data: 'typescript@~3.6.2',
    expect: {
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.6.5',
        wantedTagOrRange: '~3.6.2',
        updatesAvailable: false,
        error: undefined,
    },
}, {
    name: 'Package with existing tag',
    data: 'typescript@beta',
    expect: {
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: TO_BE_DEFINED,
        wantedTagOrRange: 'beta',
        updatesAvailable: false,
        error: undefined,
    },
}, {
    name: 'Package with non existing tag',
    data: 'typescript@unknown',
    expect: {
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: undefined,
        wantedTagOrRange: 'unknown',
        updatesAvailable: false,
        error: undefined,
    },
}, {
    name: 'Package with local updates available',
    fakeLocal: '3.6.2',
    data: ['typescript', 'typescript@3.6.2', 'typescript@^3.6.2', 'typescript@~3.6.2'],
    expect: [{
        name: 'typescript',
        local: '3.6.2',
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: TO_BE_DEFINED,
        wantedTagOrRange: 'latest',
        updatesAvailable: { local: TO_BE_DEFINED, globalNpm: false, globalYarn: false },
        error: undefined,
    }, {
        name: 'typescript',
        local: '3.6.2',
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.6.2',
        wantedTagOrRange: '3.6.2',
        updatesAvailable: false,
        error: undefined,
    }, {
        name: 'typescript',
        local: '3.6.2',
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.9.10',
        wantedTagOrRange: '^3.6.2',
        updatesAvailable: { local: '3.9.10', globalNpm: false, globalYarn: false },
        error: undefined,
    }, {
        name: 'typescript',
        local: '3.6.2',
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.6.5',
        wantedTagOrRange: '~3.6.2',
        updatesAvailable: { local: '3.6.5', globalNpm: false, globalYarn: false },
        error: undefined,
    }],
}, {
    name: 'Package with various updates available',
    fakeLocal: '3.6.2',
    fakeGlobalNpm: '2.5.0',
    fakeGlobalYarn: '4.1.0',
    data: ['typescript', 'typescript@3.6.2', 'typescript@^3.6.2', 'typescript@~3.6.2'],
    expect: [{
        name: 'typescript',
        local: '3.6.2',
        globalNpm: '2.5.0',
        globalYarn: '4.1.0',
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: TO_BE_DEFINED,
        wantedTagOrRange: 'latest',
        updatesAvailable: { local: TO_BE_DEFINED, globalNpm: TO_BE_DEFINED, globalYarn: TO_BE_DEFINED },
        error: undefined,
    }, {
        name: 'typescript',
        local: '3.6.2',
        globalNpm: '2.5.0',
        globalYarn: '4.1.0',
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.6.2',
        wantedTagOrRange: '3.6.2',
        updatesAvailable: { local: false, globalNpm: '3.6.2', globalYarn: false },
        error: undefined,
    }, {
        name: 'typescript',
        local: '3.6.2',
        globalNpm: '2.5.0',
        globalYarn: '4.1.0',
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.9.10',
        wantedTagOrRange: '^3.6.2',
        updatesAvailable: { local: '3.9.10', globalNpm: '3.9.10', globalYarn: false },
        error: undefined,
    }, {
        name: 'typescript',
        local: '3.6.2',
        globalNpm: '2.5.0',
        globalYarn: '4.1.0',
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '3.6.5',
        wantedTagOrRange: '~3.6.2',
        updatesAvailable: { local: '3.6.5', globalNpm: '3.6.5', globalYarn: false },
        error: undefined,
    }],
}, {
    name: 'Empty collection',
    data: [],
    expect: [],
}, {
    name: 'Collection of one package',
    data: ['typescript'],
    expect: [{
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: TO_BE_DEFINED,
        wantedTagOrRange: 'latest',
        updatesAvailable: false,
        error: undefined,
    }],
}, {
    name: 'Collection of many packages',
    data: ['typescript', 'typescript@1.6.2', '@scope/name@^5.0.2'],
    expect: [{
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: TO_BE_DEFINED,
        wantedTagOrRange: 'latest',
        updatesAvailable: false,
        error: undefined,
    }, {
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '1.6.2',
        wantedTagOrRange: '1.6.2',
        updatesAvailable: false,
        error: undefined,
    }, {
        name: '@scope/name',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: undefined,
        next: undefined,
        wanted: undefined,
        wantedTagOrRange: '^5.0.2',
        updatesAvailable: false,
        error: TO_BE_DEFINED as unknown as Error,
    }],
}, {
    name: 'Package.json',
    data: {
        dependencies: { typescript: 'latest' },
        devDependencies: { typescript: '1.6.2' },
        peerDependencies: { '@scope/name': '^5.0.2' },
    },
    expect: [{
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: TO_BE_DEFINED,
        wantedTagOrRange: 'latest',
        updatesAvailable: false,
        error: undefined,
    }, {
        name: 'typescript',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: TO_BE_DEFINED,
        next: TO_BE_DEFINED,
        wanted: '1.6.2',
        wantedTagOrRange: '1.6.2',
        updatesAvailable: false,
        error: undefined,
    }, {
        name: '@scope/name',
        local: undefined,
        globalNpm: undefined,
        globalYarn: undefined,
        latest: undefined,
        next: undefined,
        wanted: undefined,
        wantedTagOrRange: '^5.0.2',
        updatesAvailable: false,
        error: TO_BE_DEFINED as unknown as Error,
    }],
}];

const isPackageJson = (obj: unknown): obj is PackageJson => ((obj as PackageJson).dependencies !== undefined)
  || ((obj as PackageJson).devDependencies !== undefined)
  || ((obj as PackageJson).peerDependencies !== undefined);

const testValue = (actual: unknown, expected: unknown, output: string): void => {
    if (expected === TO_BE_DEFINED) {
        expect(actual, output).toBeDefined();
    } else if (expected === undefined) {
        expect(actual, output).toBeUndefined();
    } else {
        expect(actual, output).toEqual(expected);
    }
};

const testPkg = (
    actual: LatestVersionPackage, expected: LatestVersionPackage,
    testLocalInstalled = false, testGlobalNpmInstalled = false, testGlobalYarnInstalled = false,
): void => {
    testValue(actual.name, expected.name, '(pkg.name)');
    if (testLocalInstalled) {
        testValue(actual.local, expected.local, '(pkg.local)');
    }
    if (testGlobalNpmInstalled) {
        testValue(actual.globalNpm, expected.globalNpm, '(pkg.globalNpm)');
    }
    if (testGlobalYarnInstalled) {
        testValue(actual.globalYarn, expected.globalYarn, '(pkg.globalYarn)');
    }
    testValue(actual.latest, expected.latest, '(pkg.latest)');
    testValue(actual.next, expected.next, '(pkg.next)');
    testValue(actual.wanted, expected.wanted, '(pkg.wanted)');
    testValue(actual.wantedTagOrRange, expected.wantedTagOrRange, '(pkg.wantedTagOrRange)');
    if (typeof actual.updatesAvailable === 'boolean') {
        testValue(actual.updatesAvailable, expected.updatesAvailable, '(pkg.updatesAvailable)');
    } else {
        Object.entries(actual.updatesAvailable).forEach(([key, value]) => {
            testValue(value, expected.updatesAvailable[key as keyof typeof expected.updatesAvailable], `(pkg.updatesAvailable.${key})`);
        });
    }
    testValue(actual.error, expected.error, '(pkg.error)');
};

describe('@badisi/latest-version', () => {
    describe('Test cache', () => {
        const cacheDir = getCacheDir();
        describe('useCache=false', () => {
            beforeAll(async () => {
                rmSync(cacheDir, { recursive: true, force: true });
                spyOnReadFileSync('npm/package.json', { version: undefined });
                await latestVersion(['npm', '@badisi/latest-version'], { useCache: false });
            });
            it('no cache should be created', () => {
                expect(existsSync(join(cacheDir, 'npm.json')), 'package').toBe(false);
                expect(existsSync(join(cacheDir, '@badisi/latest-version.json')), 'scoped package').toBe(false);
            });
        });
        describe('useCache=true', () => {
            let pkgsCached: LatestVersionPackage[];
            beforeEach(async () => {
                rmSync(cacheDir, { recursive: true, force: true });
                spyOnReadFileSync('npm/package.json', { version: undefined });
                pkgsCached = await latestVersion(['npm@^5.0.2', '@badisi/latest-version', '@scope/name'], { useCache: true });
            });
            it('first call -> data should be defined', () => {
                testPkg(pkgsCached[0], {
                    name: 'npm',
                    local: undefined,
                    globalNpm: undefined,
                    globalYarn: undefined,
                    latest: TO_BE_DEFINED,
                    next: undefined,
                    wanted: TO_BE_DEFINED,
                    wantedTagOrRange: '^5.0.2',
                    updatesAvailable: false,
                    error: undefined,
                });
                testPkg(pkgsCached[1], {
                    name: '@badisi/latest-version',
                    local: undefined,
                    globalNpm: undefined,
                    globalYarn: undefined,
                    latest: TO_BE_DEFINED,
                    next: undefined,
                    wanted: TO_BE_DEFINED,
                    wantedTagOrRange: 'latest',
                    updatesAvailable: false,
                    error: undefined,
                });
                testPkg(pkgsCached[2], {
                    name: '@scope/name',
                    local: undefined,
                    globalNpm: undefined,
                    globalYarn: undefined,
                    latest: undefined,
                    next: undefined,
                    wanted: undefined,
                    wantedTagOrRange: 'latest',
                    updatesAvailable: false,
                    error: TO_BE_DEFINED as unknown as Error,
                });
            });
            it('first call -> a cache file should be created', () => {
                expect(existsSync(join(cacheDir, 'npm.json')), 'package').toBe(true);
                expect(existsSync(join(cacheDir, '@badisi/latest-version.json')), 'scoped package').toBe(true);
                expect(existsSync(join(cacheDir, '@scope/name.json')), 'non existing package').toBe(false);
            });
            it('second call -> data should be defined and returned immediately', async () => {
                const value = await latestVersion(['npm@^5.0.2', '@badisi/latest-version', '@scope/name'], { useCache: true });
                testPkg(value[0], {
                    name: 'npm',
                    local: undefined,
                    globalNpm: undefined,
                    globalYarn: undefined,
                    latest: TO_BE_DEFINED,
                    next: undefined,
                    wanted: '5.10.0',
                    wantedTagOrRange: '^5.0.2',
                    updatesAvailable: false,
                    error: undefined,
                });
                testPkg(value[1], {
                    name: '@badisi/latest-version',
                    local: undefined,
                    globalNpm: undefined,
                    globalYarn: undefined,
                    latest: TO_BE_DEFINED,
                    next: undefined,
                    wanted: TO_BE_DEFINED,
                    wantedTagOrRange: 'latest',
                    updatesAvailable: false,
                    error: undefined,
                });
                testPkg(value[2], {
                    name: '@scope/name',
                    local: undefined,
                    globalNpm: undefined,
                    globalYarn: undefined,
                    latest: undefined,
                    next: undefined,
                    wanted: undefined,
                    wantedTagOrRange: 'latest',
                    updatesAvailable: false,
                    error: TO_BE_DEFINED as unknown as Error,
                });
            });
        });
        describe('cacheMaxAge=0', () => {
            beforeEach(async () => {
                rmSync(cacheDir, { recursive: true, force: true });
                spyOnReadFileSync('npm/package.json', { version: undefined });
                await latestVersion(['npm@^5.0.2', '@badisi/latest-version'], { useCache: true });
            });
            it('second call with cacheMaxAge=0 -> data should be defined', async () => {
                const value = await latestVersion(['npm@^5.0.2', '@badisi/latest-version'], { useCache: true, cacheMaxAge: 0 });
                testPkg(value[0], {
                    name: 'npm',
                    local: undefined,
                    globalNpm: undefined,
                    globalYarn: undefined,
                    latest: TO_BE_DEFINED,
                    next: undefined,
                    wanted: TO_BE_DEFINED,
                    wantedTagOrRange: '^5.0.2',
                    updatesAvailable: false,
                    error: undefined,
                });
                testPkg(value[1], {
                    name: '@badisi/latest-version',
                    local: undefined,
                    globalNpm: undefined,
                    globalYarn: undefined,
                    latest: TO_BE_DEFINED,
                    next: undefined,
                    wanted: TO_BE_DEFINED,
                    wantedTagOrRange: 'latest',
                    updatesAvailable: false,
                    error: undefined,
                });
            });
            it('second call with cacheMaxAge=0 -> lastUpdateDate should be updated', async () => {
                const { lastUpdateDate: before } = JSON.parse(readFileSync(join(cacheDir, '@badisi/latest-version.json')).toString()) as Record<string, unknown>;
                await latestVersion('@badisi/latest-version', { useCache: true, cacheMaxAge: 0 });
                const { lastUpdateDate: after } = JSON.parse(readFileSync(join(cacheDir, '@badisi/latest-version.json')).toString()) as Record<string, unknown>;
                expect(before as number).toBeLessThan(after as number);
            });
        });
    });

    TESTS.forEach((test: TestCase) => {
        describe(test.name, () => {
            let result: LatestVersionPackage | LatestVersionPackage[];

            beforeAll(async () => {
                spyOnReadFileSync(resolve(specDirname, '../node_modules/typescript/package.json'), { version: test.fakeLocal });
                spyOnReadFileSync(resolve(npm.packages, 'typescript/package.json'), { version: test.fakeGlobalNpm });
                spyOnReadFileSync(resolve(yarn.packages, '../package.json'), { dependencies: { typescript: 'x.x.x' } });
                spyOnReadFileSync(resolve(yarn.packages, 'typescript/package.json'), { version: test.fakeGlobalYarn });

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
                    testPkg(result as LatestVersionPackage, test.expect as LatestVersionPackage, !!test.fakeLocal, !!test.fakeGlobalNpm, !!test.fakeGlobalYarn);
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
                        testPkg((result as LatestVersionPackage[])[i], (test.expect as LatestVersionPackage[])[i], !!test.fakeLocal, !!test.fakeGlobalNpm, !!test.fakeGlobalYarn);
                    });
                }
            } else if (isPackageJson(test.data)) {
                const testData: Package[] = [];
                const allDeps = [test.data.dependencies, test.data.devDependencies, test.data.peerDependencies] as Record<string, string>[];
                allDeps.forEach(deps => {
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
                        testPkg((result as LatestVersionPackage[])[i], (test.expect as LatestVersionPackage[])[i], !!test.fakeLocal, !!test.fakeGlobalNpm, !!test.fakeGlobalYarn);
                    });
                }
            }
        });
    });
});
