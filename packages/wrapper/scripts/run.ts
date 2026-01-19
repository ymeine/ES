// --------------------------------------------------------------------------------------------- 3rd

import {parseCommandString} from 'execa';

// ---------------------------------------------------------------------------------------- internal

import {$$, pathPython, pathTypeScript} from './shared';
import {BuilderOptions} from './build';




////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

const QUERY = process.env.QUERY;
if (QUERY == null) throw new Error('Environment variable QUERY is not set.');
const query = QUERY;



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

async function run(message: string, command: string[]) {
    try {
        console.log(message);
        console.log();
        await $$`${command} ${query}`;
    } catch {} finally {
        console.log();
        console.log('-'.repeat(40));
        console.log();
    }
}

class Runner {
    readonly baseArgs: string[];
    
    constructor(readonly name: string, readonly sourcePath: string, baseArgs: string) {
        this.baseArgs = parseCommandString(baseArgs);
    }

    async run() {
        await run(`Running via ${this.name}...`, [...this.baseArgs, this.sourcePath]);
    }
}

class CompiledRunner {
    readonly path: string;

    constructor(readonly name: string) {
        const builder = new BuilderOptions(name);
        this.path = builder.pathTarget;
    }

    async run() {
        await run(`Running compiled from ${this.name}...`, [this.path]);
    }
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

const bun = new Runner('bun', pathTypeScript, 'bun run');
const deno = new Runner('deno', pathTypeScript, 'deno run --sloppy-imports -A');
const node = new Runner('node', pathTypeScript, 'bun run tsx');
const python = new Runner('python', pathPython, 'uv run python');

const bunCompiled = new CompiledRunner('bun');
const denoCompiled = new CompiledRunner('deno');
const nodeCompiled = new CompiledRunner('node');
const pyinstaller = new CompiledRunner('pyinstaller');
const pyinstallerOneFile = new CompiledRunner('pyinstaller-onefile');

// await bun.run();
// await deno.run();
// await node.run();
// await python.run();

// await bunCompiled.run();
// await denoCompiled.run();
// await nodeCompiled.run();
await pyinstaller.run();
// await pyinstallerOneFile.run();