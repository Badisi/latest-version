import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { PackageMetadata } from './metadata';

interface CacheOptions {
    readonly cacheMaxAge?: number;
}

export const ONE_DAY: number = 1000 * 60 * 60 * 24;

export const getCacheDir = (name = '@badisi/latest-version'): string => {
    const homeDir = homedir();
    switch (process.platform) {
        case 'darwin': return join(homeDir, 'Library', 'Caches', name);
        case 'win32': return join(process.env['LOCALAPPDATA'] ?? join(homeDir, 'AppData', 'Local'), name, 'Cache');
        default: return join(process.env['XDG_CACHE_HOME'] ?? join(homeDir, '.cache'), name);
    }
};

export const saveMetadataToCache = (pkg: PackageMetadata): void => {
    const filePath = join(getCacheDir(), `${pkg.name}.json`);
    if (!existsSync(dirname(filePath))) {
        mkdirSync(dirname(filePath), { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(pkg));
};

export const getMetadataFromCache = (pkgName: string, options?: CacheOptions): PackageMetadata | undefined => {
    const maxAge = options?.cacheMaxAge ?? ONE_DAY;
    if (maxAge !== 0) {
        const pkgCacheFilePath = join(getCacheDir(), `${pkgName}.json`);
        if (existsSync(pkgCacheFilePath)) {
            const pkg = JSON.parse(readFileSync(pkgCacheFilePath).toString()) as PackageMetadata;
            if ((Date.now() - pkg.lastUpdateDate) < maxAge) {
                return pkg;
            }
        }
    }
    return undefined; // invalidates cache
};
