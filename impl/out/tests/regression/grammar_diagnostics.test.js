"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Regression Test: Exhaustive Keyword Support (#REG-001)
 * Ensures all GASD 1.2 keywords are recognized and do not trigger false positive diagnostics.
 */
describe('Regression: Exhaustive Keyword Support', () => {
    it('Should have zero errors for exhaustive_keywords.gasd', async function () {
        this.timeout(20000); // Extension activation can be slow
        const fixturePath = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'exhaustive_keywords.gasd');
        const uri = vscode.Uri.file(fixturePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        // Wait for LSP to process the file
        await new Promise(resolve => setTimeout(resolve, 5000));
        const diagnostics = vscode.languages.getDiagnostics(uri);
        // Filter for Errors only (Warnings might be acceptable for some patterns)
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        if (errors.length > 0) {
            console.error('Found unexpected diagnostics for exhaustive_keywords.gasd:');
            errors.forEach(d => {
                console.error(`[Line ${d.range.start.line + 1}] ${d.message}`);
            });
        }
        assert.strictEqual(errors.length, 0, 'Exhaustive keyword list should not produce any Error diagnostics');
    });
    it('Should correctly categorize INVARIANT with LOCAL scope', async () => {
        const fixturePath = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'exhaustive_keywords.gasd');
        const uri = vscode.Uri.file(fixturePath);
        const diagnostics = vscode.languages.getDiagnostics(uri);
        // LINT-003: Invariant missing explicit LOCAL or GLOBAL scope mapping.
        const lint003 = diagnostics.filter(d => d.code === 'LINT-003');
        assert.strictEqual(lint003.length, 0, 'INVARIANT LOCAL should not trigger LINT-003');
    });
    it('Should correctly recognize ACHIEVE with POSTCONDITION', async () => {
        const fixturePath = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'exhaustive_keywords.gasd');
        const uri = vscode.Uri.file(fixturePath);
        const diagnostics = vscode.languages.getDiagnostics(uri);
        // LINT-001: Missing POSTCONDITION explicitly tied to ACHIEVE block.
        const lint001 = diagnostics.filter(d => d.code === 'LINT-001');
        assert.strictEqual(lint001.length, 0, 'ACHIEVE with POSTCONDITION should not trigger LINT-001');
    });
});
//# sourceMappingURL=grammar_diagnostics.test.js.map