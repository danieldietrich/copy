# Contribution Guidelines

## Prerequisites

* List global installations: `npm ls -g --depth=0`
* Globally install [npm-check-updates](https://github.com/tjunnone/npm-check-updates): `npm i -g npm-check-updates`
* Globally install [release-it](https://github.com/release-it/release-it): `npm i -g release-it`
* Locally install project dependencies: `npm i`
* Enable ESLint for TypeScript in VS Code settings.json:
    ```json
    "eslint.validate": [
        "javascript",
        "javascriptreact",
        "typescript",
        "typescriptreact"
    ]
    ```

## Scripts

Development:

* Upgrade dependencies: `ncu -u` (might require a `npm i` afterwards)
* Run tests: `npm test` (see [coverage/](./coverage/lcov-report/index.ts.html))
* Build project: `npm run build` (see [dist/](./dist/))

Release (patch, minor or major):

* Remove `"private": true` from `package.json`.
* Double-check package contents before release: `npm pack` (see .tgz file)
* Release (dry run): `release-it minor --dry-run`
* Release: `release-it minor` (tag and publish)