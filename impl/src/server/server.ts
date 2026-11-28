import { readFileSync } from 'node:fs';
import {
    CodeAction, CodeActionKind, CompletionItemKind, createConnection, DocumentSymbol, ErrorCodes, Hover, InitializeResult,
    MarkupKind, Position, ProposedFeatures, Range, ResponseError, SymbolKind, TextDocumentSyncKind, TextDocuments, TextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { exportContractAstRequest, verifyContractRequest } from '../shared/contractProtocol';
import type { ContractCallRequest } from '../shared/contractProtocol';
import { isExecutableRequest, validateExecutableRequest } from '../shared/executableProtocol';
import { GASD12LintEngine } from './ValidationEngine';
import { analyzeContracts, exportContractAst, isCaseClauseLine, verifyContractCall } from './contracts';
import { entryPointAt, entryPointCaseCode, entryPointCompletions, entryPointHelp, entryPointKeywordRange } from './entrypoint';
import { validateExecutable } from './executable';
import { maskStrings, uncomment } from './source';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const lintEngine = new GASD12LintEngine();

connection.onInitialize((): InitializeResult => ({
    capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentSymbolProvider: true,
        completionProvider: { triggerCharacters: [' ', ':'] },
        documentFormattingProvider: true,
        documentOnTypeFormattingProvider: { firstTriggerCharacter: '\n', moreTriggerCharacter: [':', ' '] },
        hoverProvider: true,
        definitionProvider: true,
        codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
        signatureHelpProvider: { triggerCharacters: ['(', ','] },
    },
}));

function readImport(uri: string): string | undefined {
    const openDocument = documents.get(uri);
    if (openDocument) return openDocument.getText();
    try {
        const url = new URL(uri);
        return url.protocol === 'file:' ? readFileSync(url, 'utf8') : undefined;
    } catch { return undefined; }
}

function validateDocument(document: TextDocument): void {
    connection.sendDiagnostics({ uri: document.uri, diagnostics: lintEngine.validateDocument(document, readImport) });
}

function revalidateImporters(changedUri?: string): void {
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

connection.onDocumentSymbol(({ textDocument }): DocumentSymbol[] => {
    const source = documents.get(textDocument.uri)?.getText();
    if (source === undefined) return [];
    return exportContractAst(source, 'syntax').map(contract => DocumentSymbol.create(
        contract.name, 'CONTRACT', SymbolKind.Class, contract.range, contract.selectionRange,
        contract.behaviors.map(entry => DocumentSymbol.create(entry.name, 'CASE', SymbolKind.Method, entry.range, entry.range)),
    ));
});

const guardHelp = 'A CASE guard on supplied inputs. All WHEN clauses must precede case outcomes. Guards are evaluated in source order, stopping at the first false guard.';

connection.onCompletion(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri);
    if (!document) return [];
    const entryPointItems = entryPointCompletions(document, position);
    if (entryPointItems.length || !isCaseClauseLine(document.getText(), position.line)) return entryPointItems;
    const prefix = document.getText(Range.create(position.line, 0, position.line, position.character));
    const match = /^(\s*)(\w*)$/.exec(prefix);
    if (!match || !'WHEN'.startsWith(match[2].toUpperCase())) return [];
    const suffix = document.getText(Range.create(position, Position.create(position.line + 1, 0)));
    const remainingWord = /^\w*/.exec(suffix)![0];
    if (!'WHEN'.startsWith((match[2] + remainingWord).toUpperCase())) return [];
    const end = position.character + remainingWord.length;
    const colon = /^\s*:/.test(suffix.slice(remainingWord.length));
    return [{
        label: 'WHEN', kind: CompletionItemKind.Keyword, detail: guardHelp,
        textEdit: TextEdit.replace(Range.create(position.line, match[1].length, position.line, end), colon ? 'WHEN' : 'WHEN:'),
    }];
});

connection.onHover(({ textDocument, position }): Hover | null => {
    const document = documents.get(textDocument.uri);
    if (!document) return null;
    const entrypoint = entryPointKeywordRange(document, position.line);
    if (entrypoint && position.character <= entrypoint.end.character) {
        return { range: entrypoint, contents: { kind: MarkupKind.Markdown, value: `**ENTRYPOINT** · ${entryPointHelp}` } };
    }
    const text = uncomment(document.getText()).split(/\r?\n/)[position.line] ?? '';
    const retry = /@retry\b/.exec(maskStrings(text));
    if (retry && position.character >= retry.index && position.character <= retry.index + retry[0].length) {
        return { contents: {
            kind: MarkupKind.Markdown,
            value: '**@retry(n)**\n\n**Structural** · A retry wrapper is present with count n.\n\n'
                + '**Runtime** · Injected failures trigger retries.\n\n**Environment** · The operation is idempotent.',
        } };
    }
    if (!isCaseClauseLine(document.getText(), position.line)) return null;
    const start = /^\s*WHEN\b/.exec(document.getText(Range.create(position.line, 0, position.line + 1, 0)));
    if (!start || position.character < start[0].length - 4 || position.character > start[0].length) return null;
    return { contents: { kind: MarkupKind.Markdown, value: `**WHEN** · ${guardHelp}` } };
});
connection.onDefinition(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri);
    return document ? entryPointAt(document, position) : null;
});
connection.onSignatureHelp(() => null);
connection.onCodeAction(({ textDocument, context }) => context.diagnostics
    .filter(diagnostic => diagnostic.code === entryPointCaseCode)
    .map(diagnostic => ({
        ...CodeAction.create('Change to ENTRYPOINT', { changes: {
            [textDocument.uri]: [TextEdit.replace(diagnostic.range, 'ENTRYPOINT')],
        } }, CodeActionKind.QuickFix),
        diagnostics: [diagnostic],
    })));

function guardCaseEdit(document: TextDocument, line: number): TextEdit | undefined {
    if (line < 0) return undefined;
    const text = document.getText(Range.create(line, 0, line + 1, 0));
    const match = /^(\s*)(WHEN)(?=\s*:)/i.exec(text);
    if (!match || match[2] === 'WHEN' || !isCaseClauseLine(document.getText(), line)) return undefined;
    const start = match[1].length;
    return TextEdit.replace(Range.create(line, start, line, start + 4), 'WHEN');
}

function keywordCaseEdit(document: TextDocument, line: number): TextEdit | undefined {
    if (line < 0) return undefined;
    const entrypoint = entryPointKeywordRange(document, line);
    if (entrypoint && document.getText(entrypoint) !== 'ENTRYPOINT') return TextEdit.replace(entrypoint, 'ENTRYPOINT');
    return guardCaseEdit(document, line);
}

connection.onDocumentFormatting(({ textDocument }) => {
    const document = documents.get(textDocument.uri);
    if (!document) return [];
    const edits: TextEdit[] = [];
    for (let line = 0; line < document.lineCount; line++) {
        const edit = keywordCaseEdit(document, line);
        if (edit) edits.push(edit);
    }
    return edits;
});
connection.onDocumentOnTypeFormatting(({ textDocument, position, ch }) => {
    const document = documents.get(textDocument.uri);
    const edit = document && keywordCaseEdit(document, position.line - (ch === '\n' ? 1 : 0));
    return edit ? [edit] : [];
});

connection.onRequest(verifyContractRequest, ({ uri, call }: { uri: string; call: ContractCallRequest }) => {
    const source = readImport(uri);
    if (source === undefined) return { status: 'verification-error', matchedCases: [], message: 'Open a GASD document to verify a call.' };
    return verifyContractCall(analyzeContracts(source, { uri, readImport }), call);
});
connection.onRequest(exportContractAstRequest, ({ uri, mode }: { uri: string; mode: 'syntax' | 'semantic' }) => {
    const source = readImport(uri);
    return source === undefined ? [] : exportContractAst(source, mode, { uri, readImport });
});
connection.onRequest(validateExecutableRequest, (request: unknown) => {
    if (!isExecutableRequest(request)) {
        throw new ResponseError(ErrorCodes.InvalidParams, 'Executable validation requires at least one source URI.');
    }
    return validateExecutable(request, documents.all(), lintEngine);
});

documents.listen(connection);
connection.listen();
