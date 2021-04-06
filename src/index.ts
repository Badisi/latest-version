import getRegistryUrl from 'registry-auth-token/registry-url';
import registryAuthToken from 'registry-auth-token';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { RequestOptions as HttpRequestOptions, Agent, IncomingMessage } from 'node:http';
import { RequestOptions as HttpsRequestOptions } from 'node:https';
import { gt, maxSatisfying } from 'semver';
import { npm, yarn } from 'global-dirs';
import { homedir } from 'os';
import { join } from 'path';
import { URL } from 'url';

interface LatestVersions {
    /**
     * The latest version of the package found on the provided registry (if found).
     */
    latest?: string;
    /**
     * The latest version of the package satisfied by the provided range (if provided).
     */
    latestRange?: string;
    /**
     * The next version of the package (if available).
     */
    next?: string;
}

interface LatestVersionPackage extends LatestVersions {
    /**
     * The name of the package.
     */
    name: string;
    /**
     * The range that was provided (if any).
     *
     * @default "latest"
     */
    range: string;
    /**
     * Whether the installed version could be upgraded or not (if installed).
     */
    updateAvailable: boolean;
    /**
     * The current local or global installed version of the package (if installed).
     */
    installed?: string;
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
     * @default "Look at any registry urls in the .npmrc file or fallback to the default npm registry instead"
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

interface PackageMetadata {
    name: string;
    lastUpdateDate: number;
    versions: string[];
    latest: string;
    next: string;
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
                            versions: Object.keys(pkgMetadata.versions),
                            latest: pkgMetadata['dist-tags']?.latest,
                            next: pkgMetadata['dist-tags']?.next
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

const getCacheDir = (name = 'badisi.latest-version'): string => {
    const homeDir = homedir();
    switch (process.platform) {
        case 'darwin': return join(homeDir, 'Library', 'Caches', name);
        case 'win32': return join(process.env.LOCALAPPDATA || join(homeDir, 'AppData', 'Local'), name, 'Cache');
        default: return join(process.env.XDG_CACHE_HOME || join(homeDir, '.cache'), name);
    }
};

const saveMetadataToCache = (pkg: PackageMetadata): void => {
    const cacheDir = getCacheDir();
    if (!existsSync(cacheDir)) { mkdirSync(cacheDir, { recursive: true }); }
    writeFileSync(join(getCacheDir(), `${pkg.name}.json`), JSON.stringify(pkg));
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

const getLatestVersions = async (pkgName: string, pkgRange: string, options?: LatestVersionOptions): Promise<LatestVersions> => {
    let pkgMetadata: PackageMetadata | undefined;
    if (options?.useCache) {
        pkgMetadata = getMetadataFromCache(pkgName, options);
        if (!pkgMetadata) {
            downloadMetadata(pkgName, options).then(saveMetadataToCache).catch((err) => { throw err; });
        }
    } else {
        pkgMetadata = await downloadMetadata(pkgName, options);
    }
    const pkgLatestRange = (pkgRange === 'latest') ? pkgMetadata?.latest : maxSatisfying(pkgMetadata?.versions || [], pkgRange);
    return {
        latest: pkgMetadata?.latest,
        latestRange: (pkgLatestRange !== null) ? pkgLatestRange : undefined,
        next: pkgMetadata?.next
    };
};

const getInstalledVersion = (pkgName: string): string | undefined => {
    const tryPaths = (paths: string[]): string | undefined => {
        try {
            return require(require.resolve(paths.shift() as string))?.version as string | undefined;
        } catch {
            return (paths?.length) ? tryPaths(paths) : undefined;
        }
    };
    return tryPaths([
        join(pkgName, 'package.json'),
        join(npm.packages, pkgName, 'package.json'),
        join(yarn.packages, pkgName, 'package.json')
    ]);
};

const getInfo = async (pkg: Package, options?: LatestVersionOptions): Promise<LatestVersionPackage> => {
    const i = pkg.lastIndexOf('@');
    let pkgInfo: LatestVersionPackage = {
        name: (i > 1) ? pkg.slice(0, i) : pkg,
        range: (i > 1) ? pkg.slice(i + 1) : 'latest',
        updateAvailable: false
    };

    try {
        pkgInfo = {
            ...pkgInfo,
            installed: getInstalledVersion(pkgInfo.name),
            ...(await getLatestVersions(pkgInfo.name, pkgInfo.range, options))
        };
        if (pkgInfo.latestRange && pkgInfo.installed) {
            pkgInfo.updateAvailable = gt(pkgInfo.latestRange, pkgInfo.installed);
        } else if (pkgInfo.latest && pkgInfo.installed) {
            pkgInfo.updateAvailable = gt(pkgInfo.latest, pkgInfo.installed);
        }
    } catch (err) {
        pkgInfo.error = err.message || err;
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
        addDeps(arg.dependencies);
        addDeps(arg.devDependencies);
        addDeps(arg.peerDependencies);
    }

    const jobs = await Promise.allSettled(pkgs.map((pkg: string) => getInfo(pkg, options)));
    const results = jobs.map((jobResult: PromiseSettledResult<LatestVersionPackage>) =>
        (jobResult as PromiseFulfilledResult<LatestVersionPackage>).value);
    return (results.length === 1) ? results[0] : results;
};

export {
    LatestVersion,
    PackageRange,
    PackageJsonDependencies,
    PackageJson,
    LatestVersions,
    LatestVersionPackage,
    RequestOptions,
    LatestVersionOptions
};
export default latestVersion;
module.exports = latestVersion;
