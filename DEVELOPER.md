# Development

This document describes how you can lint, test, build and publish this project.

## Prerequisite

Before you can start you must install and configure the following products on your development machine:

* [Node.js][nodejs]
* [Git][git]

You will then need to clone this project and install the required dependencies:

```sh
git clone <repository_url> <dir_name>
cd <dir_name>
npm install
```

## Linting/verifying source code

Check that the code is properly formatted and adheres to coding style.

```sh
npm run lint
```

## Unit testing

Ensure that each unit of the library performs as expected.

```sh
npm run test
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

## Building the library

The library will be built in the `./dist` directory.

```sh
npm run build
```

## Publishing to NPM repository

This project comes with automatic continuous delivery (CD) using *GitHub Actions*.

1. Bump the library version in `./package.json`
2. Push the changes
3. Create a new [GitHub release](https://github.com/Badisi/latest-version/releases/new)
4. Watch the results in: [Actions](https://github.com/Badisi/latest-version/actions)



[git]: https://git-scm.com/
[nodejs]: https://nodejs.org/
