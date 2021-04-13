# @badisi/latest-version

📦 Get latest versions of packages.

[![npm version](https://img.shields.io/npm/v/@badisi/latest-version.svg?color=blue&logo=npm)][npm]
[![npm downloads](https://img.shields.io/npm/dw/@badisi/latest-version.svg?color=blue&logo=npm)][npm-dl]
[![license](https://img.shields.io/npm/l/@badisi/latest-version.svg?color=ff69b4)][license]

[![build status](https://github.com/badisi/latest-version/workflows/CI%20tests/badge.svg)][ci-tests]
[![dependencies status](https://img.shields.io/david/badisi/latest-version.svg)][david-deps]
[![devDependencies status](https://img.shields.io/david/dev/badisi/latest-version.svg)][david-dev-deps]
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)][pullrequest]

<hr>

## Features

* Get latest versions of packages *(from package registries)*
  * `latest`, `next` and `wanted` if a version range or a tag is provided
* Get `installed` version of packages *(if installed locally or globally)*
* Check if `updates` are available
* Cache support to increase data retrieval performance
* Support public/private repositories and proxies

## Installation

```sh
$ npm install @badisi/latest-version --save
```

```sh
$ yarn add @badisi/latest-version
```

## Usage

__Example__

```js
const { readFileSync } = require('fs');
const latestVersion = require('@badisi/latest-version');

(async () => {
    // Single package
    await latestVersion('npm');

    // List of packages
    await latestVersion(['npm', 'npm@1.3.2', 'npm@beta', '@scope/name@^5.0.2']);

    // Package.json
    await latestVersion(JSON.parse(readFileSync('package.json')));

    // Using cache
    await latestVersion('npm@^5.0.2', { useCache: true });
})();
```

__Return__

Either a collection or a single `LatestVersionPackage` object:

```ts
interface LatestVersionPackage {
    /**
     * The name of the package.
     */
    name: string;
    /**
     * The current local or global installed version of the package (if installed).
     */
    installed?: string;
    /**
     * The latest version of the package found on the provided registry (if found).
     */
    latest?: string;
    /**
     * The next version of the package found on the provided registry (if found).
     */
    next?: string;
    /**
     * The latest version of the package found on the provided registry and satisfied by the provided tag or version range (if provided).
     */
    wanted?: string;
    /**
     * The tag or version range that was provided (if provided).
     */
    wantedTagOrRange?: string;
    /**
     * Whether the installed version (if any) could be upgraded or not.
     */
    updatesAvailable: {
        latest: boolean;
        next: boolean;
        wanted: boolean;
    };
    /**
     * Any error that might have occurred during the process.
     */
    error?: Error;
}
```

__Options__

```ts
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
    useCache?: boolean;

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
    cacheMaxAge?: number;

    /**
     * A JavaScript package registry url that implements the CommonJS Package Registry specification.
     *
     * @default "Looks at any registry urls in the .npmrc file or fallback to the default npm registry instead"
     * @example <caption>.npmrc</caption>
     * registry = 'https://custom-registry.com/'
     * @pkgscope:registry = 'https://custom-registry.com/'
     */
    registryUrl?: string;

    /**
     * Set of options to be passed down to Node.js http/https request.
     *
     * @example <caption>Behind a proxy with self-signed certificate</caption>
     * { ca: fs.readFileSync('proxy-cert.pem') }
     * @example <caption>Bypassing certificate validation</caption>
     * { rejectUnauthorized: false }
     */
    requestOptions?: RequestOptions;
}
```


## Development

See the [developer docs][developer].


## Contributing

### Want to Help ?

Want to file a bug, contribute some code or improve documentation ? Excellent!

But please read up first on the guidelines for [contributing][contributing], and learn about submission process, coding rules and more.

### Code of Conduct

Please read and follow the [Code of Conduct][codeofconduct] and help me keep this project open and inclusive.




[npm]: https://www.npmjs.com/package/@badisi/latest-version
[npm-dl]: https://npmcharts.com/compare/@badisi/latest-version?minimal=true
[ci-tests]: https://github.com/badisi/latest-version/actions?query=workflow:CI%20tests
[david-deps]: https://david-dm.org/badisi/latest-version
[david-dev-deps]: https://david-dm.org/badisi/latest-version?type=dev
[pullrequest]: https://github.com/badisi/latest-version/blob/master/CONTRIBUTING.md#-submitting-a-pull-request-pr
[license]: https://github.com/badisi/latest-version/blob/master/LICENSE
[developer]: https://github.com/badisi/latest-version/blob/master/DEVELOPER.md
[contributing]: https://github.com/badisi/latest-version/blob/master/CONTRIBUTING.md
[codeofconduct]: https://github.com/badisi/latest-version/blob/master/CODE_OF_CONDUCT.md
