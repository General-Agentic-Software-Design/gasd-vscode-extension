import * as path from 'path';
import { workspace, ExtensionContext, commands, window } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join('out', 'src', 'server', 'server.js')
    );
    // The debug options for the server
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'gasd' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    };

    client = new LanguageClient(
        'gasdLanguageServer',
        'GASD Language Server',
        serverOptions,
        clientOptions
    );

    // Register Commands
    console.log('GASD: Registering commands...');
    const commandList = [
        'gasd.initializeProject',
        'gasd.generateDesign',
        'gasd.validateDesign',
        'gasd.showPreview',
        'gasd.requestReview',
        'gasd.showStrategyVis',
        'gasd.checkConsistency'
    ];

    commandList.forEach(cmd => {
        console.log(`GASD: Registering command ${cmd}`);
        context.subscriptions.push(
            commands.registerCommand(cmd, () => {
                window.showInformationMessage(`GASD: ${cmd} triggered`);
            })
        );
    });

    // Start the client. This will also launch the server
    client.start();
    console.log('GASD: Extension Activated');
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
