import * as copy from '.';
import * as fs from 'fs';
import * as rimraf from 'rimraf';
import { promisify } from 'util';

// promisify all the things as long as fs.promises is stage-1 experimental
const access = promisify(fs.access);
const exists = (target: string) => access(target).then(() => true).catch(() => false); // fs.exists has been deprecated
const mkdir = promisify(fs.mkdir);
const rmdir = promisify(rimraf);
const stat = promisify(fs.stat);
const symlink = promisify(fs.symlink);
const unlink = promisify(fs.unlink);
const utimes = promisify(fs.utimes);
const writeFile = promisify(fs.writeFile);

afterEach(() => tempDir('rm'));

describe('Basic behavior', () => {

    test('Should copy an empty dir to itself', async () => {
        const tmp = await tempDir();
        const totals = await copy(`${tmp}/src/d3`, `${tmp}/src/d3`);
        expect(totals).toEqual({ directories: 1, files: 0, symlinks: 0, size: 0 });
    });

    test('Should copy non-empty source to target', async () => {
        const tmp = await tempDir();
        const totals = await copy(`${tmp}/src`, `${tmp}/dst`);
        expect(totals).toEqual({ directories: 5, files: 3, symlinks: 3, size: 26 });
    });

    /* TODO: fs.mkdir(path, { recursive: true }) should work with node 10.15.1+ but it doesn't
    test('Should recursively create non-existing target directory', async () => {
        const tmp = await tempDir();
        const totals = await copy(`${tmp}/src`, `${tmp}/dst/sub/sub/sub`);
        expect(totals).toEqual({ directories: 5, files: 3, symlinks: 3, size: 26 });
    });
    */

});

describe('Options.overwrite', () => {

    test('Should copy again when { overwrite: true } (default)', async () => {
        const tmp = await tempDir();
        const run1 = await copy(`${tmp}/src`, `${tmp}/dst`);
        const run2 = await copy(`${tmp}/src`, `${tmp}/dst`);
        expect(run1).toEqual({ directories: 5, files: 3, symlinks: 3, size: 26 });
        expect(run2).toEqual(run1);
    });

    test('Should fail when copying again and { overwrite: false }', async () => {
        const tmp = await tempDir();
        const run1 = await copy(`${tmp}/src`, `${tmp}/dst`);
        const run2 = await copy(`${tmp}/src`, `${tmp}/dst`, { overwrite: false });
        expect(run1).toEqual({ directories: 5, files: 3, symlinks: 3, size: 26 });
        expect(run2).toEqual({ directories: 5, files: 3, symlinks: 3, size: 0 });
    });

});

describe('Options.errorOnExist', () => {

    test('Should not fail when copying again and { errorOnExist: true, overwrite: true }', async () => {
        const tmp = await tempDir();
        const run1 = await copy(`${tmp}/src`, `${tmp}/dst`);
        const run2 = await copy(`${tmp}/src`, `${tmp}/dst`, { errorOnExist: true });
        expect(run1).toEqual({ directories: 5, files: 3, symlinks: 3, size: 26 });
        expect(run2).toEqual({ directories: 5, files: 3, symlinks: 3, size: 26 });
    });

    test('Should fail when copying again and { errorOnExist: true, overwrite: false }', async () => {
        const tmp = await tempDir();
        await copy(`${tmp}/src`, `${tmp}/dst`);
        await expect(copy(`${tmp}/src`, `${tmp}/dst`, { errorOnExist: true, overwrite: false })).rejects.toThrow();
    });

});

describe('Options.dereference', () => {

    test('Should fail when trying to dereference broken links', async () => {
        const tmp = await tempDir();
        await unlink(`${tmp}/src/d1/l2`);
        // ENOENT: no such file or directory, copyfile '__tmp/src/d1/d3/l3' -> '__tmp/dst/d1/d3/l3'
        await expect(copy(`${tmp}/src`, `${tmp}/dst`, { dereference: true })).rejects.toThrow();
    });

    test('Should fail when trying to dereference cylclic links', async () => {
        const tmp = await tempDir();
        await writeFile(`${tmp}/src/d1/l1`, "fixed", { encoding: 'utf8' });
        const totals = await copy(`${tmp}/src`, `${tmp}/dst`, { dereference: true });
        expect(totals).toEqual({ directories: 5, files: 7, symlinks: 0, size: 31 });
    });

});

describe('Options.preserveMode', () => {

    test('Should preserve file mode when not transforming', async () => {
        const tmp = await tempDir();
        await copy(`${tmp}/src`, `${tmp}/dst`);
        const fileModeSrc = (await stat(`${tmp}/src/d1/f1`)).mode;
        const fileModeDst = (await stat(`${tmp}/dst/d1/f1`)).mode;
        expect(fileModeSrc).toBe(fileModeDst);
    });

    test('Should preserve dir mode when not transforming', async () => {
        const tmp = await tempDir();
        await copy(`${tmp}/src`, `${tmp}/dst`);
        const dirModeSrc = (await stat(`${tmp}/src/d3`)).mode;
        const dirModeDst = (await stat(`${tmp}/dst/d3`)).mode;
        expect(dirModeSrc).toBe(dirModeDst);
    });

    test('Should preserve file mode when transforming', async () => {
        const tmp = await tempDir();
        await copy(`${tmp}/src`, `${tmp}/dst`, { transform: data => data });
        const fileModeSrc = (await stat(`${tmp}/src/d1/f1`)).mode;
        const fileModeDst = (await stat(`${tmp}/dst/d1/f1`)).mode;
        expect(fileModeSrc).toBe(fileModeDst);
    });

    test('Should preserve dir mode when transforming', async () => {
        const tmp = await tempDir();
        await copy(`${tmp}/src`, `${tmp}/dst`, { transform: data => data });
        const dirModeSrc = (await stat(`${tmp}/src/d3`)).mode;
        const dirModeDst = (await stat(`${tmp}/dst/d3`)).mode;
        expect(dirModeSrc).toBe(dirModeDst);
    });

});

describe('Options.preserveTimestamps', () => {

    test('Should preserve file timestamps when { preserveTimestamps: true }', async () => {
        const tmp = await tempDir();
        await copy(`${tmp}/src`, `${tmp}/dst`, { preserveTimestamps: true });
        const srcFileStats = await stat(`${tmp}/src/d1/f1`);
        const dstFileStats = await stat(`${tmp}/dst/d1/f1`);
        // atime was changed when stat accessed the file
        expect(dstFileStats.mtime).toEqual(srcFileStats.mtime);
    });

    test('Should preserve dir timestamps when { preserveTimestamps: true }', async () => {
        const tmp = await tempDir();
        await copy(`${tmp}/src`, `${tmp}/dst`, { preserveTimestamps: true });
        const srcDirStats = await stat(`${tmp}/src/d3`);
        const dstDirStats = await stat(`${tmp}/dst/d3`);
        // atime was changed when stat accessed the dir
        expect(dstDirStats.mtime).toEqual(srcDirStats.mtime);
    });

});

describe('Options.chown', () => {

    test('Should chown identity (current user)', async () => {
        const tmp = await tempDir();
        const uid = (await stat(`${tmp}/src`)).uid;
        await copy(`${tmp}/src`, `${tmp}/dst`, { chown: uid });
    });

});

describe('Options.chgrp', () => {

    test('Should chgrp identity (current group)', async () => {
        const tmp = await tempDir();
        const gid = (await stat(`${tmp}/src`)).gid;
        await copy(`${tmp}/src`, `${tmp}/dst`, { chgrp: gid });
    });

});

describe('Options.dryRun', () => {

    test('Should perform a dyrun without writing anything', async () => {
        const tmp = await tempDir();
        const totals = await copy(`${tmp}/src`, `${tmp}/dst`, { dryRun: true });
        await expect(exists(`${tmp}/dst`)).resolves.toBeFalsy();
        expect(totals).toEqual({ directories: 5, files: 3, symlinks: 3, size: 26 });
    });

});

describe('Options.filter', () => {

    test('Should filter links sync', async () => {
        const tmp = await tempDir();
        const totals = await copy(`${tmp}/src`, `${tmp}/dst`, { filter: (source, target, sourceStats, targetStats) => {
            return !sourceStats.isSymbolicLink();
        }});
        expect(totals).toEqual({ directories: 5, files: 3, symlinks: 0, size: 11 });
    });

    test('Should filter links async', async () => {
        const tmp = await tempDir();
        const totals = await copy(`${tmp}/src`, `${tmp}/dst`, { filter: (source, target, sourceStats, targetStats) => {
            return Promise.resolve(!sourceStats.isSymbolicLink());
        }});
        expect(totals).toEqual({ directories: 5, files: 3, symlinks: 0, size: 11 });
    });

    test('Should rethrow filter failure sync', async () => {
        const tmp = await tempDir();
        await expect(copy(`${tmp}/src`, `${tmp}/dst`, { filter: (source, target, sourceStats, targetStats) => {
            throw Error('💩');
        }})).rejects.toThrow(Error('💩'));
    });

    test('Should rethrow filter failure async', async () => {
        const tmp = await tempDir();
        await expect(copy(`${tmp}/src`, `${tmp}/dst`, { filter: (source, target, sourceStats, targetStats) => {
            return Promise.reject(Error('💩'));
        }})).rejects.toThrow(Error('💩'));
    });

});

describe('Options.transform', () => {

    test('Should transform file sync', async () => {
        const tmp = await tempDir();
        const totals = await copy(`${tmp}/src`, `${tmp}/dst`, { transform: (data: Buffer, source, target, sourceStats, targetStats) => {
            if (target.endsWith('/f3')) {
                return Buffer.from("3️⃣", 'utf8');
            } else {
                return data;
            }
        }});
        expect(totals).toEqual({ directories: 5, files: 3, symlinks: 3, size: 28 });
    });

    test('Should transform file async', async () => {
        const tmp = await tempDir();
        const totals = await copy(`${tmp}/src`, `${tmp}/dst`, { transform: (data: Buffer, source, target, sourceStats, targetStats) => {
            if (target.endsWith('/f3')) {
                return Promise.resolve(Buffer.from("3️⃣", 'utf8'));
            } else {
                return Promise.resolve(data);
            }
        }});
        expect(totals).toEqual({ directories: 5, files: 3, symlinks: 3, size: 28 });
    });

    test('Should rethrow transform failure sync', async () => {
        const tmp = await tempDir();
        await expect(copy(`${tmp}/src`, `${tmp}/dst`, { transform: (data: Buffer, source, target, sourceStats, targetStats) => {
            throw Error('💩');
        }})).rejects.toThrow(Error('💩'));
    });

    test('Should rethrow transform failure async', async () => {
        const tmp = await tempDir();
        await expect(copy(`${tmp}/src`, `${tmp}/dst`, { transform: (data: Buffer, source, target, sourceStats, targetStats) => {
            return Promise.reject(Error('💩'));
        }})).rejects.toThrow(Error('💩'));
    });

});

// -- temp dir creation and cleanup

/*
__tmp/
└── src
    ├── d1
    │   ├── d3
    │   │   ├── f3
    │   │   ├── l1 -> ../l1
    │   │   └── l3 -> ../l2
    │   ├── f1
    │   └── l2 -> d3/l1
    ├── d2
    │   └── f2
    └── d3
*/
async function tempDir(mode: 'mk' | 'rm' = 'mk'): Promise<string> {
    const tmp = '__tmp';
    if (await exists(tmp)) {
        await rmdir(tmp);
    }
    if (mode === 'mk') {
        await mkdir(tmp);
        await mkdir(`${tmp}/src`);
        await mkdir(`${tmp}/src/d1`);
        await mkdir(`${tmp}/src/d1/d3`);
        await mkdir(`${tmp}/src/d2`);
        await mkdir(`${tmp}/src/d3`, { mode: 0o400 });
        await writeFile(`${tmp}/src/d1/f1`, "one", { encoding: 'utf8', mode: 0o600 });
        await writeFile(`${tmp}/src/d1/d3/f3`, "three", { encoding: 'utf8' });
        await writeFile(`${tmp}/src/d2/f2`, "two", { encoding: 'utf8' });
        await symlink('../l1', `${tmp}/src/d1/d3/l1`);
        await symlink('../l2', `${tmp}/src/d1/d3/l3`);
        await symlink('d3/l1', `${tmp}/src/d1/l2`);
        await utimes(`${tmp}/src/d1/f1`, 0, 0);
        await utimes(`${tmp}/src/d3`, 0, 0);
    }
    return tmp;
}
