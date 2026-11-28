"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateExecutable = validateExecutable;
const promises_1 = require("node:fs/promises");
const node_url_1 = require("node:url");
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const entrypoint_1 = require("./entrypoint");
const source_1 = require("./source");
async function canonicalUri(uri) {
    const url = new URL(uri);
    if (url.protocol !== 'file:')
        return url.href;
    try {
        const file = (0, node_url_1.fileURLToPath)(url);
        const canonical = await (0, promises_1.realpath)(file).catch(() => file);
        return (0, node_url_1.pathToFileURL)(canonical).href;
    }
    catch {
        return url.href;
    }
}
async function readSource(uri) {
    const url = new URL(uri);
    if (url.protocol !== 'file:')
        return undefined;
    try {
        return await (0, promises_1.readFile)(url, 'utf8');
    }
    catch {
        return undefined;
    }
}
async function validateExecutable(request, openDocuments, lint) {
    const diagnostics = [];
    const reportSource = (uri, range, message) => diagnostics.push({
        uri,
        diagnostic: { range, message, code: 'executable-source', severity: node_1.DiagnosticSeverity.Error, source: 'GASD 1.2' },
    });
    // Snapshot open buffers before the first asynchronous read.
    const openSources = new Map(openDocuments.map(document => [document.uri, document.getText()]));
    const identities = new Map();
    const resolveUri = async (uri) => {
        const resolved = identities.get(uri) ?? await canonicalUri(uri);
        identities.set(uri, resolved);
        return resolved;
    };
    const canonicalOpenSources = new Map();
    for (const uri of [...openSources.keys()].sort()) {
        const canonical = await resolveUri(uri);
        if (uri === canonical || !canonicalOpenSources.has(canonical)) {
            canonicalOpenSources.set(canonical, openSources.get(uri));
        }
    }
    const sources = new Map();
    const pending = [...new Set(request.uris)].sort().map(uri => ({ uri }));
    const contents = new Map();
    for (let i = 0; i < pending.length; i++) {
        const { uri, importer } = pending[i];
        const canonical = await resolveUri(uri);
        if (!contents.has(canonical)) {
            contents.set(canonical, canonicalOpenSources.get(canonical) ?? await readSource(canonical));
        }
        const text = contents.get(canonical);
        if (text === undefined) {
            if (importer)
                reportSource(importer.uri, importer.range, `Cannot read imported GASD source '${importer.path}'.`);
            else
                reportSource(uri, node_1.Range.create(0, 0, 0, 0), 'Cannot read this GASD source.');
            continue;
        }
        if (sources.has(canonical))
            continue;
        const document = vscode_languageserver_textdocument_1.TextDocument.create(canonical, 'gasd', 0, text);
        const analysis = (0, entrypoint_1.analyzeEntryPoints)(document);
        sources.set(canonical, { ...analysis, document });
        for (const line of analysis.roots) {
            if (line.indent !== 0 || !/^IMPORT(?=\s|$)/.test(line.text))
                continue;
            const imported = (0, source_1.parseSourceImport)(line.text);
            const target = imported && (0, source_1.resolveSourceImport)(imported.path, canonical);
            if (imported && target) {
                pending.push({ uri: target, importer: { uri: canonical, range: line.range, path: imported.path } });
            }
            else {
                reportSource(canonical, line.range, `Cannot resolve GASD import. ${line.text}`);
            }
        }
    }
    const orderedUris = [...sources.keys()].sort();
    const orderedSources = orderedUris.map(uri => sources.get(uri));
    const declarations = orderedSources.flatMap(source => source.entrypoints);
    const readImport = (uri) => contents.get(identities.get(uri) ?? uri);
    for (const source of orderedSources) {
        for (const diagnostic of lint.validateDocument(source.document, readImport, source)) {
            if (diagnostic.code !== entrypoint_1.duplicateEntryPointCode)
                diagnostics.push({ uri: source.document.uri, diagnostic });
        }
    }
    if (declarations.length > 1) {
        for (const { location } of declarations) {
            diagnostics.push({ uri: location.uri, diagnostic: (0, entrypoint_1.duplicateEntryPoint)(location.range, true) });
        }
    }
    const invalid = diagnostics.some(item => item.diagnostic.severity === node_1.DiagnosticSeverity.Error);
    const entrypoint = invalid ? null : orderedSources.find(source => source.entrypoint)?.entrypoint ?? null;
    const ast = !invalid && request.exportAST ? {
        documents: orderedSources.map(source => ({ uri: source.document.uri, entrypoints: source.entrypoints })),
        entrypoint,
    } : null;
    return { diagnostics, entrypoint, ast };
}
//# sourceMappingURL=executable.js.map