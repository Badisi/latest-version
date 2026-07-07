<h1 align="center">
    @badisi/latest-version
</h1>

<p align="center">
    <i>📦 Get latest versions of packages.</i><br/>
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@badisi/latest-version">
        <img src="https://img.shields.io/npm/v/@badisi/latest-version.svg?color=blue&logo=npm" alt="npm version" /></a>
    <a href="https://npmcharts.com/compare/@badisi/latest-version?minimal=true">
        <img src="https://img.shields.io/npm/dw/@badisi/latest-version.svg?color=7986CB&logo=npm" alt="npm donwloads" /></a>
    <a href="https://github.com/Badisi/latest-version/blob/main/LICENSE">
        <img src="https://img.shields.io/npm/l/@badisi/latest-version.svg?color=ff69b4" alt="license" /></a>
</p>

<p align="center">
    <a href="https://github.com/Badisi/latest-version/actions/workflows/ci_tests.yml">
        <img src="https://img.shields.io/github/actions/workflow/status/badisi/latest-version/ci_tests.yml?logo=github" alt="build status" /></a>
    <a href="https://github.com/Badisi/latest-version/blob/main/CONTRIBUTING.md#-submitting-a-pull-request-pr">
        <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
</p>

<hr/>

## Features

✅ Get `installed` versions of packages *(if installed locally or globally with npm or yarn)*<br/>
✅ Get `latest` and `next` versions of packages *(from package registries)*<br/>
✅ Get `wanted` version of packages *(if a version range or a tag is provided)*<br/>
✅ Check if any `updates` are available<br/>
✅ Cache support to increase data retrieval performance<br/>
✅ Support public/private repositories and proxies<br/>
✅ Dual build support (CJS/ESM)<br/>

## Installation

```sh
npm install @badisi/latest-version --save
```

```sh
yarn add @badisi/latest-version
```

## Usage

__Example__

```ts
/** CommonJS */
// const { latestVersion } = require('@badisi/latest-version');
// const { readFileSync } = require('node:fs');

/** ESM / Typescript */
import { latestVersion } from '@badisi/latest-version';
import { readFileSync } from 'node:fs';

(async () => {
    // Single package
    const pkg = await latestVersion('npm');

    // List of packages
    const pkgs = await latestVersion(['npm', 'npm@1.3.2', 'npm@beta', '@scope/name@^5.0.2']);

    // Package.json
    const pkgs = await latestVersion(JSON.parse(readFileSync('package.json').toString()));

    // Using cache
    const pkg = await latestVersion('npm@^5.0.2', { useCache: true });
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
    /**
     * The latest version of the package found on the registry (if found).
     */
    latest?: string;
    /**
     * The next version of the package found on the registry (if found).
     */
    next?: string;
    /**
     * The tag or version range that was provided (if provided).
     *
     * @default "latest"
     */
    wantedTagOrRange?: string;
    /**
     * The latest version of the package found on the registry and satisfied by the wanted tag or version range.
     */
    wanted?: string;
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
```

__Options__

```ts
interface LatestVersionOptions {
    /**
     * Awaiting the api to return might take time, depending on the network, and might impact your package loading performance.
     * You can use the cache mechanism to improve load performance and reduce unnecessary network requests.
     * If `useCache` is not supplied, the api will always check for updates and wait for every requests to return before returning itself.
     * If `useCache` is used, the api will either (for each provided packages):
     * 1) return immediately if a cache was found.
     * 2) fetch and wait for updates of that particular package then creates a cache for it so that it is available for the next call to the api.
     *
     * @default false
     */
    useCache?: boolean;

    /**
     * How long the cache for each provided packages should be used before being refreshed (in milliseconds).
     * If `useCache` is not supplied, this option has no effect.
     * If `0` is used, this will force the cache to refresh immediately:
     * 1) New updates will be fetched and waited
     * 2) The cache for each provided packages will be refreshed and made available for the next call to the api
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

#### > Want to Help ?

Want to file a bug, contribute some code or improve documentation ? Excellent!

But please read up first on the guidelines for [contributing][contributing], and learn about submission process, coding rules and more.

#### > Code of Conduct

Please read and follow the [Code of Conduct][codeofconduct] and help me keep this project open and inclusive.




[clipreview]: https://github.com/Badisi/latest-version/blob/main/cli_preview.png
[developer]: https://github.com/Badisi/latest-version/blob/main/DEVELOPER.md
[contributing]: https://github.com/Badisi/latest-version/blob/main/CONTRIBUTING.md
[codeofconduct]: https://github.com/Badisi/latest-version/blob/main/CODE_OF_CONDUCT.md
