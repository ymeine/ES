// --------------------------------------------------------------------------------------------- std

import {tmpdir} from 'node:os';
import {getAsset} from 'node:sea';

import {join} from 'node:path';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';

// ---------------------------------------------------------------------------------------- internal

import {exeName, run} from '../shared';



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

async function main() {
    const data = getAsset(exeName);
    const tmp = await mkdtemp(join(tmpdir(), 'es-'));
    const exePath = join(tmp, exeName);
    await writeFile(exePath, Buffer.from(data));

    await run(exePath);
    
    await rm(tmp, {recursive: true, force: true});
}

main();
