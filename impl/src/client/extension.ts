import * as path from 'path';
import { workspace, ExtensionContext, commands, window } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import { ContractVerification, isContractCallRequest, verifyContractRequest } from '../shared/contractProtocol';

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

    const gasdFiles = workspace.createFileSystemWatcher('**/*.gasd');
    context.subscriptions.push(gasdFiles);
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'gasd' }, { scheme: 'untitled', language: 'gasd' }],
        synchronize: {
            fileEvents: gasdFiles
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
    context.subscriptions.push(commands.registerCommand('gasd.verifyContractCall', verifyContractObservation));

    // Start the client. This will also launch the server
    const started = client.start();
    console.log('GASD: Extension Activated');
    return started;
}

async function verifyContractObservation(observation?: unknown): Promise<ContractVerification | undefined> {
    const document = window.activeTextEditor?.document;
    if (document?.languageId !== 'gasd') {
        void window.showWarningMessage('Open a GASD document before verifying a contract call.');
        return;
    }

    let call = observation;
    if (call === undefined) {
        const text = await window.showInputBox({
            prompt: 'Enter an observed contract call as JSON',
            placeHolder: '{"contract":"Service.method","arguments":{},"outcome":{"kind":"return"}}',
            ignoreFocusOut: true,
        });
        if (text === undefined) return;
        try { call = JSON.parse(text); }
        catch { void window.showErrorMessage('The contract call observation must be valid JSON.'); return; }
    }
    if (!isContractCallRequest(call)) {
        void window.showErrorMessage('Supply a contract name, named arguments, and a valid return or throw observation.');
        return;
    }

    try {
        const result = await client.sendRequest<ContractVerification>(verifyContractRequest, { uri: document.uri.toString(), call });
        if (observation === undefined) {
            if (result.status === 'verified') void window.showInformationMessage(result.message);
            else if (result.status === 'unverified') void window.showWarningMessage(`Unverified. ${result.message}`);
            else void window.showErrorMessage(result.message);
        }
        return result;
    } catch (error) {
        void window.showErrorMessage(`Could not verify the contract call. ${(error as Error).message}`);
        return;
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
