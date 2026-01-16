// --------------------------------------------------------------------------------------------- std

import {join} from 'node:path';
import {cp, rm, writeFile} from 'node:fs/promises';

// ---------------------------------------------------------------------------------------- internal

import {$$, exeBaseName, exeName, pathPython, pathTypeScript, rootBuild, rootCache, rootPackage} from './shared';



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder
////////////////////////////////////////////////////////////////////////////////////////////////////

export class BuilderOptions {
	////////////////////////////////////////////////////////////////////////////////////////////////
	// 
	////////////////////////////////////////////////////////////////////////////////////////////////

	readonly pathTarget: string;
	readonly rootTarget: string;
	readonly rootCache: string;

	constructor(readonly name: string) {
		this.rootTarget = join(rootBuild, this.name);
		this.pathTarget = join(this.rootTarget, exeName);
		this.rootCache = join(rootCache, this.name);
	}
}

class Builder {
	readonly options: BuilderOptions;

	constructor(name: string, readonly _build: () => Promise<void>) {
		this.options = new BuilderOptions(name);
	}

	get name() { return this.options.name; }
	get rootTarget() { return this.options.rootTarget; }
	get pathTarget() { return this.options.pathTarget; }
	get rootCache() { return this.options.rootCache; }

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



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: Deno
////////////////////////////////////////////////////////////////////////////////////////////////////

class DenoBuilder extends Builder {
	constructor() { super('deno', () => this.__build()); }

	// XXX 2026-01-15T11:10:31+01:00@Europe/Paris
	// It embeds the whole package by default, it should not.
	// Even with the exclude, it still embeds node_modules and some unwanted things.
	// --no-npm was needed...
	async __build() {
		await $$`deno compile --sloppy-imports -A --exclude . --no-npm --output ${this.pathTarget} ${pathTypeScript}`;
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: Bun
////////////////////////////////////////////////////////////////////////////////////////////////////

class BunBuilder extends Builder {
	constructor() { super('bun', () => this.__build()); }

	async __build() {
		await $$`bun build ${pathTypeScript} --compile --outfile ${this.pathTarget}`;
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: Node.js
////////////////////////////////////////////////////////////////////////////////////////////////////

class NodeBuilder extends Builder {
	constructor() { super('node', () => this.__build()); }

	async __build() {
		// XXX 2026-01-16T02:29:46+01:00@Europe/Paris
		// That precise, absolute path will appear in error traces, if any.
		const pathBuiltFile = join(this.rootCache, 'index.js');
		const pathBlob = join(this.rootCache, 'content.blob');
		const pathSeaConfig = join(this.rootCache, 'sea-config.json');
		const signtool = 'C:/Program Files (x86)/Windows Kits/10/App Certification Kit/signtool.exe';

		// build source
		console.log('Building source with Bun...');
		await $$`bun build --outfile ${pathBuiltFile} --target node --format cjs ${pathTypeScript}`;

		// generate sea config
		console.log('Generating SEA blob...');
		const data = {
			main: pathBuiltFile,
			output: pathBlob,
			disableExperimentalSEAWarning: true,
			// XXX 2026-01-16T02:09:24+01:00@Europe/Paris
			// Works only with CommonJS, and does crazy shit, do not activate it.
			// useSnapshot: true,
			// XXX 2026-01-16T02:32:47+01:00@Europe/Paris
			// Works only with CommonJS. Disabling it anyways since code is very small, use of
			// cache may actually hurt performances.
			// useCodeCache: true,
			assets: {
				// 'es.exe': 'path/to/original/es.exe',
			},
		};
		await writeFile(pathSeaConfig, JSON.stringify(data, null, 4));

		// generate blob
		console.log('Generating SEA blob...');
		await $$`node --experimental-sea-config ${pathSeaConfig}`;

		// copy node
		console.log('Copying node...');
		await cp(process.execPath, this.pathTarget);

		// remove signature
		console.log('Removing signature...');
		await $$`${signtool} remove /s ${this.pathTarget}`;

		// injecting blob
		console.log('Injecting SEA blob...');
		const sentinelFuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
		const resourceName = 'NODE_SEA_BLOB';
		await $$`bun run postject ${this.pathTarget} ${resourceName} ${pathBlob} --sentinel-fuse ${sentinelFuse}`;

		// sign executable
		console.log('Signing executable...');
		await $$`${signtool} sign /a /fd SHA256 ${this.pathTarget}`;
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: PyInstaller
////////////////////////////////////////////////////////////////////////////////////////////////////

class PyInstallerBuilder extends Builder {
	constructor() { super('pyinstaller', () => this.__build()); }

	async __build() {
		await $$`uv run pyinstaller ${pathPython} --distpath ${this.rootTarget} --workpath ${this.rootCache} --noconfirm --onefile --name ${exeBaseName}`;
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
	await node.build();
	await pyInstaller.build();
}

if (import.meta.main) await build();
