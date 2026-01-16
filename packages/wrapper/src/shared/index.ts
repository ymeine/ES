// --------------------------------------------------------------------------------------------- std

import process from 'node:process';
import {spawn} from 'node:child_process';



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export const exeBaseName = 'es';
export const exeName = `${exeBaseName}.exe`;



////////////////////////////////////////////////////////////////////////////////////////////////////
// 
////////////////////////////////////////////////////////////////////////////////////////////////////

export async function run(pathExe: string) {
    const args = process.argv.slice(2);
    const proc = spawn(pathExe, args, {
        stdio: 'inherit',
        windowsVerbatimArguments: true,
    });
    await new Promise<void>((resolve, reject) => {
        proc.on('error', (err) => {
            reject(err);
        });
        proc.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
    });
}
