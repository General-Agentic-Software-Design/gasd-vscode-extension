"use strict";
/**
 * GASD Parser (Expert Strict Implementation)
 * Derived from design/lsp_server.gasd
 * Trace: #AC-9.1, #AC-21.1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const types_js_1 = require("./types.js");
class Parser {
    /** @trace #AC-9.1 */
    parse(content) {
        const diagnostics = [];
        // Basic validation for mandatory directives
        if (!content.includes('CONTEXT:')) {
            diagnostics.push({
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
                message: "Missing mandatory 'CONTEXT:' directive",
                severity: types_js_1.DiagnosticSeverity.Warning
            });
        }
        if (!content.includes('TARGET:')) {
            diagnostics.push({
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 7 } },
                message: "Missing mandatory 'TARGET:' directive",
                severity: types_js_1.DiagnosticSeverity.Warning
            });
        }
        // GASD keywords per GASD 1.0.0 spec (§3-§11)
        const keywords = [
            // Directives (§3)
            'CONTEXT', 'TARGET', 'TRACE', 'NAMESPACE', 'IMPORT', 'AS', 'RESOURCES',
            // Decisions (§4)
            'DECISION', 'CHOSEN', 'RATIONALE', 'ALTERNATIVES', 'AFFECTS',
            // Types (§5)
            'TYPE',
            // Components (§6)
            'COMPONENT', 'PATTERN', 'DEPENDENCIES', 'INTERFACE',
            // Flows (§7)
            'FLOW', 'VALIDATE', 'ENSURE', 'OTHERWISE', 'ACHIEVE', 'CREATE',
            'PERSIST', 'TRANSFORM', 'RETURN', 'LOG', 'ON_ERROR', 'THROW',
            'EXECUTE', 'UPDATE', 'APPLY', 'WITH',
            // Pattern matching (§11)
            'MATCH', 'DEFAULT',
            // Control flow (§7 EBNF)
            'IF', 'ELSE',
            // Strategy (§8)
            'STRATEGY', 'ALGORITHM', 'PRECONDITION', 'COMPLEXITY',
            // Logic (§7 GEP-4)
            'IS', 'NOT', 'AND', 'OR',
            'INPUT', 'OUTPUT', 'SORT_KEY', 'ORDER', 'ASCENDING',
            // Constraints (§9)
            'CONSTRAINT', 'INVARIANT',
            // Human-in-the-Loop (§10)
            'QUESTION', 'APPROVE', 'STATUS', 'BLOCKING',
            'BY', 'DATE', 'NOTES', 'TODO', 'REVIEW'
        ];
        const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
        // Simulating EBNF grammar check (partial)
        const lines = content.split('\n');
        lines.forEach((line, i) => {
            // Check for lowercase keywords and emit specific diagnostics
            keywordRegex.lastIndex = 0;
            let kwMatch;
            while ((kwMatch = keywordRegex.exec(line)) !== null) {
                const word = kwMatch[0];
                const upper = word.toUpperCase();
                if (word !== upper) {
                    // Skip if inside a comment
                    const before = line.substring(0, kwMatch.index);
                    if (before.includes('//') || before.includes('/*'))
                        continue;
                    diagnostics.push({
                        range: {
                            start: { line: i, character: kwMatch.index },
                            end: { line: i, character: kwMatch.index + word.length }
                        },
                        message: `Keyword '${word}' should be '${upper}'`,
                        severity: types_js_1.DiagnosticSeverity.Warning,
                        code: 'keyword-case'
                    });
                }
            }
            if (line.trim().length > 0 && !line.match(/^[A-Za-z_]+:|^\s+|^\/\/|^\/\*|^\*|^\*\/|^\/\/\//)) {
                diagnostics.push({
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
                    message: "Syntax Error: Line does not match GASD EBNF grammar",
                    severity: types_js_1.DiagnosticSeverity.Error
                });
            }
        });
        return {
            ast: { uri: '', version: 1 },
            diagnostics
        };
    }
    /** @trace #AC-19.1 */
    getSymbols(content) {
        const symbols = [];
        const lines = content.split('\n');
        lines.forEach((line, i) => {
            const match = line.match(/^(COMPONENT|TYPE|FLOW|DECISION|STRATEGY)\s+([a-zA-Z_0-9]+)/);
            if (match) {
                const kind = this.mapKind(match[1]);
                symbols.push({
                    name: match[2],
                    kind: kind,
                    location: {
                        uri: '',
                        range: {
                            start: { line: i, character: match.index },
                            end: { line: i, character: line.length }
                        }
                    }
                });
            }
        });
        return symbols;
    }
    mapKind(keyword) {
        switch (keyword) {
            case 'COMPONENT': return types_js_1.SymbolKind.Class;
            case 'TYPE': return types_js_1.SymbolKind.Interface;
            case 'FLOW': return types_js_1.SymbolKind.Function;
            case 'DECISION': return types_js_1.SymbolKind.Event;
            case 'STRATEGY': return types_js_1.SymbolKind.Method;
            default: return types_js_1.SymbolKind.Variable;
        }
    }
}
exports.Parser = Parser;
//# sourceMappingURL=parser.js.map