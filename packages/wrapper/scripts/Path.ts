// --------------------------------------------------------------------------------------------- std

import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { cp, glob, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import {basename, dirname, join} from 'node:path';
import { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export type IPathInput = string | Path;

export class Path {
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // 
    ////////////////////////////////////////////////////////////////////////////////////////////////

    static fromExecPath() {
        return Path.fromString(process.execPath);
    }

    static fromOther(value: Path) {
        return new Path(value.value);
    }

    static fromString(value: string) {
        value = value.replaceAll('\\', '/');
        return new Path(value);
    }

    static fromUrl(input: string | URL) {
        const value = input instanceof URL ? input.href : input;
        if (!value.startsWith('file://')) throw new Error(`Cannot convert non-file URL to path: ${value}`);
        return Path.fromString(fileURLToPath(input));
    }

    static fromMeta(meta: ImportMeta) {
        return Path.fromUrl(meta.url);
    }

    static sourceFolder(meta: ImportMeta) {
        return Path.fromMeta(meta).parent();
    }
    
    static from(value: IPathInput) {
        if (typeof value === 'string') {
            if (value.startsWith('file://')) return Path.fromUrl(value);
            return Path.fromString(value);
        }
        if (value instanceof URL) return Path.fromUrl(value);
        return Path.fromOther(value);
    }

    value: string;

    private constructor(value: string) {
        this.value = value;
    }

    toString() { return this.value; }

    
    
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // 
    ////////////////////////////////////////////////////////////////////////////////////////////////
    
    join(...parts: IPathInput[]) {
        return Path.fromString(join(this.value, ...parts.map(p => Path.from(p).value)));
    }
    
    parent(level = 1) {
        let value = this.value;
        for (let index = 0; index < level; index++) value = dirname(value);
        return Path.fromString(value);
    }
    
    name() {
        return basename(this.value);
    }

    toUrlString() { return `file://${this.value}`; }
    toUrl() { return new URL(this.toUrlString()); }

    async import() { return await import(this.toUrlString()); }
    

    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // 
    ////////////////////////////////////////////////////////////////////////////////////////////////

    existsSync() { return existsSync(this.value); }

    async stat() { return await stat(this.value); }

    async size() {
        const stats = await this.stat();
        return stats.size;
    }

    async *gGlob(pattern: string) {
        for await (const node of glob(pattern, {cwd: this.value})) yield this.join(node);
    }

    async glob(pattern: string) { return await Array.fromAsync(this.gGlob(pattern)); }



    ////////////////////////////////////////////////////////////////////////////////////////////////
    // 
    ////////////////////////////////////////////////////////////////////////////////////////////////

    async mkdir() { await mkdir(this.value, {recursive: true}); }

    async mkParent() {
        const parent = this.parent();
        await parent.mkdir();
        return parent;
    }



    ////////////////////////////////////////////////////////////////////////////////////////////////
    // 
    ////////////////////////////////////////////////////////////////////////////////////////////////

    async moveTo(target: IPathInput) {
        const targetPath = Path.from(target);
        await targetPath.mkParent();
        await rename(this.value, targetPath.value);
        return targetPath;
    }

    async moveInto(targetDir: IPathInput) {
        return await this.moveTo(Path.from(targetDir).join(this.name()));
    }

    async copyTo(target: IPathInput) {
        const targetPath = Path.from(target);
        await targetPath.mkParent();
        await cp(this.value, targetPath.value, {recursive: true});
        return targetPath;
    }

    async copyInto(targetDir: IPathInput) {
        return await this.copyTo(Path.from(targetDir).join(this.name()));
    }

    async rm() {
        await rm(this.value, {recursive: true});
    }

    
    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    // 
    ////////////////////////////////////////////////////////////////////////////////////////////////
    
    raw() { return new RawHandler(this); }
    string(options?: IStringHandlerOptions) { return new StringHandler(this, options); }
    lines(options?: ILinesHandlerOptions) { return new LinesHandler(this, options); }
    json(options?: IJsonHandlerOptions) { return new JsonHandler(this, options); }
    
    async writableStream() {
        await this.mkParent();
        return createWriteStream(this.value);
    }
    async writableWebStream() { return Writable.toWeb(await this.writableStream()); }

    readableStream() { return createReadStream(this.value); }
    readableWebStream() { return Readable.toWeb(this.readableStream()); }
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export class RawHandler {
    constructor(readonly path: Path) {}
    private get _path() { return this.path.toString(); }
    async read() { return await readFile(this._path); }
    async write(data: Buffer) {
        await this.path.mkParent();
        await writeFile(this._path, data);
    }
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export interface IStringHandlerOptions {
    encoding?: BufferEncoding;
}

export class StringHandler {
    readonly raw: RawHandler;
    readonly encoding: BufferEncoding;

    constructor(readonly path: Path, options?: IStringHandlerOptions) {
        this.raw = new RawHandler(path);
        this.encoding = options?.encoding ?? 'utf-8';
    }

    async read() {
        const buffer = await this.raw.read();
        return buffer.toString(this.encoding);
    }
    async write(data: string) {
        await this.raw.write(Buffer.from(data, this.encoding));
    }
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export type ILineEnding = '\n' | '\r\n' | '\r';
export type ILineEndingType = ILineEnding | 'platform';

export interface ILinesHandlerOptions extends IStringHandlerOptions {
    lineEnding?: ILineEndingType;
}

export class LinesHandler {
    readonly string: StringHandler;
    readonly lineEndingType: ILineEndingType;

    constructor(readonly path: Path, options?: ILinesHandlerOptions) {
        this.string = new StringHandler(path, options);
        this.lineEndingType = options?.lineEnding ?? 'platform';
    }

    get lineEnding(): ILineEnding {
        if (this.lineEndingType === 'platform') {
            if (process.platform === 'win32') return '\r\n';
            return '\n'; // modern Mac does not use '\r' alone, and for unsupported systems we are conservative
        }
        return this.lineEndingType;
    }

    async read() {
        const content = await this.string.read();
        return content.split(/\r?\n/);
    }

    async write(data: string[]) {
        const content = data.join(this.lineEnding);
        await this.string.write(content);
    }
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export interface IJsonHandlerOptions extends IStringHandlerOptions {
    space?: string | number;
}

export class JsonHandler {
    readonly string: StringHandler;
    readonly space: string | number;

    constructor(readonly path: Path, options?: IJsonHandlerOptions) {
        this.string = new StringHandler(path, options);
        this.space = options?.space ?? 4;
    }

    async read<T>(parse: (data: unknown) => T = data => data as T): Promise<T> {
        const content = await this.string.read();
        const raw = JSON.parse(content);
        return parse(raw);
    }

    async write(data: unknown) {
        const content = JSON.stringify(data, null, this.space);
        await this.string.write(content);
    }
}
