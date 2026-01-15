// --------------------------------------------------------------------------------------------- std

import {dirname, join} from 'node:path';

// --------------------------------------------------------------------------------------------- 3rd

import {$} from 'execa';



////////////////////////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////////////////////////

export const rootPackage = dirname(import.meta.dirname);
export const rootSource = join(rootPackage, 'src');
export const pathTypeScript = join(rootSource, 'index.ts');
export const pathPython = join(rootSource, 'main.py');

export const rootCache = join(rootPackage, '.cache');

export const rootDist = join(rootPackage, '.dist');
export const rootBuild = join(rootDist, 'build');
export const exeBaseName = 'es';
export const exeName = `${exeBaseName}.exe`;

export const $$ = $({stdio: 'inherit', cwd: rootPackage});
