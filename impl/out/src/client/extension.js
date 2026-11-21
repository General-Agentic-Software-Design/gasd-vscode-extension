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
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
const contractProtocol_1 = require("../shared/contractProtocol");
let client;
function activate(context) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join('out', 'src', 'server', 'server.js'));
    // The debug options for the server
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    const gasdFiles = vscode_1.workspace.createFileSystemWatcher('**/*.gasd');
    context.subscriptions.push(gasdFiles);
    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'gasd' }, { scheme: 'untitled', language: 'gasd' }],
        synchronize: {
            fileEvents: gasdFiles
        }
    };
    client = new node_1.LanguageClient('gasdLanguageServer', 'GASD Language Server', serverOptions, clientOptions);
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
        context.subscriptions.push(vscode_1.commands.registerCommand(cmd, () => {
            vscode_1.window.showInformationMessage(`GASD: ${cmd} triggered`);
        }));
    });
    context.subscriptions.push(vscode_1.commands.registerCommand('gasd.verifyContractCall', verifyContractObservation));
    // Start the client. This will also launch the server
    const started = client.start();
    console.log('GASD: Extension Activated');
    return started;
}
async function verifyContractObservation(observation) {
    const document = vscode_1.window.activeTextEditor?.document;
    if (document?.languageId !== 'gasd') {
        void vscode_1.window.showWarningMessage('Open a GASD document before verifying a contract call.');
        return;
    }
    let call = observation;
    if (call === undefined) {
        const text = await vscode_1.window.showInputBox({
            prompt: 'Enter an observed contract call as JSON',
            placeHolder: '{"contract":"Service.method","arguments":{},"outcome":{"kind":"return"}}',
            ignoreFocusOut: true,
        });
        if (text === undefined)
            return;
        try {
            call = JSON.parse(text);
        }
        catch {
            void vscode_1.window.showErrorMessage('The contract call observation must be valid JSON.');
            return;
        }
    }
    if (!(0, contractProtocol_1.isContractCallRequest)(call)) {
        void vscode_1.window.showErrorMessage('Supply a contract name, named arguments, and a valid return or throw observation.');
        return;
    }
    try {
        const result = await client.sendRequest(contractProtocol_1.verifyContractRequest, { uri: document.uri.toString(), call });
        if (observation === undefined) {
            if (result.status === 'verified')
                void vscode_1.window.showInformationMessage(result.message);
            else if (result.status === 'unverified')
                void vscode_1.window.showWarningMessage(`Unverified. ${result.message}`);
            else
                void vscode_1.window.showErrorMessage(result.message);
        }
        return result;
    }
    catch (error) {
        void vscode_1.window.showErrorMessage(`Could not verify the contract call. ${error.message}`);
        return;
    }
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
//# sourceMappingURL=extension.js.map