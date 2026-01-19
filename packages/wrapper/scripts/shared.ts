// --------------------------------------------------------------------------------------------- std

import {dirname, join} from 'node:path';

// --------------------------------------------------------------------------------------------- 3rd

import {$} from 'execa';
import { readFile } from 'node:fs/promises';



////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

export const rootPackage = dirname(import.meta.dirname);
export const rootSource = join(rootPackage, 'src');
export const rootEntryPoints = join(rootSource, 'entry-points');
export const pathTypeScript = join(rootSource, 'index.ts');
export const pathPython = join(rootSource, 'main.py');

export const rootDist = join(rootPackage, '.dist');
export const rootBuild = join(rootDist, 'build');
export const exeBaseName = 'es';
export const exeName = `${exeBaseName}.exe`;

export const rootCache = join(rootPackage, '.cache');
export const rootCacheEs = join(rootCache, 'es');
export const pathOriginalExe = join(rootCacheEs, exeName);

export const $$ = $({stdio: 'inherit', cwd: rootPackage});



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export async function getRepoRoot() {
    const {stdout} = await $`git rev-parse --show-toplevel`;
    return stdout.trim();
}

export async function getEsVersion() {
    const repoRoot = await getRepoRoot();
    const fileName = 'Changes.txt';
    const pathReleaseNotes = join(repoRoot, fileName);
    const notes = await readFile(pathReleaseNotes, 'utf-8');
    const lines = notes.split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/.*Version (.*)/);
        if (match?.[1] != null) return match[1].trim();
    }
    throw new Error(`Could not determine ES version from ${fileName}`);
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export function group(message: string) {
    console.group(message);
    return {
        [Symbol.dispose]() {
            console.groupEnd();
        }
    };
}
