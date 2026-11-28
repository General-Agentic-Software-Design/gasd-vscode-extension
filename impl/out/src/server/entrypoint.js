"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateEntryPointCode = exports.entryPointCaseCode = exports.entryPointHelp = void 0;
exports.duplicateEntryPoint = duplicateEntryPoint;
exports.analyzeEntryPoints = analyzeEntryPoints;
exports.entryPointAt = entryPointAt;
exports.entryPointCompletions = entryPointCompletions;
exports.entryPointKeywordRange = entryPointKeywordRange;
const node_1 = require("vscode-languageserver/node");
const syntax_1 = require("./contracts/syntax");
const source_1 = require("./source");
exports.entryPointHelp = 'Selects the local FLOW invoked once when the executable launches. Available in GASD 1.2.';
exports.entryPointCaseCode = 'entrypoint-keyword-case';
exports.duplicateEntryPointCode = 'duplicate-entrypoint';
const keyword = 'ENTRYPOINT';
const directiveStart = /^(ENTRYPOINT)(?![A-Za-z0-9_#.-])/i;
const directive = new RegExp(`^ENTRYPOINT[\\t ]*:[\\t ]*(${source_1.gasdIdentifier})$`, 'i');
const flowStart = new RegExp(`^FLOW[\\t ]+(${source_1.gasdIdentifier})(?=[\\t (:]|$)`);
const identifierCharacters = /[A-Za-z0-9_#.-]*$/;
function report(range, message, code) {
    return { range, message, code, severity: node_1.DiagnosticSeverity.Error, source: 'GASD 1.2' };
}
function duplicateEntryPoint(range, executable = false) {
    return report(range, `Duplicate ENTRYPOINT. Only one declaration is allowed per ${executable ? 'executable' : 'document'}.`, exports.duplicateEntryPointCode);
}
function analyzeEntryPoints(document, roots = (0, source_1.lineTree)(document.getText())) {
    const entrypoints = [];
    const diagnostics = [];
    const topLevel = roots.filter(line => line.indent === 0);
    const version = /^VERSION[\t ]+1\.2(?:\.0)?$/.test(topLevel[0]?.text ?? '');
    let contextSeen = false;
    let targetSeen = false;
    for (const line of topLevel) {
        contextSeen ||= /^CONTEXT[\t ]*:/.test(line.text);
        targetSeen ||= /^TARGET[\t ]*:/.test(line.text);
        const start = directiveStart.exec(line.text);
        if (!start)
            continue;
        const name = directive.exec(line.text)?.[1] ?? null;
        const nameStart = name === null ? null : line.range.end.character - name.length;
        const nameRange = nameStart === null ? null : node_1.Range.create(line.range.start.line, nameStart, line.range.end.line, line.range.end.character);
        entrypoints.push({ name, location: node_1.Location.create(document.uri, line.range), nameRange });
        if (start[1] !== keyword) {
            const caseRange = node_1.Range.create(line.range.start, node_1.Position.create(line.range.start.line, line.range.start.character + keyword.length));
            diagnostics.push(report(caseRange, 'Use uppercase ENTRYPOINT.', exports.entryPointCaseCode));
        }
        if (!version)
            diagnostics.push(report(line.range, 'ENTRYPOINT requires VERSION 1.2.', 'entrypoint-version'));
        if (!contextSeen || !targetSeen) {
            diagnostics.push(report(line.range, 'ENTRYPOINT must follow CONTEXT and TARGET.', 'entrypoint-placement'));
        }
        if (name === null || line.children.length) {
            diagnostics.push(report(line.range, 'ENTRYPOINT requires one unquoted FLOW identifier on the directive line.', 'entrypoint-syntax'));
        }
    }
    let entrypoint = null;
    if (entrypoints.length > 1) {
        diagnostics.push(...entrypoints.map(declaration => duplicateEntryPoint(declaration.location.range)));
    }
    if (entrypoints.length === 1 && !diagnostics.length) {
        const declaration = entrypoints[0];
        const matches = topLevel.filter(line => flowStart.exec(line.text)?.[1] === declaration.name);
        if (matches.length !== 1) {
            diagnostics.push(report(declaration.nameRange, matches.length
                ? `ENTRYPOINT '${declaration.name}' is ambiguous. It must match exactly one local FLOW.`
                : `ENTRYPOINT '${declaration.name}' must name a local FLOW in the same document.`, 'entrypoint-flow'));
        }
        else {
            const flow = matches[0];
            const match = flowStart.exec(flow.text);
            const signatureError = (0, syntax_1.checkFlowSignature)(flow.text.slice(match[0].length));
            if (signatureError) {
                diagnostics.push(report(flow.range, `Invalid FLOW '${match[1]}'. ${signatureError}`, 'flow-signature'));
            }
            else {
                const start = flow.range.start.character + match[0].length - match[1].length;
                const range = node_1.Range.create(flow.range.start.line, start, flow.range.start.line, start + match[1].length);
                entrypoint = { name: match[1], declaration: declaration.location, flow: node_1.Location.create(document.uri, range) };
            }
        }
    }
    return { roots, entrypoints, entrypoint, diagnostics };
}
function entryPointAt(document, position) {
    const line = document.getText(node_1.Range.create(position.line, 0, position.line + 1, 0));
    if (!directiveStart.test(line.trimEnd()))
        return null;
    const analysis = analyzeEntryPoints(document);
    const range = analysis.entrypoints[0]?.nameRange;
    return range && range.start.line === position.line && range.start.character <= position.character
        && range.end.character >= position.character ? analysis.entrypoint?.flow ?? null : null;
}
function entryPointCompletions(document, position) {
    const line = (0, source_1.uncomment)(document.getText()).split(/\r?\n/)[position.line];
    if (line === undefined)
        return [];
    const prefix = line.slice(0, position.character);
    const suffix = line.slice(position.character);
    const value = prefix.match(/^ENTRYPOINT[\t ]*:[\t ]*([A-Za-z0-9_#.-]*)$/i);
    const word = /^[A-Za-z]*$/.test(prefix) ? /^[A-Za-z]*/.exec(suffix)[0] : null;
    if (!value && (word === null || !keyword.startsWith((prefix + word).toUpperCase())))
        return [];
    const roots = (0, source_1.lineTree)(document.getText()).filter(root => root.indent === 0);
    if (!/^VERSION[\t ]+1\.2(?:\.0)?$/.test(roots[0]?.text ?? ''))
        return [];
    if (!value) {
        const hasColon = /^[\t ]*:/.test(suffix.slice(word.length));
        return [{
                label: keyword, kind: node_1.CompletionItemKind.Keyword, detail: exports.entryPointHelp,
                textEdit: node_1.TextEdit.replace(node_1.Range.create(position.line, 0, position.line, position.character + word.length), hasColon ? keyword : `${keyword}: `),
            }];
    }
    const rest = /^[A-Za-z0-9_#.-]*/.exec(suffix)[0];
    const start = prefix.search(identifierCharacters);
    const range = node_1.Range.create(position.line, start, position.line, position.character + rest.length);
    const candidates = roots.flatMap(root => flowStart.exec(root.text)?.[1] ?? []);
    return [...new Set(candidates)].filter(name => name.startsWith(value[1])).map(name => ({
        label: name, kind: node_1.CompletionItemKind.Function,
        textEdit: node_1.TextEdit.replace(range, name),
    }));
}
function entryPointKeywordRange(document, line) {
    const text = document.getText(node_1.Range.create(line, 0, line + 1, 0));
    if (!/^(ENTRYPOINT)[\t ]*:/i.test(text))
        return undefined;
    const declaration = analyzeEntryPoints(document).entrypoints.find(item => item.location.range.start.line === line);
    return declaration ? node_1.Range.create(line, 0, line, keyword.length) : undefined;
}
//# sourceMappingURL=entrypoint.js.map