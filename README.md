[![npm version](https://img.shields.io/npm/v/@danieldietrich/copy?logo=npm&style=flat-square)](https://www.npmjs.com/package/@danieldietrich/copy/)[![vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/@danieldietrich/copy?style=flat-square)](https://snyk.io/test/npm/@danieldietrich/copy)[![minzipped size](https://img.shields.io/bundlephobia/minzip/@danieldietrich/copy?style=flat-square)](https://bundlephobia.com/result?p=@danieldietrich/copy@latest)
&nbsp;
[![build](https://img.shields.io/travis/danieldietrich/copy?logo=github&style=flat-square)](https://travis-ci.org/danieldietrich/copy/)[![coverage](https://img.shields.io/codecov/c/github/danieldietrich/copy?style=flat-square)](https://codecov.io/gh/danieldietrich/copy/)
&nbsp;
![Platform](https://img.shields.io/badge/platform-Node%20v10%20%28ES8%2fES2017%29-decc47?logo=TypeScript&style=flat-square)
&nbsp;
[![donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?logo=paypal&style=flat-square)](https://paypal.me/danieldietrich13)[![patrons](https://img.shields.io/liberapay/patrons/danieldietrich?style=flat-square)](https://liberapay.com/danieldietrich/)[![license](https://img.shields.io/github/license/danieldietrich/copy?style=flat-square)](https://opensource.org/licenses/MIT/)
&nbsp;
[![Follow](https://img.shields.io/twitter/follow/danieldietrich?label=Follow&style=social)](https://twitter.com/danieldietrich/)

# copy

Simple yet powerful copy tool.

The copy tool recursively copies files, directories and links from a source directory to a destination directory.

Features:

* Transformation of file contents
* Filtering paths
* Preserving user permissions
* Overwriting or keeping existing files
* Creating or dereferencing links
* Preserving original timestamps
* Changing owner and group
* Collecting results (size & number of directories, files and links)
* Performing a dry run without writing files
* May be used as drop-in for [fs-extra/copy](https://github.com/jprichardson/node-fs-extra/blob/HEAD/docs/copy.md), see [Options](#options)

## Installation

```bash
npm i @danieldietrich/copy
```

## Usage

The module supports ES6 _import_ and CommonJS _require_ style.

```ts
import copy from '@danieldietrich/copy';

example();

setTimeout(() => console.log('Done.'), 3210);

// Performs a dry run of copying ./node_modules to ./temp
async function example() {
    const totals = await copy('node_modules', 'temp', { dryRun: true });
    console.log('Totals:', totals);
}
```

_Totals_ contains information about the copy operation:

```ts
{
    directories: 1338,
    files: 7929,
    symlinks: 48,
    size: 87873775
}
```

The _number_ of directories, files and symlinks corresponds to the source. The _size_ reflects the number of written bytes. In particular, the size might be smaller than the source, if existing files are not ovewritten.

The copy tool intentionally does not

* provide a synchronous API
* check for cycles, i.e. if the destination is a subdirectory of the source
* provide an API to rename or move paths
* provide a transform API based on streams and chunks
* preserve the timestamp of links (because node does not provide an OS independent API for that purpose)

## API

The general signature of _copy_ is:

```ts
async function copy(source: string, target: string, options?: Options): Promise<Totals>;

type Options = {
    overwrite?: boolean;
    errorOnExist?: boolean;
    dereference?: boolean;
    preserveTimestamps?: boolean;
    chown?: number;
    chgrp?: number;
    dryRun?: boolean;
    filter?: (source: string, target: string, sourceStats: fs.Stats, targetStats: fs.Stats | undefined) => boolean | Promise<boolean>;
    transform?: (data: Buffer, source: string, target: string, sourceStats: fs.Stats, targetStats: fs.Stats | undefined) => Buffer | Promise<Buffer>;
};

type Totals = {
    directories: number;
    files: number;
    symlinks: number;
    size: number;
};
```

## Options

Copy is a superset of fs-extra/copy. Option names and default values correspond to fs-extra/copy options.

| Option | copy|
| -- | -- |
| <tt>overwrite</tt> | Preserves exising files when set to <tt>false</tt>. Default: <tt>true</tt> |
| <tt>errorOnExist</tt> | Used in conjunction with <tt>overwrite: false</tt>. Default: <tt>false</tt> |
| <tt>dereference</tt> | Copies files if <tt>true</tt>. Default: <tt>false</tt> |
| <tt>preserveTimestamps</tt> | Preserves the original timestamps. Default: <tt>false</tt> |
| <tt>chown</tt><sup>*)</sup> | A [uid](https://en.wikipedia.org/wiki/User_identifier). Changes the owner (preserved by default). |
| <tt>chgrp</tt><sup>*)</sup> | A [gid](https://en.wikipedia.org/wiki/Group_identifier). Changes the group (preserved by default). |
| <tt>dryRun</tt><sup>*)</sup> | Does not perform any write operations. Default: <tt>false</tt> |
| <tt>filter</tt> | Optional path filter, sync or async. Paths are excluded when returning <tt>false</tt> and included on <tt>true</tt>. There are four arguments: <tt>source</tt> path and the <tt>target</tt> path of type <tt>string</tt>, followed by the <tt>sourceStats</tt> and <tt>targetStats</tt> of type node <tt>fs.Stats</tt>. |
| <tt>transform</tt><sup>*)</sup> | Optional transformation of file contents, sync or async. There are five arguments: <tt>data</tt>, a <tt>Buffer</tt> containing the file contents, the <tt>source</tt> path and the <tt>target</tt> path of type <tt>string</tt>, followed by the <tt>sourceStats</tt> and <tt>targetStats</tt> of type node <tt>fs.Stats</tt>. |

*) fs-extra does not have this feature

---

Copyright &copy; 2019 by [Daniel Dietrich](cafebab3@gmail.com). Released under the [MIT](https://opensource.org/licenses/MIT/) license.