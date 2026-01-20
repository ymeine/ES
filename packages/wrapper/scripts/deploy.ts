// --------------------------------------------------------------------------------------------- 3rd

import { archiveFolder, extract } from 'zip-lib';
import { Octokit } from 'octokit';
import { DateTime } from 'luxon';
import { $ } from 'execa';
import * as z from 'zod';

// ---------------------------------------------------------------------------------------- internal

import { pyInstaller } from './build';
import { group, pathOriginalExe, rootCacheEs, rootDist } from './shared';
import { Path } from './Path';



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

// FIXME 2026-01-19T10:50:22+01:00@Europe/Paris
// Instead of multiplying files, just limit it to one for the release, one for the asset.
// Don't use Zod schemas, just cast to types.
async function downloadOriginalEs() {
    using _ = group('Downloading original ES...');

    const pathVersion = rootCacheEs.join('version.txt');
    const pathReleaseUrl = rootCacheEs.join('release-url.txt');
    if (pathOriginalExe.existsSync() && pathVersion.existsSync() && pathReleaseUrl.existsSync()) {
        console.log('Original ES executable already exists in cache, skipping download.');
        const version = await pathVersion.string().read();
        const releaseUrl = await pathReleaseUrl.string().read();
        return {version, releaseUrl};
    }
    
    console.log('Getting latest release and asset');
    const latest = await getLatestRelease();
    await rootCacheEs.join('release.json').json().write(latest);
    const releaseUrl = latest.html_url;
    await pathReleaseUrl.string().write(releaseUrl);

    const asset = latest.assets.find(asset => asset.name.includes('.x64.'));
    if (asset == null) throw new Error('No suitable asset found in latest release');
    const version = latest.tag_name;
    await pathVersion.string().write(version);

    console.log(`Downloading asset from ${asset.browser_download_url}...`);
    const response = await fetch(asset.browser_download_url);
    if (!response.ok || response.body == null) throw new Error(`Failed to download ES: ${response.status} ${response.statusText}`);
    const pathZip = rootCacheEs.join('es-original.zip');
    await response.body.pipeTo(await pathZip.writableWebStream());

    console.log('Extracting archive...');
    const rootExtracted = rootCacheEs.join('extracted');
    await extract(pathZip.toString(), rootExtracted.toString());

    console.log('Locating executable file...');
    const result = await rootExtracted.glob(`**/*.exe`);
    if (result.length === 0) throw new Error('No .exe file found in extracted original ES');
    if (result.length > 1) throw new Error('Multiple .exe files found in extracted original ES');
    const extractedExePath = rootExtracted.join(result[0]!);
    await extractedExePath.moveTo(pathOriginalExe);

    return {version, releaseUrl};
}



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

async function build(version: string) {
    // const version = await getEsVersion();
    using _ = group(`Building for version ${version}...`);

    const pathZip = rootDist.join(`es-${version}-x86_64-pc-windows-msvc.zip`);
    if (pathZip.existsSync()) {
        console.log(`Build for version ${version} already exists, skipping build.`);
        return {pathZip};
    }
    
    await pyInstaller.build();
    await archiveFolder(pyInstaller.rootTarget.toString(), pathZip.toString());

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

// TODO 2026-01-19T10:49:13+01:00@Europe/Paris 
// - Add info about used asset: name, link, etc.
// - add timezone name to the release date info?
async function release(version: string, pathZip: Path, releaseUrl: string) {
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
    const size = await pathZip.size();
    await octokit.rest.repos.uploadReleaseAsset({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        release_id: release.id,
        name: pathZip.name(),
        data: pathZip.readableStream() as unknown as string,
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
