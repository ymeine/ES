// --------------------------------------------------------------------------------------------- std

import {join} from 'node:path';
import {rm} from 'node:fs/promises';

// ---------------------------------------------------------------------------------------- internal

import {$$, exeBaseName, exeName, pathPython, pathTypeScript, rootBuild, rootCache, rootPackage} from './shared';



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export class BuilderOptions {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// 
	////////////////////////////////////////////////////////////////////////////////////////////////

	readonly pathTarget: string;
	readonly rootTarget: string;

	constructor(readonly name: string) {
		this.rootTarget = join(rootBuild, this.name);
		this.pathTarget = join(this.rootTarget, exeName);
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

class Builder {
	readonly options: BuilderOptions;

	constructor(name: string, readonly _build: () => Promise<void>) {
		this.options = new BuilderOptions(name);
	}

	get name() { return this.options.name; }
	get rootTarget() { return this.options.rootTarget; }
	get pathTarget() { return this.options.pathTarget; }

	async build() {
		try {
			console.log(`Building for ${this.options.name}...`);
			console.log();
			await this._build();
		} catch {} finally {
			console.log();
			console.log('-'.repeat(40));
			console.log();
		}
	}
}

class DenoBuilder extends Builder {
	constructor() {
		super('deno', () => this.__build());
	}

	// XXX 2026-01-15T11:10:31+01:00@Europe/Paris
	// It embeds the whole package by default, it should not.
	// Even with the exclude, it still embeds node_modules and some unwanted things.
	// --no-npm was needed...
	async __build() {
		await $$`deno compile --sloppy-imports -A --exclude . --no-npm --output ${this.pathTarget} ${pathTypeScript}`;
	}
}

class BunBuilder extends Builder {
	constructor() {
		super('bun', () => this.__build());
	}

	async __build() {
		await $$`bun build ${pathTypeScript} --compile --outfile ${this.pathTarget}`;
	}
}

class NodeBuilder extends Builder {
	constructor() {
		super('node', () => this.__build());
	}

	async __build() {
		throw new Error('Not implemented');
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

class PyInstallerBuilder extends Builder {
	readonly cachePath: string;

	constructor() {
		super('pyinstaller', () => this.__build());
		this.cachePath = join(rootCache, this.name);
	}

	async __build() {
		await $$`uv run pyinstaller ${pathPython} --distpath ${this.rootTarget} --workpath ${this.cachePath} --noconfirm --onefile --name ${exeBaseName}`;
		await rm(join(rootPackage, `${exeBaseName}.spec`));
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

async function build() {
	const deno = new DenoBuilder();
	const bun = new BunBuilder();
	const node = new NodeBuilder();
	const pyInstaller = new PyInstallerBuilder();

	await deno.build();
	await bun.build();
	// await node.build();
	await pyInstaller.build();
}

if (import.meta.main) await build();
