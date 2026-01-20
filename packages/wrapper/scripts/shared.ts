// --------------------------------------------------------------------------------------------- std

import {dirname, join} from 'node:path';

// --------------------------------------------------------------------------------------------- 3rd

import {$} from 'execa';

// ---------------------------------------------------------------------------------------- internal

import { Path } from './Path';



////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

export const rootScripts = Path.sourceFolder(import.meta);
export const rootPackage = rootScripts.parent();
export const rootSource = rootPackage.join('src');
export const rootEntryPoints = rootSource.join('entry-points');
export const pathTypeScript = rootSource.join('index.ts');
export const pathPython = rootSource.join('main.py');

export const rootDist = rootPackage.join('.dist');
export const rootBuild = rootDist.join('build');
export const exeBaseName = 'es';
export const exeName = `${exeBaseName}.exe`;

export const rootCache = rootPackage.join('.cache');
export const rootCacheEs = rootCache.join('es');
export const pathOriginalExe = rootCacheEs.join(exeName);

export const $$ = $({stdio: 'inherit', cwd: rootPackage.toString()});



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export async function getRepoRoot() {
    const {stdout} = await $`git rev-parse --show-toplevel`;
    return Path.fromString(stdout.trim());
}

export async function getEsVersion() {
    const repoRoot = await getRepoRoot();
    const fileName = 'Changes.txt';
    const pathReleaseNotes = repoRoot.join(fileName);
    const lines = await pathReleaseNotes.lines().read();
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
    const dispose = () => console.groupEnd();
    return {[Symbol.dispose]: dispose};
}
