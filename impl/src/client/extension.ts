import * as path from 'path';
import { workspace, ExtensionContext, commands, window, Uri, OutputChannel } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import { ContractVerification, isContractCallRequest, verifyContractRequest } from '../shared/contractProtocol';
import {
    ExecutableRequest, ExecutableValidation, isExecutableRequest, validateExecutableCommand, validateExecutableRequest,
} from '../shared/executableProtocol';

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
    const executableOutput = window.createOutputChannel('GASD Executable Validation');
    context.subscriptions.push(executableOutput, commands.registerCommand(
        validateExecutableCommand,
        (request?: unknown, selection?: Uri[]) => validateExecutableSources(executableOutput, request, selection),
    ));

    // Start the client. This will also launch the server
    const started = client.start();
    console.log('GASD: Extension Activated');
    return started;
}

async function validateExecutableSources(
    output: OutputChannel, request?: unknown, selection?: Uri[]
): Promise<ExecutableValidation | undefined> {
    const interactive = request === undefined || request instanceof Uri;
    let params: ExecutableRequest;
    if (isExecutableRequest(request)) {
        params = request;
    } else if (interactive) {
        const active = window.activeTextEditor?.document;
        let files: Uri[] | undefined;
        if (request instanceof Uri) files = selection?.length ? selection : [request];
        else if (active?.languageId === 'gasd') files = [active.uri];
        else files = await window.showOpenDialog({
            canSelectMany: true,
            filters: { 'GASD source': ['gasd'] },
            openLabel: 'Validate Executable',
        });
        if (!files?.length) return;
        params = { uris: files.map(uri => uri.toString()) };
    } else {
        void window.showErrorMessage('Supply at least one GASD source URI for executable validation.');
        return;
    }

    try {
        const result = await client.sendRequest<ExecutableValidation>(validateExecutableRequest, params);
        if (interactive) {
            const errors = result.diagnostics.filter(({ diagnostic }) => diagnostic.severity === 1);
            if (result.diagnostics.length) {
                output.clear();
                for (const { uri, diagnostic } of result.diagnostics) {
                    const source = Uri.parse(uri);
                    const line = diagnostic.range.start.line + 1;
                    const column = diagnostic.range.start.character + 1;
                    output.appendLine(`${source.scheme === 'file' ? source.fsPath : uri}:${line}:${column}  ${diagnostic.message}`);
                }
                output.show(true);
            }
            if (errors.length) {
                void window.showErrorMessage(`GASD executable validation failed with ${errors.length} error(s). See GASD Executable Validation output.`);
            } else {
                void window.showInformationMessage(result.entrypoint
                    ? `GASD executable validated. Entry point is ${result.entrypoint.name}.`
                    : 'GASD executable validated with no declared entry point.');
            }
        }
        return result;
    } catch (error) {
        void window.showErrorMessage(`Could not validate the GASD executable. ${(error as Error).message}`);
        return;
    }
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
