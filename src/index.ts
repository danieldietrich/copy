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
    const lchown = promisify(fs.lchown);
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

    const { overwrite, errorOnExist, dereference, preserveTimestamps, chown, chgrp, dryRun, filter, rename, transform } = Object.assign(defaultOptions, options);
    const flag = overwrite ? 'w' : 'wx'; // fs file system flags
    const [directories, files, symlinks, size] = await cpPath(sourcePath, targetPath, [0, 0, 0, 0]);

    return {
        directories,
        files,
        symlinks,
        size,
    };

    async function cpPath(source: string, _target: string, subTotals: SubTotals): Promise<SubTotals> {

        const sourceStats = await lstat(source);
        const _targetStats = await lstat(_target).catch(ENOENT); // undefined if not exists
        const target = rename && await Promise.resolve(rename(source, _target, sourceStats, _targetStats)) || _target;
        const targetStats = target && await lstat(target).catch(ENOENT) || _targetStats;

        if (!filter || await Promise.resolve(filter(source, target, sourceStats, targetStats))) {
            if (errorOnExist && targetStats && !overwrite) {
                throw Error(`target already exists: ${target}`);
            }
            if (sourceStats.isFile() || (dereference && sourceStats.isSymbolicLink())) {
                const fileSize = await cpFile(source, target, sourceStats, targetStats);
                subTotals[1] += 1;
                subTotals[3] += fileSize; // subTotals[3] += await cpFile(...) leads to race conditions!
            } else if (sourceStats.isDirectory()) {
                subTotals[0] += 1; // don't counting directory size produces the same result as macOS "Get info" on a folder
                await cpDir(source, target, sourceStats, targetStats, subTotals);
            } else if (sourceStats.isSymbolicLink()) {
                const symlinkSize = await cpSymlink(source, target, sourceStats, targetStats);
                subTotals[2] += 1;
                subTotals[3] += symlinkSize; // subTotals[3] += await cpSymlink(...) leads to race conditions!
            }
            if (!dryRun) {
                if (preserveTimestamps && (!targetStats || overwrite)) {
                    // see https://github.com/nodejs/node-v0.x-archive/issues/2142
                    if (!sourceStats.isSymbolicLink()) {
                        await utimes(target, sourceStats.atime, sourceStats.mtime);
                    }
                }
                if (chown || chgrp) {
                    await lchown(target, chown || sourceStats.uid, chgrp || sourceStats.gid);
                }
            }
        }

        return subTotals;
    }

    async function cpDir(source: string, target: string, sourceStats: fs.Stats, targetStats: fs.Stats | undefined, subTotals: SubTotals) {
        if (!dryRun && !targetStats) {
            await mkdir(target, { recursive: true, mode: sourceStats.mode });
        }
        await Promise.all( // much faster than for-of loop
            (await readdir(source)).map(async child =>
                cpPath(path.join(source, child), path.join(target, child), subTotals),
            ),
        );
    }

    async function cpFile(source: string, target: string, sourceStats: fs.Stats, targetStats: fs.Stats | undefined): Promise<number> {
        if (transform) {
            const data = await Promise.resolve(transform(await readFile(source), source, target, sourceStats, targetStats));
            if (!dryRun && (!targetStats || overwrite)) {
                await writeFile(target, data, { mode: sourceStats.mode, flag });
            }
            return data.length; // transformed file size
        } else if (!targetStats || overwrite) {
            if (!dryRun) {
                await copyFile(source, target);
            }
            return sourceStats.size;
        } else {
            return 0;
        }
    }

    async function cpSymlink(source: string, target: string, sourceStats: fs.Stats, targetStats: fs.Stats | undefined): Promise<number> {
        if (!targetStats || overwrite) {
            const link = await readlink(source);
            if (!dryRun) {
                if (targetStats) {
                    await unlink(target); // fails if target is a dir
                }
                await symlink(link, target);
            }
            return sourceStats.size; // we assume that a symlink size does not change
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
        chown?: number;
        chgrp?: number;
        dryRun?: boolean;
        filter?: (source: string, target: string, sourceStats: fs.Stats, targetStats: fs.Stats | undefined) => boolean | Promise<boolean>;
        rename?: (source: string, target: string, sourceStats: fs.Stats, targetStats: fs.Stats | undefined) => string | void | Promise<string | void>;
        transform?: (data: Buffer, source: string, target: string, sourceStats: fs.Stats, targetStats: fs.Stats | undefined) => Buffer | Promise<Buffer>;
    };

    export type Totals = {
        directories: number;
        files: number;
        symlinks: number;
        size: number; // not size on disk in blocks
    };
}

export = copy;
