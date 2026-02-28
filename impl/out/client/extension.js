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
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const node_js_1 = require("vscode-languageclient/node.js");
let client;
/** @trace #US-15, #US-27 */
function activate(context) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('out', 'server', 'server.js'));
    // The debug options for the server
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: { module: serverModule, transport: node_js_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_js_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for plain text documents
        documentSelector: [
            { scheme: 'file', language: 'gasd' },
            { scheme: 'untitled', language: 'gasd' }
        ],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // Create the language client and start the client.
    client = new node_js_1.LanguageClient('gasdLanguageServer', 'GASD Language Server', serverOptions, clientOptions);
    // Start the client. This will also launch the server
    client.start();
    /** @trace #AC-15.1 */
    const disposable = vscode.commands.registerCommand('gasd.initializeProject', () => {
        initializeGASDProject();
    });
    context.subscriptions.push(disposable);
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
/** @trace #AC-15.1 */
async function initializeGASDProject() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Please open a workspace folder first.');
        return;
    }
    const rootUri = workspaceFolders[0].uri;
    const projectDirs = ['build', 'design', 'impl', 'user-story', 'tests'];
    for (const dir of projectDirs) {
        const dirUri = vscode.Uri.joinPath(rootUri, dir);
        await vscode.workspace.fs.createDirectory(dirUri);
    }
    const mainGasdUri = vscode.Uri.joinPath(rootUri, 'main.gasd');
    const mainGasdContent = `/* 
   --- GASD Project Entry Point ---
*/
CONTEXT: "New GASD Project"
TARGET: "Any"

NAMESPACE: "project.main"

COMPONENT Main:
    INTERFACE:
        run() -> Void
`;
    await vscode.workspace.fs.writeFile(mainGasdUri, Buffer.from(mainGasdContent, 'utf-8'));
    vscode.window.showInformationMessage('GASD Project initialized successfully.');
}
//# sourceMappingURL=extension.js.map