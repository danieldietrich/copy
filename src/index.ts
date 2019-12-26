import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

/**
 * Recursively copies a path.
 *
 * @param source a source path
 * @param target a target path
 * @options copy options
 * @returns a new Promise which is resolved with totals or rejected with an error
 */
async function copy(sourcePath: string, targetPath: string, options?: copy.Options): Promise<copy.Totals> {

    // promisify all the things as long as fs.promises is stage-1 experimental
    const copyFile = promisify(fs.copyFile);
    const lstat = promisify(fs.lstat);
    const mkdir = promisify(fs.mkdir);
    const readdir = promisify(fs.readdir);
    const readFile = promisify(fs.readFile);
    const readlink = promisify(fs.readlink);
    const symlink = promisify(fs.symlink);
    const unlink = promisify(fs.unlink);
    const utimes = promisify(fs.utimes);
    const writeFile = promisify(fs.writeFile);

    // same defaults as fs-extra.copy
    const defaultOptions: copy.Options = {
        overwrite: true,
        errorOnExist: false,
        dereference: false,
        preserveTimestamps: false,
        dryRun: false,
    };

    const derivedOptions = Object.assign(defaultOptions, options);
    const { overwrite, errorOnExist, dereference, preserveTimestamps, dryRun, rename, filter, transform, afterEach } = derivedOptions;
    const flag = overwrite ? 'w' : 'wx'; // fs file system flags
    const [directories, files, symlinks, size] = await cpPath(sourcePath, targetPath, [0, 0, 0, 0]);

    return {
        directories,
        files,
        symlinks,
        size,
    };

    async function cpPath(src: string, dst: string, subTotals: SubTotals): Promise<SubTotals> {
        const source: copy.Source = { path: src, stats: await lstat(src) };
        const target: copy.Target = { path: dst, stats: await lstat(dst).catch(ENOENT) };
        if (rename) {
            target.path = await Promise.resolve(rename(source, target, derivedOptions)) || target.path;
            target.stats = await lstat(target.path).catch(ENOENT) || target.stats;
        }
        if (!filter || await Promise.resolve(filter(source, target, derivedOptions))) {
            if (errorOnExist && target.stats && !overwrite) {
                throw Error(`target already exists: ${target}`);
            }
            if (source.stats.isFile() || (dereference && source.stats.isSymbolicLink())) {
                const fileSize = await cpFile(source, target);
                subTotals[1] += 1;
                subTotals[3] += fileSize; // subTotals[3] += await cpFile(...) leads to race conditions!
            } else if (source.stats.isDirectory()) {
                await cpDir(source, target, subTotals);
                subTotals[0] += 1; // don't counting directory size produces the same result as macOS "Get info" on a folder
            } else if (source.stats.isSymbolicLink()) {
                const symlinkSize = await cpSymlink(source, target);
                subTotals[2] += 1;
                subTotals[3] += symlinkSize; // subTotals[3] += await cpSymlink(...) leads to race conditions!
            }
            if (!dryRun) {
                if (preserveTimestamps && (!target.stats || overwrite)) {
                    // see https://github.com/nodejs/node/issues/16695
                    if (!source.stats.isSymbolicLink()) {
                        await utimes(target.path, source.stats.atime, source.stats.mtime);
                    }
                }
                if (afterEach) {
                    target.stats = target.stats || await lstat(target.path).catch(ENOENT);
                }
            }
            if (afterEach) {
                await Promise.resolve(afterEach(source, target, derivedOptions));
            }
        }

        return subTotals;
    }

    async function cpDir(source: copy.Source, target: copy.Target, subTotals: SubTotals) {
        if (!dryRun && !target.stats) {
            await mkdir(target.path, { recursive: true, mode: source.stats.mode });
        }
        await Promise.all( // much faster than a for-of loop
            (await readdir(source.path)).map(async child =>
                cpPath(path.join(source.path, child), path.join(target.path, child), subTotals),
            ),
        );
    }

    async function cpFile(source: copy.Source, target: copy.Target): Promise<number> {
        if (transform) {
            const data = await Promise.resolve(transform(await readFile(source.path), source, target, derivedOptions));
            if (!dryRun && (!target.stats || overwrite)) {
                await writeFile(target.path, data, { mode: source.stats.mode, flag });
            }
            return data.length; // transformed file size
        } else if (!target.stats || overwrite) {
            if (!dryRun) {
                await copyFile(source.path, target.path);
            }
            return source.stats.size;
        } else {
            return 0;
        }
    }

    async function cpSymlink(source: copy.Source, target: copy.Target): Promise<number> {
        if (!target.stats || overwrite) {
            const link = await readlink(source.path);
            if (!dryRun) {
                if (target.stats) {
                    await unlink(target.path); // fails if target is a dir
                }
                await symlink(link, target.path);
            }
            return source.stats.size; // we assume that a symlink size does not change
        } else {
            return 0;
        }
    }

    async function ENOENT(err: { code: unknown }) {
        if (err.code === 'ENOENT') {
            return undefined; // file or dir not found, works also for links
        } else {
            throw err;
        }
    }

    // [files, directories, symlinks, size]
    type SubTotals = [number, number, number, number];
}

namespace copy {

    // compatible to fs-extra.copy
    export type Options = {
        overwrite?: boolean;
        errorOnExist?: boolean;
        dereference?: boolean;
        preserveTimestamps?: boolean;
        dryRun?: boolean;
        rename?: (source: Source, target: Target, options: Options) => string | void | Promise<string | void>;
        filter?: (source: Source, target: Target, options: Options) => boolean | Promise<boolean>;
        transform?: (data: Buffer, source: Source, target: Target, options: Options) => Buffer | Promise<Buffer>;
        afterEach?: (source: Source, target: Target, options: Options) => void | Promise<void>;
    };

    export type Source = {
        path: string;
        stats: fs.Stats;
    };

    export type Target = {
        path: string;
        stats?: fs.Stats;
    };

    export type Totals = {
        directories: number;
        files: number;
        symlinks: number;
        size: number; // not size on disk in blocks
    };
}

export = copy;
