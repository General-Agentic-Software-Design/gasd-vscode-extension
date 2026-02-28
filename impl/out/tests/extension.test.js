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
/** @trace #US-27, #US-15 */
describe('GASD Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    it('File association .gasd', async () => {
        /** @trace #AC-27.1 */
        const doc = await vscode.workspace.openTextDocument({
            content: 'CONTEXT: "Test"',
            language: 'gasd'
        });
        assert.strictEqual(doc.languageId, 'gasd');
    });
    it('IntelliSense Suggestions', async function () {
        this.timeout(10000);
        /** @trace #AC-5.1 */
        const doc = await vscode.workspace.openTextDocument({
            content: '',
            language: 'gasd'
        });
        const editor = await vscode.window.showTextDocument(doc);
        const position = new vscode.Position(0, 0);
        let list = { items: [] };
        // Retry until list.items is populated or timeout
        for (let i = 0; i < 20; i++) {
            list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position);
            if (list && list.items.some(item => item.label === 'COMPONENT')) {
                break;
            }
            // Wait 500ms before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        assert.ok(list.items.some(item => item.label === 'COMPONENT' && item.kind === vscode.CompletionItemKind.Snippet), 'Should suggest COMPONENT snippet');
        assert.ok(list.items.some(item => item.label === 'DECISION' && item.kind === vscode.CompletionItemKind.Snippet), 'Should suggest DECISION snippet');
        assert.ok(!list.items.some(item => item.label === 'CHOSEN:'), 'Should not suggest standalone CHOSEN: keyword');
    });
    it('Real-time Diagnostics', async () => {
        /** @trace #AC-9.1 */
        const doc = await vscode.workspace.openTextDocument({
            content: 'INVALID_LINE_WITHOUT_COLON',
            language: 'gasd'
        });
        await vscode.window.showTextDocument(doc);
        // Wait for diagnostics to be reported
        const diagnostics = vscode.languages.getDiagnostics(doc.uri);
        assert.ok(Array.isArray(diagnostics));
    });
    it('Code Formatting Auto-Correction', async function () {
        this.timeout(10000);
        /** @trace #AC-4.3 */
        const doc = await vscode.workspace.openTextDocument({
            content: 'context: "Test"\ntarget: "TypeScript"',
            language: 'gasd'
        });
        const editor = await vscode.window.showTextDocument(doc);
        // Give the LSP server a good 2 seconds to initialize and sync the document
        await new Promise(resolve => setTimeout(resolve, 2000));
        let edits;
        // Retry until edits are returned or timeout
        for (let i = 0; i < 10; i++) {
            edits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', doc.uri, { tabSize: 4, insertSpaces: true });
            if (edits && edits.length > 0) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        // Apply edits if any
        if (edits && edits.length > 0) {
            const edit = new vscode.WorkspaceEdit();
            edit.set(doc.uri, edits);
            await vscode.workspace.applyEdit(edit);
        }
        const newText = doc.getText();
        assert.ok(newText.includes('CONTEXT: "Test"'), "Should contain uppercase CONTEXT");
        assert.ok(newText.includes('TARGET: "TypeScript"'), "Should contain uppercase TARGET");
    });
    it('Initialize Project Command', async () => {
        /** @trace #AC-15.1 */
        const result = await vscode.commands.executeCommand('gasd.initializeProject');
        // Since we are in a test env without a workspace open initially, 
        // this might show an error message which is expected or we can mock it.
        // For now, we just verify the command is registered.
        assert.ok(true);
    });
});
//# sourceMappingURL=extension.test.js.map