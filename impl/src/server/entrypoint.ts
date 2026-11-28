import { CompletionItem, CompletionItemKind, Diagnostic, DiagnosticSeverity, Location, Position, Range, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { EntryPointDeclaration, ResolvedEntryPoint } from '../shared/executableProtocol';
import { checkFlowSignature } from './contracts/syntax';
import { gasdIdentifier, lineTree, SourceLine, uncomment } from './source';

export const entryPointHelp = 'Selects the local FLOW invoked once when the executable launches. Available in GASD 1.2.';
export const entryPointCaseCode = 'entrypoint-keyword-case';
export const duplicateEntryPointCode = 'duplicate-entrypoint';

const keyword = 'ENTRYPOINT';
const directiveStart = /^(ENTRYPOINT)(?![A-Za-z0-9_#.-])/i;
const directive = new RegExp(`^ENTRYPOINT[\\t ]*:[\\t ]*(${gasdIdentifier})$`, 'i');
const flowStart = new RegExp(`^FLOW[\\t ]+(${gasdIdentifier})(?=[\\t (:]|$)`);
const identifierCharacters = /[A-Za-z0-9_#.-]*$/;

export interface EntryPointAnalysis {
    roots: SourceLine[];
    entrypoints: EntryPointDeclaration[];
    entrypoint: ResolvedEntryPoint | null;
    diagnostics: Diagnostic[];
}

function report(range: Range, message: string, code: string): Diagnostic {
    return { range, message, code, severity: DiagnosticSeverity.Error, source: 'GASD 1.2' };
}

export function duplicateEntryPoint(range: Range, executable = false): Diagnostic {
    return report(range, `Duplicate ENTRYPOINT. Only one declaration is allowed per ${executable ? 'executable' : 'document'}.`, duplicateEntryPointCode);
}

export function analyzeEntryPoints(document: TextDocument, roots = lineTree(document.getText())): EntryPointAnalysis {
    const entrypoints: EntryPointDeclaration[] = [];
    const diagnostics: Diagnostic[] = [];
    const topLevel = roots.filter(line => line.indent === 0);
    const version = /^VERSION[\t ]+1\.2(?:\.0)?$/.test(topLevel[0]?.text ?? '');
    let contextSeen = false;
    let targetSeen = false;
    for (const line of topLevel) {
        contextSeen ||= /^CONTEXT[\t ]*:/.test(line.text);
        targetSeen ||= /^TARGET[\t ]*:/.test(line.text);
        const start = directiveStart.exec(line.text);
        if (!start) continue;

        const name = directive.exec(line.text)?.[1] ?? null;
        const nameStart = name === null ? null : line.range.end.character - name.length;
        const nameRange = nameStart === null ? null : Range.create(
            line.range.start.line, nameStart, line.range.end.line, line.range.end.character);
        entrypoints.push({ name, location: Location.create(document.uri, line.range), nameRange });
        if (start[1] !== keyword) {
            const caseRange = Range.create(line.range.start, Position.create(line.range.start.line, line.range.start.character + keyword.length));
            diagnostics.push(report(caseRange, 'Use uppercase ENTRYPOINT.', entryPointCaseCode));
        }
        if (!version) diagnostics.push(report(line.range, 'ENTRYPOINT requires VERSION 1.2.', 'entrypoint-version'));
        if (!contextSeen || !targetSeen) {
            diagnostics.push(report(line.range, 'ENTRYPOINT must follow CONTEXT and TARGET.', 'entrypoint-placement'));
        }
        if (name === null || line.children.length) {
            diagnostics.push(report(line.range, 'ENTRYPOINT requires one unquoted FLOW identifier on the directive line.', 'entrypoint-syntax'));
        }
    }
    let entrypoint: ResolvedEntryPoint | null = null;
    if (entrypoints.length > 1) {
        diagnostics.push(...entrypoints.map(declaration => duplicateEntryPoint(declaration.location.range)));
    }
    if (entrypoints.length === 1 && !diagnostics.length) {
        const declaration = entrypoints[0];
        const matches = topLevel.filter(line => flowStart.exec(line.text)?.[1] === declaration.name);
        if (matches.length !== 1) {
            diagnostics.push(report(declaration.nameRange!, matches.length
                ? `ENTRYPOINT '${declaration.name}' is ambiguous. It must match exactly one local FLOW.`
                : `ENTRYPOINT '${declaration.name}' must name a local FLOW in the same document.`, 'entrypoint-flow'));
        } else {
            const flow = matches[0];
            const match = flowStart.exec(flow.text)!;
            const signatureError = checkFlowSignature(flow.text.slice(match[0].length));
            if (signatureError) {
                diagnostics.push(report(flow.range, `Invalid FLOW '${match[1]}'. ${signatureError}`, 'flow-signature'));
            } else {
                const start = flow.range.start.character + match[0].length - match[1].length;
                const range = Range.create(flow.range.start.line, start, flow.range.start.line, start + match[1].length);
                entrypoint = { name: match[1], declaration: declaration.location, flow: Location.create(document.uri, range) };
            }
        }
    }
    return { roots, entrypoints, entrypoint, diagnostics };
}

export function entryPointAt(document: TextDocument, position: Position): Location | null {
    const line = document.getText(Range.create(position.line, 0, position.line + 1, 0));
    if (!directiveStart.test(line.trimEnd())) return null;
    const analysis = analyzeEntryPoints(document);
    const range = analysis.entrypoints[0]?.nameRange;
    return range && range.start.line === position.line && range.start.character <= position.character
        && range.end.character >= position.character ? analysis.entrypoint?.flow ?? null : null;
}

export function entryPointCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const line = uncomment(document.getText()).split(/\r?\n/)[position.line];
    if (line === undefined) return [];
    const prefix = line.slice(0, position.character);
    const suffix = line.slice(position.character);
    const value = prefix.match(/^ENTRYPOINT[\t ]*:[\t ]*([A-Za-z0-9_#.-]*)$/i);
    const word = /^[A-Za-z]*$/.test(prefix) ? /^[A-Za-z]*/.exec(suffix)![0] : null;
    if (!value && (word === null || !keyword.startsWith((prefix + word).toUpperCase()))) return [];

    const roots = lineTree(document.getText()).filter(root => root.indent === 0);
    if (!/^VERSION[\t ]+1\.2(?:\.0)?$/.test(roots[0]?.text ?? '')) return [];
    if (!value) {
        const hasColon = /^[\t ]*:/.test(suffix.slice(word!.length));
        return [{
            label: keyword, kind: CompletionItemKind.Keyword, detail: entryPointHelp,
            textEdit: TextEdit.replace(Range.create(position.line, 0, position.line, position.character + word!.length),
                hasColon ? keyword : `${keyword}: `),
        }];
    }
    const rest = /^[A-Za-z0-9_#.-]*/.exec(suffix)![0];
    const start = prefix.search(identifierCharacters);
    const range = Range.create(position.line, start, position.line, position.character + rest.length);
    const candidates = roots.flatMap(root => flowStart.exec(root.text)?.[1] ?? []);
    return [...new Set(candidates)].filter(name => name.startsWith(value[1])).map(name => ({
        label: name, kind: CompletionItemKind.Function,
        textEdit: TextEdit.replace(range, name),
    }));
}

export function entryPointKeywordRange(document: TextDocument, line: number): Range | undefined {
    const text = document.getText(Range.create(line, 0, line + 1, 0));
    if (!/^(ENTRYPOINT)[\t ]*:/i.test(text)) return undefined;
    const declaration = analyzeEntryPoints(document).entrypoints.find(item => item.location.range.start.line === line);
    return declaration ? Range.create(line, 0, line, keyword.length) : undefined;
}
