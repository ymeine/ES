// --------------------------------------------------------------------------------------------- std

import { basename, join } from 'node:path';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { glob, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { Writable } from 'node:stream';

// --------------------------------------------------------------------------------------------- 3rd

import { archiveFolder, extract } from 'zip-lib';
import { Octokit } from 'octokit';
import { DateTime } from 'luxon';
import { $ } from 'execa';
import * as z from 'zod';

// ---------------------------------------------------------------------------------------- internal

import { pyInstaller } from './build';
import { group, pathOriginalExe, rootCacheEs, rootDist } from './shared';



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

async function getGhToken() {
    const {stdout} = await $`gh auth token`;
    return stdout.trim();
}

const GITHUB_TOKEN = await getGhToken();
const octokit = new Octokit({
    auth: GITHUB_TOKEN,
});

type IRelease = Awaited<ReturnType<Octokit['rest']['repos']['listReleases']>>['data'][number];

const SchemaRepoInfo = z.object({
    name: z.string(),
    owner: z.object({
        id: z.string(),
        login: z.string(),
    }),
});

const SchemaRepoView = SchemaRepoInfo.extend({
    isFork: z.boolean(),
    parent: SchemaRepoInfo,
});

async function getRepoInfo() {
    await $`gh repo set-default origin`;
    const {stdout} = await $`gh repo view --json owner,name,isFork,parent`;
    const data = JSON.parse(stdout);
    return SchemaRepoView.parse(data);
}

const repoInfo = await getRepoInfo();
const ORIGINAL_REPO_OWNER = repoInfo.parent.owner.login;
const REPO_OWNER = repoInfo.owner.login;
const REPO_NAME = repoInfo.name;



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

async function getLatestRelease() {
    const result = await octokit.rest.repos.listReleases({
        owner: ORIGINAL_REPO_OWNER,
        repo: REPO_NAME,
    });
    const releases = result.data;

    let picked: IRelease | null = null;
    for (const release of releases) {
        if (release.draft) continue;
        if (picked == null) picked = release;
        else {
            const pickedDate = DateTime.fromISO(picked.published_at ?? picked.created_at);
            const releaseDate = DateTime.fromISO(release.published_at ?? release.created_at);
            if (releaseDate > pickedDate) picked = release;
        }
    }

    if (picked == null) throw new Error('No releases found');
    return picked;
}

async function downloadOriginalEs() {
    using _ = group('Downloading original ES...');

    const pathVersion = join(rootCacheEs, 'version.txt');
    const pathReleaseUrl = join(rootCacheEs, 'release-url.txt');
    if (existsSync(pathOriginalExe) && existsSync(pathVersion) && existsSync(pathReleaseUrl)) {
        console.log('Original ES executable already exists in cache, skipping download.');
        const version = await readFile(pathVersion, 'utf-8');
        const releaseUrl = await readFile(pathReleaseUrl, 'utf-8');
        return {version, releaseUrl};
    }
    
    await mkdir(rootCacheEs, {recursive: true});
    
    console.log('Getting latest release and asset');
    const latest = await getLatestRelease();
    await writeFile(join(rootCacheEs, 'release.json'), JSON.stringify(latest, null, 4));
    const releaseUrl = latest.html_url;
    await writeFile(pathReleaseUrl, releaseUrl);

    const asset = latest.assets.find(asset => asset.name.includes('.x64.'));
    if (asset == null) throw new Error('No suitable asset found in latest release');
    const version = latest.tag_name;
    await writeFile(pathVersion, version);

    console.log(`Downloading asset from ${asset.browser_download_url}...`);
    const response = await fetch(asset.browser_download_url);
    if (!response.ok || response.body == null) throw new Error(`Failed to download ES: ${response.status} ${response.statusText}`);
    const pathZip = join(rootCacheEs, 'es-original.zip');
    await response.body.pipeTo(Writable.toWeb(createWriteStream(pathZip)));

    console.log('Extracting archive...');
    const rootExtracted = join(rootCacheEs, 'extracted');
    await extract(pathZip, rootExtracted);

    console.log('Locating executable file...');
    const result = await Array.fromAsync(glob(`**/*.exe`, {cwd: rootExtracted}));
    if (result.length === 0) throw new Error('No .exe file found in extracted original ES');
    if (result.length > 1) throw new Error('Multiple .exe files found in extracted original ES');
    const extractedExePath = join(rootExtracted, result[0]!);
    await rename(extractedExePath, pathOriginalExe);

    return {version, releaseUrl};
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

async function build(version: string) {
    // const version = await getEsVersion();
    using _ = group(`Building for version ${version}...`);

    const pathZip = join(rootDist, `es-${version}-x86_64-pc-windows-msvc.zip`);
    if (existsSync(pathZip)) {
        console.log(`Build for version ${version} already exists, skipping build.`);
        return {pathZip};
    }
    
    await pyInstaller.build();
    await archiveFolder(pyInstaller.rootTarget, pathZip);

    return {pathZip};
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

async function getPythonVersion() {
    const {stdout} = await $`uv run python --version`;
    const match = stdout.trim().match(/^.*(\d+\.\d+\.\d+)$/);
    if (match == null) throw new Error(`Failed to parse Python version from output: ${stdout}`);
    return match[1]!;
}

async function getPyInstallerVersion() {
    const {stdout} = await $`uv run pyinstaller --version`;
    return stdout.trim();
}

async function release(version: string, pathZip: string, releaseUrl: string) {
    using _ = group(`Create a release for version ${version}...`);

    const now = DateTime.now();
    const versionPython = await getPythonVersion();
    const versionPyInstaller = await getPyInstallerVersion();
    const esExe = '`es.exe`';
    const body = [
        `Automated release of Everything CLI wrapper.`,
        '',
        `- **${esExe} version**: [\`${version}\`](${releaseUrl})`,
        `- **date**: ${now.toLocaleString(DateTime.DATETIME_FULL)} (\`${now.toISO()}\`)`,
        `- **type**: `,
        `  - [Python](https://www.python.org) ${versionPython}`,
        `  - [PyInstaller](https://pyinstaller.org) ${versionPyInstaller} in folder mode`,
        `  - embedded original ${esExe}`,
    ].join('\n');

    console.log('Creating release...');
    const result = await octokit.rest.repos.createRelease({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        tag_name: version,
        name: `Everything CLI wrapper version ${version}`,
        body,
        draft: false,
        prerelease: false,
    });
    const release = result.data;
    console.log(release);

    console.log('Uploading asset...');
    const {size} = await stat(pathZip);
    await octokit.rest.repos.uploadReleaseAsset({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        release_id: release.id,
        name: basename(pathZip),
        data: createReadStream(pathZip) as unknown as string,
        headers: {
            'Content-Length': size,
        },
    });
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

const {version, releaseUrl} = await downloadOriginalEs();
const {pathZip} = await build(version);
await release(version, pathZip, releaseUrl);
