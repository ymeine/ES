// --------------------------------------------------------------------------------------------- 3rd

import { $, parseCommandString } from 'execa';
import { diff, compare } from 'semver';

// ---------------------------------------------------------------------------------------- internal

import { $$, exeBaseName, exeName, pathOriginalExe, rootBuild, rootCache, rootEntryPoints, rootPackage, rootSource } from './shared';
import { Path } from './Path';



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

	readonly pathTarget: Path;
	readonly rootTarget: Path;
	readonly rootCache: Path;

	constructor(readonly name: string) {
		this.rootTarget = rootBuild.join(this.name);
		this.pathTarget = this.rootTarget.join(exeName);
		this.rootCache = rootCache.join(this.name);
	}
}

interface IBuilderExtraOptions {
	sourceExtension: string;
	genericEntryPointName: string;
	entryPointName?: string;
}

class Builder {
	readonly options: BuilderOptions;
	readonly pathEntryPoint: Path;

	constructor(
		name: string,
		readonly _build: () => Promise<void>,
		extraOptions: IBuilderExtraOptions,
	) {
		this.options = new BuilderOptions(name);
		this.pathEntryPoint = USE_GENERIC_ENTRY_POINT
			? rootSource.join(`${extraOptions.genericEntryPointName}.${extraOptions.sourceExtension}`)
			: rootEntryPoints.join(`${extraOptions.entryPointName ?? name}.${extraOptions.sourceExtension}`);
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

function toArgs(input: (string | (string | Path)[])[]): string[] {
	return input.flatMap(item => Array.isArray(item) ? item.map(i => i.toString()) : parseCommandString(item));
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
			[rootEntryPoints.join('deno.ts')],
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
			[rootEntryPoints.join('bun.ts')],
			[pathOriginalExe],
		]);
		await $$`${args}`;
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: Node.js
////////////////////////////////////////////////////////////////////////////////////////////////////

class NodeBuilder extends Builder {
	readonly signtool = 'C:/Program Files (x86)/Windows Kits/10/App Certification Kit/signtool.exe';

	readonly pathBuiltFile = this.rootCache.join('index.js');
	readonly pathSeaConfig = this.rootCache.join('sea-config.json');

	constructor() { super('node', () => this.__build(), TS_EXTRA_OPTIONS); }

	async _buildJavaScript() {
		console.log('Building source with Bun...');
		await $$`bun build --outfile ${this.pathBuiltFile.toString()} --target node --format cjs ${rootEntryPoints.join('node.ts').toString()}`;
	}

	async _makeConfig(output: Path) {
		console.log('Generating SEA configuration...');
		const data = {
			main: this.pathBuiltFile.value,
			output: output.value,
			disableExperimentalSEAWarning: true,
			// XXX 2026-01-16T02:09:24+01:00@Europe/Paris
			// Works only with CommonJS, and does crazy shit, do not activate it.
			// useSnapshot: true,
			// XXX 2026-01-16T02:32:47+01:00@Europe/Paris
			// Works only with CommonJS. Disabling it anyways since code is very small, use of
			// cache may actually hurt performances.
			// useCodeCache: true,
			assets: {
				'es.exe': pathOriginalExe.value,
			},
		};
		await this.pathSeaConfig.json().write(data);
	}

	async _sign() {
		console.log('Signing executable...');
		await $$`${this.signtool.toString()} sign /a /fd SHA256 ${this.pathTarget.toString()}`;
	}

	async _buildOld() {
		const pathBlob = this.rootCache.join('content.blob');

		// pre processing
		await this._buildJavaScript();
		await this._makeConfig(pathBlob);

		// generate blob
		console.log('Generating SEA blob...');
		await $$`node --experimental-sea-config ${this.pathSeaConfig.toString()}`;

		// copy node
		console.log('Copying node...');
		await Path.fromExecPath().copyTo(this.pathTarget);

		// remove signature
		console.log('Removing signature...');
		await $$`${this.signtool.toString()} remove /s ${this.pathTarget.toString()}`;

		// inject blob
		console.log('Injecting SEA blob...');
		const sentinelFuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
		const resourceName = 'NODE_SEA_BLOB';
		await $$`bun run postject ${this.pathTarget.toString()} ${resourceName} ${pathBlob.toString()} --sentinel-fuse ${sentinelFuse}`;

		// post processing
		await this._sign();
	}

	async _buildNew() {
		// pre processing
		await this._buildJavaScript();
		await this._makeConfig(this.pathTarget);

		// generate exe
		console.log('Generating SEA executable...');
		await $$`node --build-sea ${this.pathSeaConfig.toString()}`;

		// post processing
		await this._sign();
	}

	// 2026-01-27T19:38:11+01:00@Europe/Paris
	// New version seems to be struggling to find the Node.js path. Probably because I use shims,
	// but I could do it easily, why not them?
	async __build() {
		await this._buildOld();
		return;

		const {stdout} = await $`node -v`;
		const version = stdout.trim();
		const useOld = compare(version, '25.5.0') < 0;
		if (useOld) {
			console.log(`Using old SEA build process for Node.js version ${version}`);
			await this._buildOld();
		} else {
			console.log(`Using new SEA build process for Node.js version ${version}`);
			await this._buildNew();
		}
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// Builder: PyInstaller
////////////////////////////////////////////////////////////////////////////////////////////////////

class PyInstallerBuilder extends Builder {
	readonly workPath: Path;
	readonly distPath: Path;
	readonly projectName = exeBaseName;

	constructor(readonly oneFile: boolean) {
		const baseName = 'pyinstaller';
		const name = oneFile ? `${baseName}-onefile` : baseName;
		super(name, () => this.__build(), {...PY_EXTRA_OPTIONS, entryPointName: baseName});

		this.workPath = this.rootCache.join('work');
		this.distPath = oneFile ? this.rootTarget : this.rootCache.join('dist');
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
		await rootPackage.join(`${this.projectName}.spec`).rm();
		if (!this.oneFile) {
			const source = this.distPath.join(this.projectName);
			const target = this.rootTarget;
			console.log(`Copying output files from "${source}" to "${target}"`);
			await source.copyTo(target);
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
	await node.build();
	// await pyInstallerOneFile.build();
	// await pyInstaller.build();
}

if (import.meta.main) await build();
