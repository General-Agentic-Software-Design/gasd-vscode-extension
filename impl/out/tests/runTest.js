"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const test_electron_1 = require("@vscode/test-electron");
/** @trace #US-27, #US-15 */
async function main() {
    const profile = await (0, promises_1.mkdtemp)(path.join((0, node_os_1.tmpdir)(), 'gasd-tests-'));
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../..');
        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './index');
        await (0, test_electron_1.runTests)({
            extensionDevelopmentPath,
            extensionTestsPath,
            vscodeExecutablePath: process.env.GASD_VSCODE_EXECUTABLE,
            launchArgs: [
                '--user-data-dir', path.join(profile, 'user-data'),
                '--extensions-dir', path.join(profile, 'extensions'),
            ],
        });
    }
    catch (err) {
        console.error('Failed to run tests', err);
        process.exitCode = 1;
    }
    finally {
        await (0, promises_1.rm)(profile, { recursive: true, force: true });
    }
}
main();
//# sourceMappingURL=runTest.js.map