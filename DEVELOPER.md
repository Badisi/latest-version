# Development

This document describes how you can test, build and publish the library.

## Prerequisite

Before you can build and test this library you must install and configure the following products on your development machine:

* [Node.js][nodejs]
* [Git][git]

You will then need to install the library required dependencies:

```sh
cd <library-path>
npm install
```

## Testing locally

You can test the library while developing it, as follow:

1. Create a test file

   ```ts
   // test.ts
   import latestVersion from './src/index';

   (async () => {
      console.log(await latestVersion('npm'));
   })();
   ```

2. Run the test file with *ts-node*

   ```sh
   npx ts-node test.ts
   ```

## Unit testing

Ensure that each unit of the library performs as expected.

```sh
npm run test
```

## Linting/verifying source code

Check that the code is properly formatted and adheres to coding style.

```sh
npm run lint
```

## Building the library

The library will be built in the `./dist` directory.

```sh
npm run build
```

## Publishing to NPM repository

This project comes with automatic continuous delivery (CD) using *GitHub Actions*.

1. Bump the library version in `./package.json`
2. Push the changes
3. Create a new: [GitHub release](https://github.com/badisi/latest-version/releases/new)
4. Watch the results in: [Actions](https://github.com/badisi/latest-version/actions)



[git]: https://git-scm.com/
[nodejs]: https://nodejs.org/
