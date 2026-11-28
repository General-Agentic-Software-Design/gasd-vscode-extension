import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AnalysisOptions, analyzeContracts } from './contracts';
import { analyzeEntryPoints } from './entrypoint';
import { maskStrings, SourceLine } from './source';

const stepPrefix = /^\d+\.[\t ]+/;

function lint(line: SourceLine, code: string, message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error): Diagnostic {
    return { range: line.range, severity, message, code, source: 'GASD 1.2' };
}

function validateFlowDependencies(flow: SourceLine): Diagnostic[] {
    const steps = new Set<string>();
    const dependencies = new Map<string, { line: SourceLine; references: string[] }>();
    for (const line of flow.children) {
        const step = /^(\d+)\.[\t ]+/.exec(line.text);
        if (!step) continue;
        const id = step[1];
        steps.add(id);
        const code = maskStrings(line.text);
        const depends = /\bDEPENDS_ON[\t ]+((?:STEP[\t ]+\d+)(?:[\t ]*,[\t ]*STEP[\t ]+\d+)*)/.exec(code);
        if (!depends) continue;
        const references = Array.from(depends[1].matchAll(/STEP[\t ]+(\d+)/g), match => match[1]);
        dependencies.set(id, { line, references });
    }

    const diagnostics: Diagnostic[] = [];
    const waitingFor = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const [step, { line, references }] of dependencies) {
        const validReferences = new Set(references.filter(reference => steps.has(reference)));
        for (const reference of new Set(references)) {
            if (!steps.has(reference)) diagnostics.push(lint(line, 'LINT-008', `DEPENDS_ON references missing step ${reference}.`));
        }
        waitingFor.set(step, validReferences.size);
        for (const reference of validReferences) {
            const dependent = dependents.get(reference) ?? [];
            dependent.push(step);
            dependents.set(reference, dependent);
        }
    }
    const ready = [...steps].filter(step => !waitingFor.get(step));
    for (let i = 0; i < ready.length; i++) {
        for (const dependent of dependents.get(ready[i]) ?? []) {
            const waiting = waitingFor.get(dependent)! - 1;
            waitingFor.set(dependent, waiting);
            if (waiting === 0) ready.push(dependent);
        }
    }
    if (ready.length < steps.size) diagnostics.push(lint(flow, 'LINT-009', 'FLOW contains circular DEPENDS_ON references.'));
    return diagnostics;
}

export class GASD12LintEngine {
    public validateDocument(
        document: TextDocument, readImport?: AnalysisOptions['readImport'], parsed = analyzeEntryPoints(document)
    ): Diagnostic[] {
        const diagnostics = [...parsed.diagnostics];
        const is12 = parsed.roots.some(line => line.indent === 0 && /^VERSION\s+1\.2(?:\.\d+)?$/.test(line.text));
        const versionedSeverity = is12 ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning;
        const pending = [...parsed.roots];
        for (let i = 0; i < pending.length; i++) {
            const line = pending[i];
            const action = line.text.replace(stepPrefix, '');
            if (/^ACHIEVE\b(?![\t ]*:)/.test(action)
                && !line.children.some(child => /^POSTCONDITION[\t ]*:/.test(child.text))) {
                diagnostics.push(lint(line, 'LINT-001', 'ACHIEVE requires a POSTCONDITION in GASD 1.2.', versionedSeverity));
            }
            if (/^INVARIANT\b/.test(line.text) && !/^INVARIANT[\t ]+(LOCAL|GLOBAL)\b/.test(line.text)) {
                diagnostics.push(lint(line, 'LINT-003', 'Invariant missing explicit LOCAL or GLOBAL scope mapping.'));
            }
            const code = maskStrings(line.text);
            if (code.includes('@trace') && !code.includes('AS ')) {
                diagnostics.push(lint(line, 'LINT-011', "Every annotation element must map directly to an 'AS Identifier'.", versionedSeverity));
            }
            if (line.indent === 0 && /^FLOW[\t ]/.test(line.text)) diagnostics.push(...validateFlowDependencies(line));
            pending.push(...line.children);
        }
        return diagnostics.concat(analyzeContracts(document.getText(), { uri: document.uri, readImport }).diagnostics);
    }
}
