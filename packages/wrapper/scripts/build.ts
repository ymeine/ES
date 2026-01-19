// --------------------------------------------------------------------------------------------- std

import {join} from 'node:path';
import {cp, rm, writeFile} from 'node:fs/promises';

// --------------------------------------------------------------------------------------------- 3rd

import {parseCommandString} from 'execa';

// ---------------------------------------------------------------------------------------- internal

import {$$, exeBaseName, exeName, pathOriginalExe, pathPython, pathTypeScript, rootBuild, rootCache, rootEntryPoints, rootPackage, rootSource} from './shared';



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

const USE_GENERIC_ENTRY_POINT = false;
// const USE_GENERIC_ENTRY_POINT = true;



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

interface IBuilderExtraOptions {
	sourceExtension: string;
	genericEntryPointName: string;
	entryPointName?: string;
}

class Builder {
	readonly options: BuilderOptions;
	readonly pathEntryPoint: string;

	constructor(
		name: string,
		readonly _build: () => Promise<void>,
		extraOptions: IBuilderExtraOptions,
	) {
		this.options = new BuilderOptions(name);
		this.pathEntryPoint = USE_GENERIC_ENTRY_POINT
			? join(rootSource, `${extraOptions.genericEntryPointName}.${extraOptions.sourceExtension}`)
			: join(rootEntryPoints, `${extraOptions.entryPointName ?? name}.${extraOptions.sourceExtension}`);
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

function toArgs(input: (string | string[])[]): string[] {
	return input.flatMap(item => Array.isArray(item) ? item : parseCommandString(item));
}

const TS_EXTRA_OPTIONS: IBuilderExtraOptions = {sourceExtension: 'ts', genericEntryPointName: 'index'};
const PY_EXTRA_OPTIONS: IBuilderExtraOptions = {sourceExtension: 'py', genericEntryPointName: 'main'};



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: Deno
////////////////////////////////////////////////////////////////////////////////////////////////////

class DenoBuilder extends Builder {
	constructor() { super('deno', () => this.__build(), TS_EXTRA_OPTIONS); }

	// XXX 2026-01-15T11:10:31+01:00@Europe/Paris
	// It embeds the whole package by default, it should not.
	// Even with the exclude, it still embeds node_modules and some unwanted things.
	// --no-npm was needed...
	async __build() {
		const args = toArgs([
			'deno compile',
			'--sloppy-imports -A',
			'--exclude . --no-npm',
			'--include', [pathOriginalExe],
			`--output`, [this.pathTarget],
			[join(rootEntryPoints, 'deno.ts')],
		]);
		await $$`${args}`;
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: Bun
////////////////////////////////////////////////////////////////////////////////////////////////////

class BunBuilder extends Builder {
	constructor() { super('bun', () => this.__build(), TS_EXTRA_OPTIONS); }

	async __build() {
		const args = toArgs([
			'bun build --compile',
			`--outfile`, [this.pathTarget],
			[join(rootEntryPoints, 'bun.ts')],
			pathOriginalExe,
		]);
		await $$`${args}`;
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: Node.js
////////////////////////////////////////////////////////////////////////////////////////////////////

class NodeBuilder extends Builder {
	constructor() { super('node', () => this.__build(), TS_EXTRA_OPTIONS); }

	async __build() {
		// XXX 2026-01-16T02:29:46+01:00@Europe/Paris
		// That precise, absolute path will appear in error traces, if any.
		const pathBuiltFile = join(this.rootCache, 'index.js');
		const pathBlob = join(this.rootCache, 'content.blob');
		const pathSeaConfig = join(this.rootCache, 'sea-config.json');
		const signtool = 'C:/Program Files (x86)/Windows Kits/10/App Certification Kit/signtool.exe';

		// build source
		console.log('Building source with Bun...');
		await $$`bun build --outfile ${pathBuiltFile} --target node --format cjs ${join(rootEntryPoints, 'node.ts')}`;

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
				'es.exe': pathOriginalExe,
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
	readonly workPath: string;
	readonly distPath: string;
	readonly projectName = exeBaseName;

	constructor(readonly oneFile: boolean) {
		const baseName = 'pyinstaller';
		const name = oneFile ? `${baseName}-onefile` : baseName;
		super(name, () => this.__build(), {...PY_EXTRA_OPTIONS, entryPointName: baseName});

		this.workPath = join(this.rootCache, 'work');
		this.distPath = oneFile ? this.rootTarget : join(this.rootCache, 'dist')
	}

	async __build() {
		const args = toArgs([
			'uv run pyinstaller',
			[this.pathEntryPoint],
			'--noconfirm',
			this.oneFile ? ['--onefile'] : [],
			'--workpath', [this.workPath],
			'--distpath', [this.distPath],
			'--add-data', [`${pathOriginalExe};bin`],
			'--name', [this.projectName],
		]);
		await $$`${args}`;

		console.log('Removing spec file');
		await rm(join(rootPackage, `${this.projectName}.spec`));
		if (!this.oneFile) {
			const source = join(this.distPath, this.projectName);
			const target = this.rootTarget;
			console.log(`Copying output files from "${source}" to "${target}"`);
			await cp(source, target, {recursive: true});
		}
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export const deno = new DenoBuilder();
export const bun = new BunBuilder();
export const node = new NodeBuilder();
export const pyInstaller = new PyInstallerBuilder(false);
export const pyInstallerOneFile = new PyInstallerBuilder(true);

async function build() {
	// await deno.build();
	// await bun.build();
	// await node.build();
	// await pyInstallerOneFile.build();
	await pyInstaller.build();
}

if (import.meta.main) await build();
