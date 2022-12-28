import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { RequestOptions as HttpRequestOptions, Agent, IncomingMessage } from 'http';
import type { RequestOptions as HttpsRequestOptions } from 'https';
import { join, dirname, resolve as pathResolve, parse } from 'path';
import { npm, yarn } from 'global-dirs';
import { homedir } from 'os';
import { URL } from 'url';

import getRegistryUrl from 'registry-auth-token/registry-url';
import registryAuthToken from 'registry-auth-token';
import maxSatisfying from 'semver/ranges/max-satisfying';
import gt from 'semver/functions/gt';

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
     * The latest version of the package found on the provided registry and satisfied by the wanted tag or version range.
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
     *
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
    readonly ca?: string | Buffer | Array<string | Buffer>;
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
     *
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
     *
     * @default ONE_DAY
     */
    readonly cacheMaxAge?: number;

    /**
     * A JavaScript package registry url that implements the CommonJS Package Registry specification.
     *
     * @default "Looks at any registry urls in the .npmrc file or fallback to the default npm registry instead"
     * @example <caption>.npmrc</caption>
     * registry = 'https://custom-registry.com/'
     * @pkgscope:registry = 'https://custom-registry.com/'
     */
    readonly registryUrl?: string;

    /**
     * Set of options to be passed down to Node.js http/https request.
     *
     * @example <caption>Behind a proxy with self-signed certificate</caption>
     * { ca: [ fs.readFileSync('proxy-cert.pem') ] }
     * @example <caption>Bypassing certificate validation</caption>
     * { rejectUnauthorized: false }
     */
    readonly requestOptions?: RequestOptions;
}

type LatestVersion = {
    /**
     * Get latest versions of packages from of a package json like object.
     *
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
     *
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
     *
     * @param {Package[]} items - A collection of package object (represented by a string that should match the following format: `${'@' | ''}${string}@${string}`)
     * @example ['npm', 'npm@1.3.2', '@scope/name@^5.0.2']
     * @param {LatestVersionOptions} [options] - An object optionally specifying the use of the cache, the max age of the cache, the registry url and the http or https options.
     * If `useCache` is not supplied, the default of `false` is used.
     * If `cacheMaxAge` is not supplied, the default of `one day` is used.
     * If `registryUrl` is not supplied, the default from `.npmrc` is used or a fallback to the npm registry url instead.
     * @returns {Promise<LatestVersionPackage[]>}
     */
    (items: Package[], options?: LatestVersionOptions): Promise<LatestVersionPackage[]>; // eslint-disable-line @typescript-eslint/unified-signatures
};
type PackageRange = `${'@' | ''}${string}@${string}`;
type Package = string | PackageRange;
type PackageJsonDependencies = Record<string, string>;
type PackageJson = Record<string, any> & ({
    dependencies: PackageJsonDependencies;
} | {
    devDependencies: PackageJsonDependencies;
} | {
    peerDependencies: PackageJsonDependencies;
});

/**
 * @internal
 */
interface PackageMetadata {
    name: string;
    lastUpdateDate: number;
    versions: string[];
    distTags: Record<string, string>;
}

const ONE_DAY = 1000 * 60 * 60 * 24; // eslint-disable-line @typescript-eslint/naming-convention

const isPackageJson = (obj: any): obj is PackageJson => {
    return ((obj as PackageJson).dependencies !== undefined) ||
        ((obj as PackageJson).devDependencies !== undefined) ||
        ((obj as PackageJson).peerDependencies !== undefined);
};

const downloadMetadata = (pkgName: string, options?: LatestVersionOptions): Promise<PackageMetadata> => {
    return new Promise((resolve, reject) => {
        const i = pkgName.indexOf('/');
        const pkgScope = (i !== -1) ? pkgName.slice(0, i) : '';
        const registryUrl = options?.registryUrl || getRegistryUrl(pkgScope);
        const pkgUrl = new URL(encodeURIComponent(pkgName).replace(/^%40/, '@'), registryUrl);

        let requestOptions: HttpRequestOptions | HttpsRequestOptions = {
            headers: { accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*' },
            host: pkgUrl.hostname,
            path: pkgUrl.pathname,
            port: pkgUrl.port
        };
        const authInfo = registryAuthToken(pkgUrl.toString(), { recursive: true });
        if (authInfo && requestOptions.headers) {
            requestOptions.headers.authorization = `${authInfo.type} ${authInfo.token}`;
        }
        if (options?.requestOptions) {
            requestOptions = { ...requestOptions, ...options.requestOptions };
        }

        const { get } = require((pkgUrl.protocol === 'https:') ? 'https' : 'http');
        const request = get(requestOptions, (res: IncomingMessage) => {
            if (res.statusCode === 200) {
                let rawData = '';
                res.setEncoding('utf8');
                res.on('data', (chunk: any) => rawData += chunk);
                res.once('end', () => {
                    res.setTimeout(0);
                    res.removeAllListeners();
                    try {
                        const pkgMetadata = JSON.parse(rawData);
                        return resolve({
                            name: pkgName,
                            lastUpdateDate: Date.now(),
                            versions: Object.keys(pkgMetadata.versions as string[]),
                            distTags: pkgMetadata['dist-tags']
                        });
                    } catch (err) {
                        return reject(err);
                    }
                });
            } else {
                res.removeAllListeners();
                res.resume(); // consume response data to free up memory
                return reject(`Request error (${res.statusCode}): ${pkgUrl}`);
            }
        });
        const abort = (error: Error | string): void => {
            request.removeAllListeners();
            request.destroy();
            return reject(error);
        };
        request.once('timeout', () => abort(`Request timed out: ${pkgUrl}`));
        request.once('error', (err: Error) => abort(err));
    });
};

const getCacheDir = (name = '@badisi/latest-version'): string => {
    const homeDir = homedir();
    switch (process.platform) {
        case 'darwin': return join(homeDir, 'Library', 'Caches', name);
        case 'win32': return join(process.env.LOCALAPPDATA || join(homeDir, 'AppData', 'Local'), name, 'Cache');
        default: return join(process.env.XDG_CACHE_HOME || join(homeDir, '.cache'), name);
    }
};

const saveMetadataToCache = (pkg: PackageMetadata): void => {
    const filePath = join(getCacheDir(), `${pkg.name}.json`);
    if (!existsSync(dirname(filePath))) { mkdirSync(dirname(filePath), { recursive: true }); }
    writeFileSync(filePath, JSON.stringify(pkg));
};

const getMetadataFromCache = (pkgName: string, options?: LatestVersionOptions): PackageMetadata | undefined => {
    const pkgCacheFilePath = join(getCacheDir(), `${pkgName}.json`);
    if (existsSync(pkgCacheFilePath)) {
        const pkg = JSON.parse(readFileSync(pkgCacheFilePath).toString()) as PackageMetadata;
        const maxAge = (options?.cacheMaxAge !== undefined) ? options.cacheMaxAge : ONE_DAY;
        if ((Date.now() - pkg.lastUpdateDate) < maxAge) {
            return pkg;
        }
    }
    return undefined;
};

const getRegistryVersions = async (pkgName: string, tagOrRange?: string, options?: LatestVersionOptions): Promise<RegistryVersions | void> => {
    let pkgMetadata: PackageMetadata | undefined;
    if (pkgName.length && options?.useCache) {
        pkgMetadata = getMetadataFromCache(pkgName, options);
        if (!pkgMetadata) {
            return downloadMetadata(pkgName, options).then(saveMetadataToCache);
        }
    } else if (pkgName.length) {
        pkgMetadata = await downloadMetadata(pkgName, options);
    }

    const versions: RegistryVersions = {
        latest: pkgMetadata?.distTags?.latest,
        next: pkgMetadata?.distTags?.next
    };
    if (tagOrRange && pkgMetadata?.distTags && pkgMetadata?.distTags[tagOrRange]) {
        versions.wanted = pkgMetadata.distTags[tagOrRange];
    } else if (tagOrRange && pkgMetadata?.versions?.length) {
        versions.wanted = maxSatisfying(pkgMetadata.versions, tagOrRange) || undefined;
    }
    return versions;
};

const getInstalledVersion = (pkgName: string, location: keyof InstalledVersions = 'local'): string | undefined => {
    try {
        if (location === 'globalNpm') {
            return require(join(npm.packages, pkgName, 'package.json'))?.version as string;
        } else if (location === 'globalYarn') {
            // Make sure package is globally installed by Yarn
            const yarnGlobalPkg = require(pathResolve(yarn.packages, '..', 'package.json'));
            if (!yarnGlobalPkg?.dependencies?.[pkgName]) {
                return undefined;
            }
            return require(join(yarn.packages, pkgName, 'package.json'))?.version as string;
        } else {
            let pkgPath = '';
            try {
                pkgPath = require.resolve(join(pkgName, 'package.json'));
            } catch {
                /**
                 * require.resolve() may fail with the following error: ERR_PACKAGE_PATH_NOT_EXPORTED
                 * In such a case, local package.json will be retrieved manually
                 *
                 * @see https://github.com/nodejs/node/issues/33460
                 * @see https://github.com/nodejs/loaders/issues/26
                 */
                const allPaths = require.resolve.paths('/');
                const { root } = parse(process.cwd());
                const rootIndex = allPaths?.indexOf(join(root, 'node_modules'));
                if (rootIndex && (rootIndex > -1)) {
                    const localPaths = allPaths?.splice(0, rootIndex + 1) ?? [];
                    // eslint-disable-next-line @typescript-eslint/prefer-for-of
                    for (let i = 0; i < localPaths.length; i++) {
                        pkgPath = join(localPaths[i], pkgName, 'package.json');
                        if (existsSync(pkgPath)) {
                            break;
                        }
                    }
                }
            }
            return require(pkgPath)?.version as string;
        }
    } catch {
        return undefined;
    }
};

const getInfo = async (pkg: Package, options?: LatestVersionOptions): Promise<LatestVersionPackage> => {
    const i = pkg.lastIndexOf('@');
    let pkgInfo: LatestVersionPackage = {
        name: (i > 1) ? pkg.slice(0, i) : pkg,
        wantedTagOrRange: (i > 1) ? pkg.slice(i + 1) : 'latest',
        updatesAvailable: false
    };

    try {
        pkgInfo = {
            ...pkgInfo,
            local: getInstalledVersion(pkgInfo.name, 'local'),
            globalNpm: getInstalledVersion(pkgInfo.name, 'globalNpm'),
            globalYarn: getInstalledVersion(pkgInfo.name, 'globalYarn'),
            ...(await getRegistryVersions(pkgInfo.name, pkgInfo.wantedTagOrRange, options))
        };
        const local = (pkgInfo.local && pkgInfo.wanted) ? (gt(pkgInfo.wanted, pkgInfo.local) ? pkgInfo.wanted : false) : false;
        const globalNpm = (pkgInfo.globalNpm && pkgInfo.wanted) ? (gt(pkgInfo.wanted, pkgInfo.globalNpm) ? pkgInfo.wanted : false) : false;
        const globalYarn = (pkgInfo.globalYarn && pkgInfo.wanted) ? (gt(pkgInfo.wanted, pkgInfo.globalYarn) ? pkgInfo.wanted : false) : false;
        pkgInfo.updatesAvailable = (local || globalNpm || globalYarn) ? { local, globalNpm, globalYarn } : false;
    } catch (err: any) {
        pkgInfo.error = err?.message || err;
    }

    return pkgInfo;
};

const latestVersion: LatestVersion = async (arg: Package | Package[] | PackageJson, options?: LatestVersionOptions): Promise<any> => {
    const pkgs: string[] = [];
    if (typeof arg === 'string') {
        pkgs.push(arg);
    } else if (Array.isArray(arg)) {
        pkgs.push(...arg);
    } else if (isPackageJson(arg)) {
        const addDeps = (deps: PackageJsonDependencies): void => {
            if (deps) {
                pkgs.push(...Object.keys(deps).map((key: string) => `${key}@${deps[key]}`));
            }
        };
        addDeps(arg.dependencies as PackageJsonDependencies);
        addDeps(arg.devDependencies as PackageJsonDependencies);
        addDeps(arg.peerDependencies as PackageJsonDependencies);
    }

    const jobs = await Promise.allSettled(pkgs.map((pkg: string) => getInfo(pkg, options)));
    const results = jobs.map((jobResult: PromiseSettledResult<LatestVersionPackage>) =>
        (jobResult as PromiseFulfilledResult<LatestVersionPackage>).value);
    return (typeof arg === 'string') ? results[0] : results;
};

export type {
    LatestVersion,
    Package,
    PackageRange,
    PackageJson,
    PackageJsonDependencies,
    RegistryVersions,
    LatestVersionPackage,
    RequestOptions,
    LatestVersionOptions
};
export default latestVersion;
