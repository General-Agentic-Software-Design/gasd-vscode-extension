"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GASD12LintEngine = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
class GASD12LintEngine {
    // Core Evaluator #US-39, triggers #US-30, #US-31, #US-33
    validateDocument(document) {
        const text = document.getText();
        const diagnostics = [];
        // Check if file is Legacy 1.1 without VERSION (#US-40)
        const isLegacy = !text.includes('VERSION 1.2');
        const lines = text.split(/\r?\n/g);
        let inFlowStep = false;
        let achPos = -1;
        lines.forEach((line, i) => {
            const trimmed = line.trim();
            // LINT-001: Missing POSTCONDITION for an ACHIEVE statement (#US-30)
            if (trimmed.startsWith('ACHIEVE')) {
                inFlowStep = true;
                achPos = i;
            }
            // If we're inside a flow step and reading a new command without seeing POSTCONDITION
            if (inFlowStep && i > achPos) {
                if (trimmed.startsWith('POSTCONDITION:')) {
                    inFlowStep = false; // Resolved
                }
                else if (trimmed !== '' && !trimmed.startsWith('//')) {
                    // Missed postcondition on previous achieve
                    const diagnostic = {
                        severity: isLegacy ? vscode_languageserver_1.DiagnosticSeverity.Warning : vscode_languageserver_1.DiagnosticSeverity.Error,
                        range: {
                            start: { line: achPos, character: 0 },
                            end: { line: achPos, character: lines[achPos].length }
                        },
                        message: `LINT-001: Missing POSTCONDITION explicitly tied to ACHIEVE block.`,
                        code: 'LINT-001',
                        source: 'GASD 1.2'
                    };
                    diagnostics.push(diagnostic);
                    inFlowStep = false;
                }
            }
            // Local Scope (#US-33 LINT-003)
            if (trimmed.startsWith('INVARIANT') && !trimmed.includes('LOCAL') && !trimmed.includes('GLOBAL')) {
                const diagnostic = {
                    severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: trimmed.length }
                    },
                    message: `LINT-003: Invariant missing explicit LOCAL or GLOBAL scope mapping.`,
                    code: 'LINT-003',
                    source: 'GASD 1.2'
                };
                diagnostics.push(diagnostic);
            }
            // Annotation ID (#US-34 LINT-011)
            if (trimmed.includes('@trace') && !trimmed.includes('AS ')) {
                const diagnostic = {
                    severity: isLegacy ? vscode_languageserver_1.DiagnosticSeverity.Warning : vscode_languageserver_1.DiagnosticSeverity.Error,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: trimmed.length }
                    },
                    message: `LINT-011: Every annotation element must map directly to an 'AS Identifier'.`,
                    code: 'LINT-011',
                    source: 'GASD 1.2'
                };
                diagnostics.push(diagnostic);
            }
        });
        // Edge case: unclosed step at end of file
        if (inFlowStep) {
            const diagnostic = {
                severity: isLegacy ? vscode_languageserver_1.DiagnosticSeverity.Warning : vscode_languageserver_1.DiagnosticSeverity.Error,
                range: {
                    start: { line: achPos, character: 0 },
                    end: { line: achPos, character: lines[achPos].length }
                },
                message: `LINT-001: Missing POSTCONDITION explicitly tied to ACHIEVE block.`,
                code: 'LINT-001',
                source: 'GASD 1.2'
            };
            diagnostics.push(diagnostic);
        }
        return diagnostics;
    }
}
exports.GASD12LintEngine = GASD12LintEngine;
//# sourceMappingURL=ValidationEngine.js.map