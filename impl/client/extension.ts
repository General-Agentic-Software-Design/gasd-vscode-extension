import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node.js';

let client: LanguageClient;

/** @trace #US-15, #US-27 */
export function activate(context: vscode.ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join('out', 'server', 'server.js')
    );

    // The debug options for the server
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
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
    client = new LanguageClient(
        'gasdLanguageServer',
        'GASD Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    client.start();

    /** @trace #AC-15.1 */
    const disposable = vscode.commands.registerCommand('gasd.initializeProject', () => {
        initializeGASDProject();
    });

    context.subscriptions.push(disposable);
}

export function deactivate(): Thenable<void> | undefined {
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
