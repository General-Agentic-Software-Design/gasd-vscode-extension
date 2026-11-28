import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { ExecutableDiagnostic, ExecutableRequest, ExecutableValidation } from '../shared/executableProtocol';
import { analyzeEntryPoints, duplicateEntryPoint, duplicateEntryPointCode } from './entrypoint';
import { parseSourceImport, resolveSourceImport } from './source';
import { GASD12LintEngine } from './ValidationEngine';

interface SourceReference {
    uri: string;
    importer?: { uri: string; range: Range; path: string };
}

async function canonicalUri(uri: string): Promise<string> {
    const url = new URL(uri);
    if (url.protocol !== 'file:') return url.href;
    try {
        const file = fileURLToPath(url);
        const canonical = await realpath(file).catch(() => file);
        return pathToFileURL(canonical).href;
    } catch {
        return url.href;
    }
}

async function readSource(uri: string): Promise<string | undefined> {
    const url = new URL(uri);
    if (url.protocol !== 'file:') return undefined;
    try { return await readFile(url, 'utf8'); }
    catch { return undefined; }
}

export async function validateExecutable(
    request: ExecutableRequest, openDocuments: TextDocument[], lint: GASD12LintEngine
): Promise<ExecutableValidation> {
    const diagnostics: ExecutableDiagnostic[] = [];
    const reportSource = (uri: string, range: Range, message: string) => diagnostics.push({
        uri,
        diagnostic: { range, message, code: 'executable-source', severity: DiagnosticSeverity.Error, source: 'GASD 1.2' },
    });

    // Snapshot open buffers before the first asynchronous read.
    const openSources = new Map(openDocuments.map(document => [document.uri, document.getText()]));
    const identities = new Map<string, string>();
    const resolveUri = async (uri: string) => {
        const resolved = identities.get(uri) ?? await canonicalUri(uri);
        identities.set(uri, resolved);
        return resolved;
    };
    const canonicalOpenSources = new Map<string, string>();
    for (const uri of [...openSources.keys()].sort()) {
        const canonical = await resolveUri(uri);
        if (uri === canonical || !canonicalOpenSources.has(canonical)) {
            canonicalOpenSources.set(canonical, openSources.get(uri)!);
        }
    }

    const sources = new Map<string, ReturnType<typeof analyzeEntryPoints> & { document: TextDocument }>();
    const pending: SourceReference[] = [...new Set(request.uris)].sort().map(uri => ({ uri }));
    const contents = new Map<string, string | undefined>();
    for (let i = 0; i < pending.length; i++) {
        const { uri, importer } = pending[i];
        const canonical = await resolveUri(uri);
        if (!contents.has(canonical)) {
            contents.set(canonical, canonicalOpenSources.get(canonical) ?? await readSource(canonical));
        }
        const text = contents.get(canonical);
        if (text === undefined) {
            if (importer) reportSource(importer.uri, importer.range, `Cannot read imported GASD source '${importer.path}'.`);
            else reportSource(uri, Range.create(0, 0, 0, 0), 'Cannot read this GASD source.');
            continue;
        }
        if (sources.has(canonical)) continue;
        const document = TextDocument.create(canonical, 'gasd', 0, text);
        const analysis = analyzeEntryPoints(document);
        sources.set(canonical, { ...analysis, document });
        for (const line of analysis.roots) {
            if (line.indent !== 0 || !/^IMPORT(?=\s|$)/.test(line.text)) continue;
            const imported = parseSourceImport(line.text);
            const target = imported && resolveSourceImport(imported.path, canonical);
            if (imported && target) {
                pending.push({ uri: target, importer: { uri: canonical, range: line.range, path: imported.path } });
            } else {
                reportSource(canonical, line.range, `Cannot resolve GASD import. ${line.text}`);
            }
        }
    }
    const orderedUris = [...sources.keys()].sort();
    const orderedSources = orderedUris.map(uri => sources.get(uri)!);
    const declarations = orderedSources.flatMap(source => source.entrypoints);
    const readImport = (uri: string) => contents.get(identities.get(uri) ?? uri);
    for (const source of orderedSources) {
        for (const diagnostic of lint.validateDocument(source.document, readImport, source)) {
            if (diagnostic.code !== duplicateEntryPointCode) diagnostics.push({ uri: source.document.uri, diagnostic });
        }
    }
    if (declarations.length > 1) {
        for (const { location } of declarations) {
            diagnostics.push({ uri: location.uri, diagnostic: duplicateEntryPoint(location.range, true) });
        }
    }

    const invalid = diagnostics.some(item => item.diagnostic.severity === DiagnosticSeverity.Error);
    const entrypoint = invalid ? null : orderedSources.find(source => source.entrypoint)?.entrypoint ?? null;
    const ast = !invalid && request.exportAST ? {
        documents: orderedSources.map(source => ({ uri: source.document.uri, entrypoints: source.entrypoints })),
        entrypoint,
    } : null;
    return { diagnostics, entrypoint, ast };
}
