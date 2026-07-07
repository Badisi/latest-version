import { get as httpGet, type IncomingMessage, type OutgoingHttpHeaders, type RequestOptions as HttpRequestOptions } from 'node:http';
import { get as httpsGet, type RequestOptions as HttpsRequestOptions } from 'node:https';
import { URL } from 'node:url';
import registryAuthToken from 'registry-auth-token';
import getRegistryUrl from 'registry-auth-token/registry-url';

import type { LatestVersionOptions } from './index';

export interface PackageMetadata {
    name: string;
    lastUpdateDate: number;
    versions: string[];
    distTags: Record<string, string>;
}

export const downloadMetadata = (pkgName: string, options?: LatestVersionOptions): Promise<PackageMetadata> =>
    new Promise((resolve, reject) => {
        const i = pkgName.indexOf('/');
        const pkgScope = (i !== -1) ? pkgName.slice(0, i) : '';
        const registryUrl = options?.registryUrl ?? getRegistryUrl(pkgScope);
        const pkgUrl = new URL(encodeURIComponent(pkgName).replace(/^%40/, '@'), registryUrl);

        let requestOptions: HttpRequestOptions | HttpsRequestOptions = {
            headers: { accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*' },
            host: pkgUrl.hostname,
            path: pkgUrl.pathname,
            port: pkgUrl.port,
        };
        const authInfo = registryAuthToken(pkgUrl.toString(), { recursive: true });
        if (authInfo && requestOptions.headers) {
            (requestOptions.headers as OutgoingHttpHeaders).authorization = `${authInfo.type} ${authInfo.token}`;
        }
        if (options?.requestOptions) {
            requestOptions = { ...requestOptions, ...options.requestOptions };
        }

        const get = (pkgUrl.protocol === 'https:') ? httpsGet : httpGet;
        const request = get(requestOptions, (res: IncomingMessage) => {
            if (res.statusCode === 200) {
                let rawData = '';
                res.setEncoding('utf8');
                res.on('data', (chunk: string) => rawData += chunk);
                res.once('error', err => {
                    res.removeAllListeners();
                    reject(new Error(`Request error (${err.message}): ${pkgUrl.toString()}`));
                });
                res.once('end', () => {
                    res.removeAllListeners();
                    try {
                        const pkgMetadata = JSON.parse(rawData) as Record<string, unknown>;
                        resolve({
                            name: pkgName,
                            lastUpdateDate: Date.now(),
                            versions: Object.keys(pkgMetadata['versions'] as string[]),
                            distTags: pkgMetadata['dist-tags'] as Record<string, string>,
                        });
                        return;
                    } catch (error) {
                        if (typeof error === 'string') {
                            reject(new Error(error));
                        } else if (error instanceof Error) {
                            reject(error);
                        } else {
                            reject(new Error('Metadata extraction error'));
                        }
                        return;
                    }
                });
            } else {
                res.removeAllListeners();
                res.resume(); // consume response data to free up memory
                reject(new Error(`Request error (${res.statusCode ?? 'unknown'}): ${pkgUrl.toString()}`));
                return;
            }
        });
        const abort = (error: Error | string): void => {
            request.destroy();
            reject(typeof error === 'string' ? new Error(error) : error);
        };
        request.once('timeout', () => { abort(`Request timed out: ${pkgUrl.toString()}`); });
        request.once('error', (err: Error) => { abort(err); });
        request.once('close', () => { request.removeAllListeners(); });
    });
