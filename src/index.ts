import { npm, yarn } from 'global-dirs';
import { existsSync, readFileSync } from 'node:fs';
import type { Agent } from 'node:http';
import { dirname, join, parse, resolve as pathResolve } from 'node:path';
import gt from 'semver/functions/gt';
import maxSatisfying from 'semver/ranges/max-satisfying';

import { getMetadataFromCache, ONE_DAY, saveMetadataToCache } from './cache';
import { downloadMetadata, type PackageMetadata } from './metadata';

interface RegistryVersions {
    /**
     * The latest version of the package found on the registry (if found).
     */
    latest?: string;
    /**
     * The next version of the package found on the registry (if found).
     */
    next?: string;
    /**
     * The latest version of the package found on the registry and satisfied by the wanted tag or version range.
     */
    wanted?: string;
}

interface InstalledVersions {
    /**
     * The current local installed version of the package (if installed).
     */
    local?: string;
    /**
     * The current npm global installed version of the package (if installed).
     */
    globalNpm?: string;
    /**
     * The current yarn global installed version of the package (if installed).
     */
    globalYarn?: string;
}

interface LatestVersionPackage extends InstalledVersions, RegistryVersions {
    /**
     * The name of the package.
     */
    name: string;
    /**
     * The tag or version range that was provided (if provided).
     * @default "latest"
     */
    wantedTagOrRange?: string;
    /**
     * Whether the local or global installed versions (if any) could be upgraded or not, based on the wanted version.
     */
    updatesAvailable: {
        local: string | false;
        globalNpm: string | false;
        globalYarn: string | false;
    } | false;
    /**
     * Any error that might have occurred during the process.
     */
    error?: Error;
}

interface RequestOptions {
    readonly ca?: string | Buffer | (string | Buffer)[];
    readonly rejectUnauthorized?: boolean;
    readonly agent?: Agent | boolean;
    readonly timeout?: number;
}

interface LatestVersionOptions {
    /**
     * Awaiting the api to return might take time, depending on the network, and might impact your package loading performance.
     * You can use the cache mechanism to improve load performance and reduce unnecessary network requests.
     * If `useCache` is not supplied, the api will always check for updates and wait for every requests to return before returning itself.
     * If `useCache` is used, the api will always returned immediately, with either (for each provided packages):
     * 1) a latest/next version available if a cache was found
     * 2) no latest/next version available if no cache was found - in such case updates will be fetched in the background and a cache will
     * be created for each provided packages and made available for the next call to the api.
     * @default false
     */
    readonly useCache?: boolean;

    /**
     * How long the cache for the provided packages should be used before being refreshed (in milliseconds).
     * If `useCache` is not supplied, this option has no effect.
     * If `0` is used, this will force the cache to refresh immediately:
     * 1) The api will returned immediately (without any latest nor next version available for the provided packages)
     * 2) New updates will be fetched in the background
     * 3) The cache for each provided packages will be refreshed and made available for the next call to the api
     * @default ONE_DAY
     */
    readonly cacheMaxAge?: number;

    /**
     * A JavaScript package registry url that implements the CommonJS Package Registry specification.
     * @default "Looks at any registry urls in the .npmrc file or fallback to the default npm registry instead"
     * @example <caption>.npmrc</caption>
     * registry = 'https://custom-registry.com/'
     * \@pkgscope:registry = 'https://custom-registry.com/'
     */
    readonly registryUrl?: string;

    /**
     * Set of options to be passed down to Node.js http/https request.
     * @example <caption>Behind a proxy with self-signed certificate</caption>
     * { ca: [ fs.readFileSync('proxy-cert.pem') ] }
     * @example <caption>Bypassing certificate validation</caption>
     * { rejectUnauthorized: false }
     */
    readonly requestOptions?: RequestOptions;
}

interface LatestVersion {
    /**
     * Get latest versions of packages from of a package json like object.
     * @param {PackageJson} item - A package json like object (with dependencies, devDependencies and peerDependencies attributes).
     * @example { dependencies: { 'npm': 'latest' }, devDependencies: { 'npm': '1.3.2' }, peerDependencies: { '@scope/name': '^5.0.2' } }
     * @param {LatestVersionOptions} [options] - An object optionally specifying the use of the cache, the max age of the cache, the registry url and the http or https options.
     * If `useCache` is not supplied, the default of `false` is used.
     * If `cacheMaxAge` is not supplied, the default of `one day` is used.
     * If `registryUrl` is not supplied, the default from `.npmrc` is used or a fallback to the `npm registry url` instead.
     * @returns {Promise<LatestVersionPackage[]>}
     */
    (item: PackageJson, options?: LatestVersionOptions): Promise<LatestVersionPackage[]>;

    /**
     * Get latest version of a single package.
     * @param {Package} item - A single package object (represented by a string that should match the following format: `${'@' | ''}${string}@${string}`)
     * @example 'npm', 'npm@1.3.2', '@scope/name@^5.0.2'
     * @param {LatestVersionOptions} [options] - An object optionally specifying the use of the cache, the max age of the cache, the registry url and the http or https options.
     * If `useCache` is not supplied, the default of `false` is used.
     * If `cacheMaxAge` is not supplied, the default of `one day` is used.
     * If `registryUrl` is not supplied, the default from `.npmrc` is used or a fallback to the npm registry url instead.
     * @returns {Promise<LatestVersionPackage>}
     */
    (item: Package, options?: LatestVersionOptions): Promise<LatestVersionPackage>;

    /**
     * Get latest versions of a collection of packages.
     * @param {Package[]} items - A collection of package object (represented by a string that should match the following format: `${'@' | ''}${string}@${string}`)
     * @example ['npm', 'npm@1.3.2', '@scope/name@^5.0.2']
     * @param {LatestVersionOptions} [options] - An object optionally specifying the use of the cache, the max age of the cache, the registry url and the http or https options.
     * If `useCache` is not supplied, the default of `false` is used.
     * If `cacheMaxAge` is not supplied, the default of `one day` is used.
     * If `registryUrl` is not supplied, the default from `.npmrc` is used or a fallback to the npm registry url instead.
     * @returns {Promise<LatestVersionPackage[]>}
     */
    (items: Package[], options?: LatestVersionOptions): Promise<LatestVersionPackage[]>; // eslint-disable-line @typescript-eslint/unified-signatures

    (item: Package[] | PackageJson, options?: LatestVersionOptions): Promise<LatestVersionPackage[]>; // eslint-disable-line @typescript-eslint/unified-signatures
}
type PackageRange = `${'@' | ''}${string}@${string}`;
type Package = PackageRange | string; // eslint-disable-line @typescript-eslint/no-redundant-type-constituents
type PackageJsonDependencies = Record<string, string>;
type PackageJson = Record<string, unknown> & { version?: string } & ({
    dependencies: PackageJsonDependencies;
} | {
    devDependencies: PackageJsonDependencies;
} | {
    peerDependencies: PackageJsonDependencies;
});

const isPackageJson = (obj: unknown): obj is PackageJson => ((obj as PackageJson).dependencies !== undefined)
  || ((obj as PackageJson).devDependencies !== undefined)
  || ((obj as PackageJson).peerDependencies !== undefined);

const getRegistryVersions = async (pkgName: string, tagOrRange?: string, options?: LatestVersionOptions): Promise<RegistryVersions> => {
    let pkgMetadata: PackageMetadata | undefined;
    if (pkgName.length && options?.useCache) {
        pkgMetadata = getMetadataFromCache(pkgName, options);
        if (!pkgMetadata) {
            pkgMetadata = await downloadMetadata(pkgName, options);
            saveMetadataToCache(pkgMetadata);
        }
    } else if (pkgName.length) {
        pkgMetadata = await downloadMetadata(pkgName, options);
    }

    const versions: RegistryVersions = {
        latest: pkgMetadata?.distTags['latest'],
        next: pkgMetadata?.distTags['next'],
    };
    if (tagOrRange && pkgMetadata?.distTags[tagOrRange]) {
        versions.wanted = pkgMetadata.distTags[tagOrRange];
    } else if (tagOrRange && pkgMetadata?.versions.length) {
        versions.wanted = maxSatisfying(pkgMetadata.versions, tagOrRange) ?? undefined;
    }
    return versions;
};

const getInstalledVersion = (pkgName: string, location: keyof InstalledVersions = 'local'): string | undefined => {
    try {
        const readPackageJson = (path: string): PackageJson => JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
        if (location === 'globalNpm') {
            return readPackageJson(join(npm.packages, pkgName, 'package.json')).version;
        } else if (location === 'globalYarn') {
            // Make sure package is trully a global package installed by Yarn
            const deps = readPackageJson(pathResolve(yarn.packages, '..', 'package.json')).dependencies as PackageJsonDependencies;
            if (!(pkgName in deps)) {
                return undefined;
            }
            return readPackageJson(join(yarn.packages, pkgName, 'package.json')).version;
        } else {
            /**
             * Compute the local paths manually as require.resolve() and require.resolve.paths()
             * cannot be trusted anymore.
             * @see https://github.com/nodejs/node/issues/33460
             * @see https://github.com/nodejs/loaders/issues/26
             */
            const startPath = process.cwd();
            const { root } = parse(startPath);
            const findPackageVersion = (path: string, rootPath: string, name: string): string | undefined => {
                const pkgPath = join(path, 'node_modules', name, 'package.json');
                if (existsSync(pkgPath)) {
                    return readPackageJson(pkgPath).version;
                }
                if (path === rootPath) {
                    return undefined;
                }
                return findPackageVersion(dirname(path), rootPath, name);
            };
            return findPackageVersion(startPath, root, pkgName);
        }
        return undefined;
    } catch {
        return undefined;
    }
};

const getInfo = async (pkg: Package, options?: LatestVersionOptions): Promise<LatestVersionPackage> => {
    const i = pkg.lastIndexOf('@');
    let pkgInfo: LatestVersionPackage = {
        name: (i > 1) ? pkg.slice(0, i) : pkg,
        wantedTagOrRange: (i > 1) ? pkg.slice(i + 1) : 'latest',
        updatesAvailable: false,
    };

    try {
        pkgInfo = {
            ...pkgInfo,
            local: getInstalledVersion(pkgInfo.name, 'local'),
            globalNpm: getInstalledVersion(pkgInfo.name, 'globalNpm'),
            globalYarn: getInstalledVersion(pkgInfo.name, 'globalYarn'),
            ...(await getRegistryVersions(pkgInfo.name, pkgInfo.wantedTagOrRange, options)),
        };
        /* eslint-disable no-nested-ternary */
        const local = (pkgInfo.local && pkgInfo.wanted) ? (gt(pkgInfo.wanted, pkgInfo.local) ? pkgInfo.wanted : false) : false;
        const globalNpm = (pkgInfo.globalNpm && pkgInfo.wanted) ? (gt(pkgInfo.wanted, pkgInfo.globalNpm) ? pkgInfo.wanted : false) : false;
        const globalYarn = (pkgInfo.globalYarn && pkgInfo.wanted) ? (gt(pkgInfo.wanted, pkgInfo.globalYarn) ? pkgInfo.wanted : false) : false;
        // eslint-enable no-nested-ternary */
        pkgInfo.updatesAvailable = (local || globalNpm || globalYarn) ? { local, globalNpm, globalYarn } : false;
    } catch (err) {
        if (typeof err === 'string') {
            pkgInfo.error = new Error(err);
        } else if (err instanceof Error) {
            pkgInfo.error = err;
        } else {
            pkgInfo.error = new Error('Unknown error');
        }
    }

    return pkgInfo;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const latestVersion: LatestVersion = async (arg: Package | Package[] | PackageJson, options?: LatestVersionOptions): Promise<any> => {
    const pkgs: Package[] = [];
    if (typeof arg === 'string') {
        pkgs.push(arg);
    } else if (Array.isArray(arg)) {
        pkgs.push(...arg);
    } else if (isPackageJson(arg)) {
        const addDeps = (deps?: PackageJsonDependencies): void => {
            if (deps) {
                pkgs.push(...Object.keys(deps).map((key: string) => `${key}@${deps[key]}`));
            }
        };
        addDeps(arg.dependencies as (PackageJsonDependencies | undefined));
        addDeps(arg.devDependencies as (PackageJsonDependencies | undefined));
        addDeps(arg.peerDependencies as (PackageJsonDependencies | undefined));
    }

    const jobs = await Promise.allSettled(pkgs.map(pkg => getInfo(pkg, options)));
    const results = jobs.map((jobResult: PromiseSettledResult<LatestVersionPackage>) =>
        (jobResult as PromiseFulfilledResult<LatestVersionPackage>).value);
    return (typeof arg === 'string') ? results[0] : results;
};

export type {
    LatestVersion,
    LatestVersionOptions,
    LatestVersionPackage,
    Package,
    PackageJson,
    PackageJsonDependencies,
    PackageRange,
    RegistryVersions,
    RequestOptions,
};

export {
    latestVersion,
    ONE_DAY,
};
