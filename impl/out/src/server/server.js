"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const contractProtocol_1 = require("../shared/contractProtocol");
const executableProtocol_1 = require("../shared/executableProtocol");
const ValidationEngine_1 = require("./ValidationEngine");
const contracts_1 = require("./contracts");
const entrypoint_1 = require("./entrypoint");
const executable_1 = require("./executable");
const source_1 = require("./source");
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const lintEngine = new ValidationEngine_1.GASD12LintEngine();
connection.onInitialize(() => ({
    capabilities: {
        textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
        documentSymbolProvider: true,
        completionProvider: { triggerCharacters: [' ', ':'] },
        documentFormattingProvider: true,
        documentOnTypeFormattingProvider: { firstTriggerCharacter: '\n', moreTriggerCharacter: [':', ' '] },
        hoverProvider: true,
        definitionProvider: true,
        codeActionProvider: { codeActionKinds: [node_1.CodeActionKind.QuickFix] },
        signatureHelpProvider: { triggerCharacters: ['(', ','] },
    },
}));
function readImport(uri) {
    const openDocument = documents.get(uri);
    if (openDocument)
        return openDocument.getText();
    try {
        const url = new URL(uri);
        return url.protocol === 'file:' ? (0, node_fs_1.readFileSync)(url, 'utf8') : undefined;
    }
    catch {
        return undefined;
    }
}
function validateDocument(document) {
    connection.sendDiagnostics({ uri: document.uri, diagnostics: lintEngine.validateDocument(document, readImport) });
}
function revalidateImporters(changedUri) {
    for (const document of documents.all()) {
        if (document.uri !== changedUri && document.getText().includes('IMPORT') && document.getText().includes('CONTRACT')) {
            validateDocument(document);
        }
    }
}
documents.onDidChangeContent(({ document }) => {
    validateDocument(document);
    revalidateImporters(document.uri);
});
documents.onDidClose(({ document }) => {
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    revalidateImporters(document.uri);
});
connection.onDidChangeWatchedFiles(() => revalidateImporters());
connection.onDocumentSymbol(({ textDocument }) => {
    const source = documents.get(textDocument.uri)?.getText();
    if (source === undefined)
        return [];
    return (0, contracts_1.exportContractAst)(source, 'syntax').map(contract => node_1.DocumentSymbol.create(contract.name, 'CONTRACT', node_1.SymbolKind.Class, contract.range, contract.selectionRange, contract.behaviors.map(entry => node_1.DocumentSymbol.create(entry.name, 'CASE', node_1.SymbolKind.Method, entry.range, entry.range))));
});
const guardHelp = 'A CASE guard on supplied inputs. All WHEN clauses must precede case outcomes. Guards are evaluated in source order, stopping at the first false guard.';
connection.onCompletion(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri);
    if (!document)
        return [];
    const entryPointItems = (0, entrypoint_1.entryPointCompletions)(document, position);
    if (entryPointItems.length || !(0, contracts_1.isCaseClauseLine)(document.getText(), position.line))
        return entryPointItems;
    const prefix = document.getText(node_1.Range.create(position.line, 0, position.line, position.character));
    const match = /^(\s*)(\w*)$/.exec(prefix);
    if (!match || !'WHEN'.startsWith(match[2].toUpperCase()))
        return [];
    const suffix = document.getText(node_1.Range.create(position, node_1.Position.create(position.line + 1, 0)));
    const remainingWord = /^\w*/.exec(suffix)[0];
    if (!'WHEN'.startsWith((match[2] + remainingWord).toUpperCase()))
        return [];
    const end = position.character + remainingWord.length;
    const colon = /^\s*:/.test(suffix.slice(remainingWord.length));
    return [{
            label: 'WHEN', kind: node_1.CompletionItemKind.Keyword, detail: guardHelp,
            textEdit: node_1.TextEdit.replace(node_1.Range.create(position.line, match[1].length, position.line, end), colon ? 'WHEN' : 'WHEN:'),
        }];
});
connection.onHover(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri);
    if (!document)
        return null;
    const entrypoint = (0, entrypoint_1.entryPointKeywordRange)(document, position.line);
    if (entrypoint && position.character <= entrypoint.end.character) {
        return { range: entrypoint, contents: { kind: node_1.MarkupKind.Markdown, value: `**ENTRYPOINT** · ${entrypoint_1.entryPointHelp}` } };
    }
    const text = (0, source_1.uncomment)(document.getText()).split(/\r?\n/)[position.line] ?? '';
    const retry = /@retry\b/.exec((0, source_1.maskStrings)(text));
    if (retry && position.character >= retry.index && position.character <= retry.index + retry[0].length) {
        return { contents: {
                kind: node_1.MarkupKind.Markdown,
                value: '**@retry(n)**\n\n**Structural** · A retry wrapper is present with count n.\n\n'
                    + '**Runtime** · Injected failures trigger retries.\n\n**Environment** · The operation is idempotent.',
            } };
    }
    if (!(0, contracts_1.isCaseClauseLine)(document.getText(), position.line))
        return null;
    const start = /^\s*WHEN\b/.exec(document.getText(node_1.Range.create(position.line, 0, position.line + 1, 0)));
    if (!start || position.character < start[0].length - 4 || position.character > start[0].length)
        return null;
    return { contents: { kind: node_1.MarkupKind.Markdown, value: `**WHEN** · ${guardHelp}` } };
});
connection.onDefinition(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri);
    return document ? (0, entrypoint_1.entryPointAt)(document, position) : null;
});
connection.onSignatureHelp(() => null);
connection.onCodeAction(({ textDocument, context }) => context.diagnostics
    .filter(diagnostic => diagnostic.code === entrypoint_1.entryPointCaseCode)
    .map(diagnostic => ({
    ...node_1.CodeAction.create('Change to ENTRYPOINT', { changes: {
            [textDocument.uri]: [node_1.TextEdit.replace(diagnostic.range, 'ENTRYPOINT')],
        } }, node_1.CodeActionKind.QuickFix),
    diagnostics: [diagnostic],
})));
function guardCaseEdit(document, line) {
    if (line < 0)
        return undefined;
    const text = document.getText(node_1.Range.create(line, 0, line + 1, 0));
    const match = /^(\s*)(WHEN)(?=\s*:)/i.exec(text);
    if (!match || match[2] === 'WHEN' || !(0, contracts_1.isCaseClauseLine)(document.getText(), line))
        return undefined;
    const start = match[1].length;
    return node_1.TextEdit.replace(node_1.Range.create(line, start, line, start + 4), 'WHEN');
}
function keywordCaseEdit(document, line) {
    if (line < 0)
        return undefined;
    const entrypoint = (0, entrypoint_1.entryPointKeywordRange)(document, line);
    if (entrypoint && document.getText(entrypoint) !== 'ENTRYPOINT')
        return node_1.TextEdit.replace(entrypoint, 'ENTRYPOINT');
    return guardCaseEdit(document, line);
}
connection.onDocumentFormatting(({ textDocument }) => {
    const document = documents.get(textDocument.uri);
    if (!document)
        return [];
    const edits = [];
    for (let line = 0; line < document.lineCount; line++) {
        const edit = keywordCaseEdit(document, line);
        if (edit)
            edits.push(edit);
    }
    return edits;
});
connection.onDocumentOnTypeFormatting(({ textDocument, position, ch }) => {
    const document = documents.get(textDocument.uri);
    const edit = document && keywordCaseEdit(document, position.line - (ch === '\n' ? 1 : 0));
    return edit ? [edit] : [];
});
connection.onRequest(contractProtocol_1.verifyContractRequest, ({ uri, call }) => {
    const source = readImport(uri);
    if (source === undefined)
        return { status: 'verification-error', matchedCases: [], message: 'Open a GASD document to verify a call.' };
    return (0, contracts_1.verifyContractCall)((0, contracts_1.analyzeContracts)(source, { uri, readImport }), call);
});
connection.onRequest(contractProtocol_1.exportContractAstRequest, ({ uri, mode }) => {
    const source = readImport(uri);
    return source === undefined ? [] : (0, contracts_1.exportContractAst)(source, mode, { uri, readImport });
});
connection.onRequest(executableProtocol_1.validateExecutableRequest, (request) => {
    if (!(0, executableProtocol_1.isExecutableRequest)(request)) {
        throw new node_1.ResponseError(node_1.ErrorCodes.InvalidParams, 'Executable validation requires at least one source URI.');
    }
    return (0, executable_1.validateExecutable)(request, documents.all(), lintEngine);
});
documents.listen(connection);
connection.listen();
//# sourceMappingURL=server.js.map