import * as path from 'path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runTests } from '@vscode/test-electron';

/** @trace #US-27, #US-15 */
async function main() {
    const profile = await mkdtemp(path.join(tmpdir(), 'gasd-tests-'));
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../..');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './index');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            vscodeExecutablePath: process.env.GASD_VSCODE_EXECUTABLE,
            launchArgs: [
                '--user-data-dir', path.join(profile, 'user-data'),
                '--extensions-dir', path.join(profile, 'extensions'),
            ],
        });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exitCode = 1;
    } finally {
        await rm(profile, { recursive: true, force: true });
    }
}

main();
