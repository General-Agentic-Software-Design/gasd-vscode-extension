"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const ValidationEngine_1 = require("./ValidationEngine");
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            documentSymbolProvider: true, // Used for Contract Modeling outline mock #US-31
            hoverProvider: true,
            definitionProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            }
        }
    };
    return result;
});
const lintEngine = new ValidationEngine_1.GASD12LintEngine();
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
async function validateTextDocument(textDocument) {
    const diagnostics = lintEngine.validateDocument(textDocument);
    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
// Mocking the CONTRACT outline structure for Document Symbols (#US-31)
connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document)
        return [];
    const text = document.getText();
    const symbols = [];
    // Default stub handlers for required provider responses
    connection.onHover(() => null);
    connection.onDefinition(() => null);
    connection.onSignatureHelp(() => null);
    // Crude regex to locate CONTRACT blocks for outline tracking
    const lines = text.split(/\r?\n/g);
    lines.forEach((line, i) => {
        if (line.includes('CONTRACT:')) {
            symbols.push({
                name: 'CONTRACT',
                kind: node_1.SymbolKind.Class,
                range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
                selectionRange: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
            });
        }
    });
    return symbols;
});
// Make the text document manager listen on the connection
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map